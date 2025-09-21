import { create } from 'zustand';
import { MarketState, TickerData, CandleData, Timeframe } from '../types/market';

interface MarketStore extends MarketState {
  // Actions
  setSelectedPair: (symbol: string) => void;
  updateTicker: (ticker: TickerData) => void;
  updateCandles: (symbol: string, timeframe: Timeframe, candles: CandleData[]) => void;
  addCandle: (symbol: string, timeframe: Timeframe, candle: CandleData) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed values
  getCurrentPrice: (symbol: string) => number | null;
  getPriceChange: (symbol: string) => { change: number; changePercent: number } | null;
  getCandles: (symbol: string, timeframe: Timeframe) => CandleData[];
}

export const useMarketStore = create<MarketStore>((set, get) => ({
  // Initial state
  selectedPair: 'BTCUSDT',
  pairs: [],
  tickers: {},
  candleData: {},
  orderBooks: {},
  isLoading: false,
  error: null,
  lastUpdate: new Date().toISOString(),

  // Actions
  setSelectedPair: (symbol: string) => {
    set({ selectedPair: symbol });
  },

  updateTicker: (ticker: TickerData) => {
    set(state => ({
      tickers: {
        ...state.tickers,
        [ticker.symbol]: ticker,
      },
      lastUpdate: new Date().toISOString(),
    }));
  },

  updateCandles: (symbol: string, timeframe: Timeframe, candles: CandleData[]) => {
    set(state => ({
      candleData: {
        ...state.candleData,
        [symbol]: {
          ...state.candleData[symbol],
          [timeframe]: candles,
        },
      },
      lastUpdate: new Date().toISOString(),
    }));
  },

  addCandle: (symbol: string, timeframe: Timeframe, candle: CandleData) => {
    set(state => {
      const existingCandles = state.candleData[symbol]?.[timeframe] || [];
      const updatedCandles = [...existingCandles];
      
      // Check if this candle updates the last one or adds a new one
      const lastCandle = updatedCandles[updatedCandles.length - 1];
      if (lastCandle && lastCandle.timestamp === candle.timestamp) {
        // Update existing candle
        updatedCandles[updatedCandles.length - 1] = candle;
      } else {
        // Add new candle
        updatedCandles.push(candle);
        
        // Keep only last 1000 candles for performance
        if (updatedCandles.length > 1000) {
          updatedCandles.shift();
        }
      }

      return {
        candleData: {
          ...state.candleData,
          [symbol]: {
            ...state.candleData[symbol],
            [timeframe]: updatedCandles,
          },
        },
        lastUpdate: new Date().toISOString(),
      };
    });
  },

  setLoading: (isLoading: boolean) => set({ isLoading }),
  setError: (error: string | null) => set({ error }),

  // Computed values
  getCurrentPrice: (symbol: string) => {
    const ticker = get().tickers[symbol];
    return ticker?.price || null;
  },

  getPriceChange: (symbol: string) => {
    const ticker = get().tickers[symbol];
    if (!ticker) return null;
    
    return {
      change: ticker.change24h,
      changePercent: ticker.changePercent24h,
    };
  },

  getCandles: (symbol: string, timeframe: Timeframe) => {
    return get().candleData[symbol]?.[timeframe] || [];
  },
}));

// Selectors
export const useSelectedPair = () => useMarketStore(state => state.selectedPair);
export const useTickers = () => useMarketStore(state => state.tickers);
export const useCurrentPrice = (symbol: string) => useMarketStore(state => state.getCurrentPrice(symbol));
export const usePriceChange = (symbol: string) => useMarketStore(state => state.getPriceChange(symbol));
export const useCandles = (symbol: string, timeframe: Timeframe) => 
  useMarketStore(state => state.getCandles(symbol, timeframe));