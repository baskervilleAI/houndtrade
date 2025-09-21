import React from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { CandleData } from '../../services/binanceService';
import { getCandleDebugInfo, validateCandleData } from '../../utils/candleTimeUtils';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

interface StreamingDebugPanelProps {
  currentCandle?: CandleData;
  symbol?: string;
  interval?: string;
  updateCount?: number;
  lastUpdateTime?: Date;
  responseTime?: number;
  errorCount?: number;
  isStreaming?: boolean;
  streamingMode?: 'websocket' | 'ultra-fast';
  candleCount?: number;
  action?: 'updated' | 'appended' | 'ignored';
  actionIndex?: number;
}

export const StreamingDebugPanel: React.FC<StreamingDebugPanelProps> = ({
  currentCandle,
  symbol = 'N/A',
  interval = 'N/A',
  updateCount = 0,
  lastUpdateTime,
  responseTime = 0,
  errorCount = 0,
  isStreaming = false,
  streamingMode = 'websocket',
  candleCount = 0,
  action = 'ignored',
  actionIndex,
}) => {
  const formatPrice = (price: number): string => {
    if (!price || isNaN(price)) return 'N/A';
    return price.toFixed(4);
  };

  const formatVolume = (volume: number): string => {
    if (!volume || isNaN(volume)) return 'N/A';
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(2)}K`;
    return volume.toFixed(2);
  };

  const formatTime = (date?: Date): string => {
    if (!date) return 'N/A';
    return date.toLocaleTimeString();
  };

  const getStatusColor = (): string => {
    if (!isStreaming) return '#ff4444';
    if (errorCount > 0) return '#ffaa00';
    return '#44ff44';
  };

  const getActionColor = (): string => {
    switch (action) {
      case 'updated': return '#44ff44';
      case 'appended': return '#4444ff';
      case 'ignored': return '#888888';
      default: return '#888888';
    }
  };

  const candleDebugInfo = currentCandle ? getCandleDebugInfo(currentCandle, interval) : null;
  const isValidCandle = currentCandle ? validateCandleData(currentCandle) : false;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Debug Panel - {symbol} {interval}
          </Text>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        </View>

        {/* Streaming Status */}
        <View style={styles.row}>
          <Text style={styles.label}>Status:</Text>
          <Text style={[styles.value, { color: getStatusColor() }]}>
            {isStreaming ? `${streamingMode.toUpperCase()}` : 'STOPPED'}
          </Text>
          <Text style={styles.label}>Updates:</Text>
          <Text style={styles.value}>{updateCount}</Text>
        </View>

        {/* Current OHLCV */}
        {currentCandle && (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>O:</Text>
              <Text style={[styles.value, styles.priceValue]}>{formatPrice(currentCandle.open)}</Text>
              <Text style={styles.label}>H:</Text>
              <Text style={[styles.value, styles.priceValue]}>{formatPrice(currentCandle.high)}</Text>
            </View>
            
            <View style={styles.row}>
              <Text style={styles.label}>L:</Text>
              <Text style={[styles.value, styles.priceValue]}>{formatPrice(currentCandle.low)}</Text>
              <Text style={styles.label}>C:</Text>
              <Text style={[styles.value, styles.priceValue, styles.closePrice]}>{formatPrice(currentCandle.close)}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Vol:</Text>
              <Text style={styles.value}>{formatVolume(currentCandle.volume)}</Text>
              <Text style={styles.label}>Valid:</Text>
              <Text style={[styles.value, { color: isValidCandle ? '#44ff44' : '#ff4444' }]}>
                {isValidCandle ? 'YES' : 'NO'}
              </Text>
            </View>
          </>
        )}

        {/* Last Action */}
        <View style={styles.row}>
          <Text style={styles.label}>Action:</Text>
          <Text style={[styles.value, { color: getActionColor() }]}>
            {action.toUpperCase()}
            {actionIndex !== undefined ? ` [${actionIndex}]` : ''}
          </Text>
          <Text style={styles.label}>Count:</Text>
          <Text style={styles.value}>{candleCount}</Text>
        </View>

        {/* Performance Metrics */}
        <View style={styles.row}>
          <Text style={styles.label}>Response:</Text>
          <Text style={[styles.value, { color: responseTime > 100 ? '#ffaa00' : '#44ff44' }]}>
            {responseTime}ms
          </Text>
          <Text style={styles.label}>Errors:</Text>
          <Text style={[styles.value, { color: errorCount > 0 ? '#ff4444' : '#44ff44' }]}>
            {errorCount}
          </Text>
        </View>

        {/* Time Information */}
        <View style={styles.row}>
          <Text style={styles.label}>Last Update:</Text>
          <Text style={styles.value}>{formatTime(lastUpdateTime)}</Text>
        </View>

        {/* Candle Timing Debug */}
        {candleDebugInfo && (
          <View style={styles.row}>
            <Text style={styles.label}>Window:</Text>
            <Text style={[styles.value, styles.timeValue]}>
              {new Date(candleDebugInfo.windowStart).toLocaleTimeString()} - 
              {new Date(candleDebugInfo.windowEnd).toLocaleTimeString()}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: isTablet ? screenWidth * 0.7 : 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#333',
    maxHeight: isTablet ? 200 : 150,
  },
  scrollView: {
    padding: isTablet ? 8 : 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: isTablet ? 12 : 14,
    fontWeight: 'bold',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  label: {
    color: '#888',
    fontSize: isTablet ? 9 : 11,
    marginRight: 4,
    minWidth: isTablet ? 30 : 35,
  },
  value: {
    color: '#fff',
    fontSize: isTablet ? 9 : 11,
    marginRight: 12,
    fontFamily: 'monospace',
  },
  priceValue: {
    color: '#00ff88',
    fontWeight: 'bold',
  },
  closePrice: {
    color: '#ffaa00',
  },
  timeValue: {
    color: '#88aaff',
    fontSize: isTablet ? 8 : 10,
  },
});
