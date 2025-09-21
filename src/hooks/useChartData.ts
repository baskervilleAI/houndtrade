import { useEffect, useRef, useCallback, useState } from 'react';
import { useChart } from '../context/ChartContext';
import { streamingService } from '../services/streamingService';
import { binanceService, CandleData } from '../services/binanceService';

interface UseChartDataOptions {
  symbol: string;
  timeframe: string;
  autoLoad?: boolean;
  autoStream?: boolean;
}

export const useChartData = (options: UseChartDataOptions) => {
  const { symbol, timeframe, autoLoad = true, autoStream = true } = options;
  const { loadCandles, getCandles, isLoading: isChartLoading } = useChart();
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastSymbolRef = useRef<string>('');
  const lastTimeframeRef = useRef<string>('');

  // Get current candles
  const candles = getCandles(symbol, timeframe);
  const isLoading = isChartLoading(symbol, timeframe);

  // Load initial candle data
  const loadInitialData = useCallback(async () => {
    console.log(`📊 Loading initial chart data for ${symbol} ${timeframe}`);
    
    try {
      await loadCandles(symbol, timeframe, true); // Force refresh
      console.log(`✅ Initial chart data loaded for ${symbol} ${timeframe}`);
    } catch (error) {
      console.error(`❌ Failed to load initial chart data:`, error);
    }
  }, [symbol, timeframe, loadCandles]);

  // Setup real-time candle streaming
  const setupStreaming = useCallback(() => {
    if (!autoStream) return;

    console.log(`📡 Setting up candle streaming for ${symbol} ${timeframe}`);
    
    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    try {
      const unsubscribe = streamingService.subscribeToCandles(
        symbol,
        timeframe,
        (candle) => {
          console.log(`🕯️ Live candle update for ${symbol} ${timeframe}:`, {
            timestamp: candle.timestamp,
            close: candle.close,
            volume: candle.volume
          });
          setLastUpdate(new Date());
          
          // The ChartContext will handle the candle update
          // through its own subscription system
        },
        (error) => {
          console.error(`❌ Candle streaming error:`, error);
          setIsStreaming(false);
        }
      );

      unsubscribeRef.current = unsubscribe;
      setIsStreaming(true);
      console.log(`✅ Candle streaming active for ${symbol} ${timeframe}`);
    } catch (error) {
      console.error(`❌ Failed to setup candle streaming:`, error);
      setIsStreaming(false);
    }
  }, [symbol, timeframe, autoStream]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    if (unsubscribeRef.current) {
      console.log(`🔌 Stopping candle streaming for ${symbol} ${timeframe}`);
      unsubscribeRef.current();
      unsubscribeRef.current = null;
      setIsStreaming(false);
    }
  }, [symbol, timeframe]);

  // Refresh chart data
  const refresh = useCallback(async () => {
    console.log(`🔄 Refreshing chart data for ${symbol} ${timeframe}`);
    
    stopStreaming();
    await loadInitialData();
    setupStreaming();
  }, [symbol, timeframe, loadInitialData, setupStreaming, stopStreaming]);

  // Force reconnect streaming
  const reconnectStreaming = useCallback(() => {
    console.log(`🔄 Reconnecting streaming for ${symbol} ${timeframe}`);
    stopStreaming();
    setTimeout(setupStreaming, 1000); // Delay for clean reconnection
  }, [setupStreaming, stopStreaming, symbol, timeframe]);

  // Auto-load and stream when symbol/timeframe changes
  useEffect(() => {
    const symbolChanged = lastSymbolRef.current !== symbol;
    const timeframeChanged = lastTimeframeRef.current !== timeframe;
    
    if (symbolChanged || timeframeChanged) {
      console.log(`🔄 Chart parameters changed:`, {
        symbol: `${lastSymbolRef.current} → ${symbol}`,
        timeframe: `${lastTimeframeRef.current} → ${timeframe}`
      });

      lastSymbolRef.current = symbol;
      lastTimeframeRef.current = timeframe;

      if (autoLoad) {
        loadInitialData().then(() => {
          if (autoStream) {
            setupStreaming();
          }
        });
      }
    }

    return () => {
      if (symbolChanged || timeframeChanged) {
        stopStreaming();
      }
    };
  }, [symbol, timeframe, autoLoad, autoStream, loadInitialData, setupStreaming, stopStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  // Calculate chart statistics
  const chartStats = useRef({
    candleCount: 0,
    priceRange: { min: 0, max: 0 },
    lastPrice: 0,
    volumeAvg: 0,
  });

  useEffect(() => {
    if (candles.length > 0) {
      const prices = candles.flatMap(c => [c.high, c.low]);
      const volumes = candles.map(c => c.volume);
      
      chartStats.current = {
        candleCount: candles.length,
        priceRange: {
          min: Math.min(...prices),
          max: Math.max(...prices),
        },
        lastPrice: candles[candles.length - 1]?.close || 0,
        volumeAvg: volumes.reduce((a, b) => a + b, 0) / volumes.length,
      };
    }
  }, [candles]);

  return {
    // Data
    candles,
    isLoading,
    isStreaming,
    lastUpdate,
    stats: chartStats.current,
    
    // Actions
    loadInitialData,
    setupStreaming,
    stopStreaming,
    refresh,
    reconnectStreaming,
    
    // Status
    hasData: candles.length > 0,
    isRealtime: isStreaming && !isLoading,
  };
};
