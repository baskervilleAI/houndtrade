import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useMarket } from '../../context/AppContext';
import { formatPrice, formatPercentage } from '../../utils/formatters';

const { width: screenWidth } = Dimensions.get('window');
const CHART_HEIGHT = 300;
const CANDLE_WIDTH = 8;
const CANDLE_SPACING = 2;
const HISTORICAL_CANDLES_COUNT = 50;
const LIVE_UPDATE_INTERVAL = 2000; // Update every 2 seconds
const CHART_PADDING = 20; // Padding for better visualization

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
  isLive?: boolean;
}

// Validation function for candle data
const isValidCandle = (candle: any): candle is CandleData => {
  return (
    candle &&
    typeof candle.open === 'number' &&
    typeof candle.high === 'number' &&
    typeof candle.low === 'number' &&
    typeof candle.close === 'number' &&
    typeof candle.volume === 'number' &&
    !isNaN(candle.open) &&
    !isNaN(candle.high) &&
    !isNaN(candle.low) &&
    !isNaN(candle.close) &&
    !isNaN(candle.volume) &&
    candle.high >= candle.low &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close) &&
    candle.open > 0 &&
    candle.high > 0 &&
    candle.low > 0 &&
    candle.close > 0
  );
};

export const CandlestickChart: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1h');
  const [candleData, setCandleData] = useState<Record<string, CandleData[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const isDataInitialized = useRef<Record<string, boolean>>({});
  const updateInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Use market context
  const { selectedPair, tickers } = useMarket();

  // Calculate price range for chart scaling
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    const key = `${selectedPair}_${selectedTimeframe}`;
    const candles = candleData[key] || [];
    
    if (candles.length === 0) return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    
    const prices = candles.flatMap((c: CandleData) => [c.high, c.low]);
    const minPrice = Math.min(...prices) * 0.999;
    const maxPrice = Math.max(...prices) * 1.001;
    const priceRange = maxPrice - minPrice;
    
    return { minPrice, maxPrice, priceRange };
  }, [candleData, selectedPair, selectedTimeframe]);

  // Generate mock candle data using real ticker price as base
  const generateMockCandles = useCallback((pair: string, timeframe: string): CandleData[] => {
    const currentTicker = tickers[pair];
    const basePrice = currentTicker?.price || 45000; // fallback price
    const candles: CandleData[] = [];
    let currentPrice = basePrice * 0.98;
    
    for (let i = 0; i < HISTORICAL_CANDLES_COUNT; i++) {
      const variation = (Math.random() - 0.5) * 0.02;
      const open = currentPrice;
      const changePercent = variation;
      const high = open * (1 + Math.abs(changePercent) + Math.random() * 0.01);
      const low = open * (1 - Math.abs(changePercent) - Math.random() * 0.01);
      const close = open * (1 + changePercent);
      
      candles.push({
        timestamp: new Date(Date.now() - (HISTORICAL_CANDLES_COUNT - i) * 60000).toISOString(),
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 1000000) + 100000,
      });
      
      currentPrice = close;
    }
    
    return candles;
  }, [tickers]);

  // Get current candles
  const candles = useMemo(() => {
    const key = `${selectedPair}_${selectedTimeframe}`;
    return candleData[key] || [];
  }, [candleData, selectedPair, selectedTimeframe]);

  // Real-time price updates using context tickers
  const updateCandles = useCallback(() => {
    const currentTicker = tickers[selectedPair];
    if (!currentTicker) return;

    setCandleData(prev => {
      const key = `${selectedPair}_${selectedTimeframe}`;
      const currentCandles = prev[key] || [];
      
      if (currentCandles.length === 0) return prev;
      
      const updatedCandles = [...currentCandles];
      const lastCandle = updatedCandles[updatedCandles.length - 1];
      
      // Update last candle with real price data from ticker
      const newClose = currentTicker.price;
      const newHigh = Math.max(lastCandle.high, newClose);
      const newLow = Math.min(lastCandle.low, newClose);
      
      updatedCandles[updatedCandles.length - 1] = {
        ...lastCandle,
        close: newClose,
        high: newHigh,
        low: newLow,
      };
      
      return {
        ...prev,
        [key]: updatedCandles,
      };
    });
  }, [selectedPair, selectedTimeframe, tickers]);

  // Initialize data and start real-time updates
  useEffect(() => {
    const key = `${selectedPair}_${selectedTimeframe}`;
    
    if (!isDataInitialized.current[key]) {
      setIsLoading(true);
      
      setTimeout(() => {
        const mockCandles = generateMockCandles(selectedPair, selectedTimeframe);
        setCandleData(prev => ({
          ...prev,
          [key]: mockCandles,
        }));
        
        isDataInitialized.current[key] = true;
        setIsLoading(false);
      }, 100);
    }
  }, [selectedPair, selectedTimeframe, generateMockCandles]);

  // Start real-time updates
  useEffect(() => {
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
    }
    
    updateInterval.current = setInterval(updateCandles, 2000);
    
    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [updateCandles]);

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

  // Handle timeframe change
  const handleTimeframeChange = useCallback((timeframe: string) => {
    if (timeframe === selectedTimeframe) return;
    setSelectedTimeframe(timeframe);
  }, [selectedTimeframe]);

  const currentTicker = tickers[selectedPair];
  const currentPrice = currentTicker?.price || 0;
  const priceChange = currentTicker?.changePercent24h || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.symbolInfo}>
          <Text style={styles.symbol}>{selectedPair.replace('USDT', '/USDT')}</Text>
          <Text style={styles.price}>
            ${formatPrice(currentPrice, selectedPair)}
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
          ${formatPrice(maxPrice, selectedPair)}
        </Text>
        <Text style={styles.priceLabel}>
          ${formatPrice((maxPrice + minPrice) / 2, selectedPair)}
        </Text>
        <Text style={styles.priceLabel}>
          ${formatPrice(minPrice, selectedPair)}
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
    top: 60,
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

export default CandlestickChart;
