import { debugLogger, logError, logTiming } from '../utils/debugLogger';

// Implementación simple de EventEmitter compatible con React Native/Web
class SimpleEventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    debugLogger.log('STREAMING', `Event listener added for '${event}'. Total listeners: ${this.events[event].length}`);
  }

  off(event: string, listener: Function): void {
    if (!this.events[event]) return;
    const beforeCount = this.events[event].length;
    this.events[event] = this.events[event].filter(l => l !== listener);
    const afterCount = this.events[event].length;
    if (beforeCount !== afterCount) {
      debugLogger.log('STREAMING', `Event listener removed for '${event}'. Remaining listeners: ${afterCount}`);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    const listenerCount = this.events[event].length;
    debugLogger.log('STREAMING', `Emitting '${event}' to ${listenerCount} listeners`);
    
    this.events[event].forEach((listener, index) => {
      try {
        listener(...args);
      } catch (error) {
        logError(`Error in event listener ${index + 1}/${listenerCount} for '${event}'`, error);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      const count = this.events[event]?.length || 0;
      delete this.events[event];
      debugLogger.log('STREAMING', `Removed all ${count} listeners for '${event}'`);
    } else {
      const totalEvents = Object.keys(this.events).length;
      const totalListeners = Object.values(this.events).reduce((sum, listeners) => sum + listeners.length, 0);
      this.events = {};
      debugLogger.log('STREAMING', `Removed all listeners: ${totalListeners} listeners across ${totalEvents} event types`);
    }
  }

  setMaxListeners(n: number): void {
    debugLogger.log('STREAMING', `Max listeners set to ${n}`);
  }
}

export interface CandleData {
  x: number;          // timestamp
  o: number;          // open
  h: number;          // high
  l: number;          // low
  c: number;          // close
  v?: number;         // volume
}

export interface StreamUpdate {
  symbol: string;
  interval: string;
  candle: CandleData;
  isFinal: boolean;   // true si la vela está cerrada
}

export type TimeInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M';

export interface StreamingConfig {
  symbol: string;
  interval: TimeInterval;
  limit?: number;     // cantidad de velas históricas
}

class LiveStreamingService extends SimpleEventEmitter {
  private ws: WebSocket | null = null;
  private activeStreams = new Map<string, StreamingConfig>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 8;
  private reconnectDelay = 2000;
  private candleBuffer = new Map<string, CandleData[]>();
  private isConnected = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private usePollingFallback = false;
  private debounceUpdates = new Map<string, NodeJS.Timeout>();
  private pendingUpdates = new Map<string, StreamUpdate>();
  
  // NUEVOS: Estado detallado para debugging exhaustivo
  private connectionStartTime: number = 0;
  private lastMessageTime: number = 0;
  private messageCount: number = 0;
  private errorCount: number = 0;
  private apiCallCount: number = 0;
  private successfulApiCalls: number = 0;
  private failedApiCalls: number = 0;
  private dataQualityMetrics = new Map<string, {
    totalUpdates: number;
    finalUpdates: number;
    duplicates: number;
    outOfOrder: number;
    lastPrice: number;
    priceChanges: number;
  }>();

  constructor() {
    super();
    this.setMaxListeners(50); // Permitir más listeners
    debugLogger.log('STREAMING', 'LiveStreamingService initialized', {
      maxReconnectAttempts: this.maxReconnectAttempts,
      reconnectDelay: this.reconnectDelay,
      maxListeners: 50
    });
  }

  private getStreamKey(symbol: string, interval: TimeInterval): string {
    return `${symbol.toLowerCase()}@kline_${interval}`;
  }

  private getReadyStateText(readyState: number): string {
    const states = {
      0: 'CONNECTING',
      1: 'OPEN',
      2: 'CLOSING',
      3: 'CLOSED'
    };
    return states[readyState as keyof typeof states] || `UNKNOWN(${readyState})`;
  }

  private getBinanceWsUrl(): string {
    // Intentar diferentes URLs de Binance para evitar bloqueos
    const urls = [
      'wss://stream.binance.com:9443/ws/',
      'wss://stream.binance.com/ws/',
      'wss://data-stream.binance.vision/ws/',
      'wss://dstream.binance.com/ws/'
    ];
    
    // Rotar URL basado en intentos de reconexión
    const urlIndex = this.reconnectAttempts % urls.length;
    const selectedUrl = urls[urlIndex];
    
    debugLogger.log('STREAMING', 'WebSocket URL selection', {
      attempt: this.reconnectAttempts,
      urlIndex: urlIndex + 1,
      totalUrls: urls.length,
      selectedUrl,
      allUrls: urls,
      rotationStrategy: 'round-robin_by_reconnect_attempts'
    });
    
    return selectedUrl;
  }

  private getHistoricalDataUrl(symbol: string, interval: TimeInterval, limit: number = 1000): string {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    
    debugLogger.log('STREAMING', 'Historical data URL constructed', {
      symbol,
      interval,
      limit,
      url,
      apiCallCount: this.apiCallCount + 1,
      timestamp: new Date().toLocaleTimeString()
    });
    
    return url;
  }

  async connect(): Promise<void> {
    const connectStartTime = Date.now();
    
    if (this.isConnecting) {
      debugLogger.log('STREAMING', 'Connection already in progress - skipping duplicate connect request', {
        connectionDuration: Date.now() - this.connectionStartTime,
        currentState: 'CONNECTING'
      });
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      debugLogger.log('STREAMING', 'WebSocket already connected - skipping connect request', {
        readyState: this.ws.readyState,
        currentState: 'CONNECTED',
        connectionDuration: Date.now() - this.connectionStartTime
      });
      return;
    }

    this.isConnecting = true;
    this.connectionStartTime = connectStartTime;

    debugLogger.log('STREAMING', 'Starting WebSocket connection attempt', {
      attempt: this.reconnectAttempts + 1,
      maxAttempts: this.maxReconnectAttempts,
      usePollingFallback: this.usePollingFallback,
      activeStreams: this.activeStreams.size,
      lastError: this.errorCount > 0 ? 'Previous errors occurred' : 'No previous errors'
    });

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.getBinanceWsUrl();
        this.ws = new WebSocket(wsUrl);

        debugLogger.log('STREAMING', 'WebSocket instance created', {
          url: wsUrl,
          readyState: this.ws.readyState,
          readyStateText: this.getReadyStateText(this.ws.readyState)
        });

        // Timeout para conexión
        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            const duration = Date.now() - connectStartTime;
            debugLogger.log('STREAMING', 'Connection timeout - switching to polling fallback', {
              timeoutDuration: 10000,
              actualDuration: duration,
              readyState: this.ws.readyState,
              readyStateText: this.getReadyStateText(this.ws.readyState)
            });
            
            this.ws.close();
            this.isConnecting = false;
            this.errorCount++;
            this.startPollingFallback();
            reject(new Error('Connection timeout'));
          }
        }, 10000); // 10 segundos timeout

        this.ws.onopen = () => {
          const duration = Date.now() - connectStartTime;
          clearTimeout(connectionTimeout);
          
          debugLogger.log('STREAMING', 'WebSocket connection established successfully', {
            connectionDuration: duration,
            attempt: this.reconnectAttempts + 1,
            readyState: this.ws!.readyState,
            readyStateText: this.getReadyStateText(this.ws!.readyState),
            activeStreams: this.activeStreams.size
          });
          
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.usePollingFallback = false;
          this.messageCount = 0; // Reset message counter
          this.lastMessageTime = Date.now();
          
          this.stopPollingFallback();
          this.startPing();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.lastMessageTime = Date.now();
          this.messageCount++;
          
          if (this.messageCount % 100 === 0) { // Log every 100 messages to avoid spam
            debugLogger.log('STREAMING', 'Message batch received', {
              messageCount: this.messageCount,
              lastMessageTime: new Date(this.lastMessageTime).toLocaleTimeString(),
              connectionUptime: Date.now() - this.connectionStartTime,
              messagesPerMinute: Math.round((this.messageCount / (Date.now() - this.connectionStartTime)) * 60000)
            });
          }
          
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          const duration = Date.now() - connectStartTime;
          clearTimeout(connectionTimeout);
          this.errorCount++;
          
          logError('WebSocket connection error', {
            error,
            duration,
            attempt: this.reconnectAttempts + 1,
            readyState: this.ws?.readyState,
            readyStateText: this.ws ? this.getReadyStateText(this.ws.readyState) : 'unknown',
            totalErrors: this.errorCount,
            wasConnected: this.isConnected
          });
          
          this.isConnecting = false;
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          const duration = Date.now() - connectStartTime;
          clearTimeout(connectionTimeout);
          
          debugLogger.log('STREAMING', 'WebSocket connection closed', {
            code: event.code,
            reason: event.reason || 'No reason provided',
            wasClean: event.wasClean,
            duration,
            messageCount: this.messageCount,
            connectionUptime: this.isConnected ? Date.now() - this.connectionStartTime : 0,
            willReconnect: this.reconnectAttempts < this.maxReconnectAttempts
          });
          
          this.isConnected = false;
          this.isConnecting = false;
          this.stopPing();
          this.emit('disconnected');
          this.handleReconnect();
        };

      } catch (error) {
        this.isConnecting = false;
        this.errorCount++;
        
        logError('Failed to create WebSocket connection', {
          error,
          duration: Date.now() - connectStartTime,
          totalErrors: this.errorCount
        });
        
        reject(error);
      }
    });
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000); // Ping cada 30 segundos
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
      
      debugLogger.log('STREAMING', 'Initiating reconnection attempt', {
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        delay,
        delayFormula: `${this.reconnectDelay} * 1.5^${this.reconnectAttempts - 1}`,
        activeStreams: this.activeStreams.size,
        streamKeys: Array.from(this.activeStreams.keys()),
        timeSinceLastConnection: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0,
        totalErrors: this.errorCount
      });
      
      setTimeout(() => {
        debugLogger.log('STREAMING', 'Executing reconnection attempt', {
          attempt: this.reconnectAttempts,
          scheduledDelay: delay,
          actualDelay: delay
        });
        
        this.connect().then(() => {
          debugLogger.log('STREAMING', 'Reconnection successful - resubscribing to active streams', {
            attempt: this.reconnectAttempts,
            activeStreams: this.activeStreams.size,
            streamKeys: Array.from(this.activeStreams.keys())
          });
          
          // Re-suscribir a streams activos
          this.resubscribeActiveStreams();
        }).catch((error) => {
          debugLogger.log('STREAMING', 'Reconnection failed - continuing with polling fallback', {
            attempt: this.reconnectAttempts,
            error: error.message,
            activeStreams: this.activeStreams.size,
            willRetryAgain: this.reconnectAttempts < this.maxReconnectAttempts
          });
        });
      }, delay);
    } else {
      debugLogger.log('STREAMING', 'Max reconnection attempts reached - switching to polling mode permanently', {
        totalAttempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        totalErrors: this.errorCount,
        activeStreams: this.activeStreams.size,
        connectionUptime: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0,
        fallbackMode: 'POLLING_PERMANENT'
      });
      
      this.emit('maxReconnectAttemptsReached');
      this.startPollingFallback();
    }
  }

  private startPollingFallback(): void {
    if (this.usePollingFallback) {
      debugLogger.log('STREAMING', 'Polling fallback already active - skipping duplicate start', {
        pollingInterval: this.pollingInterval ? 'EXISTS' : 'NULL',
        activeStreams: this.activeStreams.size
      });
      return;
    }
    
    debugLogger.log('STREAMING', 'Starting polling fallback mode', {
      reason: 'WebSocket_connection_failed_or_unavailable',
      activeStreams: this.activeStreams.size,
      streamKeys: Array.from(this.activeStreams.keys()),
      pollingIntervalMs: 3000,
      candlesPerPoll: 3,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts
    });
    
    this.usePollingFallback = true;
    
    // Polling cada 3 segundos para actualizar datos más frecuentemente
    this.pollingInterval = setInterval(async () => {
      const pollStartTime = Date.now();
      let successfulPolls = 0;
      let failedPolls = 0;
      
      debugLogger.log('STREAMING', 'Starting polling cycle', {
        activeStreamsCount: this.activeStreams.size,
        cycleNumber: Math.floor((Date.now() - this.connectionStartTime) / 3000),
        timeSinceStarted: Date.now() - this.connectionStartTime
      });
      
      for (const [streamKey, config] of this.activeStreams) {
        const streamPollStart = Date.now();
        
        try {
          debugLogger.log('STREAMING', 'Polling stream data', {
            streamKey,
            symbol: config.symbol,
            interval: config.interval,
            requestedCandles: 3
          });
          
          // Obtener las últimas 3 velas para capturar actualizaciones
          const newCandles = await this.loadHistoricalData(config.symbol, config.interval, 3);
          const streamPollDuration = Date.now() - streamPollStart;
          
          if (newCandles && newCandles.length > 0) {
            debugLogger.log('STREAMING', 'Polling data received', {
              streamKey,
              candlesReceived: newCandles.length,
              requestDuration: streamPollDuration,
              latestPrice: newCandles[newCandles.length - 1].c,
              latestTimestamp: new Date(newCandles[newCandles.length - 1].x).toLocaleTimeString()
            });
            
            // Procesar cada vela como una actualización de streaming
            newCandles.forEach((candle, index) => {
              const isLastCandle = index === newCandles.length - 1;
              
              const streamUpdate: StreamUpdate = {
                symbol: config.symbol,
                interval: config.interval,
                candle: {
                  x: candle.x,
                  o: candle.o,
                  h: candle.h,
                  l: candle.l,
                  c: candle.c,
                  v: candle.v
                },
                // La última vela podría no estar finalizada aún
                isFinal: !isLastCandle || this.isCandleLikelyFinalized(candle, config.interval)
              };
              
              // Actualizar buffer y emitir evento
              this.updateCandleBuffer(streamUpdate);
              
              if (isLastCandle) {
                debugLogger.log('STREAMING', 'Processing current candle from polling', {
                  symbol: config.symbol,
                  interval: config.interval,
                  price: candle.c,
                  isFinal: streamUpdate.isFinal,
                  timestamp: new Date(candle.x).toLocaleTimeString()
                });
              }
            });
            
            successfulPolls++;
          } else {
            debugLogger.log('STREAMING', 'No candles received from polling', {
              streamKey,
              requestDuration: streamPollDuration
            });
          }
        } catch (error) {
          failedPolls++;
          this.failedApiCalls++;
          
          logError(`Polling error for ${streamKey}`, {
            streamKey,
            symbol: config.symbol,
            interval: config.interval,
            error: error instanceof Error ? error.message : String(error),
            requestDuration: Date.now() - streamPollStart,
            totalFailedPolls: failedPolls,
            totalFailedApiCalls: this.failedApiCalls
          });
        }
      }
      
      const totalPollDuration = Date.now() - pollStartTime;
      debugLogger.log('STREAMING', 'Polling cycle completed', {
        totalDuration: totalPollDuration,
        successfulPolls,
        failedPolls,
        totalStreams: this.activeStreams.size,
        successRate: this.activeStreams.size > 0 ? Math.round((successfulPolls / this.activeStreams.size) * 100) : 0
      });
    }, 3000); // Reducido a 3 segundos para mejor responsividad
  }

  private isCandleLikelyFinalized(candle: CandleData, interval: string): boolean {
    const now = Date.now();
    const candleTime = candle.x;
    const intervalMs = this.getIntervalInMs(interval);
    
    // Si la vela es de un período que ya debería haber terminado
    const nextCandleTime = candleTime + intervalMs;
    const timeSinceNextCandle = now - nextCandleTime;
    
    // Si han pasado más de 30 segundos desde que debería haber empezado la siguiente vela,
    // consideramos que esta vela está finalizada
    return timeSinceNextCandle > 30000;
  }

  private stopPollingFallback(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.usePollingFallback = false;
    console.log('✅ Polling fallback detenido');
  }

  private resubscribeActiveStreams(): void {
    for (const [streamKey, config] of this.activeStreams) {
      this.subscribeToStream(config.symbol, config.interval);
    }
  }

  private handleMessage(data: string): void {
    const messageStartTime = Date.now();
    
    try {
      debugLogger.log('STREAMING', 'Raw WebSocket message received', {
        messageLength: data.length,
        messageNumber: this.messageCount,
        timeSinceLastMessage: this.lastMessageTime ? Date.now() - this.lastMessageTime : 0
      });
      
      const message = JSON.parse(data);
      
      debugLogger.log('STREAMING', 'WebSocket message parsed', {
        messageType: message.e || 'unknown',
        hasKlineData: !!message.k,
        messageKeys: Object.keys(message),
        processingTime: Date.now() - messageStartTime
      });
      
      if (message.e === 'kline') {
        const klineData = message.k;
        
        debugLogger.log('STREAMING', 'Kline message details', {
          symbol: klineData.s,
          interval: klineData.i,
          isClosed: klineData.x,
          openTime: new Date(klineData.t).toLocaleTimeString(),
          closeTime: new Date(klineData.T).toLocaleTimeString(),
          price: parseFloat(klineData.c),
          volume: parseFloat(klineData.v),
          numberOfTrades: klineData.n,
          messageReceived: new Date().toLocaleTimeString()
        });
        
        const streamUpdate: StreamUpdate = {
          symbol: klineData.s,
          interval: klineData.i,
          candle: {
            x: klineData.t,
            o: parseFloat(klineData.o),
            h: parseFloat(klineData.h),
            l: parseFloat(klineData.l),
            c: parseFloat(klineData.c),
            v: parseFloat(klineData.v)
          },
          isFinal: klineData.x // true cuando la vela está cerrada
        };

        debugLogger.log('STREAMING', 'StreamUpdate created from kline', {
          symbol: streamUpdate.symbol,
          interval: streamUpdate.interval,
          isFinal: streamUpdate.isFinal,
          price: streamUpdate.candle.c,
          timestamp: new Date(streamUpdate.candle.x).toLocaleTimeString(),
          processingTime: Date.now() - messageStartTime
        });

        this.updateCandleBuffer(streamUpdate);
        
        // Actualizar métricas de calidad de datos
        this.updateDataQualityMetrics(streamUpdate);
        
      } else {
        debugLogger.log('STREAMING', 'Non-kline message received', {
          messageType: message.e || 'unknown',
          messageContent: message,
          processingTime: Date.now() - messageStartTime
        });
      }
    } catch (error) {
      this.errorCount++;
      
      logError('Error processing WebSocket message', {
        error: error instanceof Error ? error.message : String(error),
        messageLength: data.length,
        messageNumber: this.messageCount,
        rawMessagePreview: data.substring(0, 200),
        processingTime: Date.now() - messageStartTime,
        totalErrors: this.errorCount
      });
    }
  }

  private updateCandleBuffer(update: StreamUpdate): void {
    const bufferKey = `${update.symbol}_${update.interval}`;
    
    if (!this.candleBuffer.has(bufferKey)) {
      this.candleBuffer.set(bufferKey, []);
    }

    const buffer = this.candleBuffer.get(bufferKey)!;
    
    // Buscar si ya existe una vela para este timestamp
    // Para velas en tiempo real, verificar si es la misma ventana de tiempo
    const candleTimestamp = update.candle.x;
    const existingIndex = buffer.findIndex(candle => {
      // Para actualizaciones en tiempo real, considerar velas de la misma ventana de tiempo
      const timeDiff = Math.abs(candle.x - candleTimestamp);
      const intervalMs = this.getIntervalInMs(update.interval);
      return timeDiff < intervalMs; // Si está dentro del mismo intervalo
    });

    if (existingIndex >= 0) {
      // Actualizar vela existente (típicamente la última vela en tiempo real)
      const oldCandle = buffer[existingIndex];
      buffer[existingIndex] = update.candle;
      
      console.log(`🔄 [LiveStreamingService] Updated candle at index ${existingIndex}: ${update.symbol} ${update.interval}`, {
        oldPrice: oldCandle.c,
        newPrice: update.candle.c,
        isFinal: update.isFinal,
        timestamp: new Date(candleTimestamp).toLocaleTimeString()
      });
    } else {
      // Agregar nueva vela
      buffer.push(update.candle);
      console.log(`➕ [LiveStreamingService] Added new candle: ${update.symbol} ${update.interval}`, {
        price: update.candle.c,
        isFinal: update.isFinal,
        timestamp: new Date(candleTimestamp).toLocaleTimeString(),
        totalCandles: buffer.length
      });
      
      // Mantener solo las últimas 1000 velas en memoria
      if (buffer.length > 1000) {
        buffer.shift();
      }
    }

    // Ordenar por timestamp para asegurar orden correcto
    buffer.sort((a, b) => a.x - b.x);
    
    // NUEVA LÓGICA: Debounce las emisiones para evitar spam
    this.debounceCandleUpdate(update);
    
    // Emitir evento de buffer actualizado para que otros componentes puedan reaccionar
    this.emit('bufferUpdated', {
      symbol: update.symbol,
      interval: update.interval,
      candles: buffer,
      lastUpdate: update.candle,
      isFinal: update.isFinal
    });
  }

  // Nueva función para debounce de actualizaciones
  private debounceCandleUpdate(update: StreamUpdate): void {
    const updateKey = `${update.symbol}_${update.interval}`;
    
    // Guardar la actualización más reciente
    this.pendingUpdates.set(updateKey, update);
    
    // Limpiar timeout existente si hay uno
    const existingTimeout = this.debounceUpdates.get(updateKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Configurar nuevo timeout
    const timeout = setTimeout(() => {
      const pendingUpdate = this.pendingUpdates.get(updateKey);
      if (pendingUpdate) {
        // Emitir solo la última actualización después del debounce
        this.emit('candleUpdate', pendingUpdate);
        // Usar debugLogger en lugar de console.log directo
        // console.log(`📊 [LiveStreamingService] Debounced candle update emitted: ${pendingUpdate.symbol} ${pendingUpdate.interval} price:${pendingUpdate.candle.c}`);
        
        // Limpiar
        this.pendingUpdates.delete(updateKey);
        this.debounceUpdates.delete(updateKey);
      }
    }, 150); // 150ms debounce - suficiente para agrupar actualizaciones rápidas
    
    this.debounceUpdates.set(updateKey, timeout);
  }

  private getIntervalInMs(interval: string): number {
    const intervals: { [key: string]: number } = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
    };
    return intervals[interval] || 60 * 1000;
  }

  private updateDataQualityMetrics(update: StreamUpdate): void {
    const key = `${update.symbol}_${update.interval}`;
    
    if (!this.dataQualityMetrics.has(key)) {
      this.dataQualityMetrics.set(key, {
        totalUpdates: 0,
        finalUpdates: 0,
        duplicates: 0,
        outOfOrder: 0,
        lastPrice: 0,
        priceChanges: 0
      });
    }
    
    const metrics = this.dataQualityMetrics.get(key)!;
    metrics.totalUpdates++;
    
    if (update.isFinal) {
      metrics.finalUpdates++;
    }
    
    if (metrics.lastPrice !== 0 && metrics.lastPrice !== update.candle.c) {
      metrics.priceChanges++;
    }
    
    if (metrics.lastPrice === update.candle.c && metrics.totalUpdates > 1) {
      metrics.duplicates++;
    }
    
    metrics.lastPrice = update.candle.c;
    
    // Log metrics every 50 updates
    if (metrics.totalUpdates % 50 === 0) {
      debugLogger.log('STREAMING', 'Data quality metrics update', {
        stream: key,
        totalUpdates: metrics.totalUpdates,
        finalUpdates: metrics.finalUpdates,
        duplicates: metrics.duplicates,
        priceChanges: metrics.priceChanges,
        duplicateRate: Math.round((metrics.duplicates / metrics.totalUpdates) * 100),
        finalRate: Math.round((metrics.finalUpdates / metrics.totalUpdates) * 100),
        currentPrice: metrics.lastPrice
      });
    }
  }

  async subscribeToStream(symbol: string, interval: TimeInterval): Promise<void> {
    const streamKey = this.getStreamKey(symbol, interval);
    
    // Evitar suscripciones duplicadas
    if (this.activeStreams.has(streamKey)) {
      console.log(`📊 Ya suscrito a ${streamKey}`);
      return;
    }

    try {
      // Cargar datos históricos primero
      await this.loadHistoricalData(symbol, interval);

      // Intentar conexión WebSocket
      if (!this.isConnected && !this.usePollingFallback) {
        try {
          await this.connect();
        } catch (error) {
          console.log('❌ WebSocket falló, usando polling fallback');
          this.startPollingFallback();
        }
      }

      // Si WebSocket está conectado, suscribirse
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const subscribeMessage = {
          method: 'SUBSCRIBE',
          params: [streamKey],
          id: Date.now()
        };

        this.ws.send(JSON.stringify(subscribeMessage));
        console.log(`📊 Suscrito via WebSocket a ${streamKey}`);
      } else if (this.usePollingFallback) {
        console.log(`📊 Suscrito via polling a ${streamKey}`);
      }

      this.activeStreams.set(streamKey, { symbol, interval });
      this.emit('subscribed', { symbol, interval });

    } catch (error) {
      console.error(`❌ Error suscribiéndose a ${streamKey}:`, error);
      throw error;
    }
  }

  async loadHistoricalData(symbol: string, interval: TimeInterval, limit: number = 1000): Promise<CandleData[]> {
    const requestStartTime = Date.now();
    this.apiCallCount++;
    
    debugLogger.log('STREAMING', 'Starting historical data request', {
      symbol,
      interval,
      limit,
      requestNumber: this.apiCallCount,
      isPollingMode: this.usePollingFallback,
      timestamp: new Date().toLocaleTimeString()
    });
    
    try {
      const url = this.getHistoricalDataUrl(symbol, interval, limit);
      
      const fetchStartTime = Date.now();
      const response = await fetch(url);
      const fetchDuration = Date.now() - fetchStartTime;
      
      debugLogger.log('STREAMING', 'API response received', {
        symbol,
        interval,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        fetchDuration,
        url
      });
      
      if (!response.ok) {
        this.failedApiCalls++;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const parseStartTime = Date.now();
      const data = await response.json();
      const parseDuration = Date.now() - parseStartTime;
      
      debugLogger.log('STREAMING', 'API response parsed', {
        symbol,
        interval,
        rawDataLength: Array.isArray(data) ? data.length : 'not_array',
        dataType: typeof data,
        parseDuration,
        isArray: Array.isArray(data),
        hasError: data.code !== undefined,
        errorCode: data.code,
        errorMessage: data.msg
      });
      
      if (data.code !== undefined) {
        // Binance API error response
        this.failedApiCalls++;
        throw new Error(`Binance API Error ${data.code}: ${data.msg}`);
      }
      
      if (!Array.isArray(data)) {
        this.failedApiCalls++;
        throw new Error(`Invalid response format: expected array, got ${typeof data}`);
      }
      
      const processStartTime = Date.now();
      const candles: CandleData[] = data.map((kline: any[], index: number) => {
        if (!Array.isArray(kline) || kline.length < 6) {
          throw new Error(`Invalid kline data at index ${index}: expected array with 6+ elements, got ${typeof kline}`);
        }
        
        return {
          x: kline[0],           // timestamp
          o: parseFloat(kline[1]), // open
          h: parseFloat(kline[2]), // high
          l: parseFloat(kline[3]), // low
          c: parseFloat(kline[4]), // close
          v: parseFloat(kline[5])  // volume
        };
      });
      const processDuration = Date.now() - processStartTime;
      
      // Validate candles data
      const invalidCandles = candles.filter(candle => 
        isNaN(candle.x) || isNaN(candle.o) || isNaN(candle.h) || 
        isNaN(candle.l) || isNaN(candle.c) || (candle.v !== undefined && isNaN(candle.v))
      );
      
      if (invalidCandles.length > 0) {
        logError('Invalid candles detected in API response', {
          symbol,
          interval,
          invalidCount: invalidCandles.length,
          totalCount: candles.length,
          invalidSamples: invalidCandles.slice(0, 3)
        });
      }
      
      const validCandles = candles.filter(candle => 
        !isNaN(candle.x) && !isNaN(candle.o) && !isNaN(candle.h) && 
        !isNaN(candle.l) && !isNaN(candle.c) && (candle.v === undefined || !isNaN(candle.v))
      );

      // Guardar en buffer
      const bufferKey = `${symbol}_${interval}`;
      const oldBuffer = this.candleBuffer.get(bufferKey) || [];
      this.candleBuffer.set(bufferKey, validCandles);
      
      const totalDuration = Date.now() - requestStartTime;
      this.successfulApiCalls++;
      
      debugLogger.log('STREAMING', 'Historical data processed successfully', {
        symbol,
        interval,
        requestedCandles: limit,
        receivedCandles: data.length,
        validCandles: validCandles.length,
        invalidCandles: invalidCandles.length,
        oldBufferSize: oldBuffer.length,
        newBufferSize: validCandles.length,
        fetchDuration,
        parseDuration,
        processDuration,
        totalDuration,
        latestPrice: validCandles.length > 0 ? validCandles[validCandles.length - 1].c : null,
        latestTimestamp: validCandles.length > 0 ? new Date(validCandles[validCandles.length - 1].x).toLocaleTimeString() : null,
        successRate: Math.round((this.successfulApiCalls / this.apiCallCount) * 100)
      });

      this.emit('historicalDataLoaded', { symbol, interval, candles: validCandles });
      
      // Si estamos en modo polling, también emitir actualizaciones individuales para las últimas velas
      if (this.usePollingFallback && validCandles.length > 0) {
        // Comparar con buffer anterior para detectar cambios
        const lastCandle = validCandles[validCandles.length - 1];
        const oldLastCandle = oldBuffer.length > 0 ? oldBuffer[oldBuffer.length - 1] : null;
        
        // Si hay cambios en la última vela o es una vela nueva
        const hasChanges = !oldLastCandle || 
            lastCandle.x !== oldLastCandle.x || 
            lastCandle.c !== oldLastCandle.c ||
            lastCandle.h !== oldLastCandle.h ||
            lastCandle.l !== oldLastCandle.l;
            
        if (hasChanges) {
          debugLogger.log('STREAMING', 'Emitting polling update for latest candle', {
            symbol,
            interval,
            newCandle: lastCandle.x !== oldLastCandle?.x,
            priceChange: oldLastCandle ? lastCandle.c - oldLastCandle.c : 0,
            isFinal: this.isCandleLikelyFinalized(lastCandle, interval)
          });
          
          const streamUpdate: StreamUpdate = {
            symbol,
            interval,
            candle: lastCandle,
            isFinal: this.isCandleLikelyFinalized(lastCandle, interval)
          };
          
          // Emitir como actualización de candela en tiempo real
          setTimeout(() => {
            this.emit('candleUpdate', streamUpdate);
          }, 100); // Pequeño delay para no interferir con historicalDataLoaded
        }
      }
      
      return validCandles;
    } catch (error) {
      const totalDuration = Date.now() - requestStartTime;
      this.failedApiCalls++;
      
      logError('Failed to load historical data', {
        symbol,
        interval,
        limit,
        requestNumber: this.apiCallCount,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        totalDuration,
        isPollingMode: this.usePollingFallback,
        successfulCalls: this.successfulApiCalls,
        failedCalls: this.failedApiCalls,
        successRate: Math.round((this.successfulApiCalls / this.apiCallCount) * 100)
      });
      
      throw error;
    }
  }

  unsubscribeFromStream(symbol: string, interval: TimeInterval): void {
    const streamKey = this.getStreamKey(symbol, interval);

    const unsubscribeMessage = {
      method: 'UNSUBSCRIBE',
      params: [streamKey],
      id: Date.now()
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(unsubscribeMessage));
      this.activeStreams.delete(streamKey);
      console.log(`📊 Desuscrito de ${streamKey}`);
      this.emit('unsubscribed', { symbol, interval });
    }
  }

  getCandleBuffer(symbol: string, interval: TimeInterval): CandleData[] {
    const bufferKey = `${symbol}_${interval}`;
    return this.candleBuffer.get(bufferKey) || [];
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopPing();
    this.stopPollingFallback();
    
    // Limpiar debounce timers
    this.debounceUpdates.forEach(timeout => clearTimeout(timeout));
    this.debounceUpdates.clear();
    this.pendingUpdates.clear();
    
    this.activeStreams.clear();
    this.isConnected = false;
    this.isConnecting = false;
    this.usePollingFallback = false;
    this.reconnectAttempts = 0;
    console.log('🔌 Servicio de streaming desconectado completamente');
  }

  getConnectionStatus(): {
    connected: boolean;
    activeStreams: number;
    reconnectAttempts: number;
    usingPolling: boolean;
    isConnecting: boolean;
  } {
    return {
      connected: this.isConnected,
      activeStreams: this.activeStreams.size,
      reconnectAttempts: this.reconnectAttempts,
      usingPolling: this.usePollingFallback,
      isConnecting: this.isConnecting
    };
  }

  // Método para obtener la última vela de un símbolo
  getLatestCandle(symbol: string, interval: TimeInterval): CandleData | null {
    const buffer = this.getCandleBuffer(symbol, interval);
    return buffer.length > 0 ? buffer[buffer.length - 1] : null;
  }

  // Método para obtener el precio actual
  getCurrentPrice(symbol: string, interval: TimeInterval): number | null {
    const latest = this.getLatestCandle(symbol, interval);
    return latest ? latest.c : null;
  }
}

// Exportar instancia singleton
export const liveStreamingService = new LiveStreamingService();
export default liveStreamingService;
