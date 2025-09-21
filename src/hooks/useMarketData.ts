import { useEffect, useRef, useCallback } from 'react';
import { useMarket } from '../context/AppContext';
import { streamingService } from '../services/streamingService';
import { binanceService, TickerData } from '../services/binanceService';

const POPULAR_PAIRS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'];
const INITIAL_FETCH_INTERVAL = 30000; // 30 seconds

interface UseMarketDataOptions {
  autoStart?: boolean;
  symbols?: string[];
  refreshInterval?: number;
}

export const useMarketData = (options: UseMarketDataOptions = {}) => {
  const {
    autoStart = true,
    symbols = POPULAR_PAIRS,
    refreshInterval = INITIAL_FETCH_INTERVAL
  } = options;

  const { updateTicker } = useMarket();
  const unsubscribeFunctions = useRef<Record<string, () => void>>({});
  const isInitialized = useRef(false);
  const refreshInterval_ref = useRef<NodeJS.Timeout | null>(null);

  // Generate mock ticker for fallback
  const generateMockTicker = useCallback((symbol: string): TickerData => {
    const mockData = {
      BTCUSDT: { price: 115500, changePercent24h: -0.04 },  // Updated to current BTC price
      ETHUSDT: { price: 4474, changePercent24h: -0.05 },
      ADAUSDT: { price: 0.8981, changePercent24h: -0.067 },
      BNBUSDT: { price: 1064.8, changePercent24h: 6.81 },
      SOLUSDT: { price: 240.4, changePercent24h: 0.47 },
    }[symbol] || { price: 100, changePercent24h: 0 };

    return {
      symbol,
      price: mockData.price,
      change24h: mockData.price * (mockData.changePercent24h / 100),
      changePercent24h: mockData.changePercent24h,
      high24h: mockData.price * 1.05,
      low24h: mockData.price * 0.95,
      volume24h: Math.random() * 1000000 + 100000,
      quoteVolume24h: Math.random() * 50000000 + 1000000,
      trades24h: Math.floor(Math.random() * 100000) + 10000,
      timestamp: new Date().toISOString(),
      openPrice: mockData.price * 0.99,
      prevClosePrice: mockData.price * 0.995,
      weightedAvgPrice: mockData.price,
    };
  }, []);

  // Initialize market data
  const initializeMarketData = useCallback(async () => {
    if (isInitialized.current) return;
    
    try {
      // Initialize streaming service
      await streamingService.initialize(symbols);
      
      // Load initial data with timeout and fallback
      const dataPromises = symbols.map(async (symbol) => {
        try {
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000) // Increased timeout
          );
          
          const dataPromise = binanceService.getTicker24hr(symbol);
          const result = await Promise.race([dataPromise, timeoutPromise]);
          const ticker = Array.isArray(result) ? result[0] : result;
          
          updateTicker(ticker as TickerData);
          return ticker;
        } catch (error) {
          console.warn(`⚠️ Failed to load ${symbol}, using mock data:`, error);
          const mockTicker = generateMockTicker(symbol);
          updateTicker(mockTicker);
          return mockTicker;
        }
      });

      await Promise.all(dataPromises);
      isInitialized.current = true;
    } catch (error) {
      console.error('❌ Market data initialization failed:', error);
      
      // Fallback to all mock data
      symbols.forEach(symbol => {
        const mockTicker = generateMockTicker(symbol);
        updateTicker(mockTicker);
      });
      
      isInitialized.current = true;
    }
  }, [symbols, updateTicker, generateMockTicker]);

  // Setup real-time streaming
  const setupStreaming = useCallback(() => {
    // Clean up existing subscriptions
    Object.values(unsubscribeFunctions.current).forEach(unsubscribe => unsubscribe());
    unsubscribeFunctions.current = {};

    symbols.forEach(symbol => {
      try {
        const unsubscribe = streamingService.subscribeToTicker(
          symbol,
          (ticker) => {
            updateTicker(ticker);
          },
          (error) => {
            console.error(`❌ Streaming error for ${symbol}:`, error);
          }
        );

        unsubscribeFunctions.current[symbol] = unsubscribe;
      } catch (error) {
        console.error(`❌ Failed to setup streaming for ${symbol}:`, error);
      }
    });
  }, [symbols, updateTicker]);

  // Start market data service
  const start = useCallback(async () => {
    if (isInitialized.current) return;
    
    await initializeMarketData();
    setupStreaming();

    // Setup periodic refresh for resilience - increased interval to reduce restarts
    if (refreshInterval_ref.current) {
      clearInterval(refreshInterval_ref.current);
    }
    
    refreshInterval_ref.current = setInterval(() => {
      // Don't reset initialization flag to prevent constant restarts
      // isInitialized.current = false;
      initializeMarketData();
    }, refreshInterval * 2); // Double the interval for stability
  }, [initializeMarketData, setupStreaming, refreshInterval]);

  // Stop market data service
  const stop = useCallback(() => {
    // Clear refresh interval
    if (refreshInterval_ref.current) {
      clearInterval(refreshInterval_ref.current);
      refreshInterval_ref.current = null;
    }
    
    // Unsubscribe from all streams
    Object.values(unsubscribeFunctions.current).forEach(unsubscribe => unsubscribe());
    unsubscribeFunctions.current = {};
    
    // Cleanup streaming service
    streamingService.cleanup();
    
    isInitialized.current = false;
  }, []);

  // Force reconnect
  const reconnect = useCallback(() => {
    streamingService.reconnectAll();
  }, []);

  // Auto-start if enabled - with singleton pattern to prevent multiple instances
  useEffect(() => {
    if (autoStart && !isInitialized.current) {
      start();
      
      return () => {
        stop();
      };
    }
  }, [autoStart, start, stop]);

  // Get service status
  const getStatus = useCallback(() => {
    return {
      initialized: isInitialized.current,
      streaming: streamingService.getStatus(),
      subscriptions: Object.keys(unsubscribeFunctions.current).length,
    };
  }, []);

  return {
    start,
    stop,
    reconnect,
    getStatus,
    isInitialized: isInitialized.current,
  };
};
