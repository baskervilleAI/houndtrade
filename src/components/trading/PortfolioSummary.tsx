import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Portfolio, TradingStats } from '../../types/trading';

interface PortfolioSummaryProps {
  portfolio: Portfolio | null;
  stats: TradingStats | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  portfolio,
  stats,
  isLoading,
  onRefresh
}) => {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando portfolio...</Text>
      </View>
    );
  }

  if (!portfolio || !stats) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error al cargar el portfolio</Text>
        <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalPnL = portfolio.realizedPnL + portfolio.unrealizedPnL;
  const totalPnLPercentage = portfolio.totalBalance > 0 
    ? ((totalPnL / (portfolio.totalBalance - totalPnL)) * 100)
    : 0;

  return (
    <View style={styles.container}>
      {/* Balance principal */}
      <View style={styles.balanceSection}>
        <Text style={styles.balanceLabel}>Balance Total</Text>
        <Text style={styles.balanceValue}>
          ${portfolio.totalBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
        </Text>
        
        <View style={styles.pnlContainer}>
          <Text style={[
            styles.pnlValue,
            { color: totalPnL >= 0 ? '#16a085' : '#e74c3c' }
          ]}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </Text>
          <Text style={[
            styles.pnlPercentage,
            { color: totalPnL >= 0 ? '#16a085' : '#e74c3c' }
          ]}>
            ({totalPnL >= 0 ? '+' : ''}{totalPnLPercentage.toFixed(2)}%)
          </Text>
        </View>
      </View>

      {/* Estadísticas rápidas */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.activeOrders}</Text>
          <Text style={styles.statLabel}>Órdenes Activas</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.closedOrders}</Text>
          <Text style={styles.statLabel}>Órdenes Cerradas</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={[
            styles.statValue,
            { color: portfolio.realizedPnL >= 0 ? '#16a085' : '#e74c3c' }
          ]}>
            ${portfolio.realizedPnL.toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>PnL Realizado</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={[
            styles.statValue,
            { color: portfolio.unrealizedPnL >= 0 ? '#16a085' : '#e74c3c' }
          ]}>
            ${portfolio.unrealizedPnL.toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>PnL No Realizado</Text>
        </View>
      </View>

      {/* Métricas de rendimiento */}
      <View style={styles.performanceSection}>
        <View style={styles.performanceRow}>
          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Win Rate</Text>
            <Text style={[
              styles.performanceValue,
              { color: portfolio.winRate >= 50 ? '#16a085' : '#e74c3c' }
            ]}>
              {portfolio.winRate.toFixed(1)}%
            </Text>
          </View>

          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Total Trades</Text>
            <Text style={styles.performanceValue}>{portfolio.totalTrades}</Text>
          </View>

          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Mejor Trade</Text>
            <Text style={[styles.performanceValue, { color: '#16a085' }]}>
              ${portfolio.bestTrade.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.performanceRow}>
          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Promedio Ganancia</Text>
            <Text style={[styles.performanceValue, { color: '#16a085' }]}>
              ${portfolio.averageWin.toFixed(2)}
            </Text>
          </View>

          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Promedio Pérdida</Text>
            <Text style={[styles.performanceValue, { color: '#e74c3c' }]}>
              ${Math.abs(portfolio.averageLoss).toFixed(2)}
            </Text>
          </View>

          <View style={styles.performanceItem}>
            <Text style={styles.performanceLabel}>Max Drawdown</Text>
            <Text style={[styles.performanceValue, { color: '#e74c3c' }]}>
              {portfolio.maxDrawdown.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Botón de actualizar */}
      <TouchableOpacity 
        style={styles.refreshButton} 
        onPress={onRefresh}
        disabled={isLoading}
      >
        <Text style={styles.refreshButtonText}>
          {isLoading ? 'Actualizando...' : 'Actualizar Portfolio'}
        </Text>
      </TouchableOpacity>

      {/* Última actualización */}
      <Text style={styles.lastUpdateText}>
        Última actualización: {new Date(portfolio.lastUpdated).toLocaleTimeString('es-ES')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#e74c3c',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  balanceSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  pnlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pnlValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pnlPercentage: {
    fontSize: 16,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  performanceSection: {
    marginBottom: 20,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  performanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  performanceLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  performanceValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});