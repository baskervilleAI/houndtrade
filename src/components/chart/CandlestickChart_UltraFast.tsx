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
import { useUltraFastChart } from '../../hooks/useUltraFastChart';
import { CandleData } from '../../services/binanceService';

const { width: screenWidth } = Dimensions.get('window');
const CHART_HEIGHT = 300;
const CANDLE_WIDTH = 8;
const CANDLE_SPACING = 2;

const TIMEFRAMES: { label: string; value: string; cycleDelay: number }[] = [
  { label: '1m', value: '1m', cycleDelay: 10 }, // Ultra-rápido para 1m
  { label: '5m', value: '5m', cycleDelay: 50 }, // Medio para 5m
  { label: '15m', value: '15m', cycleDelay: 100 }, // Más lento para 15m
  { label: '1h', value: '1h', cycleDelay: 500 }, // Muy lento para 1h
  { label: '4h', value: '4h', cycleDelay: 2000 }, // Mínimo para 4h
  { label: '1d', value: '1d', cycleDelay: 5000 }, // Ocasional para 1d
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

export const CandlestickChartUltraFast: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<{ label: string; value: string; cycleDelay: number }>(
    TIMEFRAMES[0] // Empezar con 1m ultra-rápido
  );
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  // Use contexts
  const { selectedPair, tickers } = useMarket();
  
  // Ultra-fast chart hook
  const { 
    candles,
    isStreaming,
    lastUpdate,
    performanceStats,
    startStream,
    stopStream,
    restartStream,
    changeCycleSpeed,
    hasData,
    isActive
  } = useUltraFastChart({
    symbol: selectedPair,
    timeframe: selectedTimeframe.value,
    cycleDelay: selectedTimeframe.cycleDelay,
    maxCandles: 500,
    autoStart: true,
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

  // Handle timeframe change with ultra-fast optimization
  const handleTimeframeChange = useCallback(async (timeframe: typeof TIMEFRAMES[0]) => {
    if (timeframe.value === selectedTimeframe.value) return;
    
    console.log(`🚀 Ultra-fast timeframe change: ${selectedTimeframe.value} → ${timeframe.value} (${timeframe.cycleDelay}ms)`);
    
    // Immediate UI update
    setSelectedTimeframe(timeframe);
    
    // Fade animation for smooth transition
    Animated.timing(fadeAnim, {
      toValue: 0.7,
      duration: 150,
      useNativeDriver: true,
    }).start();

    try {
      // The useUltraFastChart hook will automatically handle the timeframe change
      // since selectedTimeframe is a dependency
      
      // Restore opacity
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();

      console.log(`✅ Ultra-fast timeframe change complete`);
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

  // Speed control functions
  const increaseSpeed = useCallback(() => {
    const newDelay = Math.max(selectedTimeframe.cycleDelay / 2, 5); // Mínimo 5ms
    changeCycleSpeed(newDelay);
    setSelectedTimeframe(prev => ({ ...prev, cycleDelay: newDelay }));
  }, [selectedTimeframe.cycleDelay, changeCycleSpeed]);

  const decreaseSpeed = useCallback(() => {
    const newDelay = Math.min(selectedTimeframe.cycleDelay * 2, 10000); // Máximo 10s
    changeCycleSpeed(newDelay);
    setSelectedTimeframe(prev => ({ ...prev, cycleDelay: newDelay }));
  }, [selectedTimeframe.cycleDelay, changeCycleSpeed]);

  // Get current price info from ticker
  const currentTicker = tickers[selectedPair];
  const currentPrice = currentTicker?.price || 0;
  const priceChange = currentTicker?.changePercent24h || 0;

  // Get last candle price if available
  const lastCandle = candles[candles.length - 1];
  const displayPrice = lastCandle?.close || currentPrice;

  // Memoized chart content to prevent unnecessary re-renders
  const chartContent = useMemo(() => {
    if (candles.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {isStreaming ? 'Iniciando stream ultra-rápido...' : 'Preparando gráfico...'}
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
  }, [candles, isStreaming, renderCandle]);

  return (
    <View style={styles.container}>
      {/* Header with Ultra-Fast Performance Info */}
      <View style={styles.header}>
        <View style={styles.symbolInfo}>
          <Text style={styles.symbol}>{selectedPair.replace('USDT', '/USDT')}</Text>
          <Text style={styles.price}>
            ${formatPrice(displayPrice, selectedPair)}
          </Text>
          <Text style={[
            styles.change,
            { color: priceChange >= 0 ? '#00ff88' : '#ff4444' }
          ]}>
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
          </Text>
          
          {/* Ultra-Fast Streaming Indicator */}
          {isActive && (
            <View style={[styles.liveIndicator, { backgroundColor: '#00ff88' }]}>
              <Text style={styles.liveText}>⚡ ULTRA-FAST</Text>
            </View>
          )}
          {!isActive && hasData && (
            <TouchableOpacity
              style={[styles.liveIndicator, { backgroundColor: 'rgba(255, 68, 68, 0.2)' }]}
              onPress={restartStream}
            >
              <Text style={[styles.liveText, { color: '#ff4444' }]}>🔄 RECONECTAR</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Performance Stats */}
        <View style={styles.performanceInfo}>
          <Text style={styles.performanceText}>
            {performanceStats.updateCount} updates | 
            {performanceStats.averageResponseTime}ms avg | 
            {selectedTimeframe.cycleDelay}ms cycle
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
              selectedTimeframe.value === tf.value && styles.selectedTimeframe
            ]}
            onPress={() => handleTimeframeChange(tf)}
          >
            <Text style={[
              styles.timeframeText,
              selectedTimeframe.value === tf.value && styles.selectedTimeframeText,
            ]}>
              {tf.label}
            </Text>
            <Text style={[
              styles.cycleText,
              selectedTimeframe.value === tf.value && styles.selectedTimeframeText,
            ]}>
              {tf.cycleDelay}ms
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Speed Controls */}
      <View style={styles.speedControls}>
        <TouchableOpacity style={styles.speedButton} onPress={increaseSpeed}>
          <Text style={styles.speedButtonText}>🚀 2x Más Rápido</Text>
        </TouchableOpacity>
        
        <Text style={styles.speedInfo}>
          {selectedTimeframe.cycleDelay}ms por ciclo
        </Text>
        
        <TouchableOpacity style={styles.speedButton} onPress={decreaseSpeed}>
          <Text style={styles.speedButtonText}>🐌 2x Más Lento</Text>
        </TouchableOpacity>
      </View>

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

      {/* Debug Info (can be removed in production) */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Debug: {performanceStats.candleCount} velas | 
            Última: {lastUpdate?.toLocaleTimeString()} | 
            Updates/s: {performanceStats.updatesPerSecond}
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
    marginBottom: 8,
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
  performanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceText: {
    fontSize: 10,
    color: '#888888',
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
    alignItems: 'center',
  },
  selectedTimeframe: {
    backgroundColor: '#00ff88',
  },
  timeframeText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  cycleText: {
    fontSize: 9,
    color: '#cccccc',
    marginTop: 1,
  },
  selectedTimeframeText: {
    color: '#000000',
  },
  speedControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  speedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#444444',
    borderRadius: 6,
  },
  speedButtonText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
  },
  speedInfo: {
    fontSize: 12,
    color: '#00ff88',
    fontWeight: 'bold',
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
    top: 160,
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
  debugInfo: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  debugText: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
  },
});

export default CandlestickChartUltraFast;
