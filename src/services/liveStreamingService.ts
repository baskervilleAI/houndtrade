// Implementación simple de EventEmitter compatible con React Native/Web
class SimpleEventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: Function): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for '${event}':`, error);
      }
    });
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  setMaxListeners(n: number): void {
    // No-op para compatibilidad
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

  constructor() {
    super();
    this.setMaxListeners(50); // Permitir más listeners
  }

  private getStreamKey(symbol: string, interval: TimeInterval): string {
    return `${symbol.toLowerCase()}@kline_${interval}`;
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
    console.log(`[LiveStreamingService] Usando URL ${urlIndex + 1}/${urls.length}: ${urls[urlIndex]}`);
    return urls[urlIndex];
  }

  private getHistoricalDataUrl(symbol: string, interval: TimeInterval, limit: number = 900): string {
    return `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  }

  async connect(): Promise<void> {
    if (this.isConnecting) {
      console.log('🔄 Conexión ya en progreso, esperando...');
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('📡 WebSocket ya está conectado');
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Conectando al WebSocket de Binance...');
        this.ws = new WebSocket(this.getBinanceWsUrl());

        // Timeout para conexión
        const connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            console.log('⏰ Timeout de conexión WebSocket');
            this.ws.close();
            this.isConnecting = false;
            this.startPollingFallback();
            reject(new Error('Connection timeout'));
          }
        }, 10000); // 10 segundos timeout

        this.ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('✅ WebSocket conectado');
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.usePollingFallback = false;
          this.stopPollingFallback();
          this.startPing();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('❌ Error en WebSocket:', error);
          this.isConnecting = false;
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          clearTimeout(connectionTimeout);
          console.log('🔌 WebSocket desconectado');
          this.isConnected = false;
          this.isConnecting = false;
          this.stopPing();
          this.emit('disconnected');
          this.handleReconnect();
        };

      } catch (error) {
        this.isConnecting = false;
        console.error('❌ Error al conectar WebSocket:', error);
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
      
      console.log(`🔄 Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().then(() => {
          // Re-suscribir a streams activos
          this.resubscribeActiveStreams();
        }).catch(() => {
          console.log('❌ Fallo en reconexión, continuando con polling...');
        });
      }, delay);
    } else {
      console.error('❌ Máximo de intentos de reconexión alcanzado, usando polling');
      this.emit('maxReconnectAttemptsReached');
      this.startPollingFallback();
    }
  }

  private startPollingFallback(): void {
    if (this.usePollingFallback) return;
    
    console.log('🔄 Iniciando fallback a polling para datos en vivo');
    this.usePollingFallback = true;
    
    // Polling cada 3 segundos para actualizar datos más frecuentemente
    this.pollingInterval = setInterval(async () => {
      for (const [streamKey, config] of this.activeStreams) {
        try {
          // Obtener las últimas 3 velas para capturar actualizaciones
          const newCandles = await this.loadHistoricalData(config.symbol, config.interval, 3);
          
          if (newCandles && newCandles.length > 0) {
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
            // Eliminamos la emisión directa - ahora usa debounce
            // this.emit('candleUpdate', streamUpdate);              console.log(`📊 [Polling] ${config.symbol} ${config.interval}: $${candle.c.toFixed(4)} (${isLastCandle ? 'current' : 'historical'})`);
            });
          }
        } catch (error) {
          console.error(`❌ Error en polling para ${streamKey}:`, error);
        }
      }
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
    try {
      const message = JSON.parse(data);
      
      if (message.e === 'kline') {
        const klineData = message.k;
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

        console.log(`[LiveStreamingService] Kline update: ${streamUpdate.symbol} ${streamUpdate.interval} final:${streamUpdate.isFinal} price:${streamUpdate.candle.c}`);

        this.updateCandleBuffer(streamUpdate);
        // Eliminamos la emisión directa aquí - ahora usa debounce
        // this.emit('candleUpdate', streamUpdate);
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje WebSocket:', error);
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
        console.log(`📊 [LiveStreamingService] Debounced candle update emitted: ${pendingUpdate.symbol} ${pendingUpdate.interval} price:${pendingUpdate.candle.c}`);
        
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

  async loadHistoricalData(symbol: string, interval: TimeInterval, limit: number = 900): Promise<CandleData[]> {
    try {
      console.log(`📈 Cargando datos históricos: ${symbol} ${interval}`);
      
      const response = await fetch(this.getHistoricalDataUrl(symbol, interval, limit));
      const data = await response.json();

      const candles: CandleData[] = data.map((kline: any[]) => ({
        x: kline[0],           // timestamp
        o: parseFloat(kline[1]), // open
        h: parseFloat(kline[2]), // high
        l: parseFloat(kline[3]), // low
        c: parseFloat(kline[4]), // close
        v: parseFloat(kline[5])  // volume
      }));

      // Guardar en buffer
      const bufferKey = `${symbol}_${interval}`;
      const oldBuffer = this.candleBuffer.get(bufferKey) || [];
      this.candleBuffer.set(bufferKey, candles);

      console.log(`✅ Cargadas ${candles.length} velas históricas para ${symbol} ${interval}`);
      this.emit('historicalDataLoaded', { symbol, interval, candles });
      
      // Si estamos en modo polling, también emitir actualizaciones individuales para las últimas velas
      if (this.usePollingFallback && candles.length > 0) {
        // Comparar con buffer anterior para detectar cambios
        const lastCandle = candles[candles.length - 1];
        const oldLastCandle = oldBuffer.length > 0 ? oldBuffer[oldBuffer.length - 1] : null;
        
        // Si hay cambios en la última vela o es una vela nueva
        if (!oldLastCandle || 
            lastCandle.x !== oldLastCandle.x || 
            lastCandle.c !== oldLastCandle.c ||
            lastCandle.h !== oldLastCandle.h ||
            lastCandle.l !== oldLastCandle.l) {
          
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
      
      return candles;
    } catch (error) {
      console.error(`❌ Error cargando datos históricos:`, error);
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
