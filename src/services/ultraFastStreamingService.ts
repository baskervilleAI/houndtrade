import { binanceService, CandleData } from './binanceService';

interface UltraFastStreamConfig {
  symbol: string;
  interval: string;
  onUpdate: (candle: CandleData) => void;
  onError?: (error: Error) => void;
  cycleDelay?: number; // Delay entre ciclos en ms (default: 10ms)
}

interface ActiveStream {
  config: UltraFastStreamConfig;
  isRunning: boolean;
  cycleCount: number;
  lastUpdate: Date;
  errorCount: number;
  timeoutId?: NodeJS.Timeout;
  requestInProgress: boolean;
}

/**
 * Servicio de streaming ultra-rápido que mantiene un ciclo continuo:
 * API Request → Actualización → 10ms espera → Nueva Request
 */
class UltraFastStreamingService {
  private streams: Map<string, ActiveStream> = new Map();
  private readonly MAX_ERRORS = 10;
  private readonly DEFAULT_CYCLE_DELAY = 10; // 10ms como solicitas
  private readonly BACKOFF_MULTIPLIER = 1.5;
  
  /**
   * Inicia un stream ultra-rápido para un símbolo
   */
  startUltraFastStream(config: UltraFastStreamConfig): () => void {
    const streamKey = `${config.symbol}_${config.interval}`;
    
    // Detener stream existente si existe
    this.stopStream(streamKey);
    
    const stream: ActiveStream = {
      config: {
        ...config,
        cycleDelay: config.cycleDelay || this.DEFAULT_CYCLE_DELAY
      },
      isRunning: true,
      cycleCount: 0,
      lastUpdate: new Date(),
      errorCount: 0,
      requestInProgress: false
    };
    
    this.streams.set(streamKey, stream);
    
    console.log(`🚀 Iniciando stream ultra-rápido para ${streamKey} (ciclo: ${stream.config.cycleDelay}ms)`);
    
    // Iniciar el ciclo inmediatamente
    this.runStreamCycle(streamKey);
    
    // Retornar función de cleanup
    return () => this.stopStream(streamKey);
  }
  
  /**
   * Ejecuta un ciclo del stream: Request → Update → Wait → Repeat
   */
  private async runStreamCycle(streamKey: string): Promise<void> {
    const stream = this.streams.get(streamKey);
    
    if (!stream || !stream.isRunning) {
      return;
    }
    
    // Evitar requests concurrentes
    if (stream.requestInProgress) {
      this.scheduleNextCycle(streamKey);
      return;
    }
    
    stream.requestInProgress = true;
    stream.cycleCount++;
    
    try {
      // 1. API REQUEST - Obtener solo la última vela
      const startTime = performance.now();
      const latestCandles = await this.getLatestCandle(stream.config.symbol, stream.config.interval);
      const requestTime = performance.now() - startTime;
      
      if (latestCandles && latestCandles.length > 0) {
        const latestCandle = latestCandles[latestCandles.length - 1];
        
        // 2. ACTUALIZACIÓN - Notificar inmediatamente
        stream.config.onUpdate(latestCandle);
        stream.lastUpdate = new Date();
        stream.errorCount = 0; // Reset error count en success
        
        // Log de performance cada 100 ciclos para no saturar
        if (stream.cycleCount % 100 === 0) {
          console.log(`⚡ Ciclo ${stream.cycleCount} - ${streamKey}: ${requestTime.toFixed(1)}ms request time`);
        }
      }
      
    } catch (error) {
      stream.errorCount++;
      console.error(`❌ Error en ciclo ${stream.cycleCount} - ${streamKey}:`, error);
      
      // Manejar errores con backoff
      if (stream.errorCount >= this.MAX_ERRORS) {
        console.error(`🚫 Demasiados errores para ${streamKey}, deteniendo stream`);
        this.stopStream(streamKey);
        stream.config.onError?.(new Error(`Max errors reached for ${streamKey}`));
        return;
      }
      
      stream.config.onError?.(error as Error);
    } finally {
      stream.requestInProgress = false;
    }
    
    // 3. ESPERA - Programar siguiente ciclo
    this.scheduleNextCycle(streamKey);
  }
  
