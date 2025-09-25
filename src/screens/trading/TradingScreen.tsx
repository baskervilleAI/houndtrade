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
import { PortfolioSummary } from '../../components/trading/PortfolioSummary';
import { OrderForm } from '../../components/trading/OrderForm';
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

  // Tab state
  const [activeTab, setActiveTab] = useState<'chart' | 'orders' | 'history' | 'portfolio'>('chart');

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

  const handleLogout = () => {
    logout();
  };

  const handleRefreshData = async () => {
    await refreshPortfolio();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chart':
        return (
          <View style={styles.chartContainer}>
            <MinimalistChart 
              height={screenHeight - 220} 
              width={screenWidth - 20} 
              symbol={selectedPair} 
            />
          </View>
        );
      
      case 'orders':
        return (
          <OrderForm 
            onCreateOrder={createOrder}
            isLoading={isLoading}
          />
        );
      
      case 'history':
        return (
          <OrderHistory 
            orders={orders}
            onRefresh={handleRefreshData}
          />
        );
      
      case 'portfolio':
        return (
          <ScrollView style={styles.portfolioContainer}>
            <PortfolioSummary
              portfolio={portfolio}
              stats={stats}
              isLoading={isLoading}
              onRefresh={handleRefreshData}
            />
            
            {/* Active orders list (simplified) */}
            {activeOrders.length > 0 && (
              <View style={styles.activeOrdersSection}>
                <Text style={styles.sectionTitle}>
                  Órdenes Activas ({activeOrders.length})
                </Text>
                {activeOrders.map(order => (
                  <View key={order.id} style={styles.quickOrderItem}>
                    <View style={styles.quickOrderHeader}>
                      <Text style={styles.quickOrderSymbol}>{order.symbol}</Text>
                      <Text style={[
                        styles.quickOrderSide,
                        { color: order.side === 'BUY' ? '#16a085' : '#e74c3c' }
                      ]}>
                        {order.side}
                      </Text>
                    </View>
                    <View style={styles.quickOrderDetails}>
                      <Text style={styles.quickOrderAmount}>
                        ${order.usdtAmount.toFixed(2)}
                      </Text>
                      <Text style={styles.quickOrderPrice}>
                        @${order.entryPrice.toFixed(2)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.quickCloseButton}
                      onPress={() => closeOrder(order.id, 'Cerrado desde resumen')}
                    >
                      <Text style={styles.quickCloseButtonText}>Cerrar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
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

      {/* Quick Portfolio Summary */}
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

      {/* Market Data */}
      <MarketData />

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'chart' && styles.activeTabButton]}
          onPress={() => setActiveTab('chart')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'chart' && styles.activeTabButtonText]}>
            Gráfico
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'orders' && styles.activeTabButton]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'orders' && styles.activeTabButtonText]}>
            Nueva Orden
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'portfolio' && styles.activeTabButton]}
          onPress={() => setActiveTab('portfolio')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'portfolio' && styles.activeTabButtonText]}>
            Portfolio
          </Text>
          {activeOrders.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{activeOrders.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'history' && styles.activeTabButtonText]}>
            Historial
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>

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
  portfolioSummary: {
    flexDirection: isSmallMobile ? 'column' : 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    gap: isSmallMobile ? 8 : 0,
  },
  balanceContainer: {
    flex: isSmallMobile ? 0 : 1,
    alignItems: 'center',
    paddingVertical: isSmallMobile ? 8 : 0,
  },
  balanceLabel: {
    fontSize: isSmallMobile ? 14 : 12,
    color: '#888888',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: isSmallMobile ? 18 : 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  equityContainer: {
    flex: isSmallMobile ? 0 : 1,
    alignItems: 'center',
    paddingVertical: isSmallMobile ? 8 : 0,
  },
  equityLabel: {
    fontSize: isSmallMobile ? 14 : 12,
    color: '#888888',
    marginBottom: 4,
  },
  equityValue: {
    fontSize: isSmallMobile ? 18 : 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  pnlContainer: {
    flex: isSmallMobile ? 0 : 1,
    alignItems: 'center',
    paddingVertical: isSmallMobile ? 8 : 0,
  },
  pnlLabel: {
    fontSize: isSmallMobile ? 14 : 12,
    color: '#888888',
    marginBottom: 4,
  },
  pnlValue: {
    fontSize: isSmallMobile ? 18 : 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  chartContainer: {
    flex: 1,
  },
  // Tab navigation styles
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  activeTabButton: {
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 2,
    borderBottomColor: '#00ff88',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#888888',
  },
  activeTabButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  tabBadge: {
    position: 'absolute',
    top: 4,
    right: 16,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Portfolio section styles
  portfolioContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  activeOrdersSection: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    margin: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  quickOrderItem: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickOrderHeader: {
    flex: 1,
  },
  quickOrderSymbol: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  quickOrderSide: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickOrderDetails: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 12,
  },
  quickOrderAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  quickOrderPrice: {
    fontSize: 12,
    color: '#888888',
  },
  quickCloseButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickCloseButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
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