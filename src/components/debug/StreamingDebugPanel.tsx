import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useMarket } from '../../context/AppContext';
import { ultraFastStreamingService } from '../../services/ultraFastStreamingService';
import { binanceService } from '../../services/binanceService';

interface StreamStats {
  [key: string]: {
    cycleCount: number;
    lastUpdate: Date;
    errorCount: number;
    isRunning: boolean;
    cycleDelay: number;
  };
}

interface ConnectionStatus {
  initialized: boolean;
  streaming: any;
  subscriptions: number;
}

export const StreamingDebugPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [streamStats, setStreamStats] = useState<StreamStats>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [binanceStats, setBinanceStats] = useState<any>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  
  const { tickers, selectedPair } = useMarket();

  // Actualizar estadísticas cada segundo
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      // Obtener stats del ultra fast streaming
      const stats = ultraFastStreamingService.getStreamStats();
      setStreamStats(stats);

      // Obtener stats de binance service
      const cacheStats = binanceService.getCacheStats();
      setBinanceStats({
        cacheSize: cacheStats.size,
        cacheKeys: cacheStats.keys,
        activeStreams: ultraFastStreamingService.getActiveStreamCount(),
      });

      setRefreshCount(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  // Test de velocidad de API
  const testApiSpeed = useCallback(async () => {
    const startTime = Date.now();
    try {
      await binanceService.getPrice('BTCUSDT');
      const responseTime = Date.now() - startTime;
      console.log(`⚡ API Test: ${responseTime}ms`);
    } catch (error) {
      console.error('❌ API Test failed:', error);
    }
  }, []);

  // Limpiar cache
  const clearCache = useCallback(() => {
    binanceService.clearCache();
    console.log('🗑️ Cache cleared');
  }, []);

  // Cambiar velocidad de ciclo
  const changeCycleSpeed = useCallback((newDelay: number) => {
    ultraFastStreamingService.changeCycleDelay(selectedPair, '1m', newDelay);
    console.log(`⚡ Cycle speed changed to ${newDelay}ms`);
  }, [selectedPair]);

  if (!isVisible) {
    return (
      <TouchableOpacity style={styles.toggleButton} onPress={() => setIsVisible(true)}>
        <Text style={styles.toggleButtonText}>🔍 Debug</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.debugPanel}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Streaming Debug Panel</Text>
        <TouchableOpacity onPress={() => setIsVisible(false)}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Estadísticas generales */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 General Stats</Text>
          <Text style={styles.statText}>Refresh Count: {refreshCount}</Text>
          <Text style={styles.statText}>Active Tickers: {Object.keys(tickers).length}</Text>
          <Text style={styles.statText}>Selected Pair: {selectedPair}</Text>
          <Text style={styles.statText}>
            Current Price: ${tickers[selectedPair]?.price?.toFixed(2) || 'N/A'}
          </Text>
        </View>

        {/* Ultra Fast Streaming Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Ultra Fast Streams</Text>
          {Object.keys(streamStats).length === 0 ? (
            <Text style={styles.emptyText}>No active streams</Text>
          ) : (
            Object.entries(streamStats).map(([key, stats]) => (
              <View key={key} style={styles.streamItem}>
                <Text style={styles.streamKey}>{key}</Text>
                <Text style={styles.streamText}>Cycles: {stats.cycleCount}</Text>
                <Text style={styles.streamText}>Delay: {stats.cycleDelay}ms</Text>
                <Text style={styles.streamText}>Errors: {stats.errorCount}</Text>
                <Text style={[
                  styles.streamText,
                  { color: stats.isRunning ? '#00ff88' : '#ff4444' }
                ]}>
                  Status: {stats.isRunning ? 'RUNNING' : 'STOPPED'}
                </Text>
                <Text style={styles.streamText}>
                  Last Update: {stats.lastUpdate.toLocaleTimeString()}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Binance Service Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔗 Binance Service</Text>
          {binanceStats && (
            <>
              <Text style={styles.statText}>Cache Size: {binanceStats.cacheSize}</Text>
              <Text style={styles.statText}>Active Streams: {binanceStats.activeStreams}</Text>
              <Text style={styles.statText}>
                Cache Keys: {binanceStats.cacheKeys.slice(0, 3).join(', ')}
                {binanceStats.cacheKeys.length > 3 && '...'}
              </Text>
            </>
          )}
        </View>

        {/* Controles de debugging */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎛️ Controls</Text>
          
          <TouchableOpacity style={styles.button} onPress={testApiSpeed}>
            <Text style={styles.buttonText}>⚡ Test API Speed</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={clearCache}>
            <Text style={styles.buttonText}>🗑️ Clear Cache</Text>
          </TouchableOpacity>

          <View style={styles.speedControls}>
            <Text style={styles.speedLabel}>Cycle Speed:</Text>
            <TouchableOpacity 
              style={styles.speedButton} 
              onPress={() => changeCycleSpeed(1)}
            >
              <Text style={styles.speedButtonText}>1ms</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.speedButton} 
              onPress={() => changeCycleSpeed(10)}
            >
              <Text style={styles.speedButtonText}>10ms</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.speedButton} 
              onPress={() => changeCycleSpeed(100)}
            >
              <Text style={styles.speedButtonText}>100ms</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.speedButton} 
              onPress={() => changeCycleSpeed(1000)}
            >
              <Text style={styles.speedButtonText}>1000ms</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ticker Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Ticker Details</Text>
          {Object.entries(tickers).slice(0, 5).map(([symbol, ticker]) => (
            <View key={symbol} style={styles.tickerItem}>
              <Text style={styles.tickerSymbol}>{symbol}</Text>
              <Text style={styles.tickerPrice}>${ticker.price.toFixed(2)}</Text>
              <Text style={[
                styles.tickerChange,
                { color: ticker.changePercent24h >= 0 ? '#00ff88' : '#ff4444' }
              ]}>
                {ticker.changePercent24h.toFixed(2)}%
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  toggleButton: {
    position: 'absolute',
    top: 100,
    right: 10,
    backgroundColor: '#333333',
    padding: 8,
    borderRadius: 20,
    zIndex: 1000,
  },
  toggleButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  debugPanel: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    bottom: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: 12,
    zIndex: 999,
    borderWidth: 1,
    borderColor: '#333333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    color: '#ff4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  section: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  sectionTitle: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statText: {
    color: '#ffffff',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  emptyText: {
    color: '#888888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  streamItem: {
    backgroundColor: '#333333',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  streamKey: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streamText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#00ff88',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  speedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  speedLabel: {
    color: '#ffffff',
    fontSize: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  speedButton: {
    backgroundColor: '#333333',
    padding: 6,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 8,
  },
  speedButtonText: {
    color: '#ffffff',
    fontSize: 10,
  },
  tickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 6,
    backgroundColor: '#333333',
    borderRadius: 4,
    marginBottom: 4,
  },
  tickerSymbol: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    flex: 1,
  },
  tickerPrice: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'center',
  },
  tickerChange: {
    fontSize: 11,
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'right',
  },
});
