import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useMarket } from '../../context/AppContext';

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

export const CandlestickChart: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1h');
  const { selectedPair, tickers } = useMarket();
  const [candleData, setCandleData] = useState<Record<string, any>>({});
  
  const candles = candleData[selectedPair]?.[selectedTimeframe] || [];

  const updateCandles = (symbol: string, timeframe: string, candles: any[]) => {
    setCandleData(prev => ({
      ...prev,
      [symbol]: {
        ...prev[symbol],
        [timeframe]: candles,
      },
    }));
  };

  // Generate mock candle data
  useEffect(() => {
    const generateMockCandles = () => {
      const mockCandles: any[] = [];
      const basePrice = tickers[selectedPair]?.price || 45000;
      const now = Date.now();
      const timeframeMs = getTimeframeMs(selectedTimeframe);
      
      for (let i = 99; i >= 0; i--) {
        const timestamp = new Date(now - (i * timeframeMs)).toISOString();
        const prevClose = i === 99 ? basePrice : mockCandles[mockCandles.length - 1].close;
        
        const change = (Math.random() - 0.5) * 0.02; // ±1% change
        const open = prevClose * (1 + change * 0.5);
        const close = open * (1 + change);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        const volume = Math.random() * 1000;
        
        mockCandles.push({
          timestamp,
          open,
          high,
          low,
          close,
          volume,
        });
      }
      
      updateCandles(selectedPair, selectedTimeframe, mockCandles);
    };

    generateMockCandles();
    
    // Update candles periodically
    const interval = setInterval(() => {
      if (candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        const currentPrice = tickers[selectedPair]?.price || lastCandle.close;
        const change = (Math.random() - 0.5) * 0.005; // ±0.25% change
        const newClose = currentPrice * (1 + change);
        
        const updatedCandle: any = {
          ...lastCandle,
          close: newClose,
          high: Math.max(lastCandle.high, newClose),
          low: Math.min(lastCandle.low, newClose),
          volume: lastCandle.volume + Math.random() * 10,
        };
        
        const updatedCandles = [...candles.slice(0, -1), updatedCandle];
        updateCandles(selectedPair, selectedTimeframe, updatedCandles);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedPair, selectedTimeframe, updateCandles, tickers]);

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
    return timeframes[timeframe];
  };

  const renderCandle = (candle: any, index: number, minPrice: number, maxPrice: number) => {
    const isGreen = candle.close >= candle.open;
    const bodyHeight = Math.abs(candle.close - candle.open) / (maxPrice - minPrice) * CHART_HEIGHT;
    const wickHeight = (candle.high - candle.low) / (maxPrice - minPrice) * CHART_HEIGHT;
    const bodyTop = (maxPrice - Math.max(candle.open, candle.close)) / (maxPrice - minPrice) * CHART_HEIGHT;
    const wickTop = (maxPrice - candle.high) / (maxPrice - minPrice) * CHART_HEIGHT;
    
    return (
      <View key={index} style={[styles.candleContainer, { left: index * (CANDLE_WIDTH + CANDLE_SPACING) }]}>
        {/* Wick */}
        <View
          style={[
            styles.wick,
            {
              top: wickTop,
              height: wickHeight,
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
  };

  const minPrice = candles.length > 0 ? Math.min(...candles.map((c: any) => c.low)) : 0;
  const maxPrice = candles.length > 0 ? Math.max(...candles.map((c: any) => c.high)) : 100;
  const priceRange = maxPrice - minPrice;
  const currentPrice = tickers[selectedPair]?.price || 0;
  const priceChange = tickers[selectedPair]?.changePercent24h || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.symbolInfo}>
          <Text style={styles.symbol}>{selectedPair.replace('USDT', '/USDT')}</Text>
          <Text style={styles.price}>${currentPrice.toFixed(2)}</Text>
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
            onPress={() => setSelectedTimeframe(tf.value)}
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
      <View style={styles.chartContainer}>
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
              {candles.map((candle: any, index: number) => renderCandle(candle, index, minPrice, maxPrice))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando datos del gráfico...</Text>
          </View>
        )}
      </View>

      {/* Price Scale */}
      <View style={styles.priceScale}>
        <Text style={styles.priceLabel}>${maxPrice.toFixed(2)}</Text>
        <Text style={styles.priceLabel}>${((maxPrice + minPrice) / 2).toFixed(2)}</Text>
        <Text style={styles.priceLabel}>${minPrice.toFixed(2)}</Text>
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