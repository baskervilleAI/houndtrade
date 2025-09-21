/**
 * Performance Optimizations for Real-time Trading Interface
 * Implements memoization, virtualization, and selective updates
 */

import { memo, useMemo, useCallback, useEffect, useRef } from 'react';
import { useChartDataStore } from '../stores/chartDataStore';
import { CandleData, TickerData } from '../services/binanceService';

// Memoized candle display component
export const OptimizedCandle = memo<{
  candle: CandleData;
  index: number;
  width: number;
  height: number;
  priceScale: (price: number) => number;
}>(({ candle, width, height, priceScale }) => {
  const isGreen = candle.close > candle.open;
  const bodyTop = Math.min(priceScale(candle.open), priceScale(candle.close));
  const bodyHeight = Math.abs(priceScale(candle.close) - priceScale(candle.open));
  const wickTop = priceScale(candle.high);
  const wickBottom = priceScale(candle.low);
  
  return (
    <g>
      {/* Wick */}
      <line
        x1={width / 2}
        y1={wickTop}
        x2={width / 2}
        y2={wickBottom}
        stroke={isGreen ? '#00ff88' : '#ff4757'}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={width * 0.2}
        y={bodyTop}
        width={width * 0.6}
        height={Math.max(bodyHeight, 1)}
        fill={isGreen ? '#00ff88' : '#ff4757'}
        stroke={isGreen ? '#00ff88' : '#ff4757'}
        strokeWidth={1}
      />
    </g>
  );
});

// Performance-optimized price ticker component
export const OptimizedTicker = memo<{
  symbol: string;
  ticker: TickerData | null;
}>(({ symbol, ticker }) => {
  const prevPriceRef = useRef<number>(0);
  
  const priceDirection = useMemo(() => {
    if (!ticker) return 'neutral';
    const direction = ticker.price > prevPriceRef.current ? 'up' : 
                     ticker.price < prevPriceRef.current ? 'down' : 'neutral';
    prevPriceRef.current = ticker.price;
    return direction;
  }, [ticker?.price]);

  if (!ticker) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: 8,
      backgroundColor: '#161b22',
      borderRadius: 4,
    }}>
      <span style={{ color: '#f0f6fc', fontWeight: 'bold' }}>{symbol}</span>
      <span style={{
        color: priceDirection === 'up' ? '#00ff88' : 
               priceDirection === 'down' ? '#ff4757' : '#8b949e',
        fontSize: 18,
        fontWeight: 'bold'
      }}>
        ${ticker.price.toLocaleString()}
      </span>
      <span style={{
        color: ticker.changePercent24h >= 0 ? '#00ff88' : '#ff4757',
        fontSize: 14
      }}>
        {ticker.changePercent24h >= 0 ? '+' : ''}{ticker.changePercent24h.toFixed(2)}%
      </span>
    </div>
  );
});

// Virtualized chart viewport for large datasets
export const useVirtualizedChart = (
  candles: CandleData[], 
  containerWidth: number,
  candleWidth: number = 8
) => {
  return useMemo(() => {
    const visibleCandles = Math.floor(containerWidth / candleWidth);
    const startIndex = Math.max(0, candles.length - visibleCandles);
    const endIndex = candles.length;
    
    return {
      visibleCandles: candles.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      totalCandles: candles.length,
      candleWidth,
      chartWidth: visibleCandles * candleWidth,
    };
  }, [candles, containerWidth, candleWidth]);
};

