import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  Dimensions, 
  ScrollView,
  TouchableOpacity,
  Text,
  StatusBar,
  Alert
} from 'react-native';
import { TradingChart } from '../../components/chart/TradingChart';
import { OrderPanel } from '../../components/trading/OrderPanel';
import { MarketData } from '../../components/trading/MarketData';
import { useChartDataStore } from '../../stores/chartDataStore';
import { useServiceIntegration } from '../../hooks/useServiceIntegration';
import { useMarketData } from '../../hooks/useMarketData';

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

const SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT', 
  'ADAUSDT',
  'BNBUSDT',
  'SOLUSDT'
];

const COLORS = {
  background: '#0d1117',
  surface: '#161b22',
  surfaceHover: '#21262d',
  border: '#30363d',
  text: '#f0f6fc',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',
  success: '#00ff88',
  danger: '#ff4757',
  warning: '#feca57',
  active: '#0969da',
  buy: '#00ff88',
  sell: '#ff4757',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  
  // Symbol and Timeframe Controls
  controlsContainer: {
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  symbolSelector: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  symbolButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 70,
    alignItems: 'center',
  },
  activeSymbol: {
    backgroundColor: COLORS.active,
    borderColor: COLORS.active,
  },
  symbolText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  
  timeframeSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  timeframeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: COLORS.background,
    minWidth: 40,
    alignItems: 'center',
  },
  activeTimeframe: {
    backgroundColor: COLORS.active,
  },
  timeframeText: {
    fontSize: 11,
    color: COLORS.text,
  },
  
  // Layout
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    flex: 2,
    backgroundColor: COLORS.background,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
    maxWidth: 400,
  },
  
  // Market Data Header
  marketDataHeader: {
    padding: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  
  // Chart Container
  chartContainer: {
    flex: 1,
  },
  
  // Mobile Layout (when screen is narrow)
  mobileLayout: {
    flex: 1,
  },
  mobileChartContainer: {
    height: 400,
  },
  mobilePanelContainer: {
    flex: 1,
  },
  
  // Error and Loading States
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.active,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
});

