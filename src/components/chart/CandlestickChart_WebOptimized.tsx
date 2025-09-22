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
import { ChartJSFinancialChart } from './ChartJSFinancialChart';
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
  console.log('🎯 CandlestickChartFinal: Component rendering with Chart.js Financial');
  
  // State management
  const [selectedTimeframe, setSelectedTimeframe] = useState<{ label: string; value: string; cycleDelay: number }>(
    TIMEFRAMES[0]
  );
  const [streamingStartTime, setStreamingStartTime] = useState(Date.now());
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const [showControlsHelp, setShowControlsHelp] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [chartZoom, setChartZoom] = useState(1.0);
  const [chartPan, setChartPan] = useState({ x: 0, y: 0 });
  const [chartWebViewRef, setChartWebViewRef] = useState<any>(null);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const chartRef = useRef<any>(null);
  
  // Use contexts
  const { selectedPair, tickers } = useMarket();
  
  // Performance optimization hook (mantenemos para métricas)
  const { 
    measurePerformance,
  } = usePerformanceOptimization({
    enabled: true,
    renderThrottleMs: 16,
    interactionThrottleMs: 8,
  });
  
  // Ultra-fast chart hook con configuración mejorada
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

  // Enhanced candle processing con validación
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

  // Track response times para métricas de performance
  useEffect(() => {
    if (lastUpdate) {
      const responseTime = Date.now() - lastUpdate.getTime();
      setResponseTimes(prev => {
        const newTimes = [...prev, responseTime].slice(-50);
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

  // Reset streaming start time cuando inicia nuevo stream
  useEffect(() => {
    if (isStreaming) {
      setStreamingStartTime(Date.now());
      setResponseTimes([]);
    }
  }, [isStreaming, selectedTimeframe.value]);

  // Chart control handlers
  const handleChartZoom = useCallback((zoomLevel: number) => {
    setChartZoom(zoomLevel);
  }, []);

  const handleChartPan = useCallback((panX: number, panY: number) => {
    setChartPan({ x: panX, y: panY });
  }, []);

  // Timeframe change handler
  const handleTimeframeChange = useCallback(async (timeframe: typeof TIMEFRAMES[0]) => {
    if (timeframe.value === selectedTimeframe.value) return;
    
    setSelectedTimeframe(timeframe);
    
    // Reset chart state para nuevo timeframe
    setChartZoom(1.0);
    setChartPan({ x: 0, y: 0 });

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
                🔍 {chartZoom.toFixed(1)}x | 📊 {processedCandles.length} velas
              </Text>
            </View>
            
            <View style={[styles.indicator, { backgroundColor: '#9500ff' }]}>
              <Text style={styles.indicatorText}>⚡ CHART.JS FINANCIAL</Text>
            </View>
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
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={() => chartWebViewRef?.postMessage?.(JSON.stringify({ type: 'RESET_ZOOM' }))}
        >
          <Text style={styles.quickButtonText}>🔄 Reset</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={() => chartWebViewRef?.postMessage?.(JSON.stringify({ type: 'GO_TO_LATEST' }))}
        >
          <Text style={styles.quickButtonText}>⏭️ Último</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={() => chartWebViewRef?.postMessage?.(JSON.stringify({ type: 'ZOOM', factor: 1.2 }))}
        >
          <Text style={styles.quickButtonText}>🔍+ Zoom</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={() => chartWebViewRef?.postMessage?.(JSON.stringify({ type: 'ZOOM', factor: 0.8 }))}
        >
          <Text style={styles.quickButtonText}>🔍- Zoom</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickButton} 
          onPress={() => setShowVolume(!showVolume)}
        >
          <Text style={styles.quickButtonText}>
            📊 {showVolume ? 'Sin Vol' : 'Con Vol'}
          </Text>
        </TouchableOpacity>
        
        <ChartControlsButton onPress={() => setShowControlsHelp(true)} />
        
        <View style={styles.infoDisplay}>
          <Text style={styles.infoText}>
            Chart.js Financial con controles nativos | Zoom: Rueda | Pan: Arrastrar | Volumen: {showVolume ? 'ON' : 'OFF'}
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

      {/* Chart.js Financial Chart Container */}
      <Animated.View style={[styles.chartContainer, { opacity: fadeAnim }]}>
        <ChartJSFinancialChart
          candles={processedCandles}
          symbol={selectedPair}
          isStreaming={isStreaming}
          lastCandle={lastCandle}
          onZoom={handleChartZoom}
          onPan={handleChartPan}
          onWebViewReady={setChartWebViewRef}
          height={CHART_HEIGHT}
          showVolume={showVolume}
          enableControls={true}
        />
      </Animated.View>

      {/* Chart Info Overlay */}
      <View style={styles.chartInfo}>
        <Text style={styles.chartInfoText}>
          📊 Velas: {processedCandles.length} | 
          💰 Chart.js Financial con streaming en tiempo real | 
          🎯 Zoom: {chartZoom.toFixed(1)}x | 
          📈 Volumen: {showVolume ? 'Visible' : 'Oculto'}
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
});

export default CandlestickChartFinal;
