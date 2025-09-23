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
import { useAuth, useTrading, useMarket } from '../../context/AppContext';
import { useMarketData } from '../../hooks/useMarketData';
import { formatPrice, formatPercentage, formatCurrency } from '../../utils/formatters';
import AdvancedCandlestickChart from '../../components/chart/AdvancedCandlestickChart';
import MinimalistChart from '../../components/chart/MinimalistChart';
import { MarketData } from '../../components/trading/MarketData';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Responsive breakpoints
const isTablet = screenWidth >= 768;
const isMobile = screenWidth < 768;
const isSmallMobile = screenWidth < 400;

export const TradingScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { balance, equity, totalPnl, pnlPercentage } = useTrading();
  const { selectedPair, tickers } = useMarket();

  // Initialize market data at the screen level
  const { isInitialized, getStatus } = useMarketData({
    autoStart: true,
    symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'],
    refreshInterval: 30000,
  });

  // Only log once when status changes
  useEffect(() => {
    console.log('🏠 TradingScreen - Market data status changed:', {
      initialized: isInitialized,
      tickerCount: Object.keys(tickers).length,
      symbols: Object.keys(tickers)
    });
  }, [isInitialized, Object.keys(tickers).length]); // Only depend on length, not the object itself

  const currentPrice = tickers[selectedPair]?.price || 0;
  const priceChange = tickers[selectedPair]?.changePercent24h || 0;

  const handleLogout = () => {
    logout();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.appName}>HoundTrade</Text>
          <Text style={styles.userName}>Bienvenido, {user?.displayName}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Portfolio Summary */}
      <View style={styles.portfolioSummary}>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceValue}>${formatCurrency(balance)}</Text>
        </View>
        <View style={styles.equityContainer}>
          <Text style={styles.equityLabel}>Equity</Text>
          <Text style={styles.equityValue}>${formatCurrency(equity)}</Text>
        </View>
        <View style={styles.pnlContainer}>
          <Text style={styles.pnlLabel}>PnL</Text>
          <Text style={[
            styles.pnlValue,
            { color: (totalPnl || 0) >= 0 ? '#00ff88' : '#ff4444' }
          ]}>
            ${formatCurrency(totalPnl)} ({formatPercentage(pnlPercentage)})
          </Text>
        </View>
      </View>

      {/* Market Data */}
      <MarketData />

      {/* Maximized Chart Content */}
      <View style={styles.content}>
        <View style={styles.chartContainer}>
          <MinimalistChart 
            height={screenHeight - 220} 
            width={screenWidth - 20} 
            symbol={selectedPair} 
          />
        </View>
      </View>
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
});