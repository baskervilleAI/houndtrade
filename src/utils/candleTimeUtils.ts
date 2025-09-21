/**
 * Utilidades para manejar la temporalidad de velas de trading
 * Asegura que las actualizaciones de velas se hagan correctamente según el timeframe
 */

import { CandleData } from '../services/binanceService';

/**
 * Convierte el intervalo de string a milisegundos
 */
export function getIntervalInMs(interval: string): number {
  const timeMultipliers: { [key: string]: number } = {
    '1m': 60 * 1000,           // 1 minuto
    '3m': 3 * 60 * 1000,       // 3 minutos
    '5m': 5 * 60 * 1000,       // 5 minutos
    '15m': 15 * 60 * 1000,     // 15 minutos
    '30m': 30 * 60 * 1000,     // 30 minutos
    '1h': 60 * 60 * 1000,      // 1 hora
    '2h': 2 * 60 * 60 * 1000,  // 2 horas
    '4h': 4 * 60 * 60 * 1000,  // 4 horas
    '6h': 6 * 60 * 60 * 1000,  // 6 horas
    '8h': 8 * 60 * 60 * 1000,  // 8 horas
    '12h': 12 * 60 * 60 * 1000, // 12 horas
    '1d': 24 * 60 * 60 * 1000,  // 1 día
    '3d': 3 * 24 * 60 * 60 * 1000, // 3 días
    '1w': 7 * 24 * 60 * 60 * 1000, // 1 semana
    '1M': 30 * 24 * 60 * 60 * 1000, // 1 mes (aproximado)
  };

  return timeMultipliers[interval] || 60 * 1000; // Default 1 minuto
}

/**
 * Obtiene el timestamp del inicio de la ventana de tiempo para un timestamp dado
 * Esto es crucial para determinar si dos velas pertenecen a la misma ventana temporal
 */
export function getCandleWindowStart(timestamp: number, interval: string): number {
  const intervalMs = getIntervalInMs(interval);
  
  // Para intervalos basados en tiempo UTC (todos excepto semanas y meses)
  if (interval !== '1w' && interval !== '1M') {
    return Math.floor(timestamp / intervalMs) * intervalMs;
  }
  
  // Para semanas, alinear con el lunes
  if (interval === '1w') {
    const date = new Date(timestamp);
    const dayOfWeek = date.getUTCDay();
    const daysToMonday = (dayOfWeek + 6) % 7; // 0 = lunes
    const mondayDate = new Date(date);
    mondayDate.setUTCDate(date.getUTCDate() - daysToMonday);
    mondayDate.setUTCHours(0, 0, 0, 0);
    return mondayDate.getTime();
  }
  
  // Para meses, alinear con el primer día del mes
  if (interval === '1M') {
    const date = new Date(timestamp);
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
    return date.getTime();
  }
  
  return timestamp;
}

/**
 * Determina si dos timestamps pertenecen a la misma ventana de tiempo
 */
export function isSameCandleWindow(timestamp1: number, timestamp2: number, interval: string): boolean {
  const window1 = getCandleWindowStart(timestamp1, interval);
  const window2 = getCandleWindowStart(timestamp2, interval);
  return window1 === window2;
}

/**
 * Determina si una nueva vela debe reemplazar la última vela existente
 * o si debe ser añadida como una nueva vela
 */
export function shouldUpdateLastCandle(
  existingCandles: CandleData[],
  newCandle: CandleData,
  interval: string
): { action: 'update' | 'append' | 'ignore'; index?: number } {
  
  if (existingCandles.length === 0) {
    return { action: 'append' };
  }

  const newTimestamp = new Date(newCandle.timestamp).getTime();
  const newWindowStart = getCandleWindowStart(newTimestamp, interval);
  const lastCandle = existingCandles[existingCandles.length - 1];
  const lastTimestamp = new Date(lastCandle.timestamp).getTime();
  const lastWindowStart = getCandleWindowStart(lastTimestamp, interval);

  // Si la nueva vela es de la misma ventana de tiempo que la última
  if (newWindowStart === lastWindowStart) {
    return { action: 'update', index: existingCandles.length - 1 };
  }

  // Si la nueva vela es más nueva (nueva ventana de tiempo)
  if (newWindowStart > lastWindowStart) {
    return { action: 'append' };
  }

  // Si la nueva vela es más antigua, buscar si corresponde a alguna vela existente
  // Buscar hacia atrás en las últimas 10 velas para eficiencia
  const searchLimit = Math.min(10, existingCandles.length - 1);
  for (let i = existingCandles.length - 2; i >= existingCandles.length - 1 - searchLimit && i >= 0; i--) {
    const candleTimestamp = new Date(existingCandles[i].timestamp).getTime();
    const candleWindowStart = getCandleWindowStart(candleTimestamp, interval);
    if (newWindowStart === candleWindowStart) {
      return { action: 'update', index: i };
    }
  }

  // Si la vela es demasiado antigua, ignorarla
  return { action: 'ignore' };
}

