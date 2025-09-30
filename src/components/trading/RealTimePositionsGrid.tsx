import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import { TradingOrder, OrderStatus, OrderSide } from '../../types/trading';
import { formatPrice, formatPercentage, formatCurrency } from '../../utils/formatters';
import { debugLogger } from '../../utils/debugLogger';

interface RealTimePositionData extends TradingOrder {
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  priceChange: number;
  priceChangePercentage: number;
  isUpdating?: boolean;
}

interface RealTimePositionsGridProps {
  orders: TradingOrder[];
  onAddPosition?: () => void;
  onPositionPress?: (position: RealTimePositionData) => void;
  onClosePosition?: (positionId: string) => void;
  getCurrentPrice?: (symbol: string) => number | null;
  onPriceUpdate?: (callback: (symbol: string, price: number) => void) => (() => void);
  isLoading?: boolean;
}

export const RealTimePositionsGrid: React.FC<RealTimePositionsGridProps> = ({
  orders,
  onAddPosition,
  onPositionPress,
  onClosePosition,
  getCurrentPrice,
  onPriceUpdate,
  isLoading = false,
}) => {
  const [positionsData, setPositionsData] = useState<RealTimePositionData[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  
  // Animaciones para las actualizaciones de precios
  const [priceAnimations] = useState(new Map<string, Animated.Value>());

  /**
   * Calcula el PnL no realizado para una orden
   */
  const calculateUnrealizedPnL = useCallback((order: TradingOrder, currentPrice: number): {
    unrealizedPnL: number;
    unrealizedPnLPercentage: number;
  } => {
    let unrealizedPnL = 0;
    
    if (order.side === OrderSide.BUY) {
      unrealizedPnL = (currentPrice - order.entryPrice) * order.quantity;
    } else {
      unrealizedPnL = (order.entryPrice - currentPrice) * order.quantity;
    }
    
    const unrealizedPnLPercentage = (unrealizedPnL / order.usdtAmount) * 100;
    
    return { unrealizedPnL, unrealizedPnLPercentage };
  }, []);

  /**
   * Actualiza los datos de las posiciones con precios actuales
   */
  const updatePositionsData = useCallback(() => {
    if (!getCurrentPrice) return;

    const activeOrders = orders.filter(order => order.status === OrderStatus.ACTIVE);
    
    const updatedPositions: RealTimePositionData[] = activeOrders.map(order => {
      const currentPrice = getCurrentPrice(order.symbol) || order.entryPrice;
      const { unrealizedPnL, unrealizedPnLPercentage } = calculateUnrealizedPnL(order, currentPrice);
      
      const priceChange = currentPrice - order.entryPrice;
      const priceChangePercentage = (priceChange / order.entryPrice) * 100;

      return {
        ...order,
        currentPrice,
        unrealizedPnL,
        unrealizedPnLPercentage,
        priceChange,
        priceChangePercentage,
      };
    });

    setPositionsData(updatedPositions);
    setLastUpdateTime(Date.now());
  }, [orders, getCurrentPrice, calculateUnrealizedPnL]);

  /**
   * Anima el cambio de precio para una posición
   */
  const animatePriceChange = useCallback((positionId: string) => {
    if (!priceAnimations.has(positionId)) {
      priceAnimations.set(positionId, new Animated.Value(0));
    }
    
    const animation = priceAnimations.get(positionId)!;
    
    // Animación de highlight
    Animated.sequence([
      Animated.timing(animation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(animation, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: false,
      }),
    ]).start();
  }, [priceAnimations]);

  /**
   * Maneja el refresh manual
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      updatePositionsData();
      await new Promise(resolve => setTimeout(resolve, 500)); // Pequeña pausa para UX
    } catch (error) {
      debugLogger.error('Error al refrescar posiciones:', error);
    } finally {
      setRefreshing(false);
    }
  }, [updatePositionsData]);

  // Efecto para actualizar datos cuando cambian las órdenes
  useEffect(() => {
    updatePositionsData();
  }, [updatePositionsData]);

  // Efecto para suscribirse a actualizaciones de precios en tiempo real
  useEffect(() => {
    if (!onPriceUpdate) return;

    const unsubscribe = onPriceUpdate((symbol, price) => {
      // Verificar si tenemos alguna posición con este símbolo
      const hasPositionWithSymbol = positionsData.some(pos => pos.symbol === symbol);
      
      if (hasPositionWithSymbol) {
        // Actualizar datos inmediatamente
        updatePositionsData();
        
        // Animar posiciones afectadas
        positionsData.forEach(position => {
          if (position.symbol === symbol) {
            animatePriceChange(position.id);
          }
        });
      }
    });

    return unsubscribe;
  }, [onPriceUpdate, positionsData, updatePositionsData, animatePriceChange]);

  /**
   * Renderiza la tarjeta de agregar nueva posición
   */
  const renderAddPositionCard = () => (
    <TouchableOpacity
      key="add-position"
      style={[styles.positionCard, styles.addCard]}
      onPress={onAddPosition}
    >
      <View style={styles.addCardContent}>
        <Text style={styles.addCardIcon}>+</Text>
        <Text style={styles.addCardText}>Nueva{'\n'}Posición</Text>
      </View>
    </TouchableOpacity>
  );

  /**
   * Renderiza una tarjeta de posición
   */
  const renderPositionCard = (position: RealTimePositionData) => {
    const isProfitable = position.unrealizedPnL >= 0;
    const isLong = position.side === OrderSide.BUY;
    
    // Obtener animación para esta posición
    const animatedValue = priceAnimations.get(position.id) || new Animated.Value(0);
    const highlightColor = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['rgba(255, 255, 255, 0)', isProfitable ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 68, 68, 0.2)'],
    });

    return (
      <Animated.View
        key={position.id}
        style={[styles.positionCard, { backgroundColor: highlightColor }]}
      >
        <TouchableOpacity
          style={styles.positionCardContent}
          onPress={() => onPositionPress?.(position)}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.symbolText}>{position.symbol}</Text>
            <View style={[
              styles.sideIndicator,
              { backgroundColor: isLong ? '#00ff88' : '#ff4444' }
            ]}>
              <Text style={styles.sideText}>{position.side}</Text>
            </View>
          </View>

          {/* Precio actual y cambio */}
          <View style={styles.priceSection}>
            <Text style={styles.currentPriceText}>
              ${formatPrice(position.currentPrice, position.symbol)}
            </Text>
            <Text style={[
              styles.priceChangeText,
              { color: position.priceChange >= 0 ? '#00ff88' : '#ff4444' }
            ]}>
              {position.priceChange >= 0 ? '+' : ''}${Math.abs(position.priceChange).toFixed(6)}
              {' '}({position.priceChange >= 0 ? '+' : ''}{position.priceChangePercentage.toFixed(2)}%)
            </Text>
          </View>

          {/* PnL no realizado */}
          <View style={styles.pnlSection}>
            <Text style={[
              styles.pnlAmount,
              { color: isProfitable ? '#00ff88' : '#ff4444' }
            ]}>
              {isProfitable ? '+' : ''}${formatCurrency(Math.abs(position.unrealizedPnL))}
            </Text>
            <Text style={[
              styles.pnlPercentage,
              { color: isProfitable ? '#00ff88' : '#ff4444' }
            ]}>
              {isProfitable ? '+' : ''}{formatPercentage(position.unrealizedPnLPercentage)}
            </Text>
          </View>

          {/* Detalles de la posición */}
          <View style={styles.detailsSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Inversión:</Text>
              <Text style={styles.detailValue}>${formatCurrency(position.usdtAmount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Entrada:</Text>
              <Text style={styles.detailValue}>${formatPrice(position.entryPrice, position.symbol)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cantidad:</Text>
              <Text style={styles.detailValue}>{position.quantity.toFixed(6)}</Text>
            </View>
            {position.takeProfitPrice && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>TP:</Text>
                <Text style={[styles.detailValue, { color: '#00ff88' }]}>
                  ${formatPrice(position.takeProfitPrice, position.symbol)}
                </Text>
              </View>
            )}
            {position.stopLossPrice && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SL:</Text>
                <Text style={[styles.detailValue, { color: '#ff4444' }]}>
                  ${formatPrice(position.stopLossPrice, position.symbol)}
                </Text>
              </View>
            )}
          </View>

          {/* Indicador de tiempo */}
          <View style={styles.timeSection}>
            <Text style={styles.timeText}>
              {new Date(position.createdAt).toLocaleDateString()} {new Date(position.createdAt).toLocaleTimeString()}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Botón de cerrar */}
        {onClosePosition && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              Alert.alert(
                'Cerrar Posición',
                `¿Estás seguro de que quieres cerrar ${position.symbol}?\n\nPnL actual: ${isProfitable ? '+' : ''}$${position.unrealizedPnL.toFixed(2)}`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Cerrar',
                    style: 'destructive',
                    onPress: () => onClosePosition(position.id)
                  }
                ]
              );
            }}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Cargando posiciones...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header con información */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Posiciones Activas ({positionsData.length})</Text>
        <Text style={styles.lastUpdateText}>
          Última actualización: {new Date(lastUpdateTime).toLocaleTimeString()}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#00ff88"
            colors={['#00ff88']}
          />
        }
      >
        <View style={styles.grid}>
          {renderAddPositionCard()}
          {positionsData.map(renderPositionCard)}
        </View>
        
        {positionsData.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No tienes posiciones activas{'\n'}
              Toca el botón "+" para crear una nueva posición
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#888888',
    fontSize: 16,
  },
  headerContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  lastUpdateText: {
    color: '#888888',
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  positionCard: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    position: 'relative',
    overflow: 'hidden',
  },
  positionCardContent: {
    padding: 12,
  },
  addCard: {
    backgroundColor: '#2a2a2a',
    borderStyle: 'dashed',
    borderColor: '#555555',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  addCardContent: {
    alignItems: 'center',
  },
  addCardIcon: {
    fontSize: 32,
    color: '#888888',
    marginBottom: 8,
  },
  addCardText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  sideIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sideText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  priceSection: {
    marginBottom: 8,
    alignItems: 'center',
  },
  currentPriceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  priceChangeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  pnlSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  pnlAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  pnlPercentage: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 11,
    color: '#888888',
  },
  detailValue: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '500',
  },
  timeSection: {
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 6,
  },
  timeText: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
    lineHeight: 20,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#888888',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default RealTimePositionsGrid;