import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { TradingOrder, OrderStatus, OrderSide } from '../../types/trading';

interface OrderHistoryProps {
  orders: TradingOrder[];
  onRefresh?: () => Promise<void>;
}

interface FilterOptions {
  status: OrderStatus | 'ALL';
  side: OrderSide | 'ALL';
  symbol: string | 'ALL';
  dateRange: 'ALL' | '1D' | '1W' | '1M' | '3M';
}

interface OrderDetailModalProps {
  order: TradingOrder | null;
  visible: boolean;
  onClose: () => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, visible, onClose }) => {
  if (!order) return null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.FILLED_TP: return 'Cerrado en Take Profit';
      case OrderStatus.FILLED_SL: return 'Cerrado en Stop Loss';
      case OrderStatus.CLOSED_MANUAL: return 'Cerrado Manualmente';
      case OrderStatus.CANCELLED: return 'Cancelado';
      default: return status;
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.FILLED_TP: return '#16a085';
      case OrderStatus.FILLED_SL: return '#e74c3c';
      case OrderStatus.CLOSED_MANUAL: return '#3498db';
      case OrderStatus.CANCELLED: return '#95a5a6';
      default: return '#333';
    }
  };

  const tradeDuration = order.closedAt ? order.closedAt - order.createdAt : 0;
  const durationHours = Math.floor(tradeDuration / (1000 * 60 * 60));
  const durationMinutes = Math.floor((tradeDuration % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Detalles de la Orden</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          {/* Información básica */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Información General</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Símbolo:</Text>
              <Text style={styles.detailValue}>{order.symbol}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tipo:</Text>
              <Text style={styles.detailValue}>{order.side} {order.type}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estado:</Text>
              <Text style={[styles.detailValue, { color: getStatusColor(order.status) }]}>
                {getStatusText(order.status)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>ID:</Text>
              <Text style={[styles.detailValue, styles.idText]}>{order.id}</Text>
            </View>
          </View>

          {/* Precios y cantidades */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Precios y Cantidades</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Precio de Entrada:</Text>
              <Text style={styles.detailValue}>${order.entryPrice.toFixed(2)}</Text>
            </View>
            {order.exitPrice && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Precio de Salida:</Text>
                <Text style={styles.detailValue}>${order.exitPrice.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cantidad:</Text>
              <Text style={styles.detailValue}>{order.quantity.toFixed(6)} {order.symbol.replace('USDT', '')}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Valor USDT:</Text>
              <Text style={styles.detailValue}>${order.usdtAmount.toFixed(2)}</Text>
            </View>
          </View>

          {/* TP/SL */}
          {(order.takeProfitPrice || order.stopLossPrice) && (
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Take Profit & Stop Loss</Text>
              {order.takeProfitPrice && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Take Profit (Precio):</Text>
                    <Text style={[styles.detailValue, { color: '#16a085' }]}>
                      ${order.takeProfitPrice.toFixed(2)}
                    </Text>
                  </View>
                  {order.takeProfitUSDT && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Take Profit (USDT):</Text>
                      <Text style={[styles.detailValue, { color: '#16a085' }]}>
                        +${order.takeProfitUSDT.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </>
              )}
              {order.stopLossPrice && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Stop Loss (Precio):</Text>
                    <Text style={[styles.detailValue, { color: '#e74c3c' }]}>
                      ${order.stopLossPrice.toFixed(2)}
                    </Text>
                  </View>
                  {order.stopLossUSDT && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Stop Loss (USDT):</Text>
                      <Text style={[styles.detailValue, { color: '#e74c3c' }]}>
                        -${order.stopLossUSDT.toFixed(2)}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Resultado */}
          {order.realizedPnL !== null && (
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Resultado</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>PnL Realizado:</Text>
                <Text style={[
                  styles.detailValue, 
                  styles.pnlText,
                  { color: order.realizedPnL >= 0 ? '#16a085' : '#e74c3c' }
                ]}>
                  {order.realizedPnL >= 0 ? '+' : ''}${order.realizedPnL.toFixed(2)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Rendimiento:</Text>
                <Text style={[
                  styles.detailValue,
                  { color: order.realizedPnL >= 0 ? '#16a085' : '#e74c3c' }
                ]}>
                  {((order.realizedPnL / order.usdtAmount) * 100).toFixed(2)}%
                </Text>
              </View>
            </View>
          )}

          {/* Fechas y duración */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Fechas</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Creada:</Text>
              <Text style={styles.detailValue}>{formatDate(order.createdAt)}</Text>
            </View>
            {order.closedAt && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cerrada:</Text>
                  <Text style={styles.detailValue}>{formatDate(order.closedAt)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Duración:</Text>
                  <Text style={styles.detailValue}>
                    {durationHours > 0 ? `${durationHours}h ` : ''}{durationMinutes}m
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Notas */}
          {order.notes && (
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Notas</Text>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const OrderHistoryItem: React.FC<{ 
  order: TradingOrder; 
  onPress: (order: TradingOrder) => void;
}> = ({ order, onPress }) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.FILLED_TP: return '🎯';
      case OrderStatus.FILLED_SL: return '🛑';
      case OrderStatus.CLOSED_MANUAL: return '👤';
      case OrderStatus.CANCELLED: return '❌';
      default: return '❓';
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.FILLED_TP: return '#16a085';
      case OrderStatus.FILLED_SL: return '#e74c3c';
      case OrderStatus.CLOSED_MANUAL: return '#3498db';
      case OrderStatus.CANCELLED: return '#95a5a6';
      default: return '#333';
    }
  };

  return (
    <TouchableOpacity style={styles.orderItem} onPress={() => onPress(order)}>
      <View style={styles.orderHeader}>
        <View style={styles.orderSymbol}>
          <Text style={styles.symbolText}>{order.symbol}</Text>
          <Text style={[
            styles.sideText,
            { color: order.side === OrderSide.BUY ? '#16a085' : '#e74c3c' }
          ]}>
            {order.side}
          </Text>
        </View>
        
        <View style={styles.orderDate}>
          <Text style={styles.dateText}>{formatDate(order.createdAt)}</Text>
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {getStatusIcon(order.status)}
          </Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.orderAmounts}>
          <Text style={styles.amountLabel}>Valor</Text>
          <Text style={styles.amountValue}>${order.usdtAmount.toFixed(2)}</Text>
        </View>

        {order.realizedPnL !== null && order.status !== OrderStatus.CANCELLED && (
          <View style={styles.orderPnl}>
            <Text style={styles.pnlLabel}>PnL</Text>
            <Text style={[
              styles.pnlValue,
              { color: order.realizedPnL >= 0 ? '#16a085' : '#e74c3c' }
            ]}>
              {order.realizedPnL >= 0 ? '+' : ''}${order.realizedPnL.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={styles.orderPercentage}>
          <Text style={styles.percentageLabel}>%</Text>
          <Text style={[
            styles.percentageValue,
            { 
              color: order.realizedPnL && order.realizedPnL >= 0 ? '#16a085' : '#e74c3c'
            }
          ]}>
            {order.realizedPnL ? 
              `${((order.realizedPnL / order.usdtAmount) * 100).toFixed(1)}%` :
              '--'
            }
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const OrderHistory: React.FC<OrderHistoryProps> = ({ orders }) => {
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'ALL',
    side: 'ALL',
    symbol: 'ALL',
    dateRange: 'ALL'
  });
  const [selectedOrder, setSelectedOrder] = useState<TradingOrder | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filtrar órdenes cerradas
  const closedOrders = orders.filter(order => order.status !== OrderStatus.ACTIVE);

  // Aplicar filtros
  const filteredOrders = useMemo(() => {
    let filtered = [...closedOrders];

    // Filtro por estado
    if (filters.status !== 'ALL') {
      filtered = filtered.filter(order => order.status === filters.status);
    }

    // Filtro por lado
    if (filters.side !== 'ALL') {
      filtered = filtered.filter(order => order.side === filters.side);
    }

    // Filtro por símbolo
    if (filters.symbol !== 'ALL') {
      filtered = filtered.filter(order => order.symbol === filters.symbol);
    }

    // Filtro por fecha
    if (filters.dateRange !== 'ALL') {
      const now = Date.now();
      let cutoff = 0;
      
      switch (filters.dateRange) {
        case '1D': cutoff = now - 24 * 60 * 60 * 1000; break;
        case '1W': cutoff = now - 7 * 24 * 60 * 60 * 1000; break;
        case '1M': cutoff = now - 30 * 24 * 60 * 60 * 1000; break;
        case '3M': cutoff = now - 90 * 24 * 60 * 60 * 1000; break;
      }
      
      filtered = filtered.filter(order => order.createdAt >= cutoff);
    }

    // Ordenar por fecha (más recientes primero)
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }, [closedOrders, filters]);

  // Obtener símbolos únicos para filtro
  const uniqueSymbols = [...new Set(closedOrders.map(order => order.symbol))];

  // Calcular estadísticas
  const stats = useMemo(() => {
    const profitable = filteredOrders.filter(order => 
      order.realizedPnL && order.realizedPnL > 0
    );
    const unprofitable = filteredOrders.filter(order => 
      order.realizedPnL && order.realizedPnL < 0
    );
    
    const totalPnL = filteredOrders.reduce((sum, order) => 
      sum + (order.realizedPnL || 0), 0
    );
    
    return {
      total: filteredOrders.length,
      profitable: profitable.length,
      unprofitable: unprofitable.length,
      cancelled: filteredOrders.filter(order => order.status === OrderStatus.CANCELLED).length,
      totalPnL,
      winRate: filteredOrders.length > 0 ? (profitable.length / filteredOrders.length) * 100 : 0
    };
  }, [filteredOrders]);

  const handleOrderPress = (order: TradingOrder) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const renderOrderItem = ({ item }: { item: TradingOrder }) => (
    <OrderHistoryItem order={item} onPress={handleOrderPress} />
  );

  if (closedOrders.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>
          No tienes órdenes en el historial
        </Text>
        <Text style={styles.emptySubtitle}>
          Las órdenes cerradas aparecerán aquí
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header con estadísticas */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Historial ({filteredOrders.length})
        </Text>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.profitable}</Text>
            <Text style={styles.statLabel}>Ganadas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.unprofitable}</Text>
            <Text style={styles.statLabel}>Perdidas</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: stats.totalPnL >= 0 ? '#16a085' : '#e74c3c' }]}>
              ${stats.totalPnL.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>PnL Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.winRate.toFixed(1)}%</Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterButtonText}>
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          {/* Aquí podrías agregar selectores para los filtros */}
          <Text style={styles.filtersTitle}>Filtros disponibles</Text>
          <Text style={styles.filtersSubtitle}>
            Estado: {filters.status} | Lado: {filters.side} | Rango: {filters.dateRange}
          </Text>
        </View>
      )}

      {/* Lista de órdenes */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Modal de detalles */}
      <OrderDetailModal
        order={selectedOrder}
        visible={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedOrder(null);
        }}
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
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  filterButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  filterButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  filtersContainer: {
    backgroundColor: '#e9ecef',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  filtersTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  filtersSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  orderItem: {
    backgroundColor: 'white',
    marginVertical: 4,
    marginHorizontal: 8,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderSymbol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sideText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderDate: {
    alignItems: 'flex-end',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  statusText: {
    fontSize: 16,
    marginTop: 2,
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderAmounts: {
    alignItems: 'flex-start',
  },
  amountLabel: {
    fontSize: 12,
    color: '#666',
  },
  amountValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  orderPnl: {
    alignItems: 'center',
  },
  pnlLabel: {
    fontSize: 12,
    color: '#666',
  },
  pnlValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  orderPercentage: {
    alignItems: 'flex-end',
  },
  percentageLabel: {
    fontSize: 12,
    color: '#666',
  },
  percentageValue: {
    fontSize: 14,
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f3f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  idText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  pnlText: {
    fontSize: 16,
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    fontStyle: 'italic',
  },
});