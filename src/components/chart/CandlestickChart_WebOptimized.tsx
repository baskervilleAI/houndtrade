import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useMarket } from '../../context/AppContext';
import { useUltraFastChart } from '../../hooks/useUltraFastChart';
import { useWebGestures } from '../../hooks/useWebGestures';
import { usePerformanceOptimization } from '../../hooks/usePerformanceOptimization';
import { ChartControlsButton, ChartControlsHelp } from './ChartControls';
import { CandleData } from '../../services/binanceService';
import { 
  validateCandleData, 
  fixInvalidCandle,
  calculateOptimalPriceRange,
  generatePriceLabels,
  calculateStreamingMetrics 
} from '../../utils/candleTimeUtils';

const { width: screenWidth } = Dimensions.get('window');
const CHART_HEIGHT = 400;
const DEFAULT_CANDLE_WIDTH = 8;
const MIN_CANDLE_WIDTH = 2;
const MAX_CANDLE_WIDTH = 50;
const CANDLE_SPACING = 1;

const TIMEFRAMES: { label: string; value: string; cycleDelay: number }[] = [
  { label: '1m', value: '1m', cycleDelay: 10 },
  { label: '5m', value: '5m', cycleDelay: 50 },
  { label: '15m', value: '15m', cycleDelay: 100 },
  { label: '30m', value: '30m', cycleDelay: 200 },
  { label: '1h', value: '1h', cycleDelay: 500 },
  { label: '4h', value: '4h', cycleDelay: 2000 },
  { label: '1d', value: '1d', cycleDelay: 5000 },
];

interface ChartState {
  zoom: number;
  panX: number;
  panY: number;
  candleWidth: number;
  visibleStart: number;
  visibleEnd: number;
}

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

