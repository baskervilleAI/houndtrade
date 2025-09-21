import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const CHART_HEIGHT = 300;
const CANDLE_WIDTH = 8;
const CANDLE_SPACING = 2;
const HISTORICAL_CANDLES_COUNT = 50; // Reducido para carga más rápida

const TIMEFRAMES: { label: string; value: string }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const CandlestickChart: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1h');
  const [selectedPair, setSelectedPair] = useState<string>('BTCUSDT');
  const [candleData, setCandleData] = useState<Record<string, Record<string, CandleData[]>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const isDataInitialized = useRef<Record<string, boolean>>({});

  // Mock current price data
  const mockTickers: Record<string, { price: number; changePercent24h: number }> = {
    'BTCUSDT': { price: 43250, changePercent24h: 2.45 },
    'ETHUSDT': { price: 2680, changePercent24h: -1.23 },
    'BNBUSDT': { price: 285.7, changePercent24h: 0.89 },
    'SOLUSDT': { price: 98.5, changePercent24h: 4.12 },
    'ADAUSDT': { price: 0.4156, changePercent24h: -0.67 },
  };

  // Memoized candles for current pair and timeframe
  const candles = useMemo(() => {
    return candleData[selectedPair]?.[selectedTimeframe] || [];
  }, [candleData, selectedPair, selectedTimeframe]);

  // Memoized price calculations
  const priceData = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    
    const minPrice = Math.min(...candles.map(c => c.low));
    const maxPrice = Math.max(...candles.map(c => c.high));
    const priceRange = maxPrice - minPrice;
    
    return { minPrice, maxPrice, priceRange };
  }, [candles]);

  const { minPrice, maxPrice, priceRange } = priceData;

  // Get timeframe in milliseconds
  const getTimeframeMs = (timeframe: string): number => {
    const timeframes: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
    };
    return timeframes[timeframe] || 60 * 60 * 1000;
  };

  // Generate realistic mock candles
  const generateMockCandles = useCallback((symbol: string, timeframe: string): CandleData[] => {
    console.log(`🎭 GENERATING MOCK CANDLES for immediate visualization: ${symbol} ${timeframe}`);
    
    const now = Date.now();
    const intervalMs = getTimeframeMs(timeframe);
    const basePrice = mockTickers[symbol]?.price || 50000;
    const mockCandles: CandleData[] = [];
    
    let currentPrice = basePrice * 0.98; // Start slightly lower
    
    for (let i = HISTORICAL_CANDLES_COUNT - 1; i >= 0; i--) {
      const timestamp = new Date(now - (i * intervalMs)).toISOString();
      
      // Create realistic price movement
      const trend = (Math.random() - 0.5) * 0.02; // ±1% trend
      const volatility = Math.random() * 0.01; // Up to 1% volatility
      
      const open = currentPrice;
      const close = open * (1 + trend + (Math.random() - 0.5) * volatility);
      const high = Math.max(open, close) * (1 + Math.random() * 0.005);
      const low = Math.min(open, close) * (1 - Math.random() * 0.005);
      const volume = Math.random() * 1000 + 100;
      
      mockCandles.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume,
      });
      
      currentPrice = close; // Next candle starts where this one ended
    }
    
    return mockCandles;
  }, [mockTickers]);

  // Update candles function
  const updateCandles = useCallback((symbol: string, timeframe: string, newCandles: CandleData[]) => {
    console.log(`📊 UPDATING CANDLES:`, {
      symbol,
      timeframe,
      candlesCount: newCandles.length,
      lastCandlePrice: newCandles[newCandles.length - 1]?.close,
    });

    setCandleData(prev => ({
      ...prev,
      [symbol]: {
        ...prev[symbol],
        [timeframe]: newCandles,
      },
    }));
  }, []);

  // Initialize data when pair or timeframe changes
  useEffect(() => {
    const key = `${selectedPair}_${selectedTimeframe}`;
    
    // Show mock data immediately for instant visualization
    if (!candleData[selectedPair]?.[selectedTimeframe] && !isDataInitialized.current[key]) {
      console.log(`🚀 INITIALIZING IMMEDIATE MOCK DATA for ${key}`);
      isDataInitialized.current[key] = true;
      
      setIsLoading(true);
      
      // Show mock data immediately
      setTimeout(() => {
        const mockCandles = generateMockCandles(selectedPair, selectedTimeframe);
        updateCandles(selectedPair, selectedTimeframe, mockCandles);
        setIsLoading(false);
      }, 100); // Very short delay to show loading state
    }
  }, [selectedPair, selectedTimeframe, candleData, generateMockCandles, updateCandles]);

  // Memoized candle rendering
  const renderCandle = useCallback((candle: CandleData, index: number) => {
    const isGreen = candle.close >= candle.open;
    const bodyHeight = Math.abs(candle.close - candle.open) / priceRange * CHART_HEIGHT;
    const wickHeight = (candle.high - candle.low) / priceRange * CHART_HEIGHT;
    const bodyTop = (maxPrice - Math.max(candle.open, candle.close)) / priceRange * CHART_HEIGHT;
    const wickTop = (maxPrice - candle.high) / priceRange * CHART_HEIGHT;
    
    return (
      <View key={`${candle.timestamp}_${index}`} style={[styles.candleContainer, { left: index * (CANDLE_WIDTH + CANDLE_SPACING) }]}>
        {/* Wick */}
        <View
          style={[
            styles.wick,
            {
              top: wickTop,
              height: Math.max(wickHeight, 1),
              backgroundColor: isGreen ? '#00ff88' : '#ff4444',
            },
          ]}
        />
        {/* Body */}
        <View
          style={[
            styles.candleBody,
            {
              top: bodyTop,
              height: Math.max(bodyHeight, 1),
              backgroundColor: isGreen ? '#00ff88' : '#ff4444',
            },
          ]}
        />
      </View>
    );
  }, [maxPrice, priceRange]);

  // Handle timeframe change with smooth transition
  const handleTimeframeChange = (timeframe: string) => {
    if (timeframe === selectedTimeframe) return;
    
    console.log(`🔄 CHANGING TIMEFRAME:`, {
      from: selectedTimeframe,
      to: timeframe,
      pair: selectedPair
    });

    setSelectedTimeframe(timeframe);
  };

  const currentTicker = mockTickers[selectedPair];
  const currentPrice = currentTicker?.price || 0;
  const priceChange = currentTicker?.changePercent24h || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.symbolInfo}>
          <Text style={styles.symbol}>{selectedPair.replace('USDT', '/USDT')}</Text>
          <Text style={styles.price}>
            ${currentPrice.toFixed(
              selectedPair === 'BTCUSDT' ? 0 :
              selectedPair === 'ETHUSDT' ? 0 :
              selectedPair === 'BNBUSDT' ? 1 :
              selectedPair === 'SOLUSDT' ? 1 : 4
            )}
          </Text>
          <Text style={[
            styles.change,
            { color: priceChange >= 0 ? '#00ff88' : '#ff4444' }
          ]}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* Timeframe Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeframeSelector}>
        {TIMEFRAMES.map((tf) => (
          <TouchableOpacity
            key={tf.value}
            style={[
              styles.timeframeButton,
              selectedTimeframe === tf.value && styles.selectedTimeframe
            ]}
            onPress={() => handleTimeframeChange(tf.value)}
          >
            <Text style={[
              styles.timeframeText,
              selectedTimeframe === tf.value && styles.selectedTimeframeText
            ]}>
              {tf.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chart */}
      <Animated.View style={[styles.chartContainer, { opacity: fadeAnim }]}>
        {candles.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              width: candles.length * (CANDLE_WIDTH + CANDLE_SPACING),
              height: CHART_HEIGHT,
            }}
          >
            <View style={styles.chart}>
              {candles.map((candle, index) => renderCandle(candle, index))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              {isLoading ? 'Cargando...' : 'Preparando gráfico...'}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Price Scale */}
      <View style={styles.priceScale}>
        <Text style={styles.priceLabel}>
          ${maxPrice.toFixed(
            selectedPair === 'BTCUSDT' ? 0 :
            selectedPair === 'ETHUSDT' ? 0 :
            selectedPair === 'BNBUSDT' ? 1 :
            selectedPair === 'SOLUSDT' ? 1 : 4
          )}
        </Text>
        <Text style={styles.priceLabel}>
          ${((maxPrice + minPrice) / 2).toFixed(
            selectedPair === 'BTCUSDT' ? 0 :
            selectedPair === 'ETHUSDT' ? 0 :
            selectedPair === 'BNBUSDT' ? 1 :
            selectedPair === 'SOLUSDT' ? 1 : 4
          )}
        </Text>
        <Text style={styles.priceLabel}>
          ${minPrice.toFixed(
            selectedPair === 'BTCUSDT' ? 0 :
            selectedPair === 'ETHUSDT' ? 0 :
            selectedPair === 'BNBUSDT' ? 1 :
            selectedPair === 'SOLUSDT' ? 1 : 4
          )}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  symbolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginRight: 16,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
  },
  change: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeframeSelector: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  timeframeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 6,
    backgroundColor: '#333333',
  },
  selectedTimeframe: {
    backgroundColor: '#00ff88',
  },
  timeframeText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  selectedTimeframeText: {
    color: '#000000',
  },
  chartContainer: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  chart: {
    flex: 1,
    position: 'relative',
  },
  candleContainer: {
    position: 'absolute',
    width: CANDLE_WIDTH,
    height: CHART_HEIGHT,
  },
  wick: {
    position: 'absolute',
    left: CANDLE_WIDTH / 2 - 0.5,
    width: 1,
  },
  candleBody: {
    position: 'absolute',
    left: 0,
    width: CANDLE_WIDTH,
    minHeight: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888888',
    fontSize: 14,
  },
  priceScale: {
    position: 'absolute',
    right: 8,
    top: 80,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: 10,
    color: '#888888',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 4,
  },
});
