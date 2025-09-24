import { useEffect, useRef, useCallback, useState } from 'react';
import { CandleData, binanceService } from '../services/binanceService';
import { ultraFastStreamingService } from '../services/ultraFastStreamingService';
import { 
  updateCandlesArray, 
  validateCandleData, 
  fixInvalidCandle 
} from '../utils/candleTimeUtils';

interface UseLiveChartOptions {
  symbol: string;
  interval: string;
  maxCandles?: number;
  enableUltraFast?: boolean;
  cycleDelay?: number;
}

interface LiveChartStats {
  updateCount: number;
  averageResponseTime: number;
  lastUpdate: Date | null;
  errorCount: number;
  isStreaming: boolean;
  lastAction: 'updated' | 'appended' | 'ignored';
  lastActionIndex?: number;
  currentCandle?: CandleData;
}

export const useLiveChart = (options: UseLiveChartOptions) => {
  const { 
    symbol, 
    interval, 
    maxCandles = 1000, // Configurado para máximo 1000 velas como requisito
    enableUltraFast = false,
    cycleDelay = 100
  } = options;

  // Estados
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<LiveChartStats>({
    updateCount: 0,
    averageResponseTime: 0,
    lastUpdate: null,
    errorCount: 0,
    isStreaming: false,
    lastAction: 'ignored',
    currentCandle: undefined,
  });

  // Referencias
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const responseTimesRef = useRef<number[]>([]);
  const isInitializedRef = useRef<string | null>(null);
  const lastLoadTimeRef = useRef<number>(0);
  const lastValidCandleRef = useRef<CandleData | null>(null);

  // Función para cargar datos históricos iniciales
  const loadInitialData = useCallback(async () => {
    const now = Date.now();
    const cacheKey = `${symbol}-${interval}`;
    
    // Evitar cargas duplicadas para el mismo symbol/interval
    if (isInitializedRef.current && isInitializedRef.current === cacheKey) {
      console.log(`📊 Data already loaded for ${symbol} ${interval}, skipping...`);
      return;
    }
    
    // Evitar cargas demasiado frecuentes (debouncing)
    if (now - lastLoadTimeRef.current < 2000) {
      console.log(`⏰ Too frequent load attempt for ${symbol} ${interval}, skipping...`);
      return;
    }
    
    lastLoadTimeRef.current = now;
    setIsLoading(true);
    console.log(`📊 Loading initial data for ${symbol} ${interval}...`);
    
    try {
      const historicalCandles = await binanceService.getKlines(
        symbol, 
        interval, 
        maxCandles
      );
      
      console.log(`✅ Loaded ${historicalCandles.length} historical candles for ${symbol}`);
      setCandles(historicalCandles);
      
      // Guardar la última vela válida como referencia
      if (historicalCandles.length > 0) {
        const lastCandle = historicalCandles[historicalCandles.length - 1];
        if (validateCandleData(lastCandle)) {
          lastValidCandleRef.current = lastCandle;
        }
      }
      
      isInitializedRef.current = cacheKey;
    } catch (error) {
      console.error(`❌ Error loading initial data for ${symbol}:`, error);
      setStats(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
    } finally {
      setIsLoading(false);
    }
  }, [symbol, interval, maxCandles]);

  // Función para actualizar velas usando la nueva lógica de temporalidad
  const updateCandles = useCallback((newCandle: CandleData) => {
    const updateTime = Date.now();
    const requestStartTime = responseTimesRef.current[responseTimesRef.current.length - 1] || updateTime;
    
    // Validar y corregir la nueva vela si es necesario
    let validatedCandle = newCandle;
    if (!validateCandleData(newCandle)) {
      console.warn(`⚠️ Invalid candle data received for ${symbol}, attempting to fix...`);
      const referencePrice = lastValidCandleRef.current?.close;
      validatedCandle = fixInvalidCandle(newCandle, referencePrice);
      
      if (!validateCandleData(validatedCandle)) {
        console.error(`❌ Could not fix invalid candle for ${symbol}, ignoring update`);
        setStats(prev => ({ 
          ...prev, 
          errorCount: prev.errorCount + 1,
          lastAction: 'ignored'
        }));
        return;
      }
    }

    // Calcular tiempo de respuesta
    const responseTime = updateTime - requestStartTime;
    responseTimesRef.current.push(responseTime);
    if (responseTimesRef.current.length > 20) {
      responseTimesRef.current.shift();
    }
    
    const avgResponseTime = responseTimesRef.current.reduce((a, b) => a + b, 0) / responseTimesRef.current.length;

    setCandles(prevCandles => {
      // Usar la nueva utilidad de temporalidad para manejar las actualizaciones
      const result = updateCandlesArray(prevCandles, validatedCandle, interval, maxCandles);
      
      // Log detallado de las acciones
      const actionEmoji = {
        'updated': '🔄',
        'appended': '➕',
        'ignored': '⏭️'
      };
      
      console.log(`${actionEmoji[result.action]} ${symbol} ${interval}: ${result.action.toUpperCase()} candle at index ${result.index || 'N/A'} - $${validatedCandle.close.toFixed(4)}`);
      
      // Actualizar estadísticas
      setStats(prev => ({
        ...prev,
        updateCount: prev.updateCount + 1,
        averageResponseTime: Math.round(avgResponseTime),
        lastUpdate: new Date(),
        lastAction: result.action,
        lastActionIndex: result.index,
        currentCandle: validatedCandle,
      }));

      // Guardar como última vela válida si fue exitosa
      if (result.action !== 'ignored') {
        lastValidCandleRef.current = validatedCandle;
      }

      return result.candles;
    });
  }, [symbol, interval, maxCandles]);

  // Función para manejar errores
  const handleError = useCallback((error: Error) => {
    console.error(`❌ Live chart error for ${symbol}:`, error);
    setStats(prev => ({ 
      ...prev, 
      errorCount: prev.errorCount + 1,
      isStreaming: false,
    }));
  }, [symbol]);

  // Iniciar streaming (WebSocket o Ultra Fast)
  const startStreaming = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    console.log(`🚀 Starting ${enableUltraFast ? 'ultra-fast' : 'websocket'} streaming for ${symbol} ${interval}`);

    if (enableUltraFast) {
      // Usar ultra fast streaming
      const unsubscribe = ultraFastStreamingService.startUltraFastStream({
        symbol,
        interval,
        cycleDelay,
        onUpdate: updateCandles,
        onError: handleError,
      });
      
      unsubscribeRef.current = unsubscribe;
    } else {
      // Usar WebSocket streaming tradicional
      const unsubscribe = binanceService.subscribeToKlines(
        symbol,
        interval,
        updateCandles,
        handleError
      );
      
      unsubscribeRef.current = unsubscribe;
    }

    setStats(prev => ({ ...prev, isStreaming: true }));
  }, [symbol, interval, enableUltraFast, cycleDelay, updateCandles, handleError]);

  // Detener streaming
  const stopStreaming = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    setStats(prev => ({ ...prev, isStreaming: false }));
    console.log(`🛑 Stopped streaming for ${symbol} ${interval}`);
  }, [symbol, interval]);

  // Reiniciar streaming
  const restartStreaming = useCallback(() => {
    stopStreaming();
    setTimeout(() => {
      startStreaming();
    }, 1000);
  }, [stopStreaming, startStreaming]);

  // Cambiar modo de streaming
  const toggleStreamingMode = useCallback(() => {
    const newMode = !enableUltraFast;
    console.log(`🔄 Switching to ${newMode ? 'ultra-fast' : 'websocket'} mode for ${symbol}`);
    
    stopStreaming();
    setTimeout(() => {
      startStreaming();
    }, 1000);
  }, [enableUltraFast, symbol, stopStreaming, startStreaming]);

  // Obtener estadísticas del servicio ultra fast si está habilitado
  const getUltraFastStats = useCallback(() => {
    if (enableUltraFast) {
      return ultraFastStreamingService.getStreamStat(symbol, interval);
    }
    return null;
  }, [enableUltraFast, symbol, interval]);

  // Efecto principal: cargar datos iniciales y iniciar streaming
  useEffect(() => {
    const initializeChart = async () => {
      await loadInitialData();
      startStreaming();
    };

    initializeChart();

    return () => {
      stopStreaming();
    };
  }, [symbol, interval]); // Solo re-ejecutar cuando cambien symbol o interval

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopStreaming();
      isInitializedRef.current = null;
      lastValidCandleRef.current = null;
    };
  }, [stopStreaming]);

  // Obtener estadísticas combinadas
  const getCombinedStats = useCallback(() => {
    const ultraFastStats = getUltraFastStats();
    
    return {
      ...stats,
      responseTime: ultraFastStats?.avgResponseTime || stats.averageResponseTime,
      cycleCount: ultraFastStats?.cycleCount || 0,
    };
  }, [stats, getUltraFastStats]);

  return {
    // Datos
    candles,
    isLoading,
    stats: getCombinedStats(),
    
    // Estados
    hasData: candles.length > 0,
    isStreaming: stats.isStreaming,
    currentCandle: stats.currentCandle,
    lastAction: stats.lastAction,
    lastActionIndex: stats.lastActionIndex,
    
    // Acciones
    startStreaming,
    stopStreaming,
    restartStreaming,
    toggleStreamingMode,
    
    // Información del modo actual
    isUltraFastMode: enableUltraFast,
    symbol,
    interval,
    
    // Métricas de rendimiento
    responseTime: getCombinedStats().responseTime,
    updateCount: stats.updateCount,
    errorCount: stats.errorCount,
    lastUpdate: stats.lastUpdate,
  };
};

export default useLiveChart;