/**
 * Actualiza un array de velas con una nueva vela según la lógica correcta de temporalidad
 */
export function updateCandlesArray(
  existingCandles: CandleData[],
  newCandle: CandleData,
  interval: string,
  maxCandles: number = 100
): {
  candles: CandleData[];
  action: 'updated' | 'appended' | 'ignored';
  index?: number;
} {
  
  const decision = shouldUpdateLastCandle(existingCandles, newCandle, interval);
  let resultCandles = [...existingCandles];

  switch (decision.action) {
    case 'update':
      if (decision.index !== undefined) {
        resultCandles[decision.index] = newCandle;
        return { 
          candles: resultCandles, 
          action: 'updated', 
          index: decision.index 
        };
      }
      break;

    case 'append':
      resultCandles.push(newCandle);
      
      // Mantener solo las últimas maxCandles velas
      if (resultCandles.length > maxCandles) {
        resultCandles = resultCandles.slice(-maxCandles);
      }
      
      return { 
        candles: resultCandles, 
        action: 'appended', 
        index: resultCandles.length - 1 
      };

    case 'ignore':
    default:
      return { 
        candles: existingCandles, 
        action: 'ignored' 
      };
  }

  return { candles: existingCandles, action: 'ignored' };
}

/**
 * Obtiene información de debug sobre una vela y su ventana de tiempo
 */
export function getCandleDebugInfo(candle: CandleData, interval: string): {
  timestamp: number;
  windowStart: number;
  windowEnd: number;
  formattedTime: string;
  formattedWindowStart: string;
  formattedWindowEnd: string;
} {
  const timestamp = new Date(candle.timestamp).getTime();
  const windowStart = getCandleWindowStart(timestamp, interval);
  const intervalMs = getIntervalInMs(interval);
  const windowEnd = windowStart + intervalMs - 1; // -1 ms para no solapar

  return {
    timestamp,
    windowStart,
    windowEnd,
    formattedTime: new Date(timestamp).toISOString(),
    formattedWindowStart: new Date(windowStart).toISOString(),
    formattedWindowEnd: new Date(windowEnd).toISOString(),
  };
}

/**
 * Valida que una vela tenga datos OHLCV válidos
 */
export function validateCandleData(candle: CandleData): boolean {
  return (
    candle &&
    typeof candle.open === 'number' && !isNaN(candle.open) && candle.open > 0 &&
    typeof candle.high === 'number' && !isNaN(candle.high) && candle.high > 0 &&
    typeof candle.low === 'number' && !isNaN(candle.low) && candle.low > 0 &&
    typeof candle.close === 'number' && !isNaN(candle.close) && candle.close > 0 &&
    typeof candle.volume === 'number' && !isNaN(candle.volume) && candle.volume >= 0 &&
    candle.high >= candle.low &&
    candle.high >= candle.open &&
    candle.high >= candle.close &&
    candle.low <= candle.open &&
    candle.low <= candle.close
  );
}

/**
 * Corrige una vela con datos inválidos usando datos de referencia
 */
export function fixInvalidCandle(candle: CandleData, referencePrice?: number): CandleData {
  const safePrice = referencePrice || candle.close || candle.open || 50000; // Fallback price
  
  return {
    ...candle,
    open: isNaN(candle.open) || candle.open <= 0 ? safePrice : candle.open,
    high: isNaN(candle.high) || candle.high <= 0 ? safePrice : candle.high,
    low: isNaN(candle.low) || candle.low <= 0 ? safePrice : candle.low,
    close: isNaN(candle.close) || candle.close <= 0 ? safePrice : candle.close,
    volume: isNaN(candle.volume) || candle.volume < 0 ? 0 : candle.volume,
  };
}

