import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { useAuth, useMarket } from '../../context/AppContext';
import { useMarketData } from '../../hooks/useMarketData';
import { useTrading } from '../../hooks/useTrading';
import { formatPrice, formatPercentage, formatCurrency } from '../../utils/formatters';
import MinimalistChart from '../../components/chart/MinimalistChart';
import { MarketData } from '../../components/trading/MarketData';
import { PositionsGrid } from '../../components/trading/PositionsGrid';
import { OrderForm } from '../../components/trading/OrderForm';
import { OrderFormModal } from '../../components/trading/OrderFormModal';
import { OrderHistory } from '../../components/trading/OrderHistory';
import TradingOverlay from '../../components/trading/TradingOverlay';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive breakpoints
const isTablet = screenWidth >= 768;
const isMobile = screenWidth < 768;
const isSmallMobile = screenWidth < 400;

export const TradingScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { selectedPair, tickers } = useMarket();
  
  // Trading hook
  const {
    orders,
    activeOrders,
    closedOrders,
    portfolio,
    stats,
    settings,
    isLoading,
    error,
    createOrder,
    closeOrder,
    cancelOrder,
    refreshPortfolio,
    getCurrentPrice,
    updatePrice
  } = useTrading();

  // Tab state - simplified to 3 main sections
  const [activeTab, setActiveTab] = useState<'trading' | 'posiciones' | 'trades'>('trading');
  
  // Order form modal state
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Trading overlay state - para el div de colores encima del gráfico
  const [showTradingOverlay, setShowTradingOverlay] = useState(false);
  const [chartDimensions, setChartDimensions] = useState({
    width: screenWidth - 20 - 90, // Restamos 90px para el label de precios del lado derecho
    height: screenHeight - 140,
    x: 10,
    y: 80
  });
  const [overlayTakeProfit, setOverlayTakeProfit] = useState<number | null>(null);
  const [overlayStopLoss, setOverlayStopLoss] = useState<number | null>(null);

  useEffect(() => {
    if (showTradingOverlay) {
      setOverlayTakeProfit(null);
      setOverlayStopLoss(null);
    }
  }, [showTradingOverlay]);

  // Initialize market data at the screen level
  const { isInitialized, getStatus } = useMarketData({
    autoStart: true,
    symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'],
    refreshInterval: 30000,
  });

  // Update trading prices when market data changes
  useEffect(() => {
    Object.entries(tickers).forEach(([symbol, data]) => {
      const currentTradingPrice = getCurrentPrice(symbol);
      if (!currentTradingPrice || Math.abs(currentTradingPrice - data.price) > data.price * 0.01) {
        // Update if price difference is more than 1%
        updatePrice(symbol, data.price);
      }
    });
  }, [tickers, getCurrentPrice, updatePrice]);

  // Only log once when status changes
  useEffect(() => {
    console.log('🏠 TradingScreen - Market data status changed:', {
      initialized: isInitialized,
      tickerCount: Object.keys(tickers).length,
      symbols: Object.keys(tickers),
      tradingOrders: orders.length,
      activeOrders: activeOrders.length
    });
  }, [isInitialized, Object.keys(tickers).length, orders.length, activeOrders.length]);

  const currentPrice = tickers[selectedPair]?.price || 0;
  const priceChange = tickers[selectedPair]?.changePercent24h || 0;

  // Calcular escala de precios para el overlay
  const priceScale = React.useMemo(() => {
    if (!currentPrice) return undefined;
    
    // Crear un rango de precios basado en el precio actual
    const basePrice = currentPrice;
    const range = basePrice * 0.1; // 10% de rango
    
    return {
      min: basePrice - range,
      max: basePrice + range,
      pixelsPerPrice: chartDimensions.height / (range * 2)
    };
  }, [currentPrice, chartDimensions.height]);

  const handleLogout = () => {
    logout();
  };

  const handleRefreshData = async () => {
    await refreshPortfolio();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'trading':
        return (
          <View style={styles.chartContainer}>
            <View style={styles.chartWrapper}>
              <MinimalistChart 
                symbol={selectedPair} 
              />
              
              {/* Overlay de colores - se posiciona encima del gráfico */}
              <TradingOverlay
                chartDimensions={chartDimensions}
                isVisible={showTradingOverlay}
                symbol={selectedPair}
                priceScale={priceScale}
                latestPrice={currentPrice}
                initialTakeProfit={overlayTakeProfit}
                initialStopLoss={overlayStopLoss}
                onTakeProfitChange={setOverlayTakeProfit}
                onStopLossChange={setOverlayStopLoss}
                onOverlayClick={(event) => {
                  console.log('🖱️ [OVERLAY_CLICK] Click en overlay detectado', event);
                }}
                onClose={() => {
                  console.log('❌ [OVERLAY_CLOSE] Cerrando overlay');
                  setShowTradingOverlay(false);
                }}
              />

              {/* Botón Configurar Orden para el gráfico - solo visible cuando no hay overlay */}
              {!showTradingOverlay && (
                <TouchableOpacity
                  style={styles.configureOrderButton}
                  onPress={() => {
                    console.log('🎨 [CONFIGURE_ORDER] Activando panel de configuración de orden');
                    setShowTradingOverlay(true);
                  }}
                >
                  <Text style={styles.configureOrderButtonText}>Configurar Orden</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      
      case 'posiciones':
        // Convert trading orders to positions format
        const positions = activeOrders.map(order => {
          const currentPrice = tickers[order.symbol]?.price || order.entryPrice;
          const currentValue = order.quantity * currentPrice;
          const pnl = currentValue - order.usdtAmount;
          
          return {
            id: order.id,
            symbol: order.symbol,
            side: order.side,
            quantity: order.quantity,
            entryPrice: order.entryPrice,
            currentPrice: currentPrice,
            stopLoss: order.stopLossPrice || undefined,
            takeProfit: order.takeProfitPrice || undefined,
            pnl: pnl,
            pnlPercentage: (pnl / order.usdtAmount) * 100,
            usdtAmount: order.usdtAmount,
            timestamp: order.createdAt,
          };
        });

        return (
          <PositionsGrid 
            positions={positions}
            onAddPosition={() => setShowOrderModal(true)}
            onPositionPress={(position) => {
              console.log('Position pressed:', position);
            }}
            onClosePosition={(positionId) => {
              closeOrder(positionId, 'Cerrado desde posiciones');
            }}
          />
        );
      
      case 'trades':
        return (
          <OrderHistory 
            orders={orders}
            onRefresh={handleRefreshData}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.appName}>HoundTrade</Text>
          <Text style={styles.userName}>
            Trading Simulado - {user?.displayName}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Portfolio Summary with Menu */}
      <View style={styles.portfolioSummary}>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceValue}>
            ${portfolio ? formatCurrency(portfolio.totalBalance) : '---'}
          </Text>
        </View>
        <View style={styles.equityContainer}>
          <Text style={styles.equityLabel}>PnL Total</Text>
          <Text style={[
            styles.equityValue,
            { 
              color: portfolio && (portfolio.realizedPnL + portfolio.unrealizedPnL) >= 0 
                ? '#00ff88' 
                : '#ff4444' 
            }
          ]}>
            {portfolio ? 
              `$${formatCurrency(portfolio.realizedPnL + portfolio.unrealizedPnL)}` : 
              '---'
            }
          </Text>
        </View>
        <View style={styles.pnlContainer}>
          <Text style={styles.pnlLabel}>Win Rate</Text>
          <Text style={styles.pnlValue}>
            {portfolio ? `${portfolio.winRate.toFixed(1)}%` : '---'}
          </Text>
        </View>
      </View>

      {/* Menu tabs directly below balance */}
      <View style={styles.menuNavigation}>
        <TouchableOpacity
          style={[styles.menuButton, activeTab === 'trading' && styles.activeMenuButton]}
          onPress={() => setActiveTab('trading')}
        >
          <Text style={[styles.menuButtonText, activeTab === 'trading' && styles.activeMenuButtonText]}>
            Trading
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.menuButton, activeTab === 'posiciones' && styles.activeMenuButton]}
          onPress={() => setActiveTab('posiciones')}
        >
          <Text style={[styles.menuButtonText, activeTab === 'posiciones' && styles.activeMenuButtonText]}>
            Posiciones
          </Text>
          {activeOrders.length > 0 && (
            <View style={styles.menuBadge}>
              <Text style={styles.menuBadgeText}>{activeOrders.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.menuButton, activeTab === 'trades' && styles.activeMenuButton]}
          onPress={() => setActiveTab('trades')}
        >
          <Text style={[styles.menuButtonText, activeTab === 'trades' && styles.activeMenuButtonText]}>
            Trades
          </Text>
        </TouchableOpacity>
      </View>

      {/* Market Data - only show for trading view */}
      {activeTab === 'trading' && <MarketData />}

      {/* Tab Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>

      {/* Order Form Modal/Overlay */}
      {activeTab === 'posiciones' && (
        <TouchableOpacity 
          style={styles.floatingOrderButton}
          onPress={() => setShowOrderModal(true)}
        >
          <Text style={styles.floatingOrderButtonText}>Nueva Orden</Text>
        </TouchableOpacity>
      )}

      {/* Order Form Modal */}
      <OrderFormModal
        visible={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        onCreateOrder={createOrder}
        isLoading={isLoading}
        defaultSymbol={selectedPair}
        defaultTakeProfitPrice={overlayTakeProfit}
        defaultStopLossPrice={overlayStopLoss}
      />

      {/* Error display */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    minHeight: isSmallMobile ? 60 : 70,
  },
  headerLeft: {
    flex: 1,
  },
  appName: {
    fontSize: isSmallMobile ? 18 : 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userName: {
    fontSize: isSmallMobile ? 12 : 14,
    color: '#888888',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: isSmallMobile ? 12 : 16,
    paddingVertical: isSmallMobile ? 6 : 8,
    borderRadius: 6,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: isSmallMobile ? 12 : 14,
    fontWeight: '500',
  },
  // Portfolio summary with responsive design
  portfolioSummary: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 480px)': {
        flexDirection: 'column',
        gap: 8,
      },
    }),
  },
  balanceContainer: {
    flex: 1,
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 480px)': {
        alignItems: 'flex-start',
        paddingVertical: 8,
      },
    }),
  },
  balanceLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  equityContainer: {
    flex: 1,
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 480px)': {
        alignItems: 'flex-start',
        paddingVertical: 8,
      },
    }),
  },
  equityLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
  },
  equityValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pnlContainer: {
    flex: 1,
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 480px)': {
        alignItems: 'flex-start',
        paddingVertical: 8,
      },
    }),
  },
  pnlLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
  },
  pnlValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  // New menu navigation
  menuNavigation: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  menuButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
    position: 'relative',
  },
  activeMenuButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  menuButtonText: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  activeMenuButtonText: {
    color: '#00ff88',
    fontWeight: 'bold',
  },
  menuBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Content area maximized
  content: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  // Chart container with responsive height
  chartContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 768px)': {
        minHeight: '60vh',
      },
      '@media (min-width: 769px)': {
        minHeight: '70vh',
      },
    }),
  },
  // Wrapper para gráfico y overlay
  chartWrapper: {
    flex: 1,
    position: 'relative',
  },
  // Botón activador del overlay
  overlayActivatorButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#00ff88',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  overlayActivatorButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Botón específico para configurar orden en el gráfico
  configureOrderButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#00ff88',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 999,
  },
  configureOrderButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Floating action button
  floatingOrderButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#00ff88',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 1000,
  },
  floatingOrderButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Error banner
  errorBanner: {
    backgroundColor: '#ff4444',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  errorText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '600',
  },
});