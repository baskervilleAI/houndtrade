import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { TradingOrder, OrderSide, OrderStatus } from '../../types/trading';
import { formatPrice, formatCurrency, formatPercentage } from '../../utils/formatters';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface RealTimePositionData extends TradingOrder {
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  priceChange: number;
  priceChangePercentage: number;
  isUpdating?: boolean;
}

interface PositionDetailsModalProps {
  visible: boolean;
  position: RealTimePositionData | null;
  onClose: () => void;
  onClosePosition?: (positionId: string) => void;
  onGoToChart?: (symbol: string, position: RealTimePositionData) => void;
  getCurrentPrice?: (symbol: string) => number | null;
}

export const PositionDetailsModal: React.FC<PositionDetailsModalProps> = ({
  visible,
  position,
  onClose,
  onClosePosition,
  onGoToChart,
  getCurrentPrice,
}) => {
  const [currentPosition, setCurrentPosition] = useState<RealTimePositionData | null>(position);

  // Update position data when price changes
  useEffect(() => {
    if (!position || !getCurrentPrice) {
      setCurrentPosition(position);
      return;
    }

    const updateInterval = setInterval(() => {
      const latestPrice = getCurrentPrice(position.symbol);
      if (latestPrice && latestPrice !== currentPosition?.currentPrice) {
        // Calculate updated PnL
        let unrealizedPnL = 0;
        if (position.side === OrderSide.BUY) {
          unrealizedPnL = (latestPrice - position.entryPrice) * position.quantity;
        } else {
          unrealizedPnL = (position.entryPrice - latestPrice) * position.quantity;
        }
        
        const unrealizedPnLPercentage = (unrealizedPnL / position.usdtAmount) * 100;
        const priceChange = latestPrice - position.entryPrice;
        const priceChangePercentage = (priceChange / position.entryPrice) * 100;

        setCurrentPosition({
          ...position,
          currentPrice: latestPrice,
          unrealizedPnL,
          unrealizedPnLPercentage,
          priceChange,
          priceChangePercentage,
        });
      }
    }, 1000); // Update every second

    return () => clearInterval(updateInterval);
  }, [position, getCurrentPrice, currentPosition?.currentPrice]);

  // Reset when position changes
  useEffect(() => {
    setCurrentPosition(position);
  }, [position]);

  if (!currentPosition) {
    return null;
  }

  // Validar y asegurar que todos los campos numéricos existan
  const safeCurrentPosition = {
    ...currentPosition,
    currentPrice: currentPosition.currentPrice || currentPosition.entryPrice || 0,
    unrealizedPnL: currentPosition.unrealizedPnL || 0,
    unrealizedPnLPercentage: currentPosition.unrealizedPnLPercentage || 0,
    priceChange: currentPosition.priceChange || 0,
    priceChangePercentage: currentPosition.priceChangePercentage || 0,
    quantity: currentPosition.quantity || 0,
    entryPrice: currentPosition.entryPrice || 0,
    usdtAmount: currentPosition.usdtAmount || 0,
  };

  const isProfitable = safeCurrentPosition.unrealizedPnL >= 0;
  const isLong = safeCurrentPosition.side === OrderSide.BUY;

  const handleClosePosition = () => {
    Alert.alert(
      'Cerrar Posición',
      `¿Estás seguro de que quieres cerrar la posición en ${safeCurrentPosition.symbol}?\n\nPnL actual: ${isProfitable ? '+' : ''}$${formatCurrency(Math.abs(safeCurrentPosition.unrealizedPnL))}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Posición',
          style: 'destructive',
          onPress: () => {
            onClosePosition?.(safeCurrentPosition.id);
            onClose();
          }
        }
      ]
    );
  };

  const handleGoToChart = () => {
    onGoToChart?.(safeCurrentPosition.symbol, safeCurrentPosition);
    onClose();
  };

  const profitLossPercentage = ((safeCurrentPosition.currentPrice - safeCurrentPosition.entryPrice) / safeCurrentPosition.entryPrice) * 100;
  const timeHeld = new Date().getTime() - safeCurrentPosition.createdAt;
  const hoursHeld = Math.floor(timeHeld / (1000 * 60 * 60));
  const minutesHeld = Math.floor((timeHeld % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalles de Posición</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Symbol and Side */}
          <View style={styles.symbolSection}>
            <View style={styles.symbolHeader}>
              <Text style={styles.symbolText}>{safeCurrentPosition.symbol}</Text>
              <View style={[
                styles.sideIndicator,
                { backgroundColor: isLong ? '#00ff88' : '#ff4444' }
              ]}>
                <Text style={styles.sideText}>{safeCurrentPosition.side}</Text>
              </View>
            </View>
            <Text style={styles.symbolSubtext}>
              {isLong ? 'Posición Larga' : 'Posición Corta'}
            </Text>
          </View>

          {/* Current Price and PnL */}
          <View style={styles.priceSection}>
            <View style={styles.currentPriceContainer}>
              <Text style={styles.currentPriceLabel}>Precio Actual</Text>
              <Text style={styles.currentPriceValue}>
                ${formatPrice(safeCurrentPosition.currentPrice, safeCurrentPosition.symbol)}
              </Text>
            </View>
            
            <View style={styles.pnlContainer}>
              <Text style={[
                styles.pnlAmount,
                { color: isProfitable ? '#00ff88' : '#ff4444' }
              ]}>
                {isProfitable ? '+' : ''}${formatCurrency(Math.abs(safeCurrentPosition.unrealizedPnL))}
              </Text>
              <Text style={[
                styles.pnlPercentage,
                { color: isProfitable ? '#00ff88' : '#ff4444' }
              ]}>
                {isProfitable ? '+' : ''}{formatPercentage(safeCurrentPosition.unrealizedPnLPercentage)}
              </Text>
            </View>
          </View>

          {/* Position Details */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Información de la Posición</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Precio de Entrada:</Text>
              <Text style={styles.detailValue}>
                ${formatPrice(safeCurrentPosition.entryPrice, safeCurrentPosition.symbol)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cantidad:</Text>
              <Text style={styles.detailValue}>
                {(safeCurrentPosition.quantity || 0).toFixed(6)} {safeCurrentPosition.symbol.replace('USDT', '')}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Inversión Total:</Text>
              <Text style={styles.detailValue}>
                ${formatCurrency(safeCurrentPosition.usdtAmount)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Valor Actual:</Text>
              <Text style={styles.detailValue}>
                ${formatCurrency(safeCurrentPosition.quantity * safeCurrentPosition.currentPrice)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cambio de Precio:</Text>
              <Text style={[
                styles.detailValue,
                { color: (safeCurrentPosition.priceChange || 0) >= 0 ? '#00ff88' : '#ff4444' }
              ]}>
                {(safeCurrentPosition.priceChange || 0) >= 0 ? '+' : ''}${Math.abs(safeCurrentPosition.priceChange || 0).toFixed(6)}
                {' '}({(safeCurrentPosition.priceChange || 0) >= 0 ? '+' : ''}{(safeCurrentPosition.priceChangePercentage || 0).toFixed(2)}%)
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tiempo en Posición:</Text>
              <Text style={styles.detailValue}>
                {hoursHeld}h {minutesHeld}m
              </Text>
            </View>
          </View>

          {/* TP/SL Section */}
          {(safeCurrentPosition.takeProfitPrice || safeCurrentPosition.stopLossPrice) && (
            <View style={styles.tpslSection}>
              <Text style={styles.sectionTitle}>Take Profit / Stop Loss</Text>
              
              {safeCurrentPosition.takeProfitPrice && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Take Profit:</Text>
                  <Text style={[styles.detailValue, { color: '#00ff88' }]}>
                    ${formatPrice(safeCurrentPosition.takeProfitPrice, safeCurrentPosition.symbol)}
                  </Text>
                </View>
              )}

              {safeCurrentPosition.stopLossPrice && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Stop Loss:</Text>
                  <Text style={[styles.detailValue, { color: '#ff4444' }]}>
                    ${formatPrice(safeCurrentPosition.stopLossPrice, safeCurrentPosition.symbol)}
                  </Text>
                </View>
              )}

              {safeCurrentPosition.takeProfitUSDT && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>TP en USDT:</Text>
                  <Text style={[styles.detailValue, { color: '#00ff88' }]}>
                    +${formatCurrency(safeCurrentPosition.takeProfitUSDT)}
                  </Text>
                </View>
              )}

              {safeCurrentPosition.stopLossUSDT && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>SL en USDT:</Text>
                  <Text style={[styles.detailValue, { color: '#ff4444' }]}>
                    -${formatCurrency(safeCurrentPosition.stopLossUSDT)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Order Info */}
          <View style={styles.orderInfoSection}>
            <Text style={styles.sectionTitle}>Información de la Orden</Text>
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>ID de Orden:</Text>
              <Text style={[styles.detailValue, styles.orderIdText]}>
                {safeCurrentPosition.id.substring(0, 12)}...
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fecha de Apertura:</Text>
              <Text style={styles.detailValue}>
                {new Date(safeCurrentPosition.createdAt).toLocaleDateString()} {new Date(safeCurrentPosition.createdAt).toLocaleTimeString()}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estado:</Text>
              <Text style={[styles.detailValue, { color: '#00ff88' }]}>
                {safeCurrentPosition.status === OrderStatus.ACTIVE ? 'Activa' : safeCurrentPosition.status}
              </Text>
            </View>

            {safeCurrentPosition.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.detailLabel}>Notas:</Text>
                <Text style={styles.notesText}>{safeCurrentPosition.notes}</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.goToChartButton}
            onPress={handleGoToChart}
          >
            <Text style={styles.goToChartButtonText}>📊 Ir al Gráfico</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closePositionButton}
            onPress={handleClosePosition}
          >
            <Text style={styles.closePositionButtonText}>Cerrar Posición</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#1a1a1a',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  symbolSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  symbolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  symbolText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginRight: 12,
  },
  sideIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sideText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  symbolSubtext: {
    fontSize: 16,
    color: '#888888',
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  currentPriceContainer: {
    alignItems: 'center',
  },
  currentPriceLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 4,
  },
  currentPriceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  pnlContainer: {
    alignItems: 'center',
  },
  pnlAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  pnlPercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailsSection: {
    marginBottom: 24,
  },
  tpslSection: {
    marginBottom: 24,
  },
  orderInfoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  detailLabel: {
    fontSize: 14,
    color: '#888888',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  orderIdText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  notesContainer: {
    marginTop: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  goToChartButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  goToChartButtonText: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closePositionButton: {
    flex: 1,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  closePositionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});