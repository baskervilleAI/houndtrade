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
import { MarketData } from '../../components/trading/MarketData';
import { ActiveOrdersList } from '../../components/trading/ActiveOrdersList';
import { OrderForm } from '../../components/trading/OrderForm';
import { OrderHistory } from '../../components/trading/OrderHistory';
import { PositionsGrid } from '../../components/trading/PositionsGrid';
import { OrderFormModal } from '../../components/trading/OrderFormModal';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive breakpoints
const isTablet = screenWidth >= 768;
const isMobile = screenWidth < 768;
const isSmallMobile = screenWidth < 400;

export const TradingScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { selectedPair, tickers } = useMarket();
  const isLaptop16by9 = (screenWidth >= 1200) || ((screenWidth / screenHeight) >= (16 / 9) && screenWidth >= 1024);
  // initial width reference for half-screen detection
  const initialWidthRef = React.useRef<number>(typeof window !== 'undefined' ? window.innerWidth : screenWidth);
  const [isHalfScreen, setIsHalfScreen] = useState(false);
  const [reloadChartKey, setReloadChartKey] = useState(0);
  // Key for sessionStorage
  const SESSION_KEY = 'houndtrade:tradingScreenState';
  
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
  
  // Estado para activación del overlay con precio específico
  const [overlayActivationPrice, setOverlayActivationPrice] = useState<number | null>(null);
  
  // Estado para forzar desactivación del overlay
  const [forceDeactivate, setForceDeactivate] = useState<boolean>(false);

  // Collapsible sections for left panel (large screens)
  const [showMarketDataSection, setShowMarketDataSection] = useState(true);
  const [showOrderFormSection, setShowOrderFormSection] = useState(true);
  const [showActiveOrdersSection, setShowActiveOrdersSection] = useState(true);
  const [showOrderHistorySection, setShowOrderHistorySection] = useState(false);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);

  // Restore saved UI state (if any) after reload
  useEffect(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed) {
        if (typeof parsed.activeTab === 'string') setActiveTab(parsed.activeTab);
        if (typeof parsed.showOrderModal === 'boolean') setShowOrderModal(parsed.showOrderModal);
        if (typeof parsed.overlayTakeProfit === 'number' || parsed.overlayTakeProfit === null) setOverlayTakeProfit(parsed.overlayTakeProfit);
        if (typeof parsed.overlayStopLoss === 'number' || parsed.overlayStopLoss === null) setOverlayStopLoss(parsed.overlayStopLoss);
        if (typeof parsed.isLeftPanelVisible === 'boolean') setIsLeftPanelVisible(parsed.isLeftPanelVisible);
        if (typeof parsed.showMarketDataSection === 'boolean') setShowMarketDataSection(parsed.showMarketDataSection);
        if (typeof parsed.showOrderFormSection === 'boolean') setShowOrderFormSection(parsed.showOrderFormSection);
        if (typeof parsed.showActiveOrdersSection === 'boolean') setShowActiveOrdersSection(parsed.showActiveOrdersSection);
        if (typeof parsed.showOrderHistorySection === 'boolean') setShowOrderHistorySection(parsed.showOrderHistorySection);
      }
    } catch (e) {
      // ignore parse errors
    } finally {
      try { window.sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    }
  }, []);

  // Detect window resizing to half of initial width and auto-adjust UI + reload chart axes
  useEffect(() => {
    // ensure initialWidthRef is set
    if (typeof window !== 'undefined') initialWidthRef.current = window.innerWidth;

    const onResize = () => {
      const w = window.innerWidth;
      const nowHalf = w <= initialWidthRef.current / 2;
      setIsHalfScreen(prev => {
        if (prev !== nowHalf) {
          // when crossing threshold, auto-change UI: collapse left panel on half-screen
          if (nowHalf) {
            setIsLeftPanelVisible(false);
          } else {
            setIsLeftPanelVisible(true);
          }
          // force chart reload by bumping key
          setReloadChartKey(k => k + 1);
        }
        return nowHalf;
      });
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  // UI scale detection to adapt fonts/elements to browser/device zoom
  const [uiScale, setUiScale] = useState<number>(
    (typeof window !== 'undefined' && (window.visualViewport?.scale || window.devicePixelRatio)) || 1
  );

  useEffect(() => {
    const updateScale = () => {
      const newScale = window.visualViewport?.scale || window.devicePixelRatio || 1;
      setUiScale(prev => (Math.abs(prev - newScale) > 0.01 ? newScale : prev));
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateScale);
    }
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateScale);
      }
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  }, []);

  // Reload page when window resizing finishes (debounced) — helpful for layout recalculations
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let reloadTimeout: number | null = null;

    const onResizeReload = () => {
      if (reloadTimeout !== null) {
        window.clearTimeout(reloadTimeout);
      }
      reloadTimeout = window.setTimeout(() => {
        console.log('[TradingScreen] window resize finished — reloading page');
        window.location.reload();
      }, 350);
    };

    window.addEventListener('resize', onResizeReload);
    return () => {
      if (reloadTimeout !== null) window.clearTimeout(reloadTimeout);
      window.removeEventListener('resize', onResizeReload);
    };
  }, []);

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
                activateOverlayWithPrice={overlayActivationPrice}
                forceDeactivateOverlay={forceDeactivate}
                key={`chart-${reloadChartKey}`}
                // chartOptions managed internally by MinimalistChart
              />
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
            <Text style={[styles.appName, { fontSize: Math.max(14, Math.round((isSmallMobile ? 18 : 20) * uiScale)) } ]}>HoundTrade</Text>
            <Text style={[styles.userName, { fontSize: Math.max(10, Math.round((isSmallMobile ? 12 : 14) * uiScale)) }]}>
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
          <Text style={[styles.balanceValue, { fontSize: Math.max(12, Math.round(18 * uiScale)) }]}>
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
          , { fontSize: Math.max(12, Math.round(18 * uiScale)) } ]}>
            {portfolio ? 
              `$${formatCurrency(portfolio.realizedPnL + portfolio.unrealizedPnL)}` : 
              '---'
            }
          </Text>
        </View>
        <View style={styles.pnlContainer}>
          <Text style={styles.pnlLabel}>Win Rate</Text>
          <Text style={[styles.pnlValue, { fontSize: Math.max(12, Math.round(18 * uiScale)) }]}>
            {portfolio ? `${portfolio.winRate.toFixed(1)}%` : '---'}
          </Text>
        </View>
      </View>

      {/* Menu tabs directly below balance (hidden on large laptop 16:9 since left-side menu is used) */}
      {!isLaptop16by9 && (
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
      )}

      {/* Tab Content: normal single-column on small screens, two-column on large 16:9 laptops */}
      <View style={styles.content}>
        {(() => {
          // Detect large 16:9 laptop-like screens to switch to two-column layout
          const isLaptop16by9 = (screenWidth >= 1200) || ((screenWidth / screenHeight) >= (16 / 9) && screenWidth >= 1024);

          const currentTab = activeTab;

          if (activeTab === 'trading' && isLaptop16by9) {
            return (
              <View style={styles.contentRow}>
                {isLeftPanelVisible ? (
                  <View style={styles.leftPanel}>
                    {/* Collapse button inside left panel header */}
                    <TouchableOpacity
                      style={styles.leftPanelHideButton}
                      onPress={() => setIsLeftPanelVisible(false)}
                    >
                      <Text style={{ color: '#fff' }}>◀</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      {/* Left column: vertical menu, market data and controls/buttons */}
                      {/* Left-side tab buttons (vertical) */}
                      <View style={styles.leftMenu}>
                        <TouchableOpacity
                          style={[styles.leftMenuButton, currentTab === 'trading' && styles.leftMenuButtonActive]}
                          onPress={() => setActiveTab('trading')}
                        >
                          <Text style={[styles.leftMenuButtonText, currentTab === 'trading' && styles.leftMenuButtonTextActive]}>Trading</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.leftMenuButton, currentTab === 'posiciones' && styles.leftMenuButtonActive]}
                          onPress={() => setActiveTab('posiciones')}
                        >
                          <Text style={[styles.leftMenuButtonText, currentTab === 'posiciones' && styles.leftMenuButtonTextActive]}>Posiciones</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.leftMenuButton, currentTab === 'trades' && styles.leftMenuButtonActive]}
                          onPress={() => setActiveTab('trades')}
                        >
                          <Text style={[styles.leftMenuButtonText, currentTab === 'trades' && styles.leftMenuButtonTextActive]}>Trades</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Use ScrollView to allow overflow on smaller heights; hide native scroll indicator */}
                      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
                        {/* Market Data section */}
                        <View style={styles.sectionWrapper}>
                          <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => setShowMarketDataSection(v => !v)}
                          >
                            <Text style={styles.sectionHeaderTitle}>Market Data</Text>
                            <Text style={styles.sectionToggle}>{showMarketDataSection ? '▾' : '▸'}</Text>
                          </TouchableOpacity>
                          {showMarketDataSection && (
                            <View style={styles.sectionContent}>
                              <MarketData />
                            </View>
                          )}
                        </View>

                        {/* Order Form section */}
                        <View style={styles.sectionWrapper}>
                          <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => setShowOrderFormSection(v => !v)}
                          >
                            <Text style={styles.sectionHeaderTitle}>Nueva Orden</Text>
                            <Text style={styles.sectionToggle}>{showOrderFormSection ? '▾' : '▸'}</Text>
                          </TouchableOpacity>
                          {showOrderFormSection && (
                            <View style={[styles.sectionContent, { maxHeight: 520 }]}> 
                              <OrderForm
                                onCreateOrder={createOrder}
                                isLoading={isLoading}
                                defaultSymbol={selectedPair}
                                defaultTakeProfitPrice={overlayTakeProfit}
                                defaultStopLossPrice={overlayStopLoss}
                              />
                            </View>
                          )}
                        </View>

                        {/* Active Orders section */}
                        <View style={styles.sectionWrapper}>
                          <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => setShowActiveOrdersSection(v => !v)}
                          >
                            <Text style={styles.sectionHeaderTitle}>Órdenes Activas</Text>
                            <Text style={styles.sectionToggle}>{showActiveOrdersSection ? '▾' : '▸'}</Text>
                          </TouchableOpacity>
                          {showActiveOrdersSection && (
                            <View style={styles.sectionContent}>
                              <ActiveOrdersList
                                orders={activeOrders}
                                onCloseOrder={async (orderId: string, reason?: string) => {
                                  await closeOrder(orderId, reason || 'Cerrado desde lista');
                                  return { success: true };
                                }}
                                onCancelOrder={(orderId: string) => {
                                  const res = cancelOrder(orderId, 'Cancelado desde lista');
                                  return res || { success: false, error: 'Error' };
                                }}
                                getCurrentPrice={getCurrentPrice}
                                onRefresh={handleRefreshData}
                                isLoading={isLoading}
                              />
                            </View>
                          )}
                        </View>

                        {/* Order History section */}
                        <View style={styles.sectionWrapper}>
                          <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => setShowOrderHistorySection(v => !v)}
                          >
                            <Text style={styles.sectionHeaderTitle}>Historial</Text>
                            <Text style={styles.sectionToggle}>{showOrderHistorySection ? '▾' : '▸'}</Text>
                          </TouchableOpacity>
                          {showOrderHistorySection && (
                            <View style={styles.sectionContent}>
                              <OrderHistory orders={orders} />
                            </View>
                          )}
                        </View>
                      </ScrollView>
                    </View>
                  </View>
                ) : (
                  // Collapsed thin bar with show button
                  <View style={styles.leftPanelCollapsed}>
                    <TouchableOpacity
                      style={styles.leftPanelShowButton}
                      onPress={() => setIsLeftPanelVisible(true)}
                    >
                      <Text style={{ color: '#fff' }}>▶</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.rightPanel}>
                  {renderTabContent()}
                </View>
              </View>
            );
          }

          // Default single-column layout (mobile / tablet / small desktop)
          return renderTabContent();
        })()}
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
            showTradingOverlay && styles.floatingOverlayButtonActive,
            // Move to left on large 16:9 laptop-like screens
            ((screenWidth >= 1200) || ((screenWidth / screenHeight) >= (16 / 9) && screenWidth >= 1024)) && styles.floatingOverlayButtonLeft
          ]}
          onPress={handleTradingOverlayToggle}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.floatingOverlayButtonText,
            showTradingOverlay && styles.floatingOverlayButtonTextActive,
            { fontSize: Math.max(12, Math.round(14 * uiScale)) }
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
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
  },
  leftMenuButtonActive: {
    backgroundColor: '#0b2f1f',
    borderColor: '#00ff88',
  },
  leftMenuButtonText: {
    color: '#ccc',
    fontWeight: '600',
  },
  // Two-column layout for large screens (left controls, right chart)
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    ...(Platform.OS === 'web' && {
      '@media (min-width: 1024px)': {
        gap: 16,
        padding: 16,
      }
    })
  },
  leftPanel: {
    flex: 1,
    maxWidth: '35%',
    minWidth: 300,
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
  },
  rightPanel: {
    flex: 2,
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 0,
    minWidth: 600,
  },
  // Variant to position floating overlay button to the left column on large screens
  floatingOverlayButtonLeft: {
    right: 'auto',
    left: 24,
    bottom: 24,
  },
  sectionWrapper: {
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0b0b0b'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0f0f0f',
    borderBottomWidth: 1,
    borderBottomColor: '#181818'
  },
  sectionHeaderTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionToggle: {
    color: '#888',
    fontSize: 14,
  },
  sectionContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#0a0a0a'
  },
  leftMenu: {
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 8,
  },
  leftMenuButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
  },
  leftMenuButtonActive: {
    backgroundColor: '#0b2f1f',
    borderColor: '#00ff88',
  },
  leftMenuButtonText: {
    color: '#ccc',
    fontWeight: '600',
  },
  leftMenuButtonTextActive: {
    color: '#00ff88',
  },
  leftPanelHideButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1100,
    backgroundColor: '#111',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#222',
  },
  leftPanelCollapsed: {
    width: 36,
    backgroundColor: '#080808',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftPanelShowButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
  },
});

// Definir las opciones para el gráfico que mantienen fijos los ejes al hacer zoom
const chartOptions = {
  maintainAspectRatio: true,
  scales: {
    x: {
      display: true,
      bounds: 'ticks',
      grid: { display: true },
      ticks: {
        autoSkip: false,
        maxRotation: 0,
        minRotation: 0,
        font: { size: 12 }
      },
      border: { display: true, color: '#000', lineWidth: 2 }
    },
    y: {
      // ...configuración existente para el eje y...
    }
  },
  plugins: {
    zoom: {
      zoom: {
        enabled: true,
        mode: 'x'
      },
      pan: {
        enabled: true,
        mode: 'x'
      }
    }
  }
};