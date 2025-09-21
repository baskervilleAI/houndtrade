import { useEffect, useRef, useCallback, useState } from 'react';
import { CandleData, binanceService } from '../services/binanceService';
import { ultraFastStreamingService } from '../services/ultraFastStreamingService';

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
}

export const useLiveChart = (options: UseLiveChartOptions) => {
  const { 
    symbol, 
    interval, 
    maxCandles = 100,
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
  });

  // Referencias
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const responseTimesRef = useRef<number[]>([]);
  const isInitializedRef = useRef(false);

  // Función para cargar datos históricos iniciales
  const loadInitialData = useCallback(async () => {
    if (isInitializedRef.current) return;
    
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
      isInitializedRef.current = true;
    } catch (error) {
      console.error(`❌ Error loading initial data for ${symbol}:`, error);
      setStats(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
    } finally {
      setIsLoading(false);
    }
  }, [symbol, interval, maxCandles]);

  // Función para actualizar velas
  const updateCandles = useCallback((newCandle: CandleData) => {
    const updateTime = Date.now();
    
    // Calcular tiempo de respuesta
    const responseTime = updateTime - (responseTimesRef.current[responseTimesRef.current.length - 1] || updateTime);
    responseTimesRef.current.push(responseTime);
    if (responseTimesRef.current.length > 20) {
      responseTimesRef.current.shift();
    }
    
    const avgResponseTime = responseTimesRef.current.reduce((a, b) => a + b, 0) / responseTimesRef.current.length;

    setCandles(prevCandles => {
      const newCandles = [...prevCandles];
      const newTimestamp = new Date(newCandle.timestamp).getTime();
      
      // Buscar vela existente con mismo timestamp
      const existingIndex = newCandles.findIndex(
        candle => Math.abs(new Date(candle.timestamp).getTime() - newTimestamp) < 60000 // 1 minuto de tolerancia
      );
      
      if (existingIndex >= 0) {
        // Actualizar vela existente
        newCandles[existingIndex] = newCandle;
        console.log(`🔄 Updated candle for ${symbol}: $${newCandle.close}`);
      } else {
        // Agregar nueva vela
        newCandles.push(newCandle);
        
        // Mantener solo las últimas velas
        if (newCandles.length > maxCandles) {
          newCandles.splice(0, newCandles.length - maxCandles);
        }
        
        console.log(`📈 New candle for ${symbol}: $${newCandle.close}`);
      }
      
      // Ordenar por timestamp
      newCandles.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      return newCandles;
    });

    // Actualizar estadísticas
    setStats(prev => ({
      ...prev,
      updateCount: prev.updateCount + 1,
      averageResponseTime: Math.round(avgResponseTime),
      lastUpdate: new Date(),
    }));
  }, [symbol, maxCandles]);

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
      isInitializedRef.current = false;
    };
  }, [stopStreaming]);

  return {
    // Datos
    candles,
    isLoading,
    stats,
    
    // Estados
    hasData: candles.length > 0,
    isStreaming: stats.isStreaming,
    
    // Acciones
    startStreaming,
    stopStreaming,
    restartStreaming,
    toggleStreamingMode,
    
    // Información del modo actual
    isUltraFastMode: enableUltraFast,
    symbol,
    interval,
  };
};

export default useLiveChart;
