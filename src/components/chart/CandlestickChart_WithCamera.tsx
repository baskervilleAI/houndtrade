import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { useMarket } from '../../context/AppContext';
import { useUltraFastChart } from '../../hooks/useUltraFastChart';
import { useChartCamera } from '../../hooks/useChartCamera';
import { useChartGestures } from '../../hooks/useChartGestures';
import { CandleData } from '../../services/binanceService';
import { binanceService } from '../../services/binanceService';
import ChartCameraControls from './ChartCameraControls';
import TimeNavigation from './TimeNavigation';

const { width: screenWidth } = Dimensions.get('window');
const CHART_HEIGHT = 300;
const DEFAULT_CANDLE_WIDTH = 8;
const CANDLE_SPACING = 2;

const TIMEFRAMES: { label: string; value: string; cycleDelay: number }[] = [
  { label: '1m', value: '1m', cycleDelay: 10 },
  { label: '5m', value: '5m', cycleDelay: 50 },
  { label: '15m', value: '15m', cycleDelay: 100 },
  { label: '1h', value: '1h', cycleDelay: 500 },
  { label: '4h', value: '4h', cycleDelay: 2000 },
  { label: '1d', value: '1d', cycleDelay: 5000 },
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

export const CandlestickChartWithCamera: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<{ label: string; value: string; cycleDelay: number }>(
    TIMEFRAMES[0]
  );
  const [isHistoricalMode, setIsHistoricalMode] = useState(false);
  const [historicalData, setHistoricalData] = useState<CandleData[]>([]);
  const [historicalOffset, setHistoricalOffset] = useState(0);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState(false);
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [showTimeNavigation, setShowTimeNavigation] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  
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
    clearCandles,
    hasData,
    isActive
  } = useUltraFastChart({
    symbol: selectedPair,
    timeframe: selectedTimeframe.value,
    cycleDelay: selectedTimeframe.cycleDelay,
    maxCandles: 500,
    autoStart: !isHistoricalMode,
  });

  // Get data to display (live or historical)
  const displayCandles = isHistoricalMode ? historicalData : candles;

  // Camera controls
  const cameraControls = useChartCamera({
    candleCount: displayCandles.length,
    chartWidth: screenWidth - 32,
    chartHeight: CHART_HEIGHT,
    minCandleWidth: 2,
    maxCandleWidth: 50,
    defaultZoom: 1.0,
    onCameraChange: (camera) => {
      // Optional: sync with scroll view position
      const visibleRange = cameraControls.getVisibleRange();
      if (scrollViewRef.current && visibleRange.count > 0) {
        const scrollX = (visibleRange.start / displayCandles.length) * 
          (displayCandles.length * (cameraControls.getCandleWidth() + CANDLE_SPACING));
        scrollViewRef.current.scrollTo({ x: scrollX, animated: false });
      }
    },
  });

  // Gesture controls
  const {
    panHandlers,
    simulateDoubleTap,
    simulatePinchZoom,
    simulatePan,
    isGestureActive,
  } = useChartGestures({
    cameraControls,
    chartWidth: screenWidth - 32,
    chartHeight: CHART_HEIGHT,
    enabled: true,
    onTap: (x, y) => {
      console.log(`📍 Tap at chart position: ${x.toFixed(2)}, ${y.toFixed(2)}`);
    },
    onDoubleTap: (x, y) => {
      console.log(`🖱️ Double tap at chart position: ${x.toFixed(2)}, ${y.toFixed(2)}`);
    },
    onLongPress: (x, y) => {
      console.log(`👆 Long press at chart position: ${x.toFixed(2)}, ${y.toFixed(2)}`);
      // Show detailed info or crosshair
      setShowCameraControls(true);
    },
  });

  // Calculate visible candles based on camera
  const visibleCandles = useMemo(() => {
    const range = cameraControls.getVisibleRange();
    return displayCandles.slice(range.start, range.end);
  }, [displayCandles, cameraControls.camera]);

  // Calculate price range for visible candles
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (visibleCandles.length === 0) return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    for (const candle of visibleCandles) {
      if (candle.high > maxPrice) maxPrice = candle.high;
      if (candle.low < minPrice) minPrice = candle.low;
    }
    
    // Add padding based on camera Y offset
    const basePadding = (maxPrice - minPrice) * 0.05;
    const yPadding = basePadding * (1 + Math.abs(cameraControls.camera.offsetY));
    
    minPrice -= yPadding;
    maxPrice += yPadding;
    const range = maxPrice - minPrice;
    
    return { minPrice, maxPrice, priceRange: range };
  }, [visibleCandles, cameraControls.camera.offsetY]);

  // Update camera's price range
  useEffect(() => {
    cameraControls.fitPriceRange(minPrice, maxPrice);
  }, [minPrice, maxPrice, cameraControls]);

  // Load historical data
  const loadHistoricalData = useCallback(async (offset: number = 0) => {
    setIsLoadingHistorical(true);
    try {
      const now = Date.now();
      const timeframe = selectedTimeframe.value;
      const intervals = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
      };
      
      const intervalMs = intervals[timeframe as keyof typeof intervals] || 60 * 1000;
      const endTime = now - (offset * intervalMs);
      const startTime = endTime - (500 * intervalMs);
      
      console.log(`📊 Cargando datos históricos: ${selectedPair} ${timeframe}`);
      
      const historical = await binanceService.getKlines(
        selectedPair,
        timeframe,
        500,
        startTime,
        endTime
      );
      
      setHistoricalData(historical);
      setHistoricalOffset(offset);
      
      // Reset camera to show recent data
      cameraControls.goToEnd();
      
    } catch (error) {
      console.error('❌ Error cargando datos históricos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos históricos');
    } finally {
      setIsLoadingHistorical(false);
    }
  }, [selectedPair, selectedTimeframe.value, cameraControls]);

  // Toggle between live and historical mode
  const toggleHistoricalMode = useCallback(async () => {
    if (isHistoricalMode) {
      setIsHistoricalMode(false);
      setHistoricalData([]);
      setHistoricalOffset(0);
      startStream();
    } else {
      setIsHistoricalMode(true);
      stopStream();
      await loadHistoricalData(0);
    }
  }, [isHistoricalMode, startStream, stopStream, loadHistoricalData]);

  // Navigate historical data
  const navigateHistorical = useCallback(async (direction: 'back' | 'forward') => {
    if (!isHistoricalMode) return;
    
    const newOffset = direction === 'back' 
      ? historicalOffset + 100
      : Math.max(0, historicalOffset - 100);
      
    await loadHistoricalData(newOffset);
  }, [isHistoricalMode, historicalOffset, loadHistoricalData]);

  // Go to specific date
  const goToDate = useCallback(async (date: Date) => {
    if (!isHistoricalMode) {
      await toggleHistoricalMode();
    }
    
    const targetTime = date.getTime();
    const now = Date.now();
    const timeframe = selectedTimeframe.value;
    
    const intervals = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    
    const intervalMs = intervals[timeframe as keyof typeof intervals] || 60 * 1000;
    const offset = Math.floor((now - targetTime) / intervalMs);
    
    await loadHistoricalData(Math.max(0, offset));
  }, [isHistoricalMode, toggleHistoricalMode, selectedTimeframe.value, loadHistoricalData]);

  // Optimized candle rendering with camera-aware positioning
  const renderCandle = useCallback((candle: CandleData, index: number, globalIndex: number) => {
    const isGreen = candle.close >= candle.open;
    const candleWidth = cameraControls.getCandleWidth();
    
    const bodyHeight = Math.abs(candle.close - candle.open) / priceRange * CHART_HEIGHT;
    const wickHeight = (candle.high - candle.low) / priceRange * CHART_HEIGHT;
    const bodyTop = (maxPrice - Math.max(candle.open, candle.close)) / priceRange * CHART_HEIGHT;
    const wickTop = (maxPrice - candle.high) / priceRange * CHART_HEIGHT;
    
    return (
      <View 
        key={`${candle.timestamp}_${globalIndex}`} 
        style={[
          styles.candleContainer, 
          { 
            left: index * (candleWidth + CANDLE_SPACING),
            width: candleWidth,
          }
        ]}
      >
        {/* Wick */}
        <View
          style={[
            styles.wick,
            {
              top: wickTop,
              height: Math.max(wickHeight, 1),
              backgroundColor: isGreen ? '#00ff88' : '#ff4444',
              left: (candleWidth / 2) - 0.5,
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
              width: candleWidth,
            },
          ]}
        />
      </View>
    );
  }, [maxPrice, priceRange, cameraControls]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback(async (timeframe: typeof TIMEFRAMES[0]) => {
    if (timeframe.value === selectedTimeframe.value) return;
    
    setSelectedTimeframe(timeframe);
    
    Animated.timing(fadeAnim, {
      toValue: 0.7,
      duration: 150,
      useNativeDriver: true,
    }).start();

    try {
      if (isHistoricalMode) {
        await loadHistoricalData(historicalOffset);
      }
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error(`❌ Error changing timeframe:`, error);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedTimeframe, fadeAnim, isHistoricalMode, loadHistoricalData, historicalOffset]);

  // Get current price info
  const currentTicker = tickers[selectedPair];
  const currentPrice = currentTicker?.price || 0;
  const priceChange = currentTicker?.changePercent24h || 0;
  const lastCandle = displayCandles[displayCandles.length - 1];
  const displayPrice = lastCandle?.close || currentPrice;

  // Chart content with camera-aware rendering
  const chartContent = useMemo(() => {
    if (visibleCandles.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {isLoadingHistorical 
              ? 'Cargando datos históricos...' 
              : isStreaming 
                ? 'Iniciando stream...' 
                : 'Preparando gráfico...'
            }
          </Text>
        </View>
      );
    }

    const candleWidth = cameraControls.getCandleWidth();
    const totalWidth = visibleCandles.length * (candleWidth + CANDLE_SPACING);

    return (
      <View
        style={[styles.chart, { width: totalWidth }]}
        {...panHandlers}
      >
        {visibleCandles.map((candle, index) => 
          renderCandle(candle, index, cameraControls.camera.startIndex + index)
        )}
      </View>
    );
  }, [visibleCandles, isLoadingHistorical, isStreaming, renderCandle, cameraControls, panHandlers]);

  return (
    <View style={styles.container}>
      {/* Header */}
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
          
          {/* Mode and Camera Status */}
          <View style={styles.statusContainer}>
            {isHistoricalMode ? (
              <View style={[styles.indicator, { backgroundColor: '#ff9500' }]}>
                <Text style={styles.indicatorText}>📊 HISTÓRICO</Text>
              </View>
            ) : isActive ? (
              <View style={[styles.indicator, { backgroundColor: '#00ff88' }]}>
                <Text style={styles.indicatorText}>⚡ EN VIVO</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.indicator, { backgroundColor: 'rgba(255, 68, 68, 0.2)' }]}
                onPress={restartStream}
              >
                <Text style={[styles.indicatorText, { color: '#ff4444' }]}>🔄 RECONECTAR</Text>
              </TouchableOpacity>
            )}
            
            {/* Camera Info */}
            <View style={[styles.indicator, { backgroundColor: '#333' }]}>
              <Text style={styles.indicatorText}>
                🎥 {cameraControls.camera.zoomLevel.toFixed(1)}x | {cameraControls.getVisibleCandleCount()} velas
              </Text>
            </View>
          </View>
        </View>
        
        {/* Performance Stats */}
        <View style={styles.performanceInfo}>
          <Text style={styles.performanceText}>
            {isHistoricalMode 
              ? `Histórico: ${displayCandles.length} velas | Offset: ${historicalOffset} | Rango: ${cameraControls.camera.startIndex}-${cameraControls.camera.endIndex}`
              : `${performanceStats.updateCount} updates | ${performanceStats.averageResponseTime}ms avg | ${selectedTimeframe.cycleDelay}ms cycle`
            }
          </Text>
        </View>
      </View>

      {/* Quick Camera Controls */}
      <View style={styles.quickControls}>
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={() => setShowCameraControls(true)}
        >
          <Text style={styles.quickButtonText}>🎥 Cámara</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={() => setShowTimeNavigation(true)}
        >
          <Text style={styles.quickButtonText}>🕒 Tiempo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={() => simulateDoubleTap()}
        >
          <Text style={styles.quickButtonText}>🔍 Zoom</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={cameraControls.fitAll}
        >
          <Text style={styles.quickButtonText}>📐 Ajustar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={cameraControls.goToEnd}
        >
          <Text style={styles.quickButtonText}>⏭️ Reciente</Text>
        </TouchableOpacity>
      </View>

      {/* Historical Navigation */}
      {isHistoricalMode && (
        <View style={styles.historicalNavigation}>
          <TouchableOpacity 
            style={[styles.navButton, isLoadingHistorical && styles.disabledButton]} 
            onPress={() => navigateHistorical('back')}
            disabled={isLoadingHistorical}
          >
            <Text style={styles.navButtonText}>⬅️ Pasado</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navButton, isHistoricalMode && styles.activeButton]} 
            onPress={toggleHistoricalMode}
          >
            <Text style={styles.navButtonText}>
              {isHistoricalMode ? '🔴 Modo En Vivo' : '📊 Modo Histórico'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navButton, (isLoadingHistorical || historicalOffset === 0) && styles.disabledButton]} 
            onPress={() => navigateHistorical('forward')}
            disabled={isLoadingHistorical || historicalOffset === 0}
          >
            <Text style={styles.navButtonText}>➡️ Reciente</Text>
          </TouchableOpacity>
        </View>
      )}

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
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chart with Gesture Support */}
      <Animated.View style={[styles.chartContainer, { opacity: fadeAnim }]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!isGestureActive} // Disable scroll when gesturing
          contentContainerStyle={{
            height: CHART_HEIGHT,
          }}
        >
          {chartContent}
        </ScrollView>
      </Animated.View>

      {/* Price Scale */}
      {visibleCandles.length > 0 && (
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

      {/* Camera Controls Modal */}
      <ChartCameraControls
        cameraControls={cameraControls}
        isVisible={showCameraControls}
        onClose={() => setShowCameraControls(false)}
        candleCount={displayCandles.length}
        currentTimestamp={lastCandle ? parseInt(lastCandle.timestamp) : undefined}
        onGoToDate={goToDate}
      />

      {/* Time Navigation Modal */}
      <TimeNavigation
        isVisible={showTimeNavigation}
        onClose={() => setShowTimeNavigation(false)}
        onGoToDate={goToDate}
        onGoToTimestamp={(timestamp) => {
          const date = new Date(timestamp);
          goToDate(date);
        }}
        currentTimeframe={selectedTimeframe.value}
        isHistoricalMode={isHistoricalMode}
        onToggleHistoricalMode={toggleHistoricalMode}
      />

      {/* Gesture Indicator */}
      {isGestureActive && (
        <View style={styles.gestureIndicator}>
          <Text style={styles.gestureText}>🤏 Gesto Activo</Text>
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
    marginBottom: 8,
  },
  symbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  change: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  indicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  performanceInfo: {
    marginTop: 8,
  },
  performanceText: {
    fontSize: 10,
    color: '#888888',
  },
  quickControls: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  quickButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#444444',
    borderRadius: 6,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  historicalNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#666666',
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#ff9500',
  },
  disabledButton: {
    backgroundColor: '#444444',
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
    textAlign: 'center',
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
  selectedTimeframeText: {
    color: '#000000',
  },
  chartContainer: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  chart: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  candleContainer: {
    position: 'absolute',
    height: CHART_HEIGHT,
  },
  wick: {
    position: 'absolute',
    width: 1,
  },
  candleBody: {
    position: 'absolute',
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
    pointerEvents: 'none',
  },
  priceLabel: {
    fontSize: 10,
    color: '#888888',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 4,
  },
  gestureIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 255, 136, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  gestureText: {
    fontSize: 10,
    color: '#000000',
    fontWeight: 'bold',
  },
});

export default CandlestickChartWithCamera;
