import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { formatPrice, formatPercentage, formatCurrency } from '../../utils/formatters';

const { width: screenWidth } = Dimensions.get('window');

interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl: number;
  pnlPercentage: number;
  usdtAmount: number;
  timestamp: number;
}

interface PositionsGridProps {
  positions: Position[];
  onAddPosition?: () => void;
  onPositionPress?: (position: Position) => void;
  onClosePosition?: (positionId: string) => void;
}

export const PositionsGrid: React.FC<PositionsGridProps> = ({
  positions,
  onAddPosition,
  onPositionPress,
  onClosePosition,
}) => {
  // Calculate grid dimensions based on screen width
  const cardWidth = screenWidth > 768 ? (screenWidth - 60) / 3 : (screenWidth - 48) / 2;
  const cardHeight = 140;

  const renderAddPositionCard = () => (
    <TouchableOpacity
      key="add-position"
      style={[styles.positionCard, styles.addCard, { width: cardWidth, height: cardHeight }]}
      onPress={onAddPosition}
    >
      <View style={styles.addCardContent}>
        <Text style={styles.addCardIcon}>+</Text>
        <Text style={styles.addCardText}>Nueva{'\n'}Posición</Text>
      </View>
    </TouchableOpacity>
  );

  const renderPositionCard = (position: Position) => {
    const isProfitable = position.pnl >= 0;
    const isLong = position.side === 'BUY';

    return (
      <TouchableOpacity
        key={position.id}
        style={[styles.positionCard, { width: cardWidth, height: cardHeight }]}
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

        {/* PnL */}
        <View style={styles.pnlSection}>
          <Text style={[
            styles.pnlAmount,
            { color: isProfitable ? '#00ff88' : '#ff4444' }
          ]}>
            {isProfitable ? '+' : ''}${formatCurrency(Math.abs(position.pnl))}
          </Text>
          <Text style={[
            styles.pnlPercentage,
            { color: isProfitable ? '#00ff88' : '#ff4444' }
          ]}>
            {isProfitable ? '+' : ''}{formatPercentage(position.pnlPercentage)}
          </Text>
        </View>

        {/* Position details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Cantidad:</Text>
            <Text style={styles.detailValue}>${formatCurrency(position.usdtAmount)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Entrada:</Text>
            <Text style={styles.detailValue}>${formatPrice(position.entryPrice, position.symbol)}</Text>
          </View>
          {position.takeProfit && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>TP:</Text>
              <Text style={[styles.detailValue, { color: '#00ff88' }]}>
                ${formatPrice(position.takeProfit, position.symbol)}
              </Text>
            </View>
          )}
          {position.stopLoss && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>SL:</Text>
              <Text style={[styles.detailValue, { color: '#ff4444' }]}>
                ${formatPrice(position.stopLoss, position.symbol)}
              </Text>
            </View>
          )}
        </View>

        {/* Close button */}
        {onClosePosition && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => onClosePosition(position.id)}
          >
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const allCards = [renderAddPositionCard(), ...positions.map(renderPositionCard)];

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.grid}>
        {allCards}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  positionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    position: 'relative',
  },
  addCard: {
    backgroundColor: '#2a2a2a',
    borderStyle: 'dashed',
    borderColor: '#555555',
    justifyContent: 'center',
    alignItems: 'center',
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
  pnlSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  pnlAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pnlPercentage: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    flex: 1,
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
  closeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});