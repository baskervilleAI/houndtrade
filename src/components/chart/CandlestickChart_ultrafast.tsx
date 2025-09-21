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
import { useMarket } from '../../context/AppContext';
import { useChartData } from '../../hooks/useChartData';
import { CandleData } from '../../services/binanceService';

const { width: screenWidth } = Dimensions.get('window');
const CHART_HEIGHT = 300;
const CANDLE_WIDTH = 8;
const CANDLE_SPACING = 2;

const TIMEFRAMES: { label: string; value: string }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

// Utility function to format prices consistently
const formatPrice = (price: number, symbol: string): string => {
  if (symbol === 'BTCUSDT' || symbol === 'ETHUSDT') {
    return price.toFixed(0);
  } else if (symbol === 'BNBUSDT' || symbol === 'SOLUSDT') {
    return price.toFixed(1);
  } else {
    return price.toFixed(4);
  }
};

export const CandlestickChart: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1m');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Use contexts
  const { selectedPair, tickers } = useMarket();
  const { 
    candles,
    isLoading,
    isStreaming,
    lastUpdate,
    hasData,
    isRealtime,
    refresh,
    reconnectStreaming
  } = useChartData({
    symbol: selectedPair,
    timeframe: selectedTimeframe,
    autoLoad: true,
    autoStream: true,
  });

  // Calculate price range for chart scaling - optimized
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (candles.length === 0) return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    // Fast calculation without array allocation
    for (const candle of candles) {
      if (candle.high > maxPrice) maxPrice = candle.high;
      if (candle.low < minPrice) minPrice = candle.low;
    }
    
    // Add small padding for better visualization
    const padding = (maxPrice - minPrice) * 0.05;
    minPrice -= padding;
    maxPrice += padding;
    const priceRange = maxPrice - minPrice;
    
    return { minPrice, maxPrice, priceRange };
  }, [candles]);

  // Load initial data and setup real-time updates
  useEffect(() => {
    // The useChartData hook already handles this automatically
  }, [selectedPair, selectedTimeframe]);

  // Optimized candle rendering with memoization
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

  // Handle timeframe change with optimization
  const handleTimeframeChange = useCallback(async (timeframe: string) => {
    if (timeframe === selectedTimeframe) return;
    
    console.log(`⚡ Fast timeframe change: ${selectedTimeframe} → ${timeframe}`);
    
    // Immediate UI update
    setSelectedTimeframe(timeframe);
    
    // Fade animation for smooth transition
    Animated.timing(fadeAnim, {
      toValue: 0.7,
      duration: 150,
      useNativeDriver: true,
    }).start();

    try {
      // The useChartData hook will automatically handle the timeframe change
      // since selectedTimeframe is a dependency
      
      // Restore opacity
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();

      console.log(`✅ Fast timeframe change complete`);
    } catch (error) {
      console.error(`❌ Error changing timeframe:`, error);
      // Restore opacity even on error
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedTimeframe, fadeAnim]);

  // Get current price info from ticker
  const currentTicker = tickers[selectedPair];
  const currentPrice = currentTicker?.price || 0;
  const priceChange = currentTicker?.changePercent24h || 0;

  // Memoized chart content to prevent unnecessary re-renders
  const chartContent = useMemo(() => {
    if (candles.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {isLoading ? 'Cargando datos en tiempo real...' : 'Preparando gráfico...'}
          </Text>
        </View>
      );
    }

    return (
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
    );
  }, [candles, isLoading, renderCandle]);

  // Performance info for debugging
  const performanceInfo = useMemo(() => {
    return {
      candleCount: candles.length,
      lastCandle: candles[candles.length - 1],
      lastUpdate: lastUpdate?.getTime() || 0,
      isRealtime,
      isStreaming,
    };
  }, [candles, lastUpdate, isRealtime, isStreaming]);

  // Performance monitoring
  useEffect(() => {
    // Chart performance is monitored by the hooks
  }, [performanceInfo, selectedPair, selectedTimeframe]);

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
          {isLoading && (
            <View style={styles.liveIndicator}>
              <Text style={styles.liveText}>CARGANDO</Text>
            </View>
          )}
          {!isLoading && isRealtime && (
            <View style={styles.liveIndicator}>
              <Text style={styles.liveText}>● LIVE</Text>
            </View>
          )}
          {!isLoading && !isRealtime && hasData && (
            <TouchableOpacity
              style={[styles.liveIndicator, { backgroundColor: 'rgba(255, 68, 68, 0.2)' }]}
              onPress={reconnectStreaming}
            >
              <Text style={[styles.liveText, { color: '#ff4444' }]}>🔄 RECONECTAR</Text>
            </TouchableOpacity>
          )}
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
            disabled={isLoading}
          >
            <Text style={[
              styles.timeframeText,
              selectedTimeframe === tf.value && styles.selectedTimeframeText,
              isLoading && styles.disabledText
            ]}>
              {tf.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chart */}
      <Animated.View style={[styles.chartContainer, { opacity: fadeAnim }]}>
        {chartContent}
      </Animated.View>

      {/* Price Scale */}
      {candles.length > 0 && (
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
      )}
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
    flexWrap: 'wrap',
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
    marginRight: 8,
  },
  liveIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#00ff88',
    borderRadius: 4,
    marginLeft: 8,
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
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
  disabledText: {
    opacity: 0.5,
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
    top: 100,
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
