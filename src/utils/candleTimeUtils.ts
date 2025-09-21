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
  const lastCandle = existingCandles[existingCandles.length - 1];
  const lastTimestamp = new Date(lastCandle.timestamp).getTime();

  // Si la nueva vela es de la misma ventana de tiempo que la última
  if (isSameCandleWindow(newTimestamp, lastTimestamp, interval)) {
    return { action: 'update', index: existingCandles.length - 1 };
  }

  // Si la nueva vela es más nueva (nueva ventana de tiempo)
  if (newTimestamp > lastTimestamp) {
    return { action: 'append' };
  }

  // Si la nueva vela es más antigua, buscar si corresponde a alguna vela existente
  for (let i = existingCandles.length - 2; i >= 0; i--) {
    const candleTimestamp = new Date(existingCandles[i].timestamp).getTime();
    if (isSameCandleWindow(newTimestamp, candleTimestamp, interval)) {
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
