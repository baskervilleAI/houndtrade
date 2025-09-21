import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTrading, useMarket } from '../../context/AppContext';

export const PositionsList: React.FC = () => {
  const { positions, placeOrder } = useTrading();
  const { tickers } = useMarket();

  const handleClosePosition = async (position: any) => {
    Alert.alert(
      'Cerrar Posición',
      `¿Estás seguro de que quieres cerrar la posición de ${position.symbol}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await placeOrder({
                symbol: position.symbol,
                type: 'market',
                side: position.side === 'long' ? 'sell' : 'buy',
                quantity: position.quantity,
              });
              Alert.alert('Éxito', 'Posición cerrada correctamente');
            } catch (error) {
              Alert.alert('Error', 'No se pudo cerrar la posición');
            }
          },
        },
      ]
    );
  };

  if (positions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No tienes posiciones abiertas</Text>
        <Text style={styles.emptySubtext}>
          Ejecuta una orden para abrir tu primera posición
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Posiciones Abiertas</Text>
      {positions.map((position: any) => {
        const currentPrice = tickers[position.symbol]?.price || position.currentPrice || 0;
        const pnlColor = (position.unrealizedPnl || 0) >= 0 ? '#00ff88' : '#ff4444';
        const sideColor = position.side === 'long' ? '#00ff88' : '#ff4444';
        
        return (
          <View key={position.id} style={styles.positionCard}>
            <View style={styles.positionHeader}>
              <View style={styles.symbolContainer}>
                <Text style={styles.symbol}>
                  {position.symbol.replace('USDT', '/USDT')}
                </Text>
                <View style={[styles.sideTag, { backgroundColor: sideColor }]}>
                  <Text style={styles.sideText}>
                    {position.side.toUpperCase()}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => handleClosePosition(position)}
              >
                <Text style={styles.closeButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.positionDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Cantidad:</Text>
                <Text style={styles.detailValue}>
                  {(position.quantity || 0).toFixed(6)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Precio de entrada:</Text>
                <Text style={styles.detailValue}>
                  ${(position.entryPrice || 0).toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Precio actual:</Text>
                <Text style={styles.detailValue}>
                  ${currentPrice.toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>PnL no realizado:</Text>
                <Text style={[styles.detailValue, { color: pnlColor }]}>
                  ${(position.unrealizedPnl || 0).toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>PnL total:</Text>
                <Text style={[styles.detailValue, { color: pnlColor }]}>
                  ${(position.totalPnl || position.unrealizedPnl || 0).toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Margen:</Text>
                <Text style={styles.detailValue}>
                  ${(position.margin || (position.quantity || 0) * (position.entryPrice || 0)).toFixed(2)}
                </Text>
              </View>
            </View>

            {(position.takeProfitPrice || position.stopLossPrice) && (
              <View style={styles.ordersSection}>
                <Text style={styles.ordersTitle}>Órdenes Asociadas:</Text>
                {position.takeProfitPrice && (
                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>Take Profit:</Text>
                    <Text style={[styles.orderValue, { color: '#00ff88' }]}>
                      ${(position.takeProfitPrice || 0).toFixed(2)}
                    </Text>
                  </View>
                )}
                {position.stopLossPrice && (
                  <View style={styles.orderRow}>
                    <Text style={styles.orderLabel}>Stop Loss:</Text>
                    <Text style={[styles.orderValue, { color: '#ff4444' }]}>
                      ${(position.stopLossPrice || 0).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.timestampContainer}>
              <Text style={styles.timestamp}>
                Abierta: {new Date(position.openedAt).toLocaleString()}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    padding: 16,
  },
  positionCard: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  symbolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginRight: 12,
  },
  sideTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sideText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  positionDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#888888',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  ordersSection: {
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 12,
    marginBottom: 12,
  },
  ordersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderLabel: {
    fontSize: 13,
    color: '#888888',
  },
  orderValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  timestampContainer: {
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
});