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
  const isDataInitialized = useRef<Record<string, boolean>>({});
  const updateInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Use market context
  const { selectedPair, tickers } = useMarket();

  // Generate more realistic mock candle data
  const generateHistoricalCandles = useCallback((pair: string, timeframe: string): CandleData[] => {
    const currentTicker = tickers[pair];
    let basePrice = currentTicker?.price || 50000;
    
    // Adjust base price for different symbols
    if (pair === 'ETHUSDT') basePrice = 3500;
    else if (pair === 'ADAUSDT') basePrice = 0.8;
    else if (pair === 'BNBUSDT') basePrice = 650;
    else if (pair === 'SOLUSDT') basePrice = 240;
    
    const candles: CandleData[] = [];
    let currentPrice = basePrice * 0.98; // Start slightly lower for trend
    
    // Solo log en debug
    if (process.env.NODE_ENV === 'development') {
      console.log(`🎯 Generando ${HISTORICAL_CANDLES_COUNT} velas para ${pair}`);
    }
    
    for (let i = 0; i < HISTORICAL_CANDLES_COUNT - 1; i++) {
      // More realistic price movement
      const volatility = 0.015; // 1.5% max movement
      const trendFactor = 0.002; // Slight upward trend
      const randomFactor = (Math.random() - 0.5) * volatility;
      
      const open = currentPrice;
      const priceChange = randomFactor + trendFactor;
      const close = open * (1 + priceChange);
      
      // Calculate high and low with realistic intrabar movement
      const intraBariVariation = Math.abs(priceChange) * 2;
      const high = Math.max(open, close) * (1 + Math.random() * intraBariVariation);
      const low = Math.min(open, close) * (1 - Math.random() * intraBariVariation);
      
      // Ensure OHLC relationships are valid
      const validatedHigh = Math.max(high, open, close);
      const validatedLow = Math.min(low, open, close);
      
      const candle: CandleData = {
        timestamp: new Date(Date.now() - (HISTORICAL_CANDLES_COUNT - i) * 60000).toISOString(),
        open: Number(open.toFixed(8)),
        high: Number(validatedHigh.toFixed(8)),
        low: Number(validatedLow.toFixed(8)),
        close: Number(close.toFixed(8)),
        volume: Math.floor(Math.random() * 1000000) + 100000,
        isLive: false,
      };
      
      // Validate candle before adding
      if (isValidCandle(candle)) {
        candles.push(candle);
        currentPrice = close;
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Vela inválida generada:', candle);
        }
      }
    }
    
    // Add current live candle
    const liveCandlePrice = currentTicker?.price || currentPrice;
    const liveCandle: CandleData = {
      timestamp: new Date().toISOString(),
      open: Number(currentPrice.toFixed(8)),
      high: Number(Math.max(currentPrice, liveCandlePrice).toFixed(8)),
      low: Number(Math.min(currentPrice, liveCandlePrice).toFixed(8)),
      close: Number(liveCandlePrice.toFixed(8)),
      volume: Math.floor(Math.random() * 500000) + 50000,
      isLive: true,
    };
    
    if (isValidCandle(liveCandle)) {
      candles.push(liveCandle);
    }
    
    // Solo log en debug
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ ${candles.length} velas válidas para ${pair}`);
    }
    return candles;
  }, [tickers]);

  // Calculate price range with proper validation and padding
  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    const key = `${selectedPair}_${selectedTimeframe}`;
    const candles = candleData[key] || [];
    
    if (candles.length === 0) {
      return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    }
    
    // Filter valid candles and extract all prices
    const validCandles = candles.filter(isValidCandle);
    if (validCandles.length === 0) {
      // Solo warn en casos críticos
      if (process.env.NODE_ENV === 'development') {
        console.warn('Sin velas válidas para calcular rango');
      }
      return { minPrice: 0, maxPrice: 100, priceRange: 100 };
    }
    
    const allPrices = validCandles.flatMap(candle => [candle.high, candle.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    
    // Add padding for better visualization
    const padding = (maxPrice - minPrice) * 0.1; // 10% padding
    const paddedMinPrice = Math.max(0, minPrice - padding);
    const paddedMaxPrice = maxPrice + padding;
    const priceRange = paddedMaxPrice - paddedMinPrice;
    
    // Eliminar log de rango de precios (demasiado verbose)
    // console.log(`📊 Price range for ${key}: $${paddedMinPrice.toFixed(2)} - $${paddedMaxPrice.toFixed(2)}`);
    
    return { 
      minPrice: paddedMinPrice, 
      maxPrice: paddedMaxPrice, 
      priceRange: priceRange > 0 ? priceRange : 1 
    };
  }, [candleData, selectedPair, selectedTimeframe]);

  // Get current candles
  const candles = useMemo(() => {
    const key = `${selectedPair}_${selectedTimeframe}`;
    const rawCandles = candleData[key] || [];
    return rawCandles.filter(isValidCandle);
  }, [candleData, selectedPair, selectedTimeframe]);

  // Update live candle with real ticker data
  const updateLiveCandle = useCallback(() => {
    const currentTicker = tickers[selectedPair];
    if (!currentTicker) return;

    const key = `${selectedPair}_${selectedTimeframe}`;
    
    setCandleData(prev => {
      const currentCandles = prev[key] || [];
      if (currentCandles.length === 0) return prev;
      
      const updatedCandles = [...currentCandles];
      const lastIndex = updatedCandles.length - 1;
      const lastCandle = updatedCandles[lastIndex];
      
      if (!lastCandle || !isValidCandle(lastCandle)) return prev;
      
      // Update the live candle with current price
      const newClose = currentTicker.price;
      const newHigh = Math.max(lastCandle.high, newClose);
      const newLow = Math.min(lastCandle.low, newClose);
      
      const updatedCandle: CandleData = {
        ...lastCandle,
        close: Number(newClose.toFixed(8)),
        high: Number(newHigh.toFixed(8)),
        low: Number(newLow.toFixed(8)),
        timestamp: new Date().toISOString(),
        isLive: true,
      };
      
      // Validate updated candle
      if (isValidCandle(updatedCandle)) {
        updatedCandles[lastIndex] = updatedCandle;
        setLastUpdate(new Date());
        
        return {
          ...prev,
          [key]: updatedCandles,
        };
      }
      
      return prev;
    });
  }, [selectedPair, selectedTimeframe, tickers]);

  // Initialize data only once per symbol/timeframe
  useEffect(() => {
    const key = `${selectedPair}_${selectedTimeframe}`;
    
    if (!isDataInitialized.current[key]) {
      // Solo log en debug
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 Inicializando datos para ${key}`);
      }
      setIsLoading(true);
      
      setTimeout(() => {
        const historicalCandles = generateHistoricalCandles(selectedPair, selectedTimeframe);
        setCandleData(prev => ({
          ...prev,
          [key]: historicalCandles,
        }));
        
        isDataInitialized.current[key] = true;
        setIsLoading(false);
        // Solo log en debug
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ Datos inicializados para ${key}`);
        }
      }, 300);
    }
  }, [selectedPair, selectedTimeframe, generateHistoricalCandles]);

  // Start live updates
  useEffect(() => {
    if (updateInterval.current) {
      clearInterval(updateInterval.current);
    }
    
    updateInterval.current = setInterval(updateLiveCandle, LIVE_UPDATE_INTERVAL);
    
    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [updateLiveCandle]);

  // Optimized candle rendering with better positioning
  const renderCandle = useCallback((candle: CandleData, index: number) => {
    if (!isValidCandle(candle)) {
      // Solo warn en debug
      if (process.env.NODE_ENV === 'development') {
        console.warn('Vela inválida en render:', candle);
      }
      return null;
    }
    
    const isGreen = candle.close >= candle.open;
    const isLiveCandle = candle.isLive;
    
    // Calculate heights and positions with proper scaling
    const bodyHeight = Math.max(1, Math.abs(candle.close - candle.open) / priceRange * (CHART_HEIGHT - CHART_PADDING));
    const wickHeight = Math.max(1, (candle.high - candle.low) / priceRange * (CHART_HEIGHT - CHART_PADDING));
    
    // Calculate top positions
    const bodyTop = (maxPrice - Math.max(candle.open, candle.close)) / priceRange * (CHART_HEIGHT - CHART_PADDING) + (CHART_PADDING / 2);
    const wickTop = (maxPrice - candle.high) / priceRange * (CHART_HEIGHT - CHART_PADDING) + (CHART_PADDING / 2);
    
    // Ensure positions are within bounds
    const safeBodyTop = Math.max(0, Math.min(CHART_HEIGHT - bodyHeight, bodyTop));
    const safeWickTop = Math.max(0, Math.min(CHART_HEIGHT - wickHeight, wickTop));
    
    const candleColor = isGreen ? '#00ff88' : '#ff4444';
    const opacity = isLiveCandle ? 0.9 : 1.0;
    
    return (
      <View 
        key={`${candle.timestamp}_${index}`} 
        style={[
          styles.candleContainer, 
          { left: index * (CANDLE_WIDTH + CANDLE_SPACING) }
        ]}
      >
        {/* Wick (shadow) */}
        <View
          style={[
            styles.wick,
            {
              top: safeWickTop,
              height: wickHeight,
              backgroundColor: candleColor,
              opacity,
            },
          ]}
        />
        {/* Body */}
        <View
          style={[
            styles.candleBody,
            {
              top: safeBodyTop,
              height: bodyHeight,
              backgroundColor: candleColor,
              opacity,
              borderWidth: isLiveCandle ? 1 : 0,
              borderColor: candleColor,
            },
          ]}
        />
        {/* Live indicator */}
        {isLiveCandle && (
          <View style={[styles.liveIndicator, { 
            top: safeBodyTop - 4,
            backgroundColor: candleColor,
          }]} />
        )}
      </View>
    );
  }, [maxPrice, priceRange]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((timeframe: string) => {
    if (timeframe === selectedTimeframe || isLoading) return;
    
    // Eliminar log de cambio de timeframe (demasiado verbose)
    // console.log(`📊 Changing timeframe from ${selectedTimeframe} to ${timeframe}`);
    setSelectedTimeframe(timeframe);
  }, [selectedTimeframe, isLoading]);

  const currentTicker = tickers[selectedPair];
  const currentPrice = currentTicker?.price || 0;
  const priceChange = currentTicker?.changePercent24h || 0;

  // Chart content with loading state
  const chartContent = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ff88" />
          <Text style={styles.loadingText}>Cargando gráfico...</Text>
        </View>
      );
    }

    if (candles.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No hay datos disponibles</Text>
        </View>
      );
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          width: Math.max(screenWidth, candles.length * (CANDLE_WIDTH + CANDLE_SPACING)),
          height: CHART_HEIGHT,
        }}
      >
        <View style={styles.chart}>
          {candles.map((candle, index) => renderCandle(candle, index))}
        </View>
      </ScrollView>
    );
  }, [isLoading, candles, renderCandle]);

  return (
    <View style={styles.container}>
      {/* Header with current price info */}
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
            {formatPercentage(priceChange)}
          </Text>
          <View style={styles.liveStatus}>
            <View style={[styles.liveDot, { backgroundColor: isLoading ? '#ffa500' : '#00ff88' }]} />
            <Text style={styles.liveText}>{isLoading ? 'CARGANDO' : 'LIVE'}</Text>
          </View>
        </View>
        {lastUpdate && (
          <Text style={styles.lastUpdate}>
            Última actualización: {lastUpdate.toLocaleTimeString()}
          </Text>
        )}
      </View>

      {/* Timeframe Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeframeSelector}>
        {TIMEFRAMES.map((tf) => (
          <TouchableOpacity
            key={tf.value}
            style={[
              styles.timeframeButton,
              selectedTimeframe === tf.value && styles.selectedTimeframe,
              isLoading && styles.disabledButton
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
      <View style={styles.chartContainer}>
        {chartContent}
      </View>

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

      {/* Debug info (only in development) */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Velas: {candles.length} | Rango: ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}
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
    marginRight: 12,
  },
  liveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    color: '#00ff88',
    fontWeight: 'bold',
  },
  lastUpdate: {
    fontSize: 12,
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
  },
  selectedTimeframe: {
    backgroundColor: '#00ff88',
  },
  disabledButton: {
    opacity: 0.5,
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
  liveIndicator: {
    position: 'absolute',
    right: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888888',
    fontSize: 14,
    marginTop: 8,
  },
  priceScale: {
    position: 'absolute',
    right: 8,
    top: 80,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    paddingVertical: CHART_PADDING / 2,
  },
  priceLabel: {
    fontSize: 10,
    color: '#888888',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  debugInfo: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  debugText: {
    fontSize: 10,
    color: '#888888',
    textAlign: 'center',
  },
});

export default CandlestickChart;
