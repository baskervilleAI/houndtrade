import React, { useState, useMemo, useCallback } from 'react';
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
import { useLiveChart } from '../../hooks/useLiveChart';
import { formatPrice, formatPercentage } from '../../utils/formatters';
import { CandleData } from '../../services/binanceService';
import { StreamingDebugPanel } from '../debug/StreamingDebugPanel';

const { width: screenWidth } = Dimensions.get('window');
const CHART_HEIGHT = 350;
const CANDLE_WIDTH = 6;
const CANDLE_SPACING = 1;
const CHART_PADDING = 20;

const TIMEFRAMES: { label: string; value: string }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

export const LiveCandlestickChart: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1m');
  const [enableUltraFast, setEnableUltraFast] = useState(false);
  
  const { selectedPair, tickers } = useMarket();

  // Hook de live chart con datos reales
  const {
    candles,
    isLoading,
    stats,
    hasData,
    isStreaming,
    startStreaming,
    stopStreaming,
    restartStreaming,
    toggleStreamingMode,
    isUltraFastMode,
    currentCandle,
    lastAction,
    lastActionIndex,
    responseTime,
    updateCount,
    errorCount,
    lastUpdate,
  } = useLiveChart({
    symbol: selectedPair,
    interval: selectedTimeframe,
    maxCandles: 900,
    enableUltraFast,
    cycleDelay: 10, // 10ms para ultra fast
  });

  // Calcular rango de precios basado en velas recientes y válidas
  const { minPrice, maxPrice, priceRange, validCandles } = useMemo(() => {
    if (candles.length === 0) {
      return { minPrice: 0, maxPrice: 100, priceRange: 100, validCandles: [] };
    }
    
    // Filtrar velas válidas (sin valores extremos o anómalos)
    const validCandles = candles.filter(candle => {
      // Verificar que todos los valores sean números válidos
      const isValid = candle.open > 0 && candle.high > 0 && candle.low > 0 && candle.close > 0 &&
                     isFinite(candle.open) && isFinite(candle.high) && 
                     isFinite(candle.low) && isFinite(candle.close) &&
                     candle.high >= candle.low &&
                     candle.high >= Math.max(candle.open, candle.close) &&
                     candle.low <= Math.min(candle.open, candle.close);
      
      return isValid;
    });

    if (validCandles.length === 0) {
      return { minPrice: 0, maxPrice: 100, priceRange: 100, validCandles: [] };
    }

    // Usar solo las últimas 50 velas para calcular la escala (más responsive)
    const recentCandles = validCandles.slice(-50);
    
    // Calcular min/max de las velas recientes
    const allPrices = recentCandles.flatMap(candle => [candle.high, candle.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    
    // Filtrar outliers extremos (más del 50% fuera del rango típico)
    const priceRange = maxPrice - minPrice;
    const threshold = priceRange * 0.5;
    const filteredPrices = allPrices.filter(price => 
      price >= minPrice - threshold && price <= maxPrice + threshold
    );
    
    const finalMinPrice = Math.min(...filteredPrices);
    const finalMaxPrice = Math.max(...filteredPrices);
    
    // Agregar padding más conservador
    const padding = (finalMaxPrice - finalMinPrice) * 0.05; // Reducido de 0.1 a 0.05
    const paddedMinPrice = Math.max(0, finalMinPrice - padding);
    const paddedMaxPrice = finalMaxPrice + padding;
    const finalPriceRange = paddedMaxPrice - paddedMinPrice;
    
    return { 
      minPrice: paddedMinPrice, 
      maxPrice: paddedMaxPrice, 
      priceRange: finalPriceRange > 0 ? finalPriceRange : 1,
      validCandles
    };
  }, [candles]);

  // Renderizar vela individual con validaciones mejoradas
  const renderCandle = useCallback((candle: CandleData, index: number) => {
    // Validar que la vela tenga datos válidos
    if (!candle || candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0 ||
        !isFinite(candle.open) || !isFinite(candle.high) || !isFinite(candle.low) || !isFinite(candle.close) ||
        candle.high < candle.low || 
        candle.high < Math.max(candle.open, candle.close) ||
        candle.low > Math.min(candle.open, candle.close)) {
      return null; // No renderizar velas inválidas
    }

    const isGreen = candle.close >= candle.open;
    
    // Calcular alturas y posiciones con validaciones
    const bodyHeight = Math.max(2, Math.abs(candle.close - candle.open) / priceRange * (CHART_HEIGHT - CHART_PADDING));
    const wickHeight = Math.max(2, (candle.high - candle.low) / priceRange * (CHART_HEIGHT - CHART_PADDING));
    
    const bodyTop = (maxPrice - Math.max(candle.open, candle.close)) / priceRange * (CHART_HEIGHT - CHART_PADDING) + (CHART_PADDING / 2);
    const wickTop = (maxPrice - candle.high) / priceRange * (CHART_HEIGHT - CHART_PADDING) + (CHART_PADDING / 2);
    
    // Asegurar que las posiciones estén dentro de los límites del gráfico
    const safeBodyTop = Math.max(0, Math.min(CHART_HEIGHT - bodyHeight - CHART_PADDING/2, bodyTop));
    const safeWickTop = Math.max(0, Math.min(CHART_HEIGHT - wickHeight - CHART_PADDING/2, wickTop));
    const safeBodyHeight = Math.min(bodyHeight, CHART_HEIGHT - safeBodyTop - CHART_PADDING/2);
    const safeWickHeight = Math.min(wickHeight, CHART_HEIGHT - safeWickTop - CHART_PADDING/2);
    
    const candleColor = isGreen ? '#00ff88' : '#ff4444';
    
    // Detectar si es la vela más reciente (live)
    const isLiveCandle = index === validCandles.length - 1;
    
    return (
      <View 
        key={`${candle.timestamp}_${index}`} 
        style={[
          styles.candleContainer, 
          { left: index * (CANDLE_WIDTH + CANDLE_SPACING) }
        ]}
      >
        {/* Mecha */}
        <View
          style={[
            styles.wick,
            {
              top: safeWickTop,
              height: safeWickHeight,
              backgroundColor: candleColor,
              opacity: isLiveCandle ? 0.9 : 1.0,
            },
          ]}
        />
        {/* Cuerpo */}
        <View
          style={[
            styles.candleBody,
            {
              top: safeBodyTop,
              height: safeBodyHeight,
              backgroundColor: candleColor,
              opacity: isLiveCandle ? 0.9 : 1.0,
              borderWidth: isLiveCandle ? 1 : 0,
              borderColor: candleColor,
            },
          ]}
        />
        {/* Indicador live */}
        {isLiveCandle && isStreaming && (
          <View style={[styles.liveIndicator, { 
            top: safeBodyTop - 4,
            backgroundColor: candleColor,
          }]} />
        )}
      </View>
    );
  }, [maxPrice, priceRange, validCandles.length, isStreaming]);

  // Manejar cambio de timeframe
  const handleTimeframeChange = useCallback((timeframe: string) => {
    if (timeframe === selectedTimeframe || isLoading) return;
    
    console.log(`📊 Changing timeframe to ${timeframe}`);
    setSelectedTimeframe(timeframe);
  }, [selectedTimeframe, isLoading]);

  // Alternar modo ultra fast
  const handleToggleUltraFast = useCallback(() => {
    setEnableUltraFast(prev => !prev);
    toggleStreamingMode();
  }, [toggleStreamingMode]);

  const currentTicker = tickers[selectedPair];
  const currentPrice = currentTicker?.price || 0;
  const priceChange = currentTicker?.changePercent24h || 0;

  return (
    <View style={styles.container}>
      {/* Header con información de precio */}
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
        </View>
        
        {/* Estado del streaming */}
        <View style={styles.streamingStatus}>
          <View style={[
            styles.statusDot, 
            { backgroundColor: isStreaming ? '#00ff88' : (isLoading ? '#ffa500' : '#ff4444') }
          ]} />
          <Text style={styles.statusText}>
            {isLoading ? 'CARGANDO' : (isStreaming ? 'LIVE' : 'PARADO')}
          </Text>
          {stats.lastUpdate && (
            <Text style={styles.lastUpdate}>
              {stats.lastUpdate.toLocaleTimeString()}
            </Text>
          )}
        </View>
      </View>

      {/* Controles de streaming */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.controlButton, isStreaming && styles.activeControl]} 
          onPress={isStreaming ? stopStreaming : startStreaming}
        >
          <Text style={styles.controlText}>
            {isStreaming ? '⏸️ PARAR' : '▶️ INICIAR'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton} onPress={restartStreaming}>
          <Text style={styles.controlText}>🔄 REINICIAR</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.controlButton, enableUltraFast && styles.activeControl]} 
          onPress={handleToggleUltraFast}
        >
          <Text style={styles.controlText}>
            ⚡ {enableUltraFast ? 'ULTRA' : 'NORMAL'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Estadísticas */}
      <View style={styles.statsContainer}>
        <Text style={styles.statText}>
          Updates: {stats.updateCount} | Avg: {stats.averageResponseTime}ms | Errors: {stats.errorCount}
        </Text>
        <Text style={styles.statText}>
          Candles: {validCandles.length}/{candles.length} válidas | Mode: {isUltraFastMode ? 'Ultra-Fast' : 'WebSocket'}
        </Text>
      </View>

      {/* Selector de timeframe */}
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

      {/* Gráfico */}
      <View style={styles.chartContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00ff88" />
            <Text style={styles.loadingText}>Cargando datos reales...</Text>
          </View>
        ) : hasData && validCandles.length >= 5 ? ( // Requiere al menos 5 velas válidas
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              width: Math.max(screenWidth, validCandles.length * (CANDLE_WIDTH + CANDLE_SPACING)),
              height: CHART_HEIGHT,
            }}
          >
            <View style={styles.chart}>
              {validCandles.map((candle, index) => renderCandle(candle, index)).filter(Boolean)}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              {hasData && validCandles.length < 5 
                ? `Cargando datos válidos (${validCandles.length}/5)...` 
                : "No hay datos disponibles"}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={restartStreaming}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Escala de precios */}
      {hasData && validCandles.length >= 5 && (
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

      {/* Debug Panel */}
      <StreamingDebugPanel
        currentCandle={currentCandle}
        symbol={selectedPair}
        interval={selectedTimeframe}
        updateCount={updateCount}
        lastUpdateTime={lastUpdate || undefined}
        responseTime={responseTime}
        errorCount={errorCount}
        isStreaming={isStreaming}
        streamingMode={isUltraFastMode ? 'ultra-fast' : 'websocket'}
        candleCount={validCandles.length}
        action={lastAction}
        actionIndex={lastActionIndex}
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  symbolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginRight: 12,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
  },
  change: {
    fontSize: 12,
    fontWeight: '500',
  },
  streamingStatus: {
    alignItems: 'flex-end',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  statusText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  lastUpdate: {
    fontSize: 8,
    color: '#888888',
  },
  controls: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  controlButton: {
    backgroundColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  activeControl: {
    backgroundColor: '#00ff88',
  },
  controlText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  statsContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  statText: {
    fontSize: 10,
    color: '#888888',
    fontFamily: 'monospace',
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
  retryButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 12,
  },
  retryText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  priceScale: {
    position: 'absolute',
    right: 8,
    top: 150,
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
});

export default LiveCandlestickChart;
