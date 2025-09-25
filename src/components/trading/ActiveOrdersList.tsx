import React, { useState, useEffect } from 'react';
import { View, Text, Alert, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { TradingOrder, OrderSide, OrderStatus } from '../../types/trading';

interface ActiveOrdersListProps {
  orders: TradingOrder[];
  onCloseOrder: (orderId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  onCancelOrder: (orderId: string, reason?: string) => { success: boolean; error?: string };
  getCurrentPrice: (symbol: string) => number | null;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
}

interface OrderCardProps {
  order: TradingOrder;
  currentPrice: number | null;
  onClose: (orderId: string, reason?: string) => Promise<void>;
  onCancel: (orderId: string, reason?: string) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, currentPrice, onClose, onCancel }) => {
  const [isClosing, setIsClosing] = useState(false);

  // Calcular PnL actual
  const calculateCurrentPnL = (): number => {
    if (!currentPrice) return 0;
    
    if (order.side === OrderSide.BUY) {
      return (currentPrice - order.entryPrice) * order.quantity;
    } else {
      return (order.entryPrice - currentPrice) * order.quantity;
    }
  };

  const currentPnL = calculateCurrentPnL();
  const pnlPercentage = (currentPnL / order.usdtAmount) * 100;

  // Verificar si está cerca del TP o SL
  const checkTPSLProximity = () => {
    if (!currentPrice) return null;
    
    let tpDistance = null;
    let slDistance = null;
    
    if (order.takeProfitPrice) {
      tpDistance = Math.abs((currentPrice - order.takeProfitPrice) / order.entryPrice) * 100;
    }
    
    if (order.stopLossPrice) {
      slDistance = Math.abs((currentPrice - order.stopLossPrice) / order.entryPrice) * 100;
    }
    
    return { tpDistance, slDistance };
  };

  const proximity = checkTPSLProximity();

  const handleClose = async (reason?: string) => {
    Alert.alert(
      'Cerrar Orden',
      `¿Estás seguro de que quieres cerrar esta orden ${order.side} de ${order.symbol}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            setIsClosing(true);
            try {
              await onClose(order.id, reason);
            } finally {
              setIsClosing(false);
            }
          }
        }
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Orden',
      `¿Estás seguro de que quieres cancelar esta orden ${order.side} de ${order.symbol}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => onCancel(order.id, 'Cancelado por el usuario')
        }
      ]
    );
  };

  // Formatear tiempo transcurrido
  const formatTimeElapsed = (timestamp: number): string => {
    const elapsed = Date.now() - timestamp;
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const cardStyle = [
    styles.orderCard,
    {
      backgroundColor: order.side === OrderSide.BUY ? '#e8f5e8' : '#ffe8e8',
      borderLeftColor: order.side === OrderSide.BUY ? '#16a085' : '#e74c3c'
    }
  ];

  return (
    <View style={cardStyle}>
      <View style={styles.cardContent}>
        {/* Header con símbolo y estado */}
        <View style={styles.headerRow}>
          <View style={styles.orderInfo}>
            <Text style={styles.symbolText}>
              {order.symbol} {order.side}
            </Text>
            <Text style={styles.timeText}>
              {formatTimeElapsed(order.createdAt)} • {order.type}
            </Text>
          </View>
          
          <View style={styles.amountInfo}>
            <Text style={styles.usdtAmount}>
              ${order.usdtAmount.toFixed(2)}
            </Text>
            <Text style={styles.quantityText}>
              {order.quantity.toFixed(6)} {order.symbol.replace('USDT', '')}
            </Text>
          </View>
        </View>

        {/* Precios */}
        <View style={styles.pricesRow}>
          <View style={styles.priceColumn}>
            <Text style={styles.priceLabel}>Precio Entrada</Text>
            <Text style={styles.priceValue}>
              ${order.entryPrice.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.priceColumn}>
            <Text style={styles.priceLabel}>Precio Actual</Text>
            <Text style={styles.priceValue}>
              {currentPrice ? `$${currentPrice.toFixed(2)}` : 'Cargando...'}
            </Text>
          </View>
          
          <View style={[styles.priceColumn, styles.pnlColumn]}>
            <Text style={styles.priceLabel}>PnL No Realizado</Text>
            <Text style={[
              styles.priceValue,
              { color: currentPnL >= 0 ? '#16a085' : '#e74c3c' }
            ]}>
              ${currentPnL.toFixed(2)} ({pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(1)}%)
            </Text>
          </View>
        </View>

        {/* TP/SL */}
        {(order.takeProfitPrice || order.stopLossPrice) && (
          <View style={styles.tpslRow}>
            {order.takeProfitPrice && (
              <View style={styles.tpslColumn}>
                <Text style={styles.priceLabel}>Take Profit</Text>
                <Text style={[styles.priceValue, { color: '#16a085' }]}>
                  ${order.takeProfitPrice.toFixed(2)}
                </Text>
                {order.takeProfitUSDT && (
                  <Text style={[styles.tpslUsdtText, { color: '#16a085' }]}>
                    +${order.takeProfitUSDT.toFixed(2)}
                  </Text>
                )}
                {proximity && proximity.tpDistance !== null && proximity.tpDistance < 5 && (
                  <Text style={[styles.proximityText, { color: '#16a085' }]}>
                    ¡Cerca del TP!
                  </Text>
                )}
              </View>
            )}
            
            {order.stopLossPrice && (
              <View style={[styles.tpslColumn, styles.slColumn]}>
                <Text style={styles.priceLabel}>Stop Loss</Text>
                <Text style={[styles.priceValue, { color: '#e74c3c' }]}>
                  ${order.stopLossPrice.toFixed(2)}
                </Text>
                {order.stopLossUSDT && (
                  <Text style={[styles.tpslUsdtText, { color: '#e74c3c' }]}>
                    -${order.stopLossUSDT.toFixed(2)}
                  </Text>
                )}
                {proximity && proximity.slDistance !== null && proximity.slDistance < 5 && (
                  <Text style={[styles.proximityText, { color: '#e74c3c' }]}>
                    ¡Cerca del SL!
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Notas si existen */}
        {order.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesText}>
              📝 {order.notes}
            </Text>
          </View>
        )}

        {/* Botones de acción */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.button, 
              styles.closeButton,
              { 
                backgroundColor: currentPnL >= 0 ? '#16a085' : '#e74c3c',
                opacity: (isClosing || !currentPrice) ? 0.6 : 1
              }
            ]}
            onPress={() => handleClose('Cerrado manualmente')}
            disabled={isClosing || !currentPrice}
          >
            <Text style={styles.closeButtonText}>
              {isClosing ? 'Cerrando...' : 'Cerrar Orden'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export const ActiveOrdersList: React.FC<ActiveOrdersListProps> = ({
  orders,
  onCloseOrder,
  onCancelOrder,
  getCurrentPrice,
  onRefresh,
  isLoading = false
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
  };

  const handleCloseOrder = async (orderId: string, reason?: string) => {
    try {
      const result = await onCloseOrder(orderId, reason);
      if (result.success) {
        Alert.alert('Éxito', 'Orden cerrada correctamente');
      } else {
        Alert.alert('Error', result.error || 'Error al cerrar la orden');
      }
    } catch (error) {
      Alert.alert('Error', 'Error interno al cerrar la orden');
    }
  };

  const handleCancelOrder = (orderId: string, reason?: string) => {
    try {
      const result = onCancelOrder(orderId, reason);
      if (result.success) {
        Alert.alert('Éxito', 'Orden cancelada correctamente');
      } else {
        Alert.alert('Error', result.error || 'Error al cancelar la orden');
      }
    } catch (error) {
      Alert.alert('Error', 'Error interno al cancelar la orden');
    }
  };

  const renderOrderItem = ({ item }: { item: TradingOrder }) => (
    <OrderCard
      order={item}
      currentPrice={getCurrentPrice(item.symbol)}
      onClose={handleCloseOrder}
      onCancel={handleCancelOrder}
    />
  );

  if (orders.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>
          No tienes órdenes activas
        </Text>
        <Text style={styles.emptySubtitle}>
          Crea una nueva orden para comenzar a operar
        </Text>
      </View>
    );
  }

  // Ordenar por tiempo de creación (más recientes primero)
  const sortedOrders = [...orders].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <View style={styles.container}>
      {/* Header con estadísticas */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Órdenes Activas ({orders.length})
        </Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Compras</Text>
            <Text style={[styles.statValue, { color: '#16a085' }]}>
              {orders.filter(o => o.side === OrderSide.BUY).length}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Ventas</Text>
            <Text style={[styles.statValue, { color: '#e74c3c' }]}>
              {orders.filter(o => o.side === OrderSide.SELL).length}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Volumen Total</Text>
            <Text style={styles.statValue}>
              ${orders.reduce((sum, order) => sum + order.usdtAmount, 0).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={sortedOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  orderCard: {
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardContent: {
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderInfo: {
    flex: 1,
  },
  symbolText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
  amountInfo: {
    alignItems: 'flex-end',
  },
  usdtAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: 12,
    color: '#666',
  },
  pricesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceColumn: {
    flex: 1,
  },
  pnlColumn: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  tpslRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  tpslColumn: {
    flex: 1,
  },
  slColumn: {
    alignItems: 'flex-end',
  },
  tpslUsdtText: {
    fontSize: 12,
  },
  proximityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  notesContainer: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
  },
  notesText: {
    fontSize: 12,
    color: '#666',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f39c12',
  },
  cancelButtonText: {
    color: '#f39c12',
    fontWeight: 'bold',
  },
  closeButton: {
    paddingHorizontal: 20,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});