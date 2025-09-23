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
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private candleBuffer = new Map<string, CandleData[]>();
  private isConnected = false;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setMaxListeners(50); // Permitir más listeners
  }

  private getStreamKey(symbol: string, interval: TimeInterval): string {
    return `${symbol.toLowerCase()}@kline_${interval}`;
  }

  private getBinanceWsUrl(): string {
    return 'wss://stream.binance.com:9443/ws/';
  }

  private getHistoricalDataUrl(symbol: string, interval: TimeInterval, limit: number = 100): string {
    return `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  }

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('📡 WebSocket ya está conectado');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Conectando al WebSocket de Binance...');
        this.ws = new WebSocket(this.getBinanceWsUrl());

        this.ws.onopen = () => {
          console.log('✅ WebSocket conectado');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startPing();
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('❌ Error en WebSocket:', error);
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('🔌 WebSocket desconectado');
          this.isConnected = false;
          this.stopPing();
          this.emit('disconnected');
          this.handleReconnect();
        };

      } catch (error) {
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
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`🔄 Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().then(() => {
          // Re-suscribir a streams activos
          this.resubscribeActiveStreams();
        }).catch(console.error);
      }, delay);
    } else {
      console.error('❌ Máximo de intentos de reconexión alcanzado');
      this.emit('maxReconnectAttemptsReached');
    }
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

        this.updateCandleBuffer(streamUpdate);
        this.emit('candleUpdate', streamUpdate);
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
    const existingIndex = buffer.findIndex(candle => candle.x === update.candle.x);

    if (existingIndex >= 0) {
      // Actualizar vela existente
      buffer[existingIndex] = update.candle;
    } else {
      // Agregar nueva vela
      buffer.push(update.candle);
      // Mantener solo las últimas 1000 velas en memoria
      if (buffer.length > 1000) {
        buffer.shift();
      }
    }

    // Ordenar por timestamp
    buffer.sort((a, b) => a.x - b.x);
  }

  async subscribeToStream(symbol: string, interval: TimeInterval): Promise<void> {
    const streamKey = this.getStreamKey(symbol, interval);
    
    // Cargar datos históricos primero
    await this.loadHistoricalData(symbol, interval);

    if (!this.isConnected) {
      await this.connect();
    }

    const subscribeMessage = {
      method: 'SUBSCRIBE',
      params: [streamKey],
      id: Date.now()
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(subscribeMessage));
      this.activeStreams.set(streamKey, { symbol, interval });
      console.log(`📊 Suscrito a ${streamKey}`);
      this.emit('subscribed', { symbol, interval });
    } else {
      throw new Error('WebSocket no está conectado');
    }
  }

  async loadHistoricalData(symbol: string, interval: TimeInterval, limit: number = 100): Promise<CandleData[]> {
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
      this.candleBuffer.set(bufferKey, candles);

      console.log(`✅ Cargadas ${candles.length} velas históricas para ${symbol} ${interval}`);
      this.emit('historicalDataLoaded', { symbol, interval, candles });
      
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
    this.activeStreams.clear();
    this.isConnected = false;
    console.log('🔌 Servicio de streaming desconectado');
  }

  getConnectionStatus(): {
    connected: boolean;
    activeStreams: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      activeStreams: this.activeStreams.size,
      reconnectAttempts: this.reconnectAttempts
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