export const TradingScreenModern: React.FC = () => {
  const screenWidth = Dimensions.get('window').width;
  const isTablet = screenWidth >= 768;
  
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m');
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Initialize hooks
  const {
    currentSymbol,
    currentTimeframe,
    isLoading,
    error,
    getCandles,
    getTicker,
    getCacheStats,
  } = useChartDataStore();

  // Service integration hook
  const {
    initializeTradingPair,
    switchTradingPair,
    cleanup
  } = useServiceIntegration();

  // Market data hook for connection status
  const { 
    start: startStreaming, 
    stop: stopStreaming, 
    getStatus,
    isInitialized 
  } = useMarketData();

  // Current ticker data for the selected symbol
  const ticker = getTicker(selectedSymbol);
  const candles = getCandles(selectedSymbol, selectedTimeframe);
  const currentPrice = ticker?.price || (candles[candles.length - 1]?.close || 0);

  // Update store when symbol or timeframe changes
  useEffect(() => {
    if (selectedSymbol !== currentSymbol || selectedTimeframe !== currentTimeframe) {
      switchTradingPair(selectedSymbol, selectedTimeframe).catch(err => {
        console.error('Failed to switch trading pair:', err);
      });
    }
  }, [selectedSymbol, selectedTimeframe, currentSymbol, currentTimeframe, switchTradingPair]);

  // Initialize on mount
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (!mounted) return;
      
      try {
        await initializeTradingPair(selectedSymbol, selectedTimeframe);
        setIsConnected(true);
        setLastUpdate(new Date());
      } catch (err) {
        if (mounted) {
          console.error('❌ Failed to initialize trading screen:', err);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
      cleanup();
    };
  }, []); // Only run on mount

  // Simulate real-time updates for demo
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance of update
        setLastUpdate(new Date());
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleSymbolChange = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
  }, []);

  const handleTimeframeChange = useCallback((timeframe: string) => {
    setSelectedTimeframe(timeframe);
  }, []);

  const handleOrderCreate = useCallback((type: 'buy' | 'sell', price: number) => {
    Alert.alert(
      'Order Created',
      `${type.toUpperCase()} order created at ${price}`,
      [{ text: 'OK' }]
    );
  }, []);

  const handleRetry = useCallback(() => {
    setSelectedSymbol(selectedSymbol); // This will trigger useEffect to reload data
  }, [selectedSymbol]);

  const cacheStats = getCacheStats();

  // Render connection status
  const renderConnectionStatus = () => (
    <View style={styles.connectionStatus}>
      <View 
        style={[
          styles.statusDot, 
          { backgroundColor: isConnected ? COLORS.success : COLORS.danger }
        ]} 
      />
      <Text style={styles.statusText}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </Text>
      {lastUpdate && (
        <Text style={styles.statusText}>
          • {lastUpdate.toLocaleTimeString()}
        </Text>
      )}
    </View>
  );

  // Render symbol selector
  const renderSymbolSelector = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.symbolSelector}>
      {SYMBOLS.map((symbol) => (
        <TouchableOpacity
          key={symbol}
          style={[
            styles.symbolButton,
            selectedSymbol === symbol && styles.activeSymbol,
          ]}
          onPress={() => handleSymbolChange(symbol)}
        >
          <Text style={styles.symbolText}>{symbol}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // Render timeframe selector
  const renderTimeframeSelector = () => (
    <View style={styles.timeframeSelector}>
      {TIMEFRAMES.map((tf) => (
        <TouchableOpacity
          key={tf.value}
          style={[
            styles.timeframeButton,
            selectedTimeframe === tf.value && styles.activeTimeframe,
          ]}
          onPress={() => handleTimeframeChange(tf.value)}
        >
          <Text style={styles.timeframeText}>{tf.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Render error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render loading state
  if (isLoading && candles.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading market data...</Text>
        </View>
      </View>
    );
  }

  // Desktop/Tablet Layout
  if (isTablet) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>HoundTrade Pro</Text>
              <Text style={styles.subtitle}>
                {cacheStats.totalCandles} candles • {cacheStats.memoryUsage}
              </Text>
            </View>
            {renderConnectionStatus()}
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {renderSymbolSelector()}
          {renderTimeframeSelector()}
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Left Panel - Chart */}
          <View style={styles.leftPanel}>
            <View style={styles.marketDataHeader}>
              <MarketData />
            </View>
            <View style={styles.chartContainer}>
              <TradingChart
                symbol={selectedSymbol}
                timeframe={selectedTimeframe}
                height={400}
                onOrderCreate={handleOrderCreate}
                showIndicators={true}
                showVolume={true}
              />
            </View>
          </View>

          {/* Right Panel - Order Panel */}
          <View style={styles.rightPanel}>
            <OrderPanel
              symbol={selectedSymbol}
              currentPrice={currentPrice}
              onOrderSubmit={(order) => console.log('Order submitted:', order)}
            />
          </View>
        </View>
      </View>
    );
  }

  // Mobile Layout
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>HoundTrade</Text>
            <Text style={styles.subtitle}>Mobile Trading</Text>
          </View>
          {renderConnectionStatus()}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {renderSymbolSelector()}
        {renderTimeframeSelector()}
      </View>

      <ScrollView style={styles.mobileLayout}>
        {/* Market Data */}
        <View style={styles.marketDataHeader}>
          <MarketData />
        </View>

        {/* Chart */}
        <View style={styles.mobileChartContainer}>
          <TradingChart
            symbol={selectedSymbol}
            timeframe={selectedTimeframe}
            height={350}
            onOrderCreate={handleOrderCreate}
            showIndicators={true}
            showVolume={true}
          />
        </View>

        {/* Order Panel */}
        <View style={styles.mobilePanelContainer}>
          <OrderPanel
            symbol={selectedSymbol}
            currentPrice={currentPrice}
            onOrderSubmit={(order) => console.log('Order submitted:', order)}
          />
        </View>
      </ScrollView>
    </View>
  );
};
