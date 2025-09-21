import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useMarket } from '../../context/AppContext';
import { binanceService } from '../../services/binanceService';
import { formatPrice, formatPercentage } from '../../utils/formatters';

const POPULAR_PAIRS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'];
const INITIAL_FETCH_INTERVAL = 30000; // Fetch initial data every 30 seconds

export const MarketData: React.FC = () => {
  const { selectedPair, tickers, setSelectedPair, updateTicker } = useMarket();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeFunctions = useRef<Record<string, () => void>>({});
  const isInitialized = useRef<boolean>(false);
  const updateTickerRef = useRef(updateTicker);
  
  // Keep updateTicker reference current
  useEffect(() => {
    updateTickerRef.current = updateTicker;
  }, [updateTicker]);

  // Generate mock ticker data as fallback
  const generateMockTickers = useCallback(() => {
    const mockTickers = {
      BTCUSDT: { symbol: 'BTCUSDT', price: 95550, changePercent24h: -0.04 },
      ETHUSDT: { symbol: 'ETHUSDT', price: 3469, changePercent24h: -0.14 },
      ADAUSDT: { symbol: 'ADAUSDT', price: 0.8984, changePercent24h: 0.19 },
      BNBUSDT: { symbol: 'BNBUSDT', price: 1065.3, changePercent24h: 6.24 },
      SOLUSDT: { symbol: 'SOLUSDT', price: 240.4, changePercent24h: 0.55 },
    };

    Object.values(mockTickers).forEach(ticker => {
      console.log(`🎭 Using mock ticker for ${ticker.symbol}:`, ticker);
      updateTickerRef.current(ticker as any);
    });
  }, []);

  // Initialize real market data from Binance with fallback
  const initializeMarketData = useCallback(async () => {
    if (isInitialized.current) return;
    
    console.log(`🚀 INITIALIZING MARKET DATA FROM BINANCE`);
    
    try {
      // Fetch initial ticker data for all pairs with timeout
      const tickerPromises = POPULAR_PAIRS.map(async (symbol) => {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
          );
          
          const tickerPromise = binanceService.getTicker24hr(symbol);
          const tickerResult = await Promise.race([tickerPromise, timeoutPromise]);
          const ticker = Array.isArray(tickerResult) ? tickerResult[0] : tickerResult;
          
          console.log(`✅ Fetched real ticker for ${symbol}:`, {
            price: ticker.price,
            change: ticker.changePercent24h,
            volume: ticker.volume24h
          });
          
          updateTickerRef.current(ticker as any);
          return ticker;
        } catch (error) {
          console.warn(`⚠️ Error fetching ticker for ${symbol}, will use mock data:`, error);
          return null;
        }
      });

      const results = await Promise.all(tickerPromises);
      const successfulFetches = results.filter(result => result !== null);
      
      if (successfulFetches.length === 0) {
        console.warn(`⚠️ All Binance API calls failed, using mock data`);
        generateMockTickers();
      } else {
        console.log(`✅ Successfully fetched ${successfulFetches.length}/${POPULAR_PAIRS.length} real tickers`);
        
        // Fill in missing tickers with mock data
        const failedSymbols = POPULAR_PAIRS.filter((_, index) => results[index] === null);
        if (failedSymbols.length > 0) {
          console.log(`🎭 Generating mock data for failed symbols:`, failedSymbols);
          failedSymbols.forEach(symbol => {
            const mockTicker = {
              BTCUSDT: { symbol: 'BTCUSDT', price: 95550, changePercent24h: -0.04 },
              ETHUSDT: { symbol: 'ETHUSDT', price: 3469, changePercent24h: -0.14 },
              ADAUSDT: { symbol: 'ADAUSDT', price: 0.8984, changePercent24h: 0.19 },
              BNBUSDT: { symbol: 'BNBUSDT', price: 1065.3, changePercent24h: 6.24 },
              SOLUSDT: { symbol: 'SOLUSDT', price: 240.4, changePercent24h: 0.55 },
            }[symbol];
            
            if (mockTicker) {
              updateTickerRef.current(mockTicker as any);
            }
          });
        }
      }
      
      isInitialized.current = true;
      console.log(`✅ MARKET DATA INITIALIZATION COMPLETE`);
    } catch (error) {
      console.error(`❌ Error initializing market data, using mock data:`, error);
      generateMockTickers();
      isInitialized.current = true;
    }
  }, [generateMockTickers]);

  // Setup real-time WebSocket subscriptions
  const setupRealTimeUpdates = useCallback(() => {
    console.log(`🔌 SETTING UP REAL-TIME BINANCE WEBSOCKET SUBSCRIPTIONS`);
    
    // Clean up existing subscriptions
    Object.values(unsubscribeFunctions.current).forEach(unsubscribe => unsubscribe());
    unsubscribeFunctions.current = {};

    POPULAR_PAIRS.forEach(symbol => {
      try {
        const unsubscribe = binanceService.subscribeToTicker(
          symbol,
          (ticker) => {
            console.log(`📈 REAL-TIME UPDATE for ${symbol}:`, {
              price: ticker.price,
              change: ticker.changePercent24h
            });

            updateTickerRef.current(ticker as any);
          },
          (error) => {
            console.error(`❌ WebSocket error for ${symbol}:`, error);
          }
        );

        unsubscribeFunctions.current[symbol] = unsubscribe;
        console.log(`✅ WebSocket subscription active for ${symbol}`);
      } catch (error) {
        console.error(`❌ Error setting up WebSocket for ${symbol}:`, error);
      }
    });
  }, []);

  // Setup real market data and WebSocket connections - ONLY RUN ONCE
  useEffect(() => {
    console.log(`💰 SETTING UP REAL BINANCE MARKET DATA`);
    
    // Initialize market data
    initializeMarketData();
    
    // Setup real-time updates
    setupRealTimeUpdates();

    // Setup periodic refresh for fallback
    intervalRef.current = setInterval(() => {
      // Reset initialization flag to allow periodic refresh
      isInitialized.current = false;
      initializeMarketData();
    }, INITIAL_FETCH_INTERVAL);

    return () => {
      console.log(`🛑 CLEANING UP BINANCE CONNECTIONS`);
      
      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Unsubscribe from all WebSocket connections
      Object.values(unsubscribeFunctions.current).forEach(unsubscribe => unsubscribe());
      unsubscribeFunctions.current = {};
      
      isInitialized.current = false;
    };
  }, []); // Empty dependency array - only run once on mount

  // Simple pair selection without animation
  const handlePairSelect = useCallback((symbol: string) => {
    if (symbol === selectedPair) return;

    console.log(`🔄 CRYPTO CHANGE:`, {
      from: selectedPair,
      to: symbol,
      timestamp: new Date().toISOString()
    });

    setSelectedPair(symbol);
  }, [selectedPair, setSelectedPair]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pares de Trading</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pairsList}>
        {POPULAR_PAIRS.map(symbol => {
          const ticker = tickers[symbol];
          const isSelected = symbol === selectedPair;
          const priceChangeColor = ticker?.changePercent24h >= 0 ? '#00ff88' : '#ff4444';
          
          return (
            <TouchableOpacity
              key={symbol}
              style={[styles.pairItem, isSelected && styles.selectedPair]}
              onPress={() => handlePairSelect(symbol)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pairSymbol, isSelected && styles.selectedPairText]}>
                {symbol.replace('USDT', '/USDT')}
              </Text>
              <Text style={[styles.pairPrice, isSelected && styles.selectedPairText]}>
                ${formatPrice(ticker?.price || 0, symbol)}
              </Text>
              <Text style={[styles.pairChange, { color: priceChangeColor }]}>
                {formatPercentage(ticker?.changePercent24h || 0)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pairsList: {
    paddingHorizontal: 16,
  },
  pairItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectedPair: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOpacity: 0.5,
  },
  pairSymbol: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  selectedPairText: {
    color: '#000000',
  },
  pairPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  pairChange: {
    fontSize: 11,
    fontWeight: '500',
  },
});
