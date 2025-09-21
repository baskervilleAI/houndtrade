import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { CandleData, TickerData } from '../types/market';

interface CachedSymbolData {
  candles: Map<string, CandleData[]>; // timeframe -> candles
  currentTicker: TickerData | null;
  lastUpdate: number;
  isStreaming: boolean;
}

interface TechnicalIndicators {
  sma: { [period: number]: number[] };
  ema: { [period: number]: number[] };
  rsi: { period: number; values: number[] } | null;
  macd: { values: { macd: number; signal: number; histogram: number }[] } | null;
  bollinger: { upper: number[]; middle: number[]; lower: number[] } | null;
}

interface ChartDataState {
  // Core data
  cache: Map<string, CachedSymbolData>;
  indicators: Map<string, Map<string, TechnicalIndicators>>; // symbol -> timeframe -> indicators
  
  // Configuration
  maxCacheSize: number;
  maxHistoryHours: number;
  
  // Current state
  currentSymbol: string;
  currentTimeframe: string;
  isLoading: boolean;
  error: string | null;
  
  // Real-time streaming state
  streamingData: Map<string, CandleData>; // symbol -> latest candle
  priceDirection: Map<string, 'up' | 'down' | 'neutral'>; // symbol -> direction
  
  // Actions
  setCandles: (symbol: string, timeframe: string, candles: CandleData[]) => void;
  updateCandle: (symbol: string, timeframe: string, candle: CandleData) => void;
  updateTicker: (symbol: string, ticker: TickerData) => void;
  getCandles: (symbol: string, timeframe: string) => CandleData[];
  getTicker: (symbol: string) => TickerData | null;
  getIndicators: (symbol: string, timeframe: string) => TechnicalIndicators | null;
  getPriceDirection: (symbol: string) => 'up' | 'down' | 'neutral';
  setStreamingStatus: (symbol: string, isStreaming: boolean) => void;
  isSymbolStreaming: (symbol: string) => boolean;
  clearSymbolData: (symbol: string) => void;
  getCacheStats: () => { totalSymbols: number; totalCandles: number; memoryUsage: string };
  setCurrentSymbol: (symbol: string) => void;
  setCurrentTimeframe: (timeframe: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Technical indicator calculation methods
  calculateIndicators: (symbol: string, timeframe: string, candles: CandleData[]) => void;
  calculateSMA: (values: number[], period: number) => number[];
  calculateEMA: (values: number[], period: number) => number[];
  calculateRSI: (values: number[], period: number) => { period: number; values: number[] } | null;
  calculateMACD: (values: number[]) => { values: { macd: number; signal: number; histogram: number }[] } | null;
  calculateBollingerBands: (values: number[], period: number, stdDev: number) => { upper: number[]; middle: number[]; lower: number[] } | null;
}

export const useChartDataStore = create<ChartDataState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    cache: new Map(),
    indicators: new Map(),
    maxCacheSize: 1000,
    maxHistoryHours: 24,
    currentSymbol: 'BTCUSDT',
    currentTimeframe: '1m',
    isLoading: false,
    error: null,
    streamingData: new Map(),
    priceDirection: new Map(),
    
    // Initialize symbol data if not exists
    initializeSymbol: (symbol: string): CachedSymbolData => {
      const state = get();
      if (!state.cache.has(symbol)) {
        const symbolData: CachedSymbolData = {
          candles: new Map(),
          currentTicker: null,
          lastUpdate: 0,
          isStreaming: false,
        };
        state.cache.set(symbol, symbolData);
        state.indicators.set(symbol, new Map());
      }
      return state.cache.get(symbol)!;
    },

    // Set candles for a specific symbol and timeframe
    setCandles: (symbol: string, timeframe: string, candles: CandleData[]) => {
      const state = get();
      const symbolData = state.cache.get(symbol) || {
        candles: new Map(),
        currentTicker: null,
        lastUpdate: 0,
        isStreaming: false,
      };
      
      // Sort candles by timestamp
      const sortedCandles = [...candles].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Limit cache size
      const limitedCandles = sortedCandles.slice(-state.maxCacheSize);
      
      symbolData.candles.set(timeframe, limitedCandles);
      symbolData.lastUpdate = Date.now();
      
      const newCache = new Map(state.cache);
      newCache.set(symbol, symbolData);
      
      set({ cache: newCache });
      
      // Calculate indicators
      get().calculateIndicators(symbol, timeframe, limitedCandles);
      
      console.log(`📊 Cached ${limitedCandles.length} candles for ${symbol} ${timeframe}`);
    },

    // Add or update a single candle (for real-time streaming)
    updateCandle: (symbol: string, timeframe: string, candle: CandleData) => {
      const state = get();
      const symbolData = state.cache.get(symbol) || {
        candles: new Map(),
        currentTicker: null,
        lastUpdate: 0,
        isStreaming: false,
      };
      
      const existing = symbolData.candles.get(timeframe) || [];
      
      // Check if this is an update to the last candle or a new one
      const lastCandle = existing[existing.length - 1];
      const candleTime = new Date(candle.timestamp).getTime();
      
      let updatedCandles: CandleData[];
      
      if (lastCandle && new Date(lastCandle.timestamp).getTime() === candleTime) {
        // Update existing candle
        updatedCandles = [...existing.slice(0, -1), candle];
      } else {
        // Add new candle
        updatedCandles = [...existing, candle].slice(-state.maxCacheSize);
      }
      
      symbolData.candles.set(timeframe, updatedCandles);
      symbolData.lastUpdate = Date.now();
      
      const newCache = new Map(state.cache);
      newCache.set(symbol, symbolData);
      
      // Update streaming data and price direction
      const previous = state.streamingData.get(symbol);
      const newStreamingData = new Map(state.streamingData);
      newStreamingData.set(symbol, candle);
      
      const newPriceDirection = new Map(state.priceDirection);
      if (previous) {
        if (candle.close > previous.close) {
          newPriceDirection.set(symbol, 'up');
        } else if (candle.close < previous.close) {
          newPriceDirection.set(symbol, 'down');
        }
      }
      
      set({ 
        cache: newCache,
        streamingData: newStreamingData,
        priceDirection: newPriceDirection
      });
      
      // Recalculate indicators
      get().calculateIndicators(symbol, timeframe, updatedCandles);
    },

    // Update ticker data
    updateTicker: (symbol: string, ticker: TickerData) => {
      const state = get();
      const symbolData = state.cache.get(symbol) || {
        candles: new Map(),
        currentTicker: null,
        lastUpdate: 0,
        isStreaming: false,
      };
      
      const previousPrice = symbolData.currentTicker?.price || 0;
      
      symbolData.currentTicker = ticker;
      symbolData.lastUpdate = Date.now();
      
      const newCache = new Map(state.cache);
      newCache.set(symbol, symbolData);
      
      // Update price direction
      const newPriceDirection = new Map(state.priceDirection);
      if (ticker.price > previousPrice) {
        newPriceDirection.set(symbol, 'up');
      } else if (ticker.price < previousPrice) {
        newPriceDirection.set(symbol, 'down');
      } else {
        newPriceDirection.set(symbol, 'neutral');
      }
      
      set({ 
        cache: newCache,
        priceDirection: newPriceDirection
      });
    },

    // Get candles for a symbol and timeframe
    getCandles: (symbol: string, timeframe: string): CandleData[] => {
      const state = get();
      const symbolData = state.cache.get(symbol);
      return symbolData?.candles.get(timeframe) || [];
    },

    // Get current ticker for a symbol
    getTicker: (symbol: string): TickerData | null => {
      const state = get();
      return state.cache.get(symbol)?.currentTicker || null;
    },

    // Get technical indicators
    getIndicators: (symbol: string, timeframe: string): TechnicalIndicators | null => {
      const state = get();
      return state.indicators.get(symbol)?.get(timeframe) || null;
    },

    // Calculate technical indicators
    calculateIndicators: (symbol: string, timeframe: string, candles: CandleData[]) => {
      if (candles.length < 20) return; // Need minimum data for indicators
      
      const state = get();
      const closes = candles.map(c => c.close);
      
      const indicators: TechnicalIndicators = {
        sma: {
          10: state.calculateSMA(closes, 10),
          20: state.calculateSMA(closes, 20),
          50: state.calculateSMA(closes, 50),
        },
        ema: {
          12: state.calculateEMA(closes, 12),
          26: state.calculateEMA(closes, 26),
        },
        rsi: state.calculateRSI(closes, 14),
        macd: state.calculateMACD(closes),
        bollinger: state.calculateBollingerBands(closes, 20, 2),
      };
      
      // Store indicators
      const newIndicators = new Map(state.indicators);
      if (!newIndicators.has(symbol)) {
        newIndicators.set(symbol, new Map());
      }
      newIndicators.get(symbol)!.set(timeframe, indicators);
      
      set({ indicators: newIndicators });
    },

