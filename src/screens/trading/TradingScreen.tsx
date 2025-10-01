import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { useAuth, useMarket } from '../../context/AppContext';
import { useMarketData } from '../../hooks/useMarketData';
import { useTrading } from '../../hooks/useTrading';
import { formatPrice, formatPercentage, formatCurrency } from '../../utils/formatters';
import { TRADING_SYMBOLS } from '../../constants/tradingSymbols';
import MinimalistChart from '../../components/chart/MinimalistChart';
import { MarketData } from '../../components/trading/MarketData';
import { RealTimePositionsGrid } from '../../components/trading/RealTimePositionsGrid';
import { PositionDetailsModal } from '../../components/trading/PositionDetailsModal';
import { OrderForm } from '../../components/trading/OrderForm';
import { OrderFormModal } from '../../components/trading/OrderFormModal';
import { OrderHistory } from '../../components/trading/OrderHistory';
import CentralizedTradingOverlay from '../../components/trading/CentralizedTradingOverlay';
import OverlayManagerService from '../../services/overlayManagerService';

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
  
  // Overlay manager instance
  const overlayManager = OverlayManagerService.getInstance();
  const [overlayState, setOverlayState] = useState(overlayManager.getState());

  // Estados para Take Profit y Stop Loss (mantenidos para funcionalidad del modal)
  const [overlayTakeProfit, setOverlayTakeProfit] = useState<number | null>(null);
  const [overlayStopLoss, setOverlayStopLoss] = useState<number | null>(null);

  // Initialize market data at the screen level - optimized for faster updates
  const { isInitialized, getStatus } = useMarketData({
    autoStart: true,
    symbols: TRADING_SYMBOLS,
    refreshInterval: 10000, // 10 seconds - optimized for more frequent updates
  });

  // Suscribirse a cambios del overlay manager
  useEffect(() => {
    const unsubscribe = overlayManager.subscribe(setOverlayState);
    return unsubscribe;
  }, [overlayManager]);

  // Update trading prices when market data changes
  useEffect(() => {
    Object.entries(tickers).forEach(([symbol, data]) => {
      const currentTradingPrice = getCurrentPrice(symbol);
      if (!currentTradingPrice || Math.abs(currentTradingPrice - data.price) > data.price * 0.01) {
        // Update if price difference is more than 1%
        updatePrice(symbol, data.price);
      }
    });

    // También actualizar precios en el overlay manager
    overlayManager.updatePrices(
      Object.fromEntries(
        Object.entries(tickers).map(([symbol, data]) => [symbol, data.price])
      )
    );
  }, [tickers, getCurrentPrice, updatePrice, overlayManager]);

  // Actualizar posiciones en el overlay manager cuando cambien las órdenes activas
  useEffect(() => {
    activeOrders.forEach(order => {
      const currentPrice = tickers[order.symbol]?.price || getCurrentPrice(order.symbol) || order.entryPrice;
      overlayManager.updatePosition(order, currentPrice);
    });

    // Remover posiciones que ya no existen
    const currentOrderIds = new Set(activeOrders.map(o => o.id));
    overlayState.positions.forEach((position, positionId) => {
      if (!currentOrderIds.has(positionId)) {
        overlayManager.removePosition(positionId);
      }
    });
  }, [activeOrders, tickers, getCurrentPrice, overlayManager, overlayState.positions]);

  // Only log once when status changes
  useEffect(() => {
    console.log('🏠 TradingScreen - Market data status changed:', {
      initialized: isInitialized,
      tickerCount: Object.keys(tickers).length,
      symbols: Object.keys(tickers),
      tradingOrders: orders.length,
      activeOrders: activeOrders.length,
      overlayActive: overlayState.isActive,
      activePositionId: overlayState.activePositionId,
    });
  }, [isInitialized, Object.keys(tickers).length, orders.length, activeOrders.length, overlayState.isActive, overlayState.activePositionId]);

  // Calcular precio actual para referencia
  const currentPrice = tickers[selectedPair]?.price || 0;
  const priceChange = tickers[selectedPair]?.changePercent24h || 0;

  const handleLogout = () => {
    logout();
  };

  const handleRefreshData = async () => {
    await refreshPortfolio();
  };

  // Handle navigation to chart from position - SIMPLIFICADO con overlay centralizado
  const handleGoToChart = useCallback((symbol: string, position: any) => {
    console.log(`🎯 [GO TO CHART] Navegando a ${symbol} con overlay activado`);
    
    // Switch to trading tab
    setActiveTab('trading');
    
    // Activar overlay para esta posición específica
    overlayManager.togglePositionOverlay(position.id);
    
    console.log(`🎯 [GO TO CHART] Overlay activado para posición ${position.id}`);
  }, [overlayManager]);

  const handlePositionPress = useCallback((position: any) => {
    setSelectedPosition(position);
    setShowPositionModal(true);
  }, []);

  // Calculate unrealized PnL for position
  const calculateUnrealizedPnL = useCallback((order: any, currentPrice: number) => {
    if (!currentPrice || currentPrice === 0) return 0;
    
    const priceChange = currentPrice - order.entryPrice;
    const pnl = order.side === 'BUY' 
      ? priceChange * order.quantity 
      : -priceChange * order.quantity;
    
    return pnl;
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'trading':
        return (
          <View style={styles.chartContainer}>
            <View style={styles.chartWrapper}>
              <MinimalistChart 
                symbol={selectedPair}
                // Simplificado: usar solo el estado del overlay manager
                showTradingOverlay={overlayState.isActive}
                onTradingOverlayChange={(isVisible) => {
                  console.log(`🎯 [CHART OVERLAY TOGGLE] ${isVisible ? 'Activado' : 'Desactivado'}`);
                  if (!isVisible) {
                    overlayManager.deactivateOverlay();
                  }
                }}
                activePositions={activeOrders.map(order => ({
                  id: order.id,
                  symbol: order.symbol,
                  side: order.side,
                  entryPrice: order.entryPrice,
                  takeProfitPrice: order.takeProfitPrice || undefined,
                  stopLossPrice: order.stopLossPrice || undefined,
                  quantity: order.quantity,
                  unrealizedPnL: calculateUnrealizedPnL(order, currentPrice),
                }))}
              />
              {/* NUEVO: Overlay centralizado */}
              <CentralizedTradingOverlay
                chartDimensions={{
                  width: screenWidth,
                  height: 400, // Chart height
                  x: 0,
                  y: 0,
                }}
                symbol={selectedPair}
                latestPrice={currentPrice}
                priceScale={(() => {
                  // Calcular escala de precios basada en las posiciones activas
                  if (activeOrders.length === 0) return undefined;
                  const prices = activeOrders.flatMap(order => [
                    order.entryPrice,
                    ...(order.takeProfitPrice ? [order.takeProfitPrice] : []),
                    ...(order.stopLossPrice ? [order.stopLossPrice] : [])
                  ].filter(Boolean));
                  if (prices.length === 0) return undefined;
                  const min = Math.min(...prices) * 0.98; // 2% padding
                  const max = Math.max(...prices) * 1.02; // 2% padding
                  return {
                    min,
                    max,
                    pixelsPerPrice: 400 / (max - min) // Chart height / price range
                  };
                })()}
                onClose={() => {
                  console.log(`🧹 [OVERLAY CLOSE] Overlay cerrado desde el componente`);
                  overlayManager.deactivateOverlay();
                }}
              />
            </View>
          </View>
        );
      
      case 'posiciones':
        return (
          <View style={styles.positionsContainer}>
            <View style={styles.positionsTopSpacer} />
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
          </View>
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
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../../assets/logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>HoundTrade</Text>
          </View>
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

      {/* Posiciones siempre visibles en la parte superior */}
      <View style={styles.positionsHeaderContainer}>
        <View style={styles.positionsHeader}>
          <Text style={styles.positionsHeaderText}>
            Posiciones Activas ({activeOrders.length})
          </Text>
          <TouchableOpacity 
            style={styles.newOrderButton}
            onPress={() => setShowOrderModal(true)}
          >
            <Text style={styles.newOrderButtonText}>+ Nueva</Text>
          </TouchableOpacity>
        </View>
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
          compact={true} // Modo compacto para ahorrar espacio
        />
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>

      {/* Order Form Modal/Overlay */}
      {activeTab === 'posiciones' && (
        <TouchableOpacity 
          style={[
            styles.floatingOrderButton,
            activeTab === 'posiciones' && styles.floatingOrderButtonBottom
          ]}
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
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  logo: {
    width: isSmallMobile ? 24 : 28,
    height: isSmallMobile ? 24 : 28,
    marginRight: 8,
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
  },
  balanceContainer: {
    flex: 1,
    alignItems: 'center',
    minWidth: 100,
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
    minWidth: 100,
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
    minWidth: 100,
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
    textAlign: 'center',
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
  floatingOrderButtonBottom: {
    bottom: 120, // Ajustar posición para no solaparse con las posiciones
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
  // Styles for bottom-aligned positions
  positionsContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#0a0a0a',
  },
  positionsTopSpacer: {
    flex: 1,
  },
  // Estilos para posiciones en la parte superior
  positionsHeaderContainer: {
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    maxHeight: 200, // Limitar altura para ahorrar espacio
  },
  positionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
  },
  positionsHeaderText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  newOrderButton: {
    backgroundColor: '#00ff88',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newOrderButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
});