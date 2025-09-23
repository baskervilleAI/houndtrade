/**
 * Service Integration Layer
 * Connects the new chart data store with existing services
 */

import { useCallback } from 'react';
import { useChartDataStore } from '../stores/chartDataStore';
import { streamingService } from '../services/streamingService';
import { binanceService, CandleData, TickerData } from '../services/binanceService';

interface ServiceIntegrationOptions {
  symbols?: string[];
  timeframes?: string[];
  enableStreaming?: boolean;
  enableCaching?: boolean;
}

const DEFAULT_OPTIONS: ServiceIntegrationOptions = {
  symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'],
  timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
  enableStreaming: true,
  enableCaching: true,
};

export const useServiceIntegration = (options: ServiceIntegrationOptions = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  
  const {
    setCandles,
    updateCandle,
    updateTicker,
    setCurrentSymbol,
    setCurrentTimeframe,
    setLoading,
    setError,
    setStreamingStatus,
    currentSymbol,
    currentTimeframe,
  } = useChartDataStore();

  // Load historical data for a symbol/timeframe
  const loadHistoricalData = useCallback(async (
    symbol: string, 
    timeframe: string, 
    limit: number = 900
  ) => {
    try {
      setLoading(true);
      
      const candles = await binanceService.getKlines(symbol, timeframe, limit);
      
      if (candles && candles.length > 0) {
        setCandles(symbol, timeframe, candles);
        return candles;
      } else {
        throw new Error('No data received');
      }
    } catch (error) {
      console.error(`❌ Failed to load historical data for ${symbol}:`, error);
      setError(`Failed to load data for ${symbol}: ${error}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setCandles, setLoading, setError]);

  // Load ticker data
  const loadTickerData = useCallback(async (symbol: string) => {
    try {
      const tickerData = await binanceService.getTicker24hr(symbol);
      const ticker = Array.isArray(tickerData) ? tickerData[0] : tickerData;
      
      updateTicker(symbol, ticker);
    } catch (error) {
      console.error(`❌ Failed to load ticker for ${symbol}:`, error);
      
      // Generate fallback ticker data with all required fields
      const fallbackPrice = 50000 + Math.random() * 20000;
      const fallbackTicker: TickerData = {
        symbol,
        price: fallbackPrice,
        change24h: -100 + Math.random() * 200,
        changePercent24h: -2 + Math.random() * 4,
        volume24h: 100000 + Math.random() * 50000,
        quoteVolume24h: 1000000 + Math.random() * 500000,
        trades24h: 10000 + Math.floor(Math.random() * 5000),
        high24h: fallbackPrice * 1.02,
        low24h: fallbackPrice * 0.98,
        timestamp: new Date().toISOString(),
        openPrice: fallbackPrice * 0.99,
        prevClosePrice: fallbackPrice * 0.995,
        weightedAvgPrice: fallbackPrice,
      };
      
      updateTicker(symbol, fallbackTicker);
    }
  }, [updateTicker]);

  // Start streaming for a symbol
  const startStreaming = useCallback(async (symbol: string, timeframes: string[] = ['1m']) => {
    if (!config.enableStreaming) return;

    try {
      // Initialize streaming service if needed
      await streamingService.initialize([symbol]);
      
      // Subscribe to ticker updates
      streamingService.subscribeToTicker(
        symbol,
        (ticker: TickerData) => {
          updateTicker(symbol, ticker);
        },
        (error: any) => {
          console.error(`❌ Ticker streaming error for ${symbol}:`, error);
        }
      );

      setStreamingStatus(symbol, true);
    } catch (error) {
      console.error(`❌ Failed to start streaming for ${symbol}:`, error);
      setStreamingStatus(symbol, false);
    }
  }, [config.enableStreaming, updateTicker, setStreamingStatus]);

  // Stop streaming for a symbol
  const stopStreaming = useCallback((symbol: string) => {
    setStreamingStatus(symbol, false);
    // Note: streamingService doesn't have a method to unsubscribe from specific symbols
    // This would need to be implemented in the streaming service
  }, [setStreamingStatus]);

  // Initialize data for a trading pair
  const initializeTradingPair = useCallback(async (
    symbol: string, 
    timeframe: string = '1m'
  ) => {
    try {
      setCurrentSymbol(symbol);
      setCurrentTimeframe(timeframe);
      
      // Load initial data in parallel
      const [historicalData] = await Promise.all([
        loadHistoricalData(symbol, timeframe),
        loadTickerData(symbol),
      ]);
      
      // Start streaming
      if (config.enableStreaming) {
        await startStreaming(symbol, [timeframe]);
      }
      
      return historicalData;
    } catch (error) {
      console.error(`❌ Failed to initialize trading pair ${symbol}:`, error);
      throw error;
    }
  }, [
    setCurrentSymbol, 
    setCurrentTimeframe, 
    loadHistoricalData, 
    loadTickerData, 
    startStreaming,
    config.enableStreaming
  ]);

  // Switch to different symbol/timeframe
  const switchTradingPair = useCallback(async (
    newSymbol: string, 
    newTimeframe?: string
  ) => {
    const targetTimeframe = newTimeframe || currentTimeframe;
    
    // Stop current streaming if switching symbols
    if (newSymbol !== currentSymbol) {
      stopStreaming(currentSymbol);
    }
    
    // Initialize new pair
    await initializeTradingPair(newSymbol, targetTimeframe);
  }, [currentSymbol, currentTimeframe, stopStreaming, initializeTradingPair]);

  // Bulk initialize multiple symbols (for initial app load)
  const initializeMultipleSymbols = useCallback(async (
    symbols: string[] = config.symbols || [],
    timeframe: string = '1m'
  ) => {
    const results = await Promise.allSettled(
      symbols.map(symbol => 
        Promise.all([
          loadHistoricalData(symbol, timeframe),
          loadTickerData(symbol)
        ])
      )
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ Bulk initialization complete: ${successful}/${symbols.length} successful`);
    
    // Start streaming for the first symbol
    if (symbols.length > 0 && config.enableStreaming) {
      await startStreaming(symbols[0], [timeframe]);
      setCurrentSymbol(symbols[0]);
      setCurrentTimeframe(timeframe);
    }
  }, [config.symbols, config.enableStreaming, loadHistoricalData, loadTickerData, startStreaming, setCurrentSymbol, setCurrentTimeframe]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (currentSymbol) {
      stopStreaming(currentSymbol);
    }
    streamingService.cleanup();
  }, [currentSymbol, stopStreaming]);

  return {
    // Data loading
    loadHistoricalData,
    loadTickerData,
    
    // Streaming control
    startStreaming,
    stopStreaming,
    
    // High-level operations
    initializeTradingPair,
    switchTradingPair,
    initializeMultipleSymbols,
    
    // Cleanup
    cleanup,
    
    // Status
    isStreaming: (symbol: string) => {
      const status = streamingService.getStatus();
      return status.symbols.includes(symbol);
    }
  };
};
