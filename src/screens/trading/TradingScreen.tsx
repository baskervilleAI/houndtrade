import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useAuth, useTrading, useMarket } from '../../context/AppContext';
import { CandlestickChart } from '../../components/chart/CandlestickChart';
import { OrderForm } from '../../components/trading/OrderForm';
import { PositionsList } from '../../components/trading/PositionsList';
import { MarketData } from '../../components/trading/MarketData';

const { width: screenWidth } = Dimensions.get('window');

export const TradingScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'chart' | 'positions' | 'orders'>('chart');
  const { user, logout } = useAuth();
  const { balance, equity, totalPnl, pnlPercentage } = useTrading();
  const { selectedPair, tickers } = useMarket();

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
          <Text style={styles.balanceValue}>${balance.toLocaleString()}</Text>
        </View>
        <View style={styles.equityContainer}>
          <Text style={styles.equityLabel}>Equity</Text>
          <Text style={styles.equityValue}>${equity.toLocaleString()}</Text>
        </View>
        <View style={styles.pnlContainer}>
          <Text style={styles.pnlLabel}>PnL</Text>
          <Text style={[
            styles.pnlValue,
            { color: totalPnl >= 0 ? '#00ff88' : '#ff4444' }
          ]}>
            ${totalPnl.toLocaleString()} ({pnlPercentage.toFixed(2)}%)
          </Text>
        </View>
      </View>

      {/* Market Data */}
      <MarketData />

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'chart' && styles.activeTab]}
          onPress={() => setSelectedTab('chart')}
        >
          <Text style={[styles.tabText, selectedTab === 'chart' && styles.activeTabText]}>
            Gráfico
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'positions' && styles.activeTab]}
          onPress={() => setSelectedTab('positions')}
        >
          <Text style={[styles.tabText, selectedTab === 'positions' && styles.activeTabText]}>
            Posiciones
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'orders' && styles.activeTab]}
          onPress={() => setSelectedTab('orders')}
        >
          <Text style={[styles.tabText, selectedTab === 'orders' && styles.activeTabText]}>
            Órdenes
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {selectedTab === 'chart' && (
          <View style={styles.chartContainer}>
            <CandlestickChart />
            <OrderForm />
          </View>
        )}
        {selectedTab === 'positions' && <PositionsList />}
        {selectedTab === 'orders' && (
          <View style={styles.ordersContainer}>
            <Text style={styles.comingSoon}>Historial de órdenes próximamente</Text>
          </View>
        )}
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
  },
  headerLeft: {
    flex: 1,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userName: {
    fontSize: 14,
    color: '#888888',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  portfolioSummary: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  balanceContainer: {
    flex: 1,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  equityContainer: {
    flex: 1,
    alignItems: 'center',
  },
  equityLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 4,
  },
  equityValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  pnlContainer: {
    flex: 1,
    alignItems: 'center',
  },
  pnlLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 4,
  },
  pnlValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00ff88',
  },
  tabText: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#00ff88',
  },
  content: {
    flex: 1,
  },
  chartContainer: {
    flex: 1,
  },
  ordersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoon: {
    fontSize: 16,
    color: '#888888',
  },
});