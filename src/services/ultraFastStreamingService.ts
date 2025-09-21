import { binanceService, CandleData } from './binanceService';
import { validateCandleData, fixInvalidCandle } from '../utils/candleTimeUtils';

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
  lastValidCandle?: CandleData; // Para validación de datos
  lastResponseTime: number;
  avgResponseTime: number;
  responseTimes: number[];
}

/**
 * Servicio de streaming ultra-rápido que mantiene un ciclo continuo:
 * API Request → Validación → Actualización → 10ms espera → Nueva Request
 */
class UltraFastStreamingService {
  private streams: Map<string, ActiveStream> = new Map();
  private readonly MAX_ERRORS = 10;
  private readonly DEFAULT_CYCLE_DELAY = 10; // 10ms como solicitas
  private readonly BACKOFF_MULTIPLIER = 1.5;
  private readonly MAX_RESPONSE_TIMES = 50; // Para calcular promedio
  
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
      requestInProgress: false,
      lastResponseTime: 0,
      avgResponseTime: 0,
      responseTimes: []
    };
    
    this.streams.set(streamKey, stream);
    
    // Solo log si es debug mode (silencioso por defecto)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 Ultra-fast stream iniciado: ${streamKey} (${config.cycleDelay}ms)`);
    }
    
    // Iniciar el ciclo inmediatamente
    this.runStreamCycle(streamKey);
    
    // Retornar función de cleanup
    return () => this.stopStream(streamKey);
  }
  
  /**
   * Ejecuta un ciclo del stream: Request → Validate → Update → Wait → Repeat
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
      
      // Actualizar métricas de rendimiento
      stream.lastResponseTime = requestTime;
      stream.responseTimes.push(requestTime);
      if (stream.responseTimes.length > this.MAX_RESPONSE_TIMES) {
        stream.responseTimes.shift();
      }
      stream.avgResponseTime = stream.responseTimes.reduce((a, b) => a + b, 0) / stream.responseTimes.length;
      
      if (latestCandles && latestCandles.length > 0) {
        let latestCandle = latestCandles[latestCandles.length - 1];
        
        // 2. VALIDACIÓN - Verificar que los datos sean válidos
        if (!validateCandleData(latestCandle)) {
          console.warn(`⚠️ Invalid candle data for ${streamKey}, attempting to fix...`);
          
          // Intentar corregir usando la última vela válida como referencia
          const referencePrice = stream.lastValidCandle?.close;
          latestCandle = fixInvalidCandle(latestCandle, referencePrice);
          
          // Si aún no es válida después de la corrección, usar datos sintéticos
          if (!validateCandleData(latestCandle)) {
            console.error(`❌ Could not fix invalid candle for ${streamKey}`);
            throw new Error(`Invalid candle data for ${streamKey}`);
          }
        }
        
        // Guardar como última vela válida
        stream.lastValidCandle = latestCandle;
        
        // 3. ACTUALIZACIÓN - Notificar inmediatamente
        stream.config.onUpdate(latestCandle);
        stream.lastUpdate = new Date();
        stream.errorCount = 0; // Reset error count en success
        
        // Log de performance solo en debug y cada 1000 ciclos
        if (process.env.NODE_ENV === 'development' && stream.cycleCount % 1000 === 0) {
          console.log(`⚡ ${streamKey}: ${stream.cycleCount} ciclos, ${requestTime.toFixed(1)}ms avg: ${stream.avgResponseTime.toFixed(1)}ms`);
        }
      }
      
    } catch (error) {
      stream.errorCount++;
      
      // Solo log errores críticos o cada 5 errores
      if (stream.errorCount === 1 || stream.errorCount % 5 === 0) {
        console.error(`❌ Error ${stream.errorCount} en ${streamKey}:`, error);
      }
      
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
    
    // 4. ESPERA - Programar siguiente ciclo
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
      
      // Solo log en desarrollo
      if (process.env.NODE_ENV === 'development') {
        console.log(`🛑 Stream detenido: ${streamKey} (${stream.cycleCount} ciclos, avg: ${stream.avgResponseTime.toFixed(1)}ms)`);
      }
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
    lastResponseTime: number;
    avgResponseTime: number;
    lastValidCandle?: CandleData;
  }} {
    const stats: any = {};
    
    this.streams.forEach((stream, key) => {
      stats[key] = {
        cycleCount: stream.cycleCount,
        lastUpdate: stream.lastUpdate,
        errorCount: stream.errorCount,
        isRunning: stream.isRunning,
        cycleDelay: stream.config.cycleDelay || this.DEFAULT_CYCLE_DELAY,
        lastResponseTime: stream.lastResponseTime,
        avgResponseTime: stream.avgResponseTime,
        lastValidCandle: stream.lastValidCandle
      };
    });
    
    return stats;
  }
  
  /**
   * Obtiene estadísticas de un stream específico
   */
  getStreamStat(symbol: string, interval: string): {
    cycleCount: number;
    lastUpdate: Date;
    errorCount: number;
    isRunning: boolean;
    cycleDelay: number;
    lastResponseTime: number;
    avgResponseTime: number;
    lastValidCandle?: CandleData;
  } | null {
    const streamKey = `${symbol}_${interval}`;
    const stream = this.streams.get(streamKey);
    
    if (!stream) return null;
    
    return {
      cycleCount: stream.cycleCount,
      lastUpdate: stream.lastUpdate,
      errorCount: stream.errorCount,
      isRunning: stream.isRunning,
      cycleDelay: stream.config.cycleDelay || this.DEFAULT_CYCLE_DELAY,
      lastResponseTime: stream.lastResponseTime,
      avgResponseTime: stream.avgResponseTime,
      lastValidCandle: stream.lastValidCandle
    };
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
