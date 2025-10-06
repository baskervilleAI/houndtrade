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
  
  // Estados para colapsar/expandir paneles
  const [isMarketDataCollapsed, setIsMarketDataCollapsed] = useState(false);
  const [isPositionsCollapsed, setIsPositionsCollapsed] = useState(false);
  
  // Estado para controlar el overlay de trading en el gráfico
  const [showChartOverlay, setShowChartOverlay] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);

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
      activeOrders: activeOrders.length,
      showChartOverlay,
      selectedPositionId,
    });
  }, [isInitialized, Object.keys(tickers).length, orders.length, activeOrders.length, showChartOverlay, selectedPositionId]);

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
    
    // Activar overlay en el chart con el entry price de la posición
    setShowChartOverlay(true);
    setSelectedPositionId(position.id);
    
    console.log(`🎯 [GO TO CHART] Overlay activado para posición ${position.id}`);
  }, []);

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
          <View style={styles.tradingContainer}>
            {/* Market Data Panel - Colapsable */}
            <View style={styles.collapsiblePanel}>
              <TouchableOpacity 
                style={styles.collapsibleHeader}
                onPress={() => setIsMarketDataCollapsed(!isMarketDataCollapsed)}
              >
                <Text style={styles.collapsibleTitle}>Pares de Trading</Text>
                <Text style={styles.collapseIcon}>{isMarketDataCollapsed ? '▼' : '▲'}</Text>
              </TouchableOpacity>
              {!isMarketDataCollapsed && <MarketData />}
            </View>

            {/* Chart Container - Toma el espacio restante */}
            <View style={[
              styles.chartContainer,
              { marginBottom: activeOrders.length > 0 ? (isPositionsCollapsed ? 50 : 180) : 0 }
            ]}>
              <View style={styles.chartWrapper}>
                <MinimalistChart 
                  symbol={selectedPair}
                  showTradingOverlay={showChartOverlay}
                  onTradingOverlayChange={(isVisible) => {
                    console.log(`🎯 [CHART OVERLAY TOGGLE] ${isVisible ? 'Activado' : 'Desactivado'}`);
                    setShowChartOverlay(isVisible);
                    if (!isVisible) {
                      setSelectedPositionId(null);
                    }
                  }}
                  selectedPositionId={selectedPositionId}
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

            </View>
            </View>

            {/* Posiciones Activas Panel - Fijo en la parte inferior - Colapsable */}
            {activeOrders.length > 0 && (
              <View style={styles.bottomPositionsPanel}>
                <TouchableOpacity 
                  style={styles.collapsibleHeader}
                  onPress={() => setIsPositionsCollapsed(!isPositionsCollapsed)}
                >
                  <View style={styles.collapsibleHeaderLeft}>
                    <Text style={styles.collapsibleTitle}>
                      Posiciones Activas ({activeOrders.length})
                    </Text>
                  </View>
                  <View style={styles.collapsibleHeaderRight}>
                    {!isPositionsCollapsed && (
                      <TouchableOpacity
                        style={styles.miniNewButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          setShowOrderModal(true);
                        }}
                      >
                        <Text style={styles.miniNewButtonText}>+ Nueva</Text>
                      </TouchableOpacity>
                    )}
                    <Text style={styles.collapseIcon}>{isPositionsCollapsed ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>
                {!isPositionsCollapsed && (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.positionsScrollView}
                    contentContainerStyle={styles.positionsScrollContent}
                  >
                    {activeOrders.map((position) => {
                      const currentPriceForPosition = tickers[position.symbol]?.price || getCurrentPrice(position.symbol) || position.entryPrice;
                      const pnl = calculateUnrealizedPnL(position, currentPriceForPosition);
                      const pnlPercent = ((currentPriceForPosition - position.entryPrice) / position.entryPrice) * 100;
                      const isProfit = pnl >= 0;
                      const isSelected = selectedPositionId === position.id;

                      return (
                        <TouchableOpacity
                          key={position.id}
                          style={[
                            styles.positionCard,
                            isSelected && styles.positionCardSelected
                          ]}
                          onPress={() => {
                            console.log(`🎯 [POSITION CLICK] Posición clickeada: ${position.symbol}, Par actual: ${selectedPair}`);
                            
                            // Toggle overlay para esta posición (solo si es del mismo par)
                            if (position.symbol === selectedPair) {
                              // Si ya está seleccionada, deseleccionar (toggle OFF)
                              if (selectedPositionId === position.id) {
                                console.log(`🔴 [TOGGLE] Desactivando overlay para ${position.id}`);
                                setShowChartOverlay(false);
                                setSelectedPositionId(null);
                              } else {
                                // Seleccionar esta posición (toggle ON)
                                console.log(`🟢 [TOGGLE] Activando overlay para ${position.id}`);
                                setSelectedPositionId(position.id);
                                setShowChartOverlay(true);
                              }
                            } else {
                              console.log(`⚠️ [MISMATCH] Posición ${position.symbol} no coincide con par actual ${selectedPair}`);
                            }
                          }}
                        >
                          <View style={styles.positionCardHeader}>
                            <Text style={styles.positionSymbol}>{position.symbol}</Text>
                            <View style={[
                              styles.positionSideBadge,
                              position.side === 'BUY' ? styles.buyBadge : styles.sellBadge
                            ]}>
                              <Text style={styles.positionSideText}>
                                {position.side === 'BUY' ? 'LONG' : 'SHORT'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.positionEntry}>
                            ${formatPrice(position.entryPrice, position.symbol)}
                          </Text>
                          <Text style={[
                            styles.positionPnL,
                            { color: isProfit ? '#00ff88' : '#ff4444' }
                          ]}>
                            {isProfit ? '+' : ''}${formatCurrency(Math.abs(pnl))}
                          </Text>
                          <Text style={[
                            styles.positionPnLPercent,
                            { color: isProfit ? '#00ff88' : '#ff4444' }
                          ]}>
                            {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        );
      
      case 'posiciones':
        return (
          <View style={styles.positionsFullContainer}>
            <RealTimePositionsGrid 
              orders={activeOrders}
              onAddPosition={() => setShowOrderModal(true)}
              onPositionPress={(position: any) => {
                console.log('Position pressed - opening modal:', position);
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
              compact={false}
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
          style={[styles.menuButton, activeTab === 'posiciones' && styles.activeMenuButton]}
          onPress={() => setActiveTab('posiciones')}
        >
          <Text style={[styles.menuButtonText, activeTab === 'posiciones' && styles.activeMenuButtonText]}>
            Posiciones
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
  // Styles for positions view (full screen)
  positionsFullContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  // Trading container con paneles colapsables
  tradingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  // Paneles colapsables
  collapsiblePanel: {
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  // Panel de posiciones en la parte inferior
  bottomPositionsPanel: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 180,
    zIndex: 10,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#222222',
  },
  collapsibleHeaderLeft: {
    flex: 1,
  },
  collapsibleHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  collapsibleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  collapseIcon: {
    fontSize: 12,
    color: '#888888',
    marginLeft: 8,
  },
  miniNewButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  miniNewButtonText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Scroll de posiciones
  positionsScrollView: {
    paddingVertical: 12,
  },
  positionsScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  // Tarjetas de posición
  positionCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
    minWidth: 120,
    marginRight: 8,
  },
  positionCardSelected: {
    borderColor: '#00ff88',
    borderWidth: 2,
    backgroundColor: '#1a2a1a',
  },
  positionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  positionSymbol: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  positionSideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  buyBadge: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
  },
  sellBadge: {
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
  },
  positionSideText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  positionEntry: {
    fontSize: 11,
    color: '#888888',
    marginBottom: 4,
  },
  positionPnL: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  positionPnLPercent: {
    fontSize: 11,
    fontWeight: '600',
  },
});