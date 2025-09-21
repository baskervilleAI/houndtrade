import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useUpdatePipeline } from '../../hooks/useUpdatePipeline';
import { useMarket } from '../../context/AppContext';

export const StreamingDebugPanelEnhanced: React.FC = () => {
  const { selectedPair } = useMarket();
  const [isExpanded, setIsExpanded] = useState(false);
  const [enableDetailedLogs, setEnableDetailedLogs] = useState(false);

  // Use the update pipeline
  const {
    isRunning,
    lastUpdates,
    errorCount,
    stats,
    events,
    recentEvents,
    symbolCount,
    startPipeline,
    stopPipeline,
    forceRefreshAll,
    clearCacheAndRestart,
    getEventsForSymbol,
    getLatestEventForSymbol,
  } = useUpdatePipeline({
    symbols: [selectedPair],
    updateInterval: 5000,
    enableRealTime: true,
    autoStart: true,
  });

  // Get recent events for selected pair
  const pairEvents = getEventsForSymbol(selectedPair);
  const latestPrice = getLatestEventForSymbol(selectedPair, 'price');
  const latestCandle = getLatestEventForSymbol(selectedPair, 'candle');
  const latestMarketData = getLatestEventForSymbol(selectedPair, 'market_data');

  // Format timestamp
  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  }, []);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (!isRunning) return '#ff4444';
    if (errorCount > 0) return '#ff9500';
    return '#00ff88';
  }, [isRunning, errorCount]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (!isRunning) return 'DETENIDO';
    if (errorCount > 0) return `ERRORES (${errorCount})`;
    return 'ACTIVO';
  }, [isRunning, errorCount]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity 
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <View style={styles.statusRow}>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.title}>
            🔧 Pipeline Debug - {selectedPair}
          </Text>
          <Text style={[styles.status, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>
        
        <Text style={styles.expandIcon}>
          {isExpanded ? '▼' : '▶'}
        </Text>
      </TouchableOpacity>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.content}>
          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Símbolos</Text>
              <Text style={styles.statValue}>{symbolCount}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Eventos</Text>
              <Text style={styles.statValue}>{events.length}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Errores</Text>
              <Text style={[styles.statValue, { color: errorCount > 0 ? '#ff4444' : '#00ff88' }]}>
                {errorCount}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Última Act.</Text>
              <Text style={styles.statValue}>
                {lastUpdates[selectedPair] ? formatTime(lastUpdates[selectedPair]) : 'N/A'}
              </Text>
            </View>
          </View>

          {/* Control Buttons */}
          <View style={styles.controls}>
            <TouchableOpacity 
              style={[styles.controlButton, isRunning ? styles.stopButton : styles.startButton]}
              onPress={isRunning ? stopPipeline : startPipeline}
            >
              <Text style={styles.controlButtonText}>
                {isRunning ? '⏹️ Detener' : '▶️ Iniciar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlButton, styles.refreshButton]}
              onPress={forceRefreshAll}
            >
              <Text style={styles.controlButtonText}>🔄 Actualizar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlButton, styles.clearButton]}
              onPress={clearCacheAndRestart}
            >
              <Text style={styles.controlButtonText}>🧹 Limpiar</Text>
            </TouchableOpacity>
          </View>

          {/* Latest Data Display */}
          <View style={styles.dataSection}>
            <Text style={styles.sectionTitle}>📊 Últimos Datos</Text>
            
            {latestPrice && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Precio:</Text>
                <Text style={styles.dataValue}>
                  ${latestPrice.data.price?.toFixed(2) || 'N/A'} 
                  <Text style={styles.dataTime}>
                    ({formatTime(latestPrice.timestamp)})
                  </Text>
                </Text>
              </View>
            )}

            {latestCandle && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Vela:</Text>
                <Text style={styles.dataValue}>
                  O: ${latestCandle.data.open?.toFixed(2)} 
                  H: ${latestCandle.data.high?.toFixed(2)} 
                  L: ${latestCandle.data.low?.toFixed(2)} 
                  C: ${latestCandle.data.close?.toFixed(2)}
                  <Text style={styles.dataTime}>
                    ({formatTime(latestCandle.timestamp)})
                  </Text>
                </Text>
              </View>
            )}

            {latestMarketData && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>Market:</Text>
                <Text style={styles.dataValue}>
                  24h: {latestMarketData.data.changePercent24h?.toFixed(2)}%
                  Vol: {latestMarketData.data.volume24h?.toFixed(0)}
                  <Text style={styles.dataTime}>
                    ({formatTime(latestMarketData.timestamp)})
                  </Text>
                </Text>
              </View>
            )}
          </View>

          {/* Detailed Logs Toggle */}
          <View style={styles.toggleSection}>
            <Text style={styles.toggleLabel}>Logs Detallados</Text>
            <Switch 
              value={enableDetailedLogs}
              onValueChange={setEnableDetailedLogs}
              trackColor={{ false: '#333333', true: '#00ff88' }}
              thumbColor={enableDetailedLogs ? '#ffffff' : '#666666'}
            />
          </View>

          {/* Recent Events */}
          {enableDetailedLogs && (
            <View style={styles.eventsSection}>
              <Text style={styles.sectionTitle}>
                📝 Eventos Recientes ({recentEvents.length})
              </Text>
              
              <ScrollView style={styles.eventsList} nestedScrollEnabled>
                {recentEvents.slice().reverse().map((event, index) => (
                  <View key={index} style={styles.eventItem}>
                    <View style={styles.eventHeader}>
                      <Text style={[styles.eventType, { color: getEventColor(event.type) }]}>
                        {getEventIcon(event.type)} {event.type.toUpperCase()}
                      </Text>
                      <Text style={styles.eventTime}>
                        {formatTime(event.timestamp)}
                      </Text>
                    </View>
                    
                    <Text style={styles.eventSymbol}>{event.symbol}</Text>
                    
                    <Text style={styles.eventData} numberOfLines={2}>
                      {JSON.stringify(event.data, null, 2).substring(0, 100)}...
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Pipeline Stats */}
          {stats && (
            <View style={styles.statsSection}>
              <Text style={styles.sectionTitle}>📈 Estadísticas Pipeline</Text>
              <Text style={styles.statsText}>
                Running: {stats.isRunning ? 'Sí' : 'No'}{'\n'}
                Symbols: {stats.symbolCount}{'\n'}
                Errors: {stats.errorCount}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// Helper functions
const getEventColor = (type: string): string => {
  switch (type) {
    case 'price': return '#00ff88';
    case 'candle': return '#00aaff';
    case 'market_data': return '#ff9500';
    case 'error': return '#ff4444';
    default: return '#888888';
  }
};

const getEventIcon = (type: string): string => {
  switch (type) {
    case 'price': return '💰';
    case 'candle': return '📊';
    case 'market_data': return '📈';
    case 'error': return '❌';
    default: return '📝';
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2a2a2a',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  status: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  expandIcon: {
    fontSize: 12,
    color: '#888888',
    marginLeft: 8,
  },
  content: {
    padding: 12,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#333333',
    borderRadius: 6,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#888888',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  controlButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#00ff88',
  },
  stopButton: {
    backgroundColor: '#ff4444',
  },
  refreshButton: {
    backgroundColor: '#00aaff',
  },
  clearButton: {
    backgroundColor: '#ff9500',
  },
  controlButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
  },
  dataSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  dataItem: {
    marginBottom: 4,
  },
  dataLabel: {
    fontSize: 10,
    color: '#888888',
    marginBottom: 2,
  },
  dataValue: {
    fontSize: 11,
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  dataTime: {
    fontSize: 9,
    color: '#666666',
  },
  toggleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#333333',
    borderRadius: 6,
  },
  toggleLabel: {
    fontSize: 12,
    color: '#ffffff',
  },
  eventsSection: {
    marginBottom: 12,
    maxHeight: 200,
  },
  eventsList: {
    backgroundColor: '#333333',
    borderRadius: 6,
    padding: 8,
  },
  eventItem: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#00ff88',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventType: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  eventTime: {
    fontSize: 9,
    color: '#666666',
  },
  eventSymbol: {
    fontSize: 10,
    color: '#ffffff',
    marginBottom: 2,
  },
  eventData: {
    fontSize: 9,
    color: '#888888',
    fontFamily: 'monospace',
  },
  statsSection: {
    backgroundColor: '#333333',
    padding: 8,
    borderRadius: 6,
  },
  statsText: {
    fontSize: 10,
    color: '#ffffff',
    fontFamily: 'monospace',
    lineHeight: 14,
  },
});

export default StreamingDebugPanelEnhanced;