/**
 * Calcula un rango de precios optimizado para visualización
 */
export function calculateOptimalPriceRange(
  candles: CandleData[],
  paddingPercent: number = 0.05,
  minRangePercent: number = 0.02
): { minPrice: number; maxPrice: number; priceRange: number; tickSize: number } {
  if (candles.length === 0) {
    return { minPrice: 0, maxPrice: 100, priceRange: 100, tickSize: 10 };
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;

  // Encontrar rango real de precios
  for (const candle of candles) {
    if (candle.high > maxPrice) maxPrice = candle.high;
    if (candle.low < minPrice) minPrice = candle.low;
  }

  // Calcular el rango base
  let baseRange = maxPrice - minPrice;
  
  // Si el rango es muy pequeño, establecer un mínimo basado en el precio promedio
  const avgPrice = (maxPrice + minPrice) / 2;
  const minRange = avgPrice * minRangePercent;
  
  if (baseRange < minRange) {
    baseRange = minRange;
    const center = (maxPrice + minPrice) / 2;
    minPrice = center - baseRange / 2;
    maxPrice = center + baseRange / 2;
  }

  // Agregar padding
  const padding = baseRange * paddingPercent;
  minPrice -= padding;
  maxPrice += padding;
  
  // Calcular el tamaño de tick apropiado
  const priceRange = maxPrice - minPrice;
  const tickSize = calculateTickSize(priceRange);

  // Redondear límites a múltiplos del tick size para una mejor visualización
  minPrice = Math.floor(minPrice / tickSize) * tickSize;
  maxPrice = Math.ceil(maxPrice / tickSize) * tickSize;

  return {
    minPrice,
    maxPrice,
    priceRange: maxPrice - minPrice,
    tickSize
  };
}

/**
 * Calcula el tamaño de tick apropiado basado en el rango de precios
 */
export function calculateTickSize(priceRange: number): number {
  if (priceRange <= 0) return 1;

  const magnitude = Math.pow(10, Math.floor(Math.log10(priceRange)));
  const normalizedRange = priceRange / magnitude;

  if (normalizedRange <= 1) return magnitude * 0.1;
  if (normalizedRange <= 2) return magnitude * 0.2;
  if (normalizedRange <= 5) return magnitude * 0.5;
  return magnitude;
}

/**
 * Genera etiquetas de precio para el eje Y
 */
export function generatePriceLabels(
  minPrice: number,
  maxPrice: number,
  tickSize: number,
  maxLabels: number = 5
): number[] {
  const labels: number[] = [];
  const startPrice = Math.ceil(minPrice / tickSize) * tickSize;
  
  for (let price = startPrice; price <= maxPrice && labels.length < maxLabels; price += tickSize) {
    labels.push(price);
  }

  // Asegurar que siempre tenemos al menos los extremos
  if (labels.length === 0 || labels[0] > minPrice + tickSize) {
    labels.unshift(minPrice);
  }
  if (labels[labels.length - 1] < maxPrice - tickSize) {
    labels.push(maxPrice);
  }

  return labels;
}

/**
 * Calcula métricas de rendimiento para el streaming de velas
 */
export function calculateStreamingMetrics(
  updateCount: number,
  startTime: number,
  responseTimes: number[]
): {
  updatesPerSecond: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  efficiency: number;
} {
  const currentTime = Date.now();
  const elapsedSeconds = (currentTime - startTime) / 1000;
  
  const updatesPerSecond = elapsedSeconds > 0 ? updateCount / elapsedSeconds : 0;
  
  let averageResponseTime = 0;
  let minResponseTime = Infinity;
  let maxResponseTime = 0;
  
  if (responseTimes.length > 0) {
    averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    minResponseTime = Math.min(...responseTimes);
    maxResponseTime = Math.max(...responseTimes);
  }

  // Calcular eficiencia (0-1, donde 1 es perfecto)
  const targetUpdatesPerSecond = 10; // Target ideal
  const efficiency = Math.min(1, updatesPerSecond / targetUpdatesPerSecond);

  return {
    updatesPerSecond: Math.round(updatesPerSecond * 100) / 100,
    averageResponseTime: Math.round(averageResponseTime),
    minResponseTime: Math.round(minResponseTime),
    maxResponseTime: Math.round(maxResponseTime),
    efficiency: Math.round(efficiency * 100) / 100,
  };
}
