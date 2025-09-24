import { useMemo } from 'react';
import { CandleData } from '../services/liveStreamingService';

export interface TechnicalIndicators {
  sma20: number[];
  sma50: number[];
  ema20: number[];
  rsi: number[];
  bollinger: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
  volume: number[];
  macd: {
    macd: number[];
    signal: number[];
    histogram: number[];
  };
}

// Simple Moving Average
function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  
  return sma;
}

// Exponential Moving Average
function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < prices.length; i++) {
    if (i === 0) {
      ema.push(prices[i]);
    } else {
      ema.push((prices[i] - ema[i - 1]) * multiplier + ema[i - 1]);
    }
  }
  
  return ema;
}

// Relative Strength Index
function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      rsi.push(NaN);
    } else {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      
      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
  }
  
  // Agregar NaN al inicio para compensar el primer precio
  return [NaN, ...rsi];
}

// Bollinger Bands
function calculateBollingerBands(prices: number[], period: number = 20, multiplier: number = 2) {
  const sma = calculateSMA(prices, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = sma[i];
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      
      upper.push(mean + (stdDev * multiplier));
      lower.push(mean - (stdDev * multiplier));
    }
  }
  
  return {
    upper,
    middle: sma,
    lower
  };
}

// MACD (Moving Average Convergence Divergence)
function calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
  const ema12 = calculateEMA(prices, fastPeriod);
  const ema26 = calculateEMA(prices, slowPeriod);
  
  const macdLine = ema12.map((value, index) => value - ema26[index]);
  const signalLine = calculateEMA(macdLine.filter(value => !isNaN(value)), signalPeriod);
  
  // Rellenar los valores faltantes al inicio
  const paddedSignal = new Array(macdLine.length - signalLine.length).fill(NaN).concat(signalLine);
  
  const histogram = macdLine.map((value, index) => value - (paddedSignal[index] || 0));
  
  return {
    macd: macdLine,
    signal: paddedSignal,
    histogram
  };
}

export const useTechnicalIndicators = (candleData: CandleData[]): TechnicalIndicators => {
  return useMemo(() => {
    if (!candleData || candleData.length === 0) {
      return {
        sma20: [],
        sma50: [],
        ema20: [],
        rsi: [],
        bollinger: {
          upper: [],
          middle: [],
          lower: []
        },
        volume: [],
        macd: {
          macd: [],
          signal: [],
          histogram: []
        }
      };
    }

    const closePrices = candleData.map(candle => candle.c);
    const volumes = candleData.map(candle => candle.v || 0);

    // Calcular todos los indicadores
    const sma20 = calculateSMA(closePrices, 20);
    const sma50 = calculateSMA(closePrices, 50);
    const ema20 = calculateEMA(closePrices, 20);
    const rsi = calculateRSI(closePrices, 14);
    const bollinger = calculateBollingerBands(closePrices, 20, 2);
    const macd = calculateMACD(closePrices, 12, 26, 9);

    return {
      sma20,
      sma50,
      ema20,
      rsi,
      bollinger,
      volume: volumes,
      macd
    };
  }, [candleData]);
};

// Función helper para agregar indicadores al gráfico de Chart.js
export const addIndicatorToChart = (
  chart: any,
  indicator: 'sma20' | 'sma50' | 'ema20' | 'bollinger' | 'rsi' | 'macd',
  data: TechnicalIndicators,
  candleData: CandleData[]
) => {
  if (!chart || !chart.data || !chart.data.datasets) return;

  const timestamps = candleData.map(candle => candle.x);

  switch (indicator) {
    case 'sma20':
      chart.data.datasets.push({
        label: 'SMA 20',
        type: 'line',
        data: timestamps.map((x, i) => ({ x, y: data.sma20[i] })),
        borderColor: '#ffaa00',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1
      });
      break;

    case 'sma50':
      chart.data.datasets.push({
        label: 'SMA 50',
        type: 'line',
        data: timestamps.map((x, i) => ({ x, y: data.sma50[i] })),
        borderColor: '#ff6600',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1
      });
      break;

    case 'ema20':
      chart.data.datasets.push({
        label: 'EMA 20',
        type: 'line',
        data: timestamps.map((x, i) => ({ x, y: data.ema20[i] })),
        borderColor: '#00aaff',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1
      });
      break;

    case 'bollinger':
      // Banda superior
      chart.data.datasets.push({
        label: 'BB Upper',
        type: 'line',
        data: timestamps.map((x, i) => ({ x, y: data.bollinger.upper[i] })),
        borderColor: 'rgba(255, 255, 255, 0.5)',
        backgroundColor: 'transparent',
        borderWidth: 1,
        pointRadius: 0,
        borderDash: [5, 5]
      });

      // Banda media (SMA 20)
      chart.data.datasets.push({
        label: 'BB Middle',
        type: 'line',
        data: timestamps.map((x, i) => ({ x, y: data.bollinger.middle[i] })),
        borderColor: '#ffffff',
        backgroundColor: 'transparent',
        borderWidth: 1,
        pointRadius: 0
      });

      // Banda inferior
      chart.data.datasets.push({
        label: 'BB Lower',
        type: 'line',
        data: timestamps.map((x, i) => ({ x, y: data.bollinger.lower[i] })),
        borderColor: 'rgba(255, 255, 255, 0.5)',
        backgroundColor: 'transparent',
        borderWidth: 1,
        pointRadius: 0,
        borderDash: [5, 5]
      });
      break;
  }

  chart.update('none');
};

export default useTechnicalIndicators;
