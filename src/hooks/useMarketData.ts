import { useEffect, useRef, useCallback } from 'react';
import { useMarket } from '../context/AppContext';
import { streamingService } from '../services/streamingService';
import { binanceService, TickerData } from '../services/binanceService';

const POPULAR_PAIRS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'];
const INITIAL_FETCH_INTERVAL = 2000; // OPTIMIZED: Reduced from 5000ms to 2000ms for faster updates

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
    
    // Solo log inicial
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Iniciando datos de mercado...');
    }
    
    try {
      // Initialize streaming service first
      await streamingService.initialize(symbols);
      
      // Load initial data with timeout and fallback
      const dataPromises = symbols.map(async (symbol) => {
        try {
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 3000)
          );
          
          const dataPromise = binanceService.getTicker24hr(symbol);
          const result = await Promise.race([dataPromise, timeoutPromise]);
          const ticker = Array.isArray(result) ? result[0] : result;
          
          // Log solo éxito significativo
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ ${symbol}: $${ticker.price}`);
          }
          
          // Immediately update the ticker in context
          updateTicker(ticker as TickerData);
          return ticker;
        } catch (error) {
          // Log solo errores importantes
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ ${symbol}: usando datos mock`);
          }
          const mockTicker = generateMockTicker(symbol);
          updateTicker(mockTicker);
          return mockTicker;
        }
      });

      await Promise.all(dataPromises);
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Datos de mercado inicializados');
      }
      isInitialized.current = true;
    } catch (error) {
      console.error('❌ Error inicializando datos:', error);
      
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
            // Solo log ocasional para verificar funcionamiento
            if (Math.random() < 0.001) { // 0.1% de las actualizaciones
              console.log(`📈 Live update ${symbol}: $${ticker.price}`);
            }
            updateTicker(ticker);
          },
          (error) => {
            console.error(`❌ Streaming error para ${symbol}:`, error);
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
    if (isInitialized.current) {
      return;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('💰 Iniciando servicio de datos...');
    }
    
    await initializeMarketData();
    setupStreaming();

    // Setup periodic refresh for resilience - increased interval to reduce restarts
    if (refreshInterval_ref.current) {
      clearInterval(refreshInterval_ref.current);
    }
    
    refreshInterval_ref.current = setInterval(() => {
      // Silent refresh - but more frequent for better responsiveness
      initializeMarketData();
    }, refreshInterval * 2); // OPTIMIZED: Reduced from *4 to *2 for better updates

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Servicio de datos iniciado');
    }
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
  }, [autoStart]); // Remove start and stop from dependencies to prevent loops

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
