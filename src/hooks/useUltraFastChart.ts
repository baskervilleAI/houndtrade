import { useEffect, useRef, useCallback, useState } from 'react';
import { CandleData } from '../services/binanceService';
import { ultraFastStreamingService } from '../services/ultraFastStreamingService';
import { 
  updateCandlesArray, 
  validateCandleData, 
  fixInvalidCandle, 
  getCandleWindowStart, 
  getIntervalInMs 
} from '../utils/candleTimeUtils';

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
  const intervalMsRef = useRef<number>(getIntervalInMs(timeframe));
  const lastCandleWindowRef = useRef<number>(0);

  // Update interval reference when timeframe changes
  useEffect(() => {
    intervalMsRef.current = getIntervalInMs(timeframe);
    lastCandleWindowRef.current = 0; // Reset window tracking
  }, [timeframe]);

  // Función para agregar o actualizar vela con validación mejorada
  const updateCandle = useCallback((newCandle: CandleData) => {
    const requestTime = Date.now();
    const responseTime = requestTime - lastRequestTimeRef.current;
    lastRequestTimeRef.current = requestTime;

    // Validar datos de vela antes de procesar
    if (!validateCandleData(newCandle)) {
      console.warn('⚠️ Datos de vela inválidos, corrigiendo:', newCandle);
      const referencePrice = candlesRef.current.length > 0 
        ? candlesRef.current[candlesRef.current.length - 1].close 
        : undefined;
      newCandle = fixInvalidCandle(newCandle, referencePrice);
    }

    // Calcular ventana de tiempo para esta vela
    const newTimestamp = new Date(newCandle.timestamp).getTime();
    const newCandleWindow = getCandleWindowStart(newTimestamp, timeframe);
    
    // Solo procesar si es una vela válida para el timeframe actual
    const shouldProcess = shouldProcessCandle(newCandleWindow, intervalMsRef.current);
    
    if (!shouldProcess) {
      // console.log(`⏭️ Saltando vela fuera de ventana: ${new Date(newTimestamp).toISOString()}`);
      return;
    }

    // Calcular tiempo de respuesta promedio
    responseTimesRef.current.push(responseTime);
    if (responseTimesRef.current.length > 50) {
      responseTimesRef.current.shift(); // Mantener solo las últimas 50 mediciones
    }
    
    const avgTime = responseTimesRef.current.reduce((a, b) => a + b, 0) / responseTimesRef.current.length;
    setAverageResponseTime(avgTime);

    setCandles(prevCandles => {
      // Usar la función mejorada de actualización de velas
      const result = updateCandlesArray(prevCandles, newCandle, timeframe, maxCandles);
      
      if (result.action !== 'ignored') {
        candlesRef.current = result.candles;
        lastCandleWindowRef.current = newCandleWindow;
        
        // Log para debug en modo desarrollo
        if (__DEV__ && result.action === 'appended') {
          console.log(`📈 Nueva vela ${timeframe}: ${new Date(newCandle.timestamp).toISOString()} | ${result.candles.length} total`);
        }
      }
      
      return result.candles;
    });

    setLastUpdate(new Date());
    setUpdateCount(prev => prev + 1);
  }, [timeframe, maxCandles]);

  // Función para determinar si debemos procesar una vela basado en el timeframe
  const shouldProcessCandle = useCallback((candleWindow: number, intervalMs: number): boolean => {
    // Para timeframes largos (>= 1h), ser más selectivo
    if (intervalMs >= 3600000) { // 1 hora o más
      const now = Date.now();
      const timeSinceWindowStart = now - candleWindow;
      
      // Solo procesar si estamos cerca del inicio o final de la ventana
      const windowProgress = timeSinceWindowStart / intervalMs;
      
      // Procesar solo en los primeros y últimos 10% de la ventana, o cada 5 minutos
      return windowProgress <= 0.1 || windowProgress >= 0.9 || 
             timeSinceWindowStart % (5 * 60 * 1000) < 30000; // Cada 5 min ±30s
    }
    
    // Para timeframes cortos, procesar más frecuentemente
    return true;
  }, []);

  // Iniciar streaming ultra-rápido con optimizaciones de timeframe
  const startUltraFastStream = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    lastRequestTimeRef.current = Date.now();
    responseTimesRef.current = [];
    lastCandleWindowRef.current = 0;

    // Ajustar cycleDelay basado en timeframe si no se especifica
    let effectiveCycleDelay = cycleDelay;
    const intervalMs = intervalMsRef.current;
    
    if (cycleDelay === 10) { // Si es el default, optimizar
      if (intervalMs >= 3600000) { // 1h+
        effectiveCycleDelay = 5000; // 5 segundos para timeframes largos
      } else if (intervalMs >= 900000) { // 15m+
        effectiveCycleDelay = 1000; // 1 segundo para timeframes medios
      } else {
        effectiveCycleDelay = 100; // 100ms para timeframes cortos
      }
    }

    console.log(`🚀 Iniciando stream optimizado: ${symbol} ${timeframe} (${effectiveCycleDelay}ms) | Intervalo: ${intervalMs/1000}s`);

    const unsubscribe = ultraFastStreamingService.startUltraFastStream({
      symbol,
      interval: timeframe,
      cycleDelay: effectiveCycleDelay,
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
    lastCandleWindowRef.current = 0;
  }, []);

  // Auto-start cuando cambian symbol/timeframe
  useEffect(() => {
    if (autoStart) {
      clearCandles();
      
      // Primero cargar datos históricos, luego iniciar streaming
      loadHistoricalData().then(() => {
        console.log(`📊 Datos históricos cargados para ${symbol} ${timeframe}, iniciando streaming...`);
        startUltraFastStream();
      }).catch((error) => {
        console.error(`❌ Error cargando datos históricos para ${symbol}:`, error);
        // Aún así iniciar el streaming para intentar obtener datos en vivo
        startUltraFastStream();
      });
    }

    return () => {
      stopStream();
    };
  }, [symbol, timeframe, autoStart]);

  // Función para cargar datos históricos iniciales
  const loadHistoricalData = useCallback(async (): Promise<void> => {
    try {
      console.log(`📈 Cargando datos históricos para ${symbol} ${timeframe}...`);
      
      // Importar binanceService aquí para evitar dependencias circulares
      const { binanceService } = await import('../services/binanceService');
      
      const interval = binanceService.getIntervalFromTimeframe(timeframe);
      const historicalCandles = await binanceService.getKlines(symbol, interval, 100);
      
      if (historicalCandles && historicalCandles.length > 0) {
        console.log(`✅ Cargados ${historicalCandles.length} datos históricos para ${symbol}`);
        
        // Validar y procesar las velas históricas
        const validHistoricalCandles = historicalCandles
          .filter(validateCandleData)
          .map((candle, index, arr) => {
            if (!validateCandleData(candle)) {
              const referencePrice = index > 0 ? arr[index - 1].close : undefined;
              return fixInvalidCandle(candle, referencePrice);
            }
            return candle;
          });
        
        setCandles(validHistoricalCandles);
        candlesRef.current = validHistoricalCandles;
        
        console.log(`📊 ${validHistoricalCandles.length} velas históricas válidas cargadas para ${symbol}`);
      } else {
        console.warn(`⚠️ No se pudieron cargar datos históricos para ${symbol}`);
      }
    } catch (error) {
      console.error(`❌ Error cargando datos históricos para ${symbol}:`, error);
      throw error;
    }
  }, [symbol, timeframe]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // Estadísticas de rendimiento mejoradas
  const performanceStats = {
    updateCount,
    averageResponseTime: Math.round(averageResponseTime),
    candleCount: candles.length,
    isStreaming,
    lastUpdate,
    cycleDelay,
    updatesPerSecond: updateCount > 0 && lastUpdate 
      ? Math.round(updateCount / ((Date.now() - (lastUpdate.getTime() - updateCount * cycleDelay)) / 1000))
      : 0,
    intervalMs: intervalMsRef.current,
    efficiency: calculateEfficiency(updateCount, intervalMsRef.current, Date.now() - (lastUpdate?.getTime() || Date.now())),
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
    loadHistoricalData,
    
    // Estado
    hasData: candles.length > 0,
    isActive: isStreaming,
  };
};

// Función auxiliar para calcular eficiencia
function calculateEfficiency(updateCount: number, intervalMs: number, elapsedMs: number): number {
  if (elapsedMs <= 0 || intervalMs <= 0) return 0;
  
  const expectedUpdates = Math.max(1, elapsedMs / intervalMs);
  const efficiency = Math.min(1, updateCount / expectedUpdates);
  
  return Math.round(efficiency * 100) / 100;
}