  /**
   * Programa el siguiente ciclo con el delay especificado
   */
  private scheduleNextCycle(streamKey: string): void {
    const stream = this.streams.get(streamKey);
    
    if (!stream || !stream.isRunning) {
      return;
    }
    
    // Calcular delay con backoff en caso de errores
    let delay = stream.config.cycleDelay || this.DEFAULT_CYCLE_DELAY;
    if (stream.errorCount > 0) {
      delay = Math.min(delay * Math.pow(this.BACKOFF_MULTIPLIER, stream.errorCount), 1000);
    }
    
    // Programar siguiente ciclo
    stream.timeoutId = setTimeout(() => {
      this.runStreamCycle(streamKey);
    }, delay);
  }
  
  /**
   * Obtiene solo la última vela de manera ultra-optimizada
   */
  private async getLatestCandle(symbol: string, interval: string): Promise<CandleData[]> {
    try {
      // Usar el método optimizado de binanceService para obtener solo 1 vela
      const candles = await binanceService.getLatestKlines(symbol, interval, 1);
      return candles;
    } catch (error) {
      // Fallback: intentar obtener precio actual si falla el kline
      try {
        const price = await binanceService.getPrice(symbol);
        const now = Date.now();
        
        // Crear una vela sintética con el precio actual
        const syntheticCandle: CandleData = {
          timestamp: new Date(now).toISOString(),
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0,
          trades: 0,
          quoteVolume: 0
        };
        
        return [syntheticCandle];
      } catch (fallbackError) {
        throw error; // Lanzar error original
      }
    }
  }
  
  /**
   * Detiene un stream específico
   */
  private stopStream(streamKey: string): void {
    const stream = this.streams.get(streamKey);
    
    if (stream) {
      stream.isRunning = false;
      
      if (stream.timeoutId) {
        clearTimeout(stream.timeoutId);
      }
      
      this.streams.delete(streamKey);
      console.log(`🛑 Stream ultra-rápido detenido: ${streamKey} (${stream.cycleCount} ciclos)`);
    }
  }
  
  /**
   * Obtiene estadísticas de todos los streams activos
   */
  getStreamStats(): { [key: string]: {
    cycleCount: number;
    lastUpdate: Date;
    errorCount: number;
    isRunning: boolean;
    cycleDelay: number;
  }} {
    const stats: any = {};
    
    this.streams.forEach((stream, key) => {
      stats[key] = {
        cycleCount: stream.cycleCount,
        lastUpdate: stream.lastUpdate,
        errorCount: stream.errorCount,
        isRunning: stream.isRunning,
        cycleDelay: stream.config.cycleDelay || this.DEFAULT_CYCLE_DELAY
      };
    });
    
    return stats;
  }
  
  /**
   * Cambia la velocidad de un stream en tiempo real
   */
  changeCycleDelay(symbol: string, interval: string, newDelay: number): boolean {
    const streamKey = `${symbol}_${interval}`;
    const stream = this.streams.get(streamKey);
    
    if (stream) {
      stream.config.cycleDelay = Math.max(newDelay, 1); // Mínimo 1ms
      console.log(`⚡ Velocidad cambiada para ${streamKey}: ${newDelay}ms`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Detiene todos los streams
   */
  stopAllStreams(): void {
    const streamKeys = Array.from(this.streams.keys());
    
    streamKeys.forEach(key => {
      this.stopStream(key);
    });
    
    console.log(`🛑 Todos los streams ultra-rápidos detenidos (${streamKeys.length})`);
  }
  
  /**
   * Obtiene el número de streams activos
   */
  getActiveStreamCount(): number {
    return this.streams.size;
  }
  
  /**
   * Verifica si un stream está activo
   */
  isStreamActive(symbol: string, interval: string): boolean {
    const streamKey = `${symbol}_${interval}`;
    const stream = this.streams.get(streamKey);
    return stream ? stream.isRunning : false;
  }
  
  /**
   * Reinicia un stream manteniendo la configuración
   */
  restartStream(symbol: string, interval: string): boolean {
    const streamKey = `${symbol}_${interval}`;
    const stream = this.streams.get(streamKey);
    
    if (stream) {
      const config = { ...stream.config };
      this.stopStream(streamKey);
      
      // Reiniciar después de un pequeño delay
      setTimeout(() => {
        this.startUltraFastStream(config);
      }, 100);
      
      return true;
    }
    
    return false;
  }
}

export const ultraFastStreamingService = new UltraFastStreamingService();
