import React, { useState, useEffect, useCallback } from 'react';
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
import { TRADING_SYMBOLS } from '../../constants/tradingSymbols';
import MinimalistChart from '../../components/chart/MinimalistChart';
import TradingOverlay from '../../components/trading/TradingOverlay';
import { MarketData } from '../../components/trading/MarketData';
import { RealTimePositionsGrid } from '../../components/trading/RealTimePositionsGrid';
import { PositionDetailsModal } from '../../components/trading/PositionDetailsModal';
import { OrderForm } from '../../components/trading/OrderForm';
import { OrderFormModal } from '../../components/trading/OrderFormModal';
import { OrderHistory } from '../../components/trading/OrderHistory';

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
  
  // Position details modal state
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  
  // Trading overlay state
  const [showTradingOverlay, setShowTradingOverlay] = useState(false);
  const [overlayActivationPrice, setOverlayActivationPrice] = useState<number | null>(null);
  const [forceDeactivate, setForceDeactivate] = useState(false);
  
  // Handler para el botón de overlay que también activa los niveles
  const handleTradingOverlayToggle = useCallback(() => {
    const newState = !showTradingOverlay;
    setShowTradingOverlay(newState);
    
    // Si se está activando el overlay, obtener precio actual y enviarlo al chart
    if (newState) {
      // Intentar múltiples fuentes para obtener el precio actual
      let currentPrice = tickers[selectedPair]?.price; // Precio del ticker
      
      if (!currentPrice) {
        // Fallback 1: Precio del trading hook
        const tradingPrice = getCurrentPrice(selectedPair);
        if (tradingPrice) {
          currentPrice = tradingPrice;
        }
      }
      
      if (!currentPrice) {
        // Fallback 2: Precio base según el símbolo
        const basePrices: Record<string, number> = {
          'BTCUSDT': 114000,
          'ETHUSDT': 4200,
          'BNBUSDT': 1000,
          'ADAUSDT': 0.8,
          'SOLUSDT': 210,
          'XRPUSDT': 2.8,
          'DOTUSDT': 4.0,
          'LINKUSDT': 22,
          'MATICUSDT': 0.38,
          'AVAXUSDT': 30,
          'ATOMUSDT': 4.1,
          'UNIUSDT': 7.7,
          'LTCUSDT': 107
        };
        currentPrice = basePrices[selectedPair] || 100;
      }
      
      console.log(`� [OVERLAY BUTTON] Activando overlay con precio actual: $${currentPrice}`);
      setOverlayActivationPrice(currentPrice);
      setForceDeactivate(false); // Asegurar que no esté en modo desactivación
      // Reset el precio después de un momento para que pueda activarse nuevamente
      setTimeout(() => setOverlayActivationPrice(null), 100);
    } else {
      console.log(`🔴 [OVERLAY BUTTON] Desactivando overlay - LIMPIEZA COMPLETA`);
      setOverlayActivationPrice(null);
      setForceDeactivate(true); // Forzar desactivación completa
      // Reset después de un momento
      setTimeout(() => setForceDeactivate(false), 100);
    }
  }, [showTradingOverlay, selectedPair, tickers, getCurrentPrice]);

  // Estados para Take Profit y Stop Loss (mantenidos para funcionalidad del modal)
  const [overlayTakeProfit, setOverlayTakeProfit] = useState<number | null>(null);
  const [overlayStopLoss, setOverlayStopLoss] = useState<number | null>(null);

  // Initialize market data at the screen level - optimized for faster updates
  const { isInitialized, getStatus } = useMarketData({
    autoStart: true,
    symbols: TRADING_SYMBOLS,
    refreshInterval: 10000, // 10 seconds - optimized for more frequent updates
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

  // Calcular precio actual para referencia
  const currentPrice = tickers[selectedPair]?.price || 0;
  const priceChange = tickers[selectedPair]?.changePercent24h || 0;

  const handleLogout = () => {
    logout();
  };

  const handleRefreshData = async () => {
    await refreshPortfolio();
  };

  // Handle navigation to chart from position
  const handleGoToChart = useCallback((symbol: string, position: any) => {
    console.log(`🎯 [GO TO CHART] Navegando a ${symbol} con overlay activado`);
    
    // Switch to trading tab
    setActiveTab('trading');
    
    // Activate trading overlay with position
    setShowTradingOverlay(true);
    
    // Get current price for the symbol
    let currentPrice = tickers[symbol]?.price;
    if (!currentPrice) {
      const tradingPrice = getCurrentPrice(symbol);
      currentPrice = tradingPrice || position.entryPrice;
    }
    
    setOverlayActivationPrice(currentPrice);
    setForceDeactivate(false);
    
    // Set overlay TP/SL from position
    if (position.takeProfitPrice) {
      setOverlayTakeProfit(position.takeProfitPrice);
    }
    if (position.stopLossPrice) {
      setOverlayStopLoss(position.stopLossPrice);
    }
    
    setTimeout(() => setOverlayActivationPrice(null), 100);
  }, [tickers, getCurrentPrice]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'trading':
        return (
          <View style={styles.chartContainer}>
            <View style={styles.chartWrapper}>
              <MinimalistChart 
                symbol={selectedPair} 
                showTradingOverlay={showTradingOverlay}
                onTradingOverlayChange={setShowTradingOverlay}
                activateOverlayWithPrice={overlayActivationPrice}
                forceDeactivateOverlay={forceDeactivate}
              />
              
              {/* External Trading Overlay for enhanced position visualization */}
              {showTradingOverlay && (
                <TradingOverlay
                  chartDimensions={{
                    width: screenWidth - 32, // Account for padding
                    height: 300, // Approximate chart height
                    x: 16,
                    y: 100, // Offset from top controls
                  }}
                  isVisible={showTradingOverlay}
                  onClose={() => setShowTradingOverlay(false)}
                  symbol={selectedPair}
                  priceScale={{
                    min: Math.min(...Object.values(tickers).map(t => t.price)) * 0.95,
                    max: Math.max(...Object.values(tickers).map(t => t.price)) * 1.05,
                    pixelsPerPrice: 1,
                  }}
                  latestPrice={currentPrice}
                  initialTakeProfit={overlayTakeProfit}
                  initialStopLoss={overlayStopLoss}
                  onTakeProfitChange={setOverlayTakeProfit}
                  onStopLossChange={setOverlayStopLoss}
                  // Position data for visualization
                  activePositions={activeOrders
                    .filter(order => order.symbol === selectedPair)
                    .map(order => ({
                      id: order.id,
                      symbol: order.symbol,
                      side: order.side,
                      entryPrice: order.entryPrice,
                      takeProfitPrice: order.takeProfitPrice || undefined,
                      stopLossPrice: order.stopLossPrice || undefined,
                      quantity: order.quantity,
                      unrealizedPnL: (tickers[order.symbol]?.price || order.entryPrice) * order.quantity - order.usdtAmount,
                    }))
                  }
                  currentPositionIndex={0}
                  onPositionChange={(index: number) => {
                    console.log('Position changed to index:', index);
                  }}
                  onPositionPress={(position: any) => {
                    // Find the full order data and show position modal
                    const fullOrder = activeOrders.find(order => order.id === position.id);
                    if (fullOrder) {
                      const positionWithPnL = {
                        ...fullOrder,
                        currentPrice: tickers[fullOrder.symbol]?.price || fullOrder.entryPrice,
                        unrealizedPnL: position.unrealizedPnL,
                        unrealizedPnLPercentage: (position.unrealizedPnL / fullOrder.usdtAmount) * 100,
                        priceChange: (tickers[fullOrder.symbol]?.price || fullOrder.entryPrice) - fullOrder.entryPrice,
                        priceChangePercentage: ((tickers[fullOrder.symbol]?.price || fullOrder.entryPrice) - fullOrder.entryPrice) / fullOrder.entryPrice * 100,
                      };
                      setSelectedPosition(positionWithPnL);
                      setShowPositionModal(true);
                    }
                  }}
                />
              )}
            </View>
          </View>
        );
      
      case 'posiciones':
        return (
          <RealTimePositionsGrid 
            orders={activeOrders}
            onAddPosition={() => setShowOrderModal(true)}
            onPositionPress={(position: any) => {
              console.log('Position pressed:', position);
              setSelectedPosition(position);
              setShowPositionModal(true);
            }}
            onClosePosition={(positionId: string) => {
              closeOrder(positionId, 'Cerrado desde posiciones');
            }}
            getCurrentPrice={getCurrentPrice}
            onPriceUpdate={(callback: any) => {
              // Subscribe to price updates from the trading service
              const tradingOrderService = require('../../services/tradingOrderService').TradingOrderService.getInstance();
              return tradingOrderService.onPriceUpdate(callback);
            }}
            isLoading={isLoading}
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

      {/* Trading Overlay Toggle Button */}
      {activeTab === 'trading' && (
        <TouchableOpacity 
          style={[
            styles.floatingOverlayButton,
            showTradingOverlay && styles.floatingOverlayButtonActive
          ]}
          onPress={handleTradingOverlayToggle}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.floatingOverlayButtonText,
            showTradingOverlay && styles.floatingOverlayButtonTextActive
          ]}>
            {showTradingOverlay ? '✕ Cerrar' : '📊 Overlay'}
          </Text>
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

      {/* Position Details Modal */}
      <PositionDetailsModal
        visible={showPositionModal}
        position={selectedPosition}
        onClose={() => {
          setShowPositionModal(false);
          setSelectedPosition(null);
        }}
        onClosePosition={(positionId: string) => {
          closeOrder(positionId, 'Cerrado desde detalles de posición');
        }}
        onGoToChart={handleGoToChart}
        getCurrentPrice={getCurrentPrice}
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
      // Pequeños móviles y alta escala de texto
      '@media (max-width: 360px), (max-height: 640px)': {
        flexDirection: 'column',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 12,
      },
      // Móviles estándar
      '@media (max-width: 480px)': {
        flexDirection: 'column',
        gap: 8,
        paddingVertical: 14,
      },
      // Tablets pequeñas en modo portrait
      '@media (max-width: 600px) and (orientation: portrait)': {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
      },
      // Dispositivos con zoom alto o escalado de texto
      '@media (min-resolution: 2dppx), (-webkit-min-device-pixel-ratio: 2)': {
        paddingVertical: 14,
        paddingHorizontal: 14,
      },
    }),
  },
  balanceContainer: {
    flex: 1,
    alignItems: 'center',
    minWidth: 100,
    ...(Platform.OS === 'web' && {
      // Pequeños móviles
      '@media (max-width: 360px)': {
        alignItems: 'flex-start',
        paddingVertical: 6,
        minWidth: 'auto',
        width: '100%',
      },
      // Móviles estándar
      '@media (max-width: 480px)': {
        alignItems: 'flex-start',
        paddingVertical: 8,
        minWidth: 'auto',
      },
      // Tablets en portrait
      '@media (max-width: 600px) and (orientation: portrait)': {
        flex: '0 1 calc(50% - 8px)',
        alignItems: 'center',
      },
      // Alto DPI / escalado
      '@media (min-resolution: 2dppx)': {
        minWidth: 110,
      },
    }),
  },
  balanceLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        fontSize: 12,
        marginBottom: 2,
      },
      '@media (max-height: 500px) and (orientation: landscape)': {
        fontSize: 12,
        marginBottom: 2,
      },
    }),
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        fontSize: 16,
      },
      '@media (max-width: 480px)': {
        fontSize: 17,
      },
      '@media (max-height: 500px) and (orientation: landscape)': {
        fontSize: 16,
      },
    }),
  },
  equityContainer: {
    flex: 1,
    alignItems: 'center',
    minWidth: 100,
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        alignItems: 'flex-start',
        paddingVertical: 6,
        minWidth: 'auto',
        width: '100%',
      },
      '@media (max-width: 480px)': {
        alignItems: 'flex-start',
        paddingVertical: 8,
        minWidth: 'auto',
      },
      '@media (max-width: 600px) and (orientation: portrait)': {
        flex: '0 1 calc(50% - 8px)',
        alignItems: 'center',
      },
      '@media (min-resolution: 2dppx)': {
        minWidth: 110,
      },
    }),
  },
  equityLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        fontSize: 12,
        marginBottom: 2,
      },
      '@media (max-height: 500px) and (orientation: landscape)': {
        fontSize: 12,
        marginBottom: 2,
      },
    }),
  },
  equityValue: {
    fontSize: 18,
    fontWeight: 'bold',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        fontSize: 16,
      },
      '@media (max-width: 480px)': {
        fontSize: 17,
      },
      '@media (max-height: 500px) and (orientation: landscape)': {
        fontSize: 16,
      },
    }),
  },
  pnlContainer: {
    flex: 1,
    alignItems: 'center',
    minWidth: 100,
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        alignItems: 'flex-start',
        paddingVertical: 6,
        minWidth: 'auto',
        width: '100%',
      },
      '@media (max-width: 480px)': {
        alignItems: 'flex-start',
        paddingVertical: 8,
        minWidth: 'auto',
      },
      '@media (max-width: 600px) and (orientation: portrait)': {
        flex: '0 1 calc(50% - 8px)',
        alignItems: 'center',
      },
      '@media (min-resolution: 2dppx)': {
        minWidth: 110,
      },
    }),
  },
  pnlLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        fontSize: 12,
        marginBottom: 2,
      },
      '@media (max-height: 500px) and (orientation: landscape)': {
        fontSize: 12,
        marginBottom: 2,
      },
    }),
  },
  pnlValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        fontSize: 16,
      },
      '@media (max-width: 480px)': {
        fontSize: 17,
      },
      '@media (max-height: 500px) and (orientation: landscape)': {
        fontSize: 16,
      },
    }),
  },
  // New menu navigation
  menuNavigation: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        paddingHorizontal: 8,
        paddingVertical: 6,
      },
      '@media (max-width: 480px)': {
        paddingHorizontal: 12,
        paddingVertical: 6,
      },
      '@media (max-height: 500px) and (orientation: landscape)': {
        paddingVertical: 4,
        paddingHorizontal: 12,
      },
    }),
  },
  menuButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
    position: 'relative',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        paddingVertical: 8,
        paddingHorizontal: 4,
        marginHorizontal: 2,
        borderRadius: 6,
      },
      '@media (max-width: 480px)': {
        paddingVertical: 10,
        paddingHorizontal: 6,
        marginHorizontal: 3,
      },
      '@media (max-height: 500px) and (orientation: landscape)': {
        paddingVertical: 6,
        paddingHorizontal: 4,
        marginHorizontal: 2,
      },
    }),
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
    textAlign: 'center',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        fontSize: 11,
      },
      '@media (max-width: 480px)': {
        fontSize: 12,
      },
      '@media (max-height: 500px) and (orientation: landscape)': {
        fontSize: 11,
      },
      '@media (min-resolution: 3dppx)': {
        fontSize: 13,
      },
    }),
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
      // Móviles muy pequeños
      '@media (max-width: 360px)': {
        minHeight: '50vh',
      },
      // Móviles estándar
      '@media (max-width: 480px)': {
        minHeight: '55vh',
      },
      // Móviles grandes / Tablets pequeñas
      '@media (max-width: 768px)': {
        minHeight: '60vh',
      },
      // Tablets medianas
      '@media (min-width: 769px) and (max-width: 1024px)': {
        minHeight: '65vh',
      },
      // Escritorio
      '@media (min-width: 1025px)': {
        minHeight: '70vh',
      },
      // Landscape en móviles (altura limitada)
      '@media (max-height: 500px) and (orientation: landscape)': {
        minHeight: '40vh',
      },
      // Tablets en landscape
      '@media (min-width: 768px) and (max-width: 1024px) and (orientation: landscape)': {
        minHeight: '55vh',
      },
      // Dispositivos con alta densidad
      '@media (min-resolution: 2dppx)': {
        minHeight: '62vh',
      },
    }),
  },
  // Wrapper para gráfico y overlay
  chartWrapper: {
    flex: 1,
    position: 'relative',
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
  // Trading overlay floating button
  floatingOverlayButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#444444',
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    // Animación suave en web
    ...(Platform.OS === 'web' && {
      transition: 'all 0.2s ease-in-out',
      cursor: 'pointer',
      // Móviles pequeños
      '@media (max-width: 360px)': {
        bottom: 15,
        right: 15,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        minWidth: 85,
      },
      // Móviles estándar
      '@media (max-width: 480px)': {
        bottom: 15,
        right: 15,
        paddingVertical: 10,
        paddingHorizontal: 18,
        minWidth: 90,
      },
      // Landscape móvil
      '@media (max-height: 500px) and (orientation: landscape)': {
        bottom: 10,
        right: 15,
        paddingVertical: 8,
        paddingHorizontal: 16,
        minWidth: 80,
      },
      // Shadow web
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
      // Hover effect
      ':hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0px 6px 16px rgba(0, 0, 0, 0.4)',
      },
    }),
  },
  floatingOverlayButtonActive: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
    ...(Platform.OS === 'web' && {
      boxShadow: '0px 4px 12px rgba(0, 255, 136, 0.4)',
      ':hover': {
        boxShadow: '0px 6px 16px rgba(0, 255, 136, 0.5)',
      },
    }),
  },
  floatingOverlayButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    ...(Platform.OS === 'web' && {
      '@media (max-width: 360px)': {
        fontSize: 12,
      },
      '@media (max-height: 500px) and (orientation: landscape)': {
        fontSize: 12,
      },
    }),
  },
  floatingOverlayButtonTextActive: {
    color: '#000000',
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