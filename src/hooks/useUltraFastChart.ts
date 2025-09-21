import { useEffect, useRef, useCallback, useState } from 'react';
import { CandleData } from '../services/binanceService';
import { ultraFastStreamingService } from '../services/ultraFastStreamingService';

interface UseUltraFastChartOptions {
  symbol: string;
  timeframe: string;
  cycleDelay?: number; // Delay en ms entre requests (default: 10ms)
  maxCandles?: number; // Máximo número de velas a mantener en memoria
  autoStart?: boolean; // Iniciar automáticamente
}

export const useUltraFastChart = (options: UseUltraFastChartOptions) => {
  const { 
    symbol, 
    timeframe, 
    cycleDelay = 10, 
    maxCandles = 500,
    autoStart = true 
  } = options;

  // Estado del gráfico
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [averageResponseTime, setAverageResponseTime] = useState(0);
  
  // Referencias para optimización
  const candlesRef = useRef<CandleData[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const responseTimesRef = useRef<number[]>([]);
  const lastRequestTimeRef = useRef<number>(0);

  // Función para agregar o actualizar vela
  const updateCandle = useCallback((newCandle: CandleData) => {
    const requestTime = Date.now();
    const responseTime = requestTime - lastRequestTimeRef.current;
    lastRequestTimeRef.current = requestTime;

    // Calcular tiempo de respuesta promedio
    responseTimesRef.current.push(responseTime);
    if (responseTimesRef.current.length > 50) {
      responseTimesRef.current.shift(); // Mantener solo las últimas 50 mediciones
    }
    
    const avgTime = responseTimesRef.current.reduce((a, b) => a + b, 0) / responseTimesRef.current.length;
    setAverageResponseTime(avgTime);

    setCandles(prevCandles => {
      const newCandles = [...prevCandles];
      const newTimestamp = new Date(newCandle.timestamp).getTime();
      
      // Buscar si ya existe una vela con el mismo timestamp
      const existingIndex = newCandles.findIndex(
        candle => new Date(candle.timestamp).getTime() === newTimestamp
      );
      
      if (existingIndex >= 0) {
        // Actualizar vela existente
        newCandles[existingIndex] = newCandle;
      } else {
        // Agregar nueva vela
        newCandles.push(newCandle);
        
        // Mantener solo las últimas velas para optimizar rendimiento
        if (newCandles.length > maxCandles) {
          newCandles.splice(0, newCandles.length - maxCandles);
        }
      }
      
      // Ordenar por timestamp para asegurar orden correcto
      newCandles.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      candlesRef.current = newCandles;
      return newCandles;
    });

    setLastUpdate(new Date());
    setUpdateCount(prev => prev + 1);
  }, [maxCandles]);

  // Iniciar streaming ultra-rápido
  const startUltraFastStream = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    lastRequestTimeRef.current = Date.now();
    responseTimesRef.current = [];

    console.log(`🚀 Iniciando stream ultra-rápido: ${symbol} ${timeframe} (${cycleDelay}ms)`);

    const unsubscribe = ultraFastStreamingService.startUltraFastStream({
      symbol,
      interval: timeframe,
      cycleDelay,
      onUpdate: updateCandle,
      onError: (error) => {
        console.error(`❌ Error en stream ultra-rápido ${symbol}:`, error);
        setIsStreaming(false);
      }
    });

    unsubscribeRef.current = unsubscribe;
    setIsStreaming(true);
    setUpdateCount(0);

    return unsubscribe;
  }, [symbol, timeframe, cycleDelay, updateCandle]);

  // Detener streaming
  const stopStream = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setIsStreaming(false);
    console.log(`🛑 Stream ultra-rápido detenido: ${symbol} ${timeframe}`);
  }, [symbol, timeframe]);

  // Reiniciar streaming
  const restartStream = useCallback(() => {
    stopStream();
    setTimeout(() => {
      startUltraFastStream();
    }, 100);
  }, [stopStream, startUltraFastStream]);

  // Cambiar velocidad del ciclo en tiempo real
  const changeCycleSpeed = useCallback((newDelay: number) => {
    if (ultraFastStreamingService.changeCycleDelay(symbol, timeframe, newDelay)) {
      console.log(`⚡ Velocidad cambiada: ${symbol} ${timeframe} -> ${newDelay}ms`);
      return true;
    }
    return false;
  }, [symbol, timeframe]);

  // Limpiar velas
  const clearCandles = useCallback(() => {
    setCandles([]);
    candlesRef.current = [];
    setUpdateCount(0);
    setLastUpdate(null);
    responseTimesRef.current = [];
    setAverageResponseTime(0);
  }, []);

  // Auto-start cuando cambian symbol/timeframe
  useEffect(() => {
    if (autoStart) {
      clearCandles();
      startUltraFastStream();
    }

    return () => {
      stopStream();
    };
  }, [symbol, timeframe, autoStart, startUltraFastStream, stopStream, clearCandles]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // Estadísticas de rendimiento
  const performanceStats = {
    updateCount,
    averageResponseTime: Math.round(averageResponseTime),
    candleCount: candles.length,
    isStreaming,
    lastUpdate,
    cycleDelay,
    updatesPerSecond: updateCount > 0 && lastUpdate 
      ? Math.round(updateCount / ((Date.now() - (lastUpdate.getTime() - updateCount * cycleDelay)) / 1000))
      : 0
  };

  return {
    // Datos
    candles,
    isStreaming,
    lastUpdate,
    performanceStats,
    
    // Acciones
    startStream: startUltraFastStream,
    stopStream,
    restartStream,
    changeCycleSpeed,
    clearCandles,
    
    // Estado
    hasData: candles.length > 0,
    isActive: isStreaming,
  };
};