// Selective update hook for chart data
export const useSelectiveUpdates = (symbol: string, timeframe: string) => {
  const { getCandles, getTicker, getIndicators } = useChartDataStore();
  const lastUpdateRef = useRef<{
    candleCount: number;
    tickerPrice: number;
    timestamp: number;
  }>({ candleCount: 0, tickerPrice: 0, timestamp: 0 });

  return useMemo(() => {
    const candles = getCandles(symbol, timeframe);
    const ticker = getTicker(symbol);
    const indicators = getIndicators(symbol, timeframe);
    const now = Date.now();
    
    // Check if we need to update
    const needsUpdate = 
      candles.length !== lastUpdateRef.current.candleCount ||
      (ticker?.price || 0) !== lastUpdateRef.current.tickerPrice ||
      now - lastUpdateRef.current.timestamp > 1000; // Max 1 update per second
    
    if (needsUpdate) {
      lastUpdateRef.current = {
        candleCount: candles.length,
        tickerPrice: ticker?.price || 0,
        timestamp: now,
      };
    }
    
    return needsUpdate ? { candles, ticker, indicators } : null;
  }, [symbol, timeframe, getCandles, getTicker, getIndicators]);
};

// Throttled price scale calculator
export const usePriceScale = (candles: CandleData[], height: number) => {
  return useMemo(() => {
    if (candles.length === 0) return (price: number) => height / 2;
    
    const prices = candles.flatMap(c => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.1; // 10% padding
    
    return (price: number) => {
      const normalizedPrice = (price - (minPrice - padding)) / (priceRange + 2 * padding);
      return height - (normalizedPrice * height); // Invert Y axis
    };
  }, [candles, height]);
};

// Debounced resize handler
export const useDebouncedResize = (callback: () => void, delay: number = 100) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(callback, delay);
  }, [callback, delay]);
};

// Memory usage monitor
export const useMemoryMonitor = () => {
  const { getCacheStats } = useChartDataStore();
  
  return useMemo(() => {
    const stats = getCacheStats();
    
    // Calculate estimated memory usage
    const estimatedMemory = stats.totalCandles * 200 + stats.totalSymbols * 500; // bytes
    const memoryMB = (estimatedMemory / 1024 / 1024).toFixed(2);
    
    return {
      ...stats,
      estimatedMemoryMB: memoryMB,
      isHighMemory: parseFloat(memoryMB) > 50, // Flag if over 50MB
    };
  }, [getCacheStats]);
};

// Performance monitoring component
export const PerformanceMonitor = memo(() => {
  const memoryStats = useMemoryMonitor();
  const renderCountRef = useRef(0);
  const lastRenderRef = useRef(Date.now());
  
  renderCountRef.current++;
  const fps = 1000 / (Date.now() - lastRenderRef.current);
  lastRenderRef.current = Date.now();
  
  return (
    <div style={{
      position: 'absolute',
      top: 10,
      right: 10,
      padding: 8,
      backgroundColor: 'rgba(0,0,0,0.8)',
      color: '#fff',
      fontSize: 10,
      borderRadius: 4,
      zIndex: 1000,
    }}>
      <div>FPS: {fps.toFixed(1)}</div>
      <div>Renders: {renderCountRef.current}</div>
      <div>Memory: {memoryStats.estimatedMemoryMB}MB</div>
      <div>Candles: {memoryStats.totalCandles}</div>
      {memoryStats.isHighMemory && (
        <div style={{ color: '#ff4757' }}>⚠️ High Memory</div>
      )}
    </div>
  );
});

// Batch update scheduler for multiple ticker updates
export class BatchUpdateScheduler {
  private updates: Map<string, any> = new Map();
  private timeoutId: NodeJS.Timeout | null = null;
  private callback: (updates: Map<string, any>) => void;

  constructor(callback: (updates: Map<string, any>) => void, delay: number = 16) {
    this.callback = callback;
  }

  schedule(key: string, data: any) {
    this.updates.set(key, data);
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.timeoutId = setTimeout(() => {
      this.callback(new Map(this.updates));
      this.updates.clear();
      this.timeoutId = null;
    }, 16); // ~60fps
  }

  flush() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.callback(new Map(this.updates));
      this.updates.clear();
      this.timeoutId = null;
    }
  }
}

export default {
  OptimizedCandle,
  OptimizedTicker,
  useVirtualizedChart,
  useSelectiveUpdates,
  usePriceScale,
  useDebouncedResize,
  useMemoryMonitor,
  PerformanceMonitor,
  BatchUpdateScheduler,
};