    // Technical indicator calculation methods
    calculateSMA: (values: number[], period: number): number[] => {
      const sma: number[] = [];
      for (let i = period - 1; i < values.length; i++) {
        const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
      return sma;
    },

    calculateEMA: (values: number[], period: number): number[] => {
      const ema: number[] = [];
      const multiplier = 2 / (period + 1);
      
      // Start with SMA for first value
      let sum = 0;
      for (let i = 0; i < period; i++) {
        sum += values[i];
      }
      ema.push(sum / period);
      
      // Calculate EMA
      for (let i = period; i < values.length; i++) {
        const value = (values[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
        ema.push(value);
      }
      
      return ema;
    },

    calculateRSI: (values: number[], period: number): { period: number; values: number[] } | null => {
      if (values.length < period + 1) return null;
      
      const gains: number[] = [];
      const losses: number[] = [];
      
      for (let i = 1; i < values.length; i++) {
        const change = values[i] - values[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
      }
      
      const rsi: number[] = [];
      
      // Calculate initial RS
      let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      
      for (let i = period - 1; i < gains.length; i++) {
        if (i > period - 1) {
          avgGain = (avgGain * (period - 1) + gains[i]) / period;
          avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        }
        
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
      
      return { period, values: rsi };
    },

    calculateMACD: (values: number[]): { values: { macd: number; signal: number; histogram: number }[] } | null => {
      const state = get();
      if (values.length < 26) return null;
      
      const ema12 = state.calculateEMA(values, 12);
      const ema26 = state.calculateEMA(values, 26);
      
      if (ema12.length === 0 || ema26.length === 0) return null;
      
      const macdLine: number[] = [];
      const startIndex = 26 - 12; // Offset for EMA26
      
      for (let i = startIndex; i < ema12.length; i++) {
        macdLine.push(ema12[i] - ema26[i - startIndex]);
      }
      
      const signalLine = state.calculateEMA(macdLine, 9);
      
      const result: { macd: number; signal: number; histogram: number }[] = [];
      
      for (let i = 0; i < signalLine.length; i++) {
        const macdIndex = i + (macdLine.length - signalLine.length);
        result.push({
          macd: macdLine[macdIndex],
          signal: signalLine[i],
          histogram: macdLine[macdIndex] - signalLine[i],
        });
      }
      
      return { values: result };
    },

    calculateBollingerBands: (values: number[], period: number, stdDev: number): { upper: number[]; middle: number[]; lower: number[] } | null => {
      const state = get();
      if (values.length < period) return null;
      
      const sma = state.calculateSMA(values, period);
      const upper: number[] = [];
      const lower: number[] = [];
      
      for (let i = 0; i < sma.length; i++) {
        const dataIndex = i + period - 1;
        const slice = values.slice(dataIndex - period + 1, dataIndex + 1);
        
        // Calculate standard deviation
        const mean = sma[i];
        const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
        const standardDeviation = Math.sqrt(variance);
        
        upper.push(mean + (standardDeviation * stdDev));
        lower.push(mean - (standardDeviation * stdDev));
      }
      
      return {
        upper,
        middle: sma,
        lower,
      };
    },

    // Get price direction for visual feedback
    getPriceDirection: (symbol: string): 'up' | 'down' | 'neutral' => {
      const state = get();
      return state.priceDirection.get(symbol) || 'neutral';
    },

    // Set streaming status
    setStreamingStatus: (symbol: string, isStreaming: boolean) => {
      const state = get();
      const symbolData = state.cache.get(symbol) || {
        candles: new Map(),
        currentTicker: null,
        lastUpdate: 0,
        isStreaming: false,
      };
      
      symbolData.isStreaming = isStreaming;
      
      const newCache = new Map(state.cache);
      newCache.set(symbol, symbolData);
      
      set({ cache: newCache });
    },

    // Check if symbol is streaming
    isSymbolStreaming: (symbol: string): boolean => {
      const state = get();
      return state.cache.get(symbol)?.isStreaming || false;
    },

    // Clear all data for a symbol
    clearSymbolData: (symbol: string) => {
      const state = get();
      
      const newCache = new Map(state.cache);
      const newIndicators = new Map(state.indicators);
      const newStreamingData = new Map(state.streamingData);
      const newPriceDirection = new Map(state.priceDirection);
      
      newCache.delete(symbol);
      newIndicators.delete(symbol);
      newStreamingData.delete(symbol);
      newPriceDirection.delete(symbol);
      
      set({
        cache: newCache,
        indicators: newIndicators,
        streamingData: newStreamingData,
        priceDirection: newPriceDirection
      });
    },

    // Get cache stats
    getCacheStats: () => {
      const state = get();
      let totalCandles = 0;
      let totalSymbols = state.cache.size;
      
      for (const [symbol, data] of state.cache.entries()) {
        for (const [timeframe, candles] of data.candles.entries()) {
          totalCandles += candles.length;
        }
      }
      
      return {
        totalSymbols,
        totalCandles,
        memoryUsage: `${(JSON.stringify([...state.cache.entries()]).length / 1024 / 1024).toFixed(2)} MB`,
      };
    },

    // Set current symbol
    setCurrentSymbol: (symbol: string) => set({ currentSymbol: symbol }),

    // Set current timeframe
    setCurrentTimeframe: (timeframe: string) => set({ currentTimeframe: timeframe }),

    // Set loading state
    setLoading: (loading: boolean) => set({ isLoading: loading }),

    // Set error state
    setError: (error: string | null) => set({ error }),
  }))
);

// Export singleton instance for compatibility
export const chartDataStore = {
  getState: useChartDataStore.getState,
  setState: useChartDataStore.setState,
  subscribe: useChartDataStore.subscribe,
};
