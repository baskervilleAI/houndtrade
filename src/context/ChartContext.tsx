import React, { createContext, useContext, useReducer, useCallback, useRef, ReactNode } from 'react';
import { binanceService, CandleData } from '../services/binanceService';

interface ChartState {
  candleData: Record<string, CandleData[]>; // key: symbol_interval
  isLoading: Record<string, boolean>;
  lastUpdate: Record<string, number>;
  currentTimeframe: string;
  subscriptions: Record<string, boolean>; // Track active subscriptions
}

type ChartAction = 
  | { type: 'SET_LOADING'; payload: { key: string; loading: boolean } }
  | { type: 'SET_CANDLES'; payload: { key: string; candles: CandleData[] } }
  | { type: 'UPDATE_LAST_CANDLE'; payload: { key: string; candle: CandleData } }
  | { type: 'ADD_NEW_CANDLE'; payload: { key: string; candle: CandleData } }
  | { type: 'SET_TIMEFRAME'; payload: string }
  | { type: 'SET_SUBSCRIPTION'; payload: { key: string; active: boolean } }
  | { type: 'CLEAR_DATA'; payload?: string };

const initialState: ChartState = {
  candleData: {},
  isLoading: {},
  lastUpdate: {},
  currentTimeframe: '1h',
  subscriptions: {},
};

function chartReducer(state: ChartState, action: ChartAction): ChartState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: {
          ...state.isLoading,
          [action.payload.key]: action.payload.loading,
        },
      };

    case 'SET_CANDLES':
      return {
        ...state,
        candleData: {
          ...state.candleData,
          [action.payload.key]: action.payload.candles,
        },
        lastUpdate: {
          ...state.lastUpdate,
          [action.payload.key]: Date.now(),
        },
      };

    case 'UPDATE_LAST_CANDLE': {
      const currentCandles = state.candleData[action.payload.key] || [];
      if (currentCandles.length === 0) return state;

      const updatedCandles = [...currentCandles];
      updatedCandles[updatedCandles.length - 1] = action.payload.candle;

      return {
        ...state,
        candleData: {
          ...state.candleData,
          [action.payload.key]: updatedCandles,
        },
        lastUpdate: {
          ...state.lastUpdate,
          [action.payload.key]: Date.now(),
        },
      };
    }

    case 'ADD_NEW_CANDLE': {
      const currentCandles = state.candleData[action.payload.key] || [];
      const newCandles = [...currentCandles, action.payload.candle];
      
      // Keep only last 200 candles for performance
      const trimmedCandles = newCandles.slice(-200);

      return {
        ...state,
        candleData: {
          ...state.candleData,
          [action.payload.key]: trimmedCandles,
        },
        lastUpdate: {
          ...state.lastUpdate,
          [action.payload.key]: Date.now(),
        },
      };
    }

    case 'SET_TIMEFRAME':
      return {
        ...state,
        currentTimeframe: action.payload,
      };

    case 'SET_SUBSCRIPTION':
      return {
        ...state,
        subscriptions: {
          ...state.subscriptions,
          [action.payload.key]: action.payload.active,
        },
      };

    case 'CLEAR_DATA':
      if (action.payload) {
        const newCandleData = { ...state.candleData };
        const newIsLoading = { ...state.isLoading };
        const newLastUpdate = { ...state.lastUpdate };
        
        delete newCandleData[action.payload];
        delete newIsLoading[action.payload];
        delete newLastUpdate[action.payload];
        
        return {
          ...state,
          candleData: newCandleData,
          isLoading: newIsLoading,
          lastUpdate: newLastUpdate,
        };
      }
      return initialState;

    default:
      return state;
  }
}

interface ChartContextType {
  state: ChartState;
  loadCandles: (symbol: string, timeframe: string, forceRefresh?: boolean) => Promise<void>;
  subscribeToUpdates: (symbol: string, timeframe: string) => () => void;
  setTimeframe: (timeframe: string) => void;
  getCandles: (symbol: string, timeframe: string) => CandleData[];
  isLoading: (symbol: string, timeframe: string) => boolean;
  clearCache: (symbol?: string, timeframe?: string) => void;
}

const ChartContext = createContext<ChartContextType | null>(null);

export const ChartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(chartReducer, initialState);
  const unsubscribeFunctions = useRef<Record<string, () => void>>({});
  const loadingPromises = useRef<Record<string, Promise<void>>>({});

  const getKey = useCallback((symbol: string, timeframe: string) => `${symbol}_${timeframe}`, []);

  // Generate mock candles for fallback
  const generateMockCandles = useCallback((symbol: string, count: number = 100): CandleData[] => {
    const candles: CandleData[] = [];
    const basePrice = symbol === 'BTCUSDT' ? 95000 : 
                     symbol === 'ETHUSDT' ? 3500 : 
                     symbol === 'ADAUSDT' ? 0.8 : 
                     symbol === 'BNBUSDT' ? 650 : 250;
    
    let currentPrice = basePrice * 0.98; // Start slightly lower
    const now = Date.now();
    
    for (let i = 0; i < count; i++) {
      const timestamp = new Date(now - (count - i) * 60000).toISOString();
      const variation = (Math.random() - 0.5) * 0.02; // 2% max change
      const open = currentPrice;
      const high = open * (1 + Math.abs(variation) + Math.random() * 0.01);
      const low = open * (1 - Math.abs(variation) - Math.random() * 0.01);
      const close = open * (1 + variation);
      
      candles.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 1000000) + 100000,
        trades: Math.floor(Math.random() * 5000) + 100,
        quoteVolume: Math.floor(Math.random() * 50000000) + 1000000,
      });
      
      currentPrice = close;
    }
    
    return candles;
  }, []);

  // Load candles with intelligent caching and fallback
  const loadCandles = useCallback(async (
    symbol: string, 
    timeframe: string, 
    forceRefresh: boolean = false
  ) => {
    const key = getKey(symbol, timeframe);
    
    // Prevent duplicate requests
    if (key in loadingPromises.current) {
      return loadingPromises.current[key];
    }

    // Check if data exists and is recent
    const existingCandles = state.candleData[key];
    const lastUpdate = state.lastUpdate[key];
    const isDataFresh = lastUpdate && (Date.now() - lastUpdate) < 30000; // 30 seconds

    if (existingCandles && existingCandles.length > 0 && isDataFresh && !forceRefresh) {
      console.log(`♻️ Using cached data for ${key} (${existingCandles.length} candles)`);
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: { key, loading: true } });

    const loadPromise = (async () => {
      try {
        let candles: CandleData[];

        try {
          console.log(`📊 Loading candles for ${key}...`);
          
          if (existingCandles && existingCandles.length > 0 && !forceRefresh) {
            // Load only missing candles for efficiency
            const lastCandle = existingCandles[existingCandles.length - 1];
            const missingCandles = await binanceService.getMissingKlines(
              symbol, 
              binanceService.getIntervalFromTimeframe(timeframe),
              lastCandle.timestamp,
              50
            );
            
            if (missingCandles.length > 0) {
              candles = [...existingCandles, ...missingCandles];
              console.log(`📈 Added ${missingCandles.length} missing candles to ${key}`);
            } else {
              candles = existingCandles;
            }
          } else {
            // Load fresh historical data
            candles = await binanceService.getKlines(
              symbol,
              binanceService.getIntervalFromTimeframe(timeframe),
              200 // Más datos históricos para mejor visualización
            );
            console.log(`🆕 Loaded ${candles.length} fresh candles for ${key}`);
          }
        } catch (apiError) {
          console.warn(`⚠️ Binance API failed for ${key}, using mock data:`, apiError);
          // Fallback to mock data
          candles = generateMockCandles(symbol, 200);
          console.log(`🎭 Generated ${candles.length} mock candles for ${key}`);
        }

        // Validate candles before setting
        const validCandles = candles.filter(candle => {
          return candle && 
                 typeof candle.open === 'number' && !isNaN(candle.open) && candle.open > 0 &&
                 typeof candle.close === 'number' && !isNaN(candle.close) && candle.close > 0;
        });

        console.log(`✅ Setting ${validCandles.length} valid candles for ${key}`);
        dispatch({ type: 'SET_CANDLES', payload: { key, candles: validCandles } });
      } catch (error) {
        console.error(`❌ Error loading candles for ${key}:`, error);
        // Final fallback - generate mock data
        const mockCandles = generateMockCandles(symbol, 200);
        dispatch({ type: 'SET_CANDLES', payload: { key, candles: mockCandles } });
        console.log(`🎭 Fallback: Generated ${mockCandles.length} mock candles for ${key}`);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: { key, loading: false } });
        delete loadingPromises.current[key];
      }
    })();

    loadingPromises.current[key] = loadPromise;
    return loadPromise;
  }, [state.candleData, state.lastUpdate, getKey, generateMockCandles]);

  // Subscribe to real-time updates with optimization
  const subscribeToUpdates = useCallback((symbol: string, timeframe: string) => {
    const key = getKey(symbol, timeframe);
    
    // Prevent duplicate subscriptions
    if (unsubscribeFunctions.current[key]) {
      console.log(`♻️ Reusing subscription for ${key}`);
      return unsubscribeFunctions.current[key];
    }

    console.log(`🚀 Subscribing to real-time updates for ${key}`);
    dispatch({ type: 'SET_SUBSCRIPTION', payload: { key, active: true } });

    const unsubscribe = binanceService.subscribeToKlines(
      symbol,
      binanceService.getIntervalFromTimeframe(timeframe),
      (candle: CandleData) => {
        // Determine if this is an update to existing candle or new candle
        const existingCandles = state.candleData[key] || [];
        const lastCandle = existingCandles[existingCandles.length - 1];
        
        if (lastCandle && new Date(candle.timestamp).getTime() === new Date(lastCandle.timestamp).getTime()) {
          // Update existing candle
          dispatch({ type: 'UPDATE_LAST_CANDLE', payload: { key, candle } });
        } else if (lastCandle && new Date(candle.timestamp).getTime() > new Date(lastCandle.timestamp).getTime()) {
          // Add new candle
          dispatch({ type: 'ADD_NEW_CANDLE', payload: { key, candle } });
        }
      },
      (error) => {
        console.error(`❌ WebSocket error for ${key}:`, error);
        dispatch({ type: 'SET_SUBSCRIPTION', payload: { key, active: false } });
      }
    );

    unsubscribeFunctions.current[key] = () => {
      unsubscribe();
      dispatch({ type: 'SET_SUBSCRIPTION', payload: { key, active: false } });
      delete unsubscribeFunctions.current[key];
      console.log(`🔌 Unsubscribed from ${key}`);
    };

    return unsubscribeFunctions.current[key];
  }, [getKey, state.candleData]);

  // Set timeframe
  const setTimeframe = useCallback((timeframe: string) => {
    dispatch({ type: 'SET_TIMEFRAME', payload: timeframe });
  }, []);

  // Get candles
  const getCandles = useCallback((symbol: string, timeframe: string): CandleData[] => {
    const key = getKey(symbol, timeframe);
    return state.candleData[key] || [];
  }, [state.candleData, getKey]);

  // Check loading state
  const isLoading = useCallback((symbol: string, timeframe: string): boolean => {
    const key = getKey(symbol, timeframe);
    return state.isLoading[key] || false;
  }, [state.isLoading, getKey]);

  // Clear cache
  const clearCache = useCallback((symbol?: string, timeframe?: string) => {
    if (symbol && timeframe) {
      const key = getKey(symbol, timeframe);
      dispatch({ type: 'CLEAR_DATA', payload: key });
      binanceService.clearCache(symbol, timeframe);
    } else {
      dispatch({ type: 'CLEAR_DATA' });
      binanceService.clearCache();
    }
  }, [getKey]);

  const contextValue: ChartContextType = {
    state,
    loadCandles,
    subscribeToUpdates,
    setTimeframe,
    getCandles,
    isLoading,
    clearCache,
  };

  return (
    <ChartContext.Provider value={contextValue}>
      {children}
    </ChartContext.Provider>
  );
};

export const useChart = () => {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error('useChart must be used within ChartProvider');
  }
  return context;
};