export const CandlestickChartFinal: React.FC = () => {
  // State management
  const [selectedTimeframe, setSelectedTimeframe] = useState<{ label: string; value: string; cycleDelay: number }>(
    TIMEFRAMES[0]
  );
  const [chartState, setChartState] = useState<ChartState>({
    zoom: 1.0,
    panX: 0,
    panY: 0,
    candleWidth: DEFAULT_CANDLE_WIDTH,
    visibleStart: 0,
    visibleEnd: 100,
  });
  const [streamingStartTime, setStreamingStartTime] = useState(Date.now());
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const chartContainerRef = useRef<View>(null);
  
  // Use contexts
  const { selectedPair, tickers } = useMarket();
  
  // Performance optimization hook
  const { 
    throttledRender, 
    throttledInteraction, 
    measurePerformance,
    optimizeMemory,
    isInteracting: isPerformanceInteracting 
  } = usePerformanceOptimization({
    enabled: true,
    renderThrottleMs: 16, // 60fps
    interactionThrottleMs: 8, // 120fps for smooth interactions
  });
  
  // Ultra-fast chart hook with enhanced options
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
    maxCandles: 1000,
    autoStart: true,
  });

  // Enhanced candle processing with validation
  const processedCandles = useMemo(() => {
    return candles
      .filter(validateCandleData)
      .map((candle, index, arr) => {
        if (!validateCandleData(candle)) {
          const referencePrice = index > 0 ? arr[index - 1].close : undefined;
          return fixInvalidCandle(candle, referencePrice);
        }
        return candle;
      });
  }, [candles]);

  // Calculate visible candles based on chart state with memory optimization
  const visibleCandles = useMemo(() => {
    const totalCandles = processedCandles.length;
    if (totalCandles === 0) return [];

    const candlesPerScreen = Math.floor((screenWidth - 64) / (chartState.candleWidth + CANDLE_SPACING));
    const totalWidth = totalCandles * (chartState.candleWidth + CANDLE_SPACING);
    const maxPanX = Math.max(0, totalWidth - (screenWidth - 64));
    
    // Calculate which candles are visible based on pan position
    let startIndex = 0;
    if (maxPanX > 0) {
      startIndex = Math.floor((chartState.panX / maxPanX) * Math.max(0, totalCandles - candlesPerScreen));
    }
    const endIndex = Math.min(totalCandles, startIndex + candlesPerScreen + 10); // +10 for smooth scrolling
    
    // Update visible range in state
    setChartState(prev => ({
      ...prev,
      visibleStart: startIndex,
      visibleEnd: endIndex,
    }));

    // Use memory optimization for large datasets
    const optimizedCandles = optimizeMemory(
      processedCandles, 
      Math.max(200, candlesPerScreen * 3), // Keep at least 3 screens worth of data
      startIndex + Math.floor(candlesPerScreen / 2) // Center around visible area
    );

    // Return only the visible slice from optimized data
    const visibleStart = Math.max(0, startIndex - (processedCandles.length - optimizedCandles.length));
    const visibleEnd = Math.min(optimizedCandles.length, visibleStart + (endIndex - startIndex));
    
    return optimizedCandles.slice(visibleStart, visibleEnd);
  }, [processedCandles, chartState.candleWidth, chartState.panX, optimizeMemory]);

  // Enhanced price range calculation with intelligent scaling
  const priceMetrics = useMemo(() => {
    if (visibleCandles.length === 0) {
      return { 
        minPrice: 0, 
        maxPrice: 100, 
        priceRange: 100, 
        tickSize: 10,
        priceLabels: [0, 25, 50, 75, 100] 
      };
    }
    
    const { minPrice, maxPrice, priceRange, tickSize } = calculateOptimalPriceRange(
      visibleCandles, 
      0.05, // 5% padding
      0.02  // Minimum 2% range
    );

    // Apply vertical pan offset
    const panOffset = chartState.panY * priceRange * 0.5;
    const adjustedMin = minPrice - panOffset;
    const adjustedMax = maxPrice - panOffset;
    
    const priceLabels = generatePriceLabels(adjustedMin, adjustedMax, tickSize, 7);
    
    return {
      minPrice: adjustedMin,
      maxPrice: adjustedMax,
      priceRange: adjustedMax - adjustedMin,
      tickSize,
      priceLabels,
    };
  }, [visibleCandles, chartState.panY]);

  // Quick action functions
  const resetZoom = useCallback(() => {
    setChartState(prev => ({
      ...prev,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      candleWidth: DEFAULT_CANDLE_WIDTH,
    }));
  }, []);

  const goToLatest = useCallback(() => {
    const totalCandles = processedCandles.length;
    if (totalCandles === 0) return;
    
    const candlesPerScreen = Math.floor((screenWidth - 64) / (chartState.candleWidth + CANDLE_SPACING));
    const maxPanX = Math.max(0, totalCandles - candlesPerScreen);
    
    setChartState(prev => ({
      ...prev,
      panX: maxPanX,
      panY: 0,
    }));
  }, [processedCandles, chartState.candleWidth]);

  // Enhanced web gesture handlers with keyboard support
  const {
    attachGestures,
    simulateZoom,
    simulatePan,
    simulateDoubleClick,
    isDragging,
    isWebSupported,
  } = useWebGestures({
    onZoom: useCallback((factor: number, centerX?: number, centerY?: number) => {
      throttledInteraction(() => {
        const newZoom = Math.max(0.1, Math.min(5.0, chartState.zoom * factor));
        const newCandleWidth = Math.max(MIN_CANDLE_WIDTH, Math.min(MAX_CANDLE_WIDTH, 
          DEFAULT_CANDLE_WIDTH * newZoom
        ));
        
        // If centerX is provided, adjust panX to zoom towards that point
        let newPanX = chartState.panX;
        if (centerX !== undefined && processedCandles.length > 0) {
          const totalCandles = processedCandles.length;
          const candlesPerScreen = Math.floor((screenWidth - 64) / newCandleWidth);
          const maxPanX = Math.max(0, totalCandles - candlesPerScreen);
          
          // Calculate zoom adjustment based on center point
          const zoomChange = factor - 1;
          const centerOffset = centerX * candlesPerScreen;
          const panAdjustment = centerOffset * zoomChange * 0.5;
          
          newPanX = Math.max(0, Math.min(maxPanX, chartState.panX + panAdjustment));
        }
        
        setChartState(prev => ({
          ...prev,
          zoom: newZoom,
          candleWidth: newCandleWidth,
          panX: newPanX,
        }));
      });
    }, [chartState.zoom, chartState.panX, processedCandles.length, throttledInteraction]),
    
    onPan: useCallback((deltaX: number, deltaY: number) => {
      throttledInteraction(() => {
        const totalCandles = processedCandles.length;
        if (totalCandles === 0) return;
        
        const candlesPerScreen = Math.floor((screenWidth - 64) / (chartState.candleWidth + CANDLE_SPACING));
        const maxPanX = Math.max(0, totalCandles - candlesPerScreen);
        
        // Improved pan calculation with momentum
        const panDeltaX = deltaX * totalCandles * 0.1; // Scale based on total candles
        const newPanX = Math.max(0, Math.min(maxPanX, chartState.panX + panDeltaX));
        const newPanY = Math.max(-1, Math.min(1, chartState.panY + deltaY));
        
        setChartState(prev => ({
          ...prev,
          panX: newPanX,
          panY: newPanY,
        }));
      });
    }, [processedCandles.length, chartState.candleWidth, chartState.panX, chartState.panY, throttledInteraction]),
    
    onDoubleClick: useCallback((x: number, y: number) => {
      // Smart zoom behavior
      if (chartState.zoom < 1.5) {
        // Zoom in towards click point
        const newZoom = Math.min(3.0, chartState.zoom * 2);
        const newCandleWidth = Math.max(MIN_CANDLE_WIDTH, Math.min(MAX_CANDLE_WIDTH, 
          DEFAULT_CANDLE_WIDTH * newZoom
        ));
        
        // Adjust pan to center on click point
        const totalCandles = processedCandles.length;
        const candlesPerScreen = Math.floor((screenWidth - 64) / newCandleWidth);
        const maxPanX = Math.max(0, totalCandles - candlesPerScreen);
        const targetCandle = Math.floor(x * candlesPerScreen) + chartState.visibleStart;
        const newPanX = Math.max(0, Math.min(maxPanX, targetCandle - candlesPerScreen / 2));
        
        setChartState(prev => ({
          ...prev,
          zoom: newZoom,
          candleWidth: newCandleWidth,
          panX: newPanX,
        }));
      } else {
        // Reset zoom
        setChartState(prev => ({
          ...prev,
          zoom: 1.0,
          candleWidth: DEFAULT_CANDLE_WIDTH,
          panX: 0,
          panY: 0,
        }));
      }
    }, [chartState.zoom, chartState.visibleStart, processedCandles.length]),

    onKeyboard: useCallback((key: string, ctrlKey: boolean, shiftKey: boolean, altKey: boolean) => {
      switch (key) {
        case '+':
        case '=':
          // Zoom in
          const zoomInFactor = shiftKey ? 2.0 : 1.5;
          setChartState(prev => ({
            ...prev,
            zoom: Math.min(5.0, prev.zoom * zoomInFactor),
            candleWidth: Math.min(MAX_CANDLE_WIDTH, prev.candleWidth * zoomInFactor),
          }));
          break;
          
        case '-':
        case '_':
          // Zoom out
          const zoomOutFactor = shiftKey ? 0.5 : 0.75;
          setChartState(prev => ({
            ...prev,
            zoom: Math.max(0.1, prev.zoom * zoomOutFactor),
            candleWidth: Math.max(MIN_CANDLE_WIDTH, prev.candleWidth * zoomOutFactor),
          }));
          break;
          
        case 'r':
        case 'R':
          // Reset zoom and pan
          setChartState(prev => ({
            ...prev,
            zoom: 1.0,
            candleWidth: DEFAULT_CANDLE_WIDTH,
            panX: 0,
            panY: 0,
          }));
          break;
          
        case 'End':
          // Go to latest candles
          goToLatest();
          break;
          
        case 'Home':
          // Go to beginning
          setChartState(prev => ({
            ...prev,
            panX: 0,
            panY: 0,
          }));
          break;
          
        case 'ArrowLeft':
          // Pan left
          const panLeftAmount = shiftKey ? 50 : 10;
          setChartState(prev => ({
            ...prev,
            panX: Math.max(0, prev.panX - panLeftAmount),
          }));
          break;
          
        case 'ArrowRight':
          // Pan right
          const panRightAmount = shiftKey ? 50 : 10;
          const totalCandles = processedCandles.length;
          const candlesPerScreen = Math.floor((screenWidth - 64) / (chartState.candleWidth + CANDLE_SPACING));
          const maxPanX = Math.max(0, totalCandles - candlesPerScreen);
          setChartState(prev => ({
            ...prev,
            panX: Math.min(maxPanX, prev.panX + panRightAmount),
          }));
          break;
          
        case 'ArrowUp':
          // Pan up
          setChartState(prev => ({
            ...prev,
            panY: Math.max(-1, prev.panY - 0.1),
          }));
          break;
          
        case 'ArrowDown':
          // Pan down
          setChartState(prev => ({
            ...prev,
            panY: Math.min(1, prev.panY + 0.1),
          }));
          break;
          
        case ' ':
          // Space bar - toggle between zoom levels
          if (chartState.zoom === 1.0) {
            setChartState(prev => ({
              ...prev,
              zoom: 2.0,
              candleWidth: DEFAULT_CANDLE_WIDTH * 2,
            }));
          } else {
            setChartState(prev => ({
              ...prev,
              zoom: 1.0,
              candleWidth: DEFAULT_CANDLE_WIDTH,
            }));
          }
          break;
          
        case 'Escape':
          // Reset all
          setChartState(prev => ({
            ...prev,
            zoom: 1.0,
            candleWidth: DEFAULT_CANDLE_WIDTH,
            panX: 0,
            panY: 0,
          }));
          break;
      }
      
      // Ctrl+Number shortcuts for zoom presets
      if (ctrlKey && ['0', '1', '2', '3', '4', '5'].includes(key)) {
        const zoomLevels = [1.0, 0.5, 1.0, 1.5, 2.0, 3.0];
        const zoomLevel = zoomLevels[parseInt(key)];
        setChartState(prev => ({
          ...prev,
          zoom: zoomLevel,
          candleWidth: DEFAULT_CANDLE_WIDTH * zoomLevel,
        }));
      }
    }, [chartState.zoom, chartState.candleWidth, processedCandles.length, goToLatest]),
    
    enabled: true,
    zoomSensitivity: 0.15,
    panSensitivity: 2.0,
    enableKeyboard: true,
  });

  // Setup web gestures
  useEffect(() => {
    if (!isWebSupported) return;
    
    const chartElement = chartContainerRef.current as any;
    if (!chartElement) return;

    return attachGestures(chartElement);
  }, [attachGestures, isWebSupported]);

  // Track response times for performance metrics
  useEffect(() => {
    if (lastUpdate) {
      const responseTime = Date.now() - lastUpdate.getTime();
      setResponseTimes(prev => {
        const newTimes = [...prev, responseTime].slice(-50); // Keep last 50 measurements
        return newTimes;
      });
    }
  }, [lastUpdate]);

  // Calculate streaming metrics
  const streamingMetrics = useMemo(() => {
    return calculateStreamingMetrics(
      performanceStats.updateCount,
      streamingStartTime,
      responseTimes
    );
  }, [performanceStats.updateCount, streamingStartTime, responseTimes]);

  // Reset streaming start time when starting new stream
  useEffect(() => {
    if (isStreaming) {
      setStreamingStartTime(Date.now());
      setResponseTimes([]);
    }
  }, [isStreaming, selectedTimeframe.value]);

  // Optimized candle rendering with performance measurement
  const renderCandle = useCallback(measurePerformance((candle: CandleData, index: number) => {
    const isGreen = candle.close >= candle.open;
    const bodyHeight = Math.abs(candle.close - candle.open) / priceMetrics.priceRange * CHART_HEIGHT;
    const wickHeight = (candle.high - candle.low) / priceMetrics.priceRange * CHART_HEIGHT;
    const bodyTop = (priceMetrics.maxPrice - Math.max(candle.open, candle.close)) / priceMetrics.priceRange * CHART_HEIGHT;
    const wickTop = (priceMetrics.maxPrice - candle.high) / priceMetrics.priceRange * CHART_HEIGHT;
    
    const candleColor = isGreen ? '#00ff88' : '#ff4444';
    const isLastCandle = index === visibleCandles.length - 1;
    
    // Para la última vela, evitar renderizar si es muy pequeña (evita el puntito)
    const shouldRenderBody = bodyHeight >= 0.5 || !isLastCandle;
    
    return (
      <View 
        key={`${candle.timestamp}_${index}`} 
        style={[
          styles.candleContainer, 
          { 
            left: index * (chartState.candleWidth + CANDLE_SPACING),
            width: chartState.candleWidth,
          }
        ]}
      >
        {/* Wick */}
        <View
          style={[
            styles.wick,
            {
              top: Math.max(0, wickTop),
              height: Math.max(1, Math.min(CHART_HEIGHT, wickHeight)),
              backgroundColor: candleColor,
              left: Math.floor(chartState.candleWidth / 2) - 0.5,
            },
          ]}
        />
        {/* Body - Solo renderizar si tiene altura suficiente o no es la última vela */}
        {shouldRenderBody && (
          <View
            style={[
              styles.candleBody,
              {
                top: Math.max(0, bodyTop),
                height: Math.max(1, Math.min(CHART_HEIGHT, bodyHeight)),
                backgroundColor: candleColor,
                width: chartState.candleWidth,
                opacity: bodyHeight < 1 ? 0.8 : 1,
              },
            ]}
          />
        )}
      </View>
    );
  }, 'renderCandle'), [priceMetrics, chartState.candleWidth, measurePerformance, visibleCandles.length]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback(async (timeframe: typeof TIMEFRAMES[0]) => {
    if (timeframe.value === selectedTimeframe.value) return;
    
    setSelectedTimeframe(timeframe);
    
    // Reset chart state for new timeframe
    setChartState(prev => ({
      ...prev,
      panX: 0,
      panY: 0,
      zoom: 1.0,
      candleWidth: DEFAULT_CANDLE_WIDTH,
    }));

    // Visual feedback
    Animated.timing(fadeAnim, {
      toValue: 0.7,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [selectedTimeframe, fadeAnim]);

  // Get current price info
  const currentTicker = tickers[selectedPair];
  const currentPrice = currentTicker?.price || 0;
  const priceChange = currentTicker?.changePercent24h || 0;
  const lastCandle = processedCandles[processedCandles.length - 1];
  const displayPrice = lastCandle?.close || currentPrice;

  // Chart content with optimized rendering
  const chartContent = useMemo(() => {
    if (visibleCandles.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {isStreaming ? 'Cargando datos en tiempo real...' : 'Preparando gráfico...'}
          </Text>
        </View>
      );
    }

    const totalWidth = visibleCandles.length * (chartState.candleWidth + CANDLE_SPACING);
    
    // Calcular la posición de la línea horizontal para el precio de cierre de la última vela
    const lastCandle = visibleCandles[visibleCandles.length - 1];
    const lastClosePriceY = lastCandle ? 
      (priceMetrics.maxPrice - lastCandle.close) / priceMetrics.priceRange * CHART_HEIGHT : 0;

    return (
      <View style={[styles.chart, { width: Math.max(totalWidth, screenWidth - 64) }]}>
        {visibleCandles.map((candle, index) => renderCandle(candle, index))}
        
        {/* Línea horizontal punteada para el precio de cierre de la última vela */}
        {lastCandle && (
          <View 
            style={[
              styles.lastClosePriceLine,
              {
                top: Math.max(0, Math.min(CHART_HEIGHT - 1, lastClosePriceY)),
                width: Math.max(totalWidth, screenWidth - 64),
              }
            ]}
          />
        )}
      </View>
    );
  }, [visibleCandles, isStreaming, renderCandle, chartState.candleWidth, priceMetrics]);

  return (
    <View style={styles.container}>
      {/* Enhanced Header */}
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
          
          {/* Enhanced Status Indicators */}
          <View style={styles.statusContainer}>
            {isActive ? (
              <View style={[styles.indicator, { backgroundColor: '#00ff88' }]}>
                <Text style={styles.indicatorText}>🔴 EN VIVO</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.indicator, { backgroundColor: 'rgba(255, 68, 68, 0.2)' }]}
                onPress={restartStream}
              >
                <Text style={[styles.indicatorText, { color: '#ff4444' }]}>🔄 RECONECTAR</Text>
              </TouchableOpacity>
            )}
            
            <View style={[styles.indicator, { backgroundColor: '#333' }]}>
              <Text style={styles.indicatorText}>
                🔍 {chartState.zoom.toFixed(1)}x | 📊 {visibleCandles.length} velas
              </Text>
            </View>
            
            {isDragging && (
              <View style={[styles.indicator, { backgroundColor: '#ff9500' }]}>
                <Text style={styles.indicatorText}>🖱️ ARRASTRANDO</Text>
              </View>
            )}
            
            {isPerformanceInteracting && (
              <View style={[styles.indicator, { backgroundColor: '#9500ff' }]}>
                <Text style={styles.indicatorText}>⚡ OPTIMIZADO</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Enhanced Performance Info */}
        <View style={styles.performanceInfo}>
          <Text style={styles.performanceText}>
            📈 {streamingMetrics.updatesPerSecond}/s | 
            ⚡ {streamingMetrics.averageResponseTime}ms | 
            🎯 {(streamingMetrics.efficiency * 100).toFixed(0)}% eficiencia | 
            🕒 {selectedTimeframe.cycleDelay}ms ciclo
          </Text>
        </View>
      </View>

      {/* Enhanced Quick Controls */}
      <View style={styles.quickControls}>
        <TouchableOpacity style={styles.quickButton} onPress={resetZoom}>
          <Text style={styles.quickButtonText}>🔄 Reset</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.quickButton} onPress={goToLatest}>
          <Text style={styles.quickButtonText}>⏭️ Último</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={() => setChartState(prev => ({ 
            ...prev, 
            zoom: Math.min(5, prev.zoom * 1.5),
            candleWidth: Math.min(MAX_CANDLE_WIDTH, prev.candleWidth * 1.5)
          }))}
        >
          <Text style={styles.quickButtonText}>🔍+ Zoom</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={() => setChartState(prev => ({ 
            ...prev, 
            zoom: Math.max(0.1, prev.zoom / 1.5),
            candleWidth: Math.max(MIN_CANDLE_WIDTH, prev.candleWidth / 1.5)
          }))}
        >
          <Text style={styles.quickButtonText}>🔍- Zoom</Text>
        </TouchableOpacity>
        
        <ChartControlsButton onPress={() => setShowControlsHelp(true)} />
        
        <View style={styles.infoDisplay}>
          <Text style={styles.infoText}>
            {isWebSupported ? 'Rueda: Pan | Ctrl+Rueda: Zoom | Arrastrar: Mover | R: Reset | End: Último | +/-: Zoom' : 'Touch: Pan/Zoom'}
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

      {/* Enhanced Chart Container */}
      <Animated.View 
        ref={chartContainerRef}
        style={[styles.chartContainer, { opacity: fadeAnim }]}
      >
        <View style={styles.chartContent}>
          {chartContent}
        </View>
      </Animated.View>

      {/* Enhanced Price Scale */}
      {visibleCandles.length > 0 && (
        <View style={styles.priceScale}>
          {priceMetrics.priceLabels.map((price, index) => (
            <Text key={index} style={styles.priceLabel}>
              ${formatPrice(price, selectedPair)}
            </Text>
          ))}
        </View>
      )}

      {/* Chart Info Overlay */}
      <View style={styles.chartInfo}>
        <Text style={styles.chartInfoText}>
          📊 Velas: {chartState.visibleStart}-{chartState.visibleEnd} de {processedCandles.length} | 
          💰 ${formatPrice(priceMetrics.minPrice, selectedPair)} - ${formatPrice(priceMetrics.maxPrice, selectedPair)} | 
          🎯 Zoom: {chartState.zoom.toFixed(1)}x
        </Text>
      </View>

      {/* Chart Controls Help Modal */}
      <ChartControlsHelp 
        isVisible={showControlsHelp} 
        onClose={() => setShowControlsHelp(false)} 
      />
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
    overflow: 'hidden',
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
    marginBottom: 2,
  },
  change: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    fontSize: 11,
    color: '#888888',
  },
  quickControls: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    alignItems: 'center',
    gap: 8,
  },
  quickButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#444444',
    borderRadius: 6,
  },
  quickButtonText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
  },
  infoDisplay: {
    flex: 1,
    marginLeft: 8,
  },
  infoText: {
    fontSize: 10,
    color: '#888888',
    textAlign: 'right',
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
  chartContainer: {
    height: CHART_HEIGHT,
    position: 'relative',
    backgroundColor: '#0f0f0f',
    cursor: Platform.select({ web: 'grab', default: undefined }) as any,
  },
  chartContent: {
    flex: 1,
    overflow: 'hidden',
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
    top: 200,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    paddingVertical: 8,
    pointerEvents: 'none' as any,
  },
  priceLabel: {
    fontSize: 10,
    color: '#888888',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  chartInfo: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  chartInfoText: {
    fontSize: 10,
    color: '#cccccc',
    textAlign: 'center',
  },
  lastClosePriceLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: '#888888',
    opacity: 0.6,
    borderStyle: 'dashed',
    borderTopWidth: 1,
    borderTopColor: '#888888',
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
});

export default CandlestickChartFinal;
