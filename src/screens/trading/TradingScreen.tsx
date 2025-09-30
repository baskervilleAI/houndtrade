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
  
  // Position details modal state
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  
  // Trading overlay state - now controlled automatically by positions
  const [showTradingOverlay, setShowTradingOverlay] = useState(false);
  
  // TP/SL visualization state for chart
  const [visualizedPosition, setVisualizedPosition] = useState<any>(null);
  const [showTpSlLines, setShowTpSlLines] = useState(false);

  // Estados para Take Profit y Stop Loss (mantenidos para funcionalidad del modal)
  const [overlayTakeProfit, setOverlayTakeProfit] = useState<number | null>(null);
  const [overlayStopLoss, setOverlayStopLoss] = useState<number | null>(null);

  // Position navigation state
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0);

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

  // Automatically show overlay when there are active positions
  useEffect(() => {
    const hasActivePositions = activeOrders.length > 0;
    setShowTradingOverlay(hasActivePositions);
  }, [activeOrders.length]);

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

  // Handle navigation to chart from position - MEJORADO con visualización de TP/SL
  const handleGoToChart = useCallback((symbol: string, position: any) => {
    console.log(`🎯 [GO TO CHART] Navegando a ${symbol} con overlay activado y visualización TP/SL`);
    
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
    
    console.log(`🎯 [GO TO CHART] Precio actual: $${currentPrice}, Precio entrada: $${position.entryPrice}`);
    
    // NUEVO: Convertir TP/SL de PnL a precio si es necesario y establecer visualización
    let takeProfitPrice = null;
    let stopLossPrice = null;
    
    if (position.takeProfitPrice !== undefined && position.takeProfitPrice !== null) {
      if (position.takeProfitPrice > 0 && position.takeProfitPrice < 1) {
        // Es un porcentaje o PnL, convertir a precio
        const tpMultiplier = position.side === 'BUY' ? (1 + position.takeProfitPrice) : (1 - position.takeProfitPrice);
        takeProfitPrice = position.entryPrice * tpMultiplier;
        console.log(`🎯 [TP CONVERSION] TP de PnL ${position.takeProfitPrice} a precio $${takeProfitPrice.toFixed(2)}`);
      } else {
        // Ya es un precio
        takeProfitPrice = position.takeProfitPrice;
        console.log(`🎯 [TP PRICE] TP ya es precio: $${takeProfitPrice.toFixed(2)}`);
      }
    }
    
    if (position.stopLossPrice !== undefined && position.stopLossPrice !== null) {
      if (position.stopLossPrice > 0 && position.stopLossPrice < 1) {
        // Es un porcentaje o PnL, convertir a precio
        const slMultiplier = position.side === 'BUY' ? (1 - position.stopLossPrice) : (1 + position.stopLossPrice);
        stopLossPrice = position.entryPrice * slMultiplier;
        console.log(`🎯 [SL CONVERSION] SL de PnL ${position.stopLossPrice} a precio $${stopLossPrice.toFixed(2)}`);
      } else {
        // Ya es un precio
        stopLossPrice = position.stopLossPrice;
        console.log(`🎯 [SL PRICE] SL ya es precio: $${stopLossPrice.toFixed(2)}`);
      }
    }
    
    // Set overlay TP/SL from position
    if (takeProfitPrice) {
      setOverlayTakeProfit(takeProfitPrice);
      console.log(`🟢 [OVERLAY TP] Establecido TP en $${takeProfitPrice.toFixed(2)}`);
    }
    if (stopLossPrice) {
      setOverlayStopLoss(stopLossPrice);
      console.log(`🔴 [OVERLAY SL] Establecido SL en $${stopLossPrice.toFixed(2)}`);
    }
    
    // Colores basados en el precio de entrada como divisor
    const entryPrice = position.entryPrice;
    const side = position.side;
    
    console.log(`🎨 [COLOR LOGIC] Posición ${side} con entrada $${entryPrice.toFixed(2)}`);
    console.log(`🎨 [COLOR LOGIC] TP: ${takeProfitPrice ? '$' + takeProfitPrice.toFixed(2) : 'N/A'}`);
    console.log(`🎨 [COLOR LOGIC] SL: ${stopLossPrice ? '$' + stopLossPrice.toFixed(2) : 'N/A'}`);
  }, [tickers, getCurrentPrice]);

  // Position navigation handlers
  const handlePositionChange = useCallback((index: number) => {
    setCurrentPositionIndex(index);
  }, []);

  const handlePositionPress = useCallback((position: any) => {
    setSelectedPosition(position);
    setShowPositionModal(true);
  }, []);

  // Handler for visualizing TP/SL lines when clicking position in overlay
  const handlePositionTpSlVisualize = useCallback((position: any) => {
    console.log(`🎯 [TP/SL VISUALIZE] Activando visualización para posición:`, {
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      takeProfitPrice: position.takeProfitPrice,
      stopLossPrice: position.stopLossPrice
    });
    
    setVisualizedPosition(position);
    setShowTpSlLines(true);
    
    // También activar el trading overlay si no está activo
    if (!showTradingOverlay) {
      setShowTradingOverlay(true);
    }
  }, [showTradingOverlay]);

  // Handler to clear TP/SL visualization
  const handleClearTpSlVisualization = useCallback(() => {
    console.log(`🧹 [TP/SL CLEAR] Limpiando visualización TP/SL`);
    setShowTpSlLines(false);
    setVisualizedPosition(null);
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
                showTradingOverlay={showTradingOverlay}
                onTradingOverlayChange={setShowTradingOverlay}
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
                // New props for TP/SL visualization
                visualizedPosition={visualizedPosition}
                showTpSlVisualization={showTpSlLines}
                onClearTpSlVisualization={handleClearTpSlVisualization}
              />
              <TradingOverlay
                chartDimensions={{
                  width: screenWidth,
                  height: 400, // Chart height
                  x: 0,
                  y: 0,
                }}
                isVisible={showTradingOverlay}
                symbol={selectedPair}
                latestPrice={currentPrice}
                // Position visualization props
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
                currentPositionIndex={currentPositionIndex}
                onPositionChange={handlePositionChange}
                onPositionPress={handlePositionPress}
                onPositionTpSlVisualize={handlePositionTpSlVisualize}
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
});