import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  GestureResponderEvent,
  Text,
  TouchableOpacity,
} from 'react-native';
import { formatPrice } from '../../utils/formatters';
import { OrderSide } from '../../types/trading';

interface PositionOverlayData {
  id: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  quantity: number;
  unrealizedPnL: number;
}

interface TradingOverlayProps {
  chartDimensions: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  isVisible: boolean;
  onOverlayClick?: (event: GestureResponderEvent) => void;
  onClose?: () => void;
  symbol?: string;
  priceScale?: {
    min: number;
    max: number;
    pixelsPerPrice: number;
  };
  latestPrice?: number;
  initialTakeProfit?: number | null;
  initialStopLoss?: number | null;
  onTakeProfitChange?: (price: number | null) => void;
  onStopLossChange?: (price: number | null) => void;
  // New props for position visualization
  activePositions?: PositionOverlayData[];
  currentPositionIndex?: number;
  onPositionChange?: (index: number) => void;
  onPositionPress?: (position: PositionOverlayData) => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const TradingOverlay: React.FC<TradingOverlayProps> = ({
  chartDimensions,
  isVisible,
  onOverlayClick,
  onClose,
  symbol = 'BTCUSDT',
  priceScale,
  latestPrice,
  // Position props
  activePositions = [],
  currentPositionIndex = 0,
  onPositionChange,
  onPositionPress,
}) => {
  const height = chartDimensions.height;

  // Filter positions for current symbol
  const symbolPositions = useMemo(() => {
    return activePositions.filter(pos => pos.symbol === symbol);
  }, [activePositions, symbol]);

  // Get current position for display
  const currentPosition = useMemo(() => {
    return symbolPositions[currentPositionIndex] || null;
  }, [symbolPositions, currentPositionIndex]);

  const priceRange = useMemo(() => {
    if (!priceScale) return null;
    return priceScale.max - priceScale.min;
  }, [priceScale]);

  const priceToOffset = useCallback(
    (price: number) => {
      if (!priceScale || !priceRange || priceRange === 0) {
        return height / 2;
      }

      const clampedPrice = clamp(price, priceScale.min, priceScale.max);
      const ratio = (priceScale.max - clampedPrice) / priceRange;
      return ratio * height;
    },
    [priceScale, priceRange, height]
  );

  const latestPriceOffset = useMemo(() => {
    if (!priceScale || latestPrice === undefined || latestPrice === null) {
      return height / 2;
    }
    return priceToOffset(latestPrice);
  }, [priceScale, latestPrice, priceToOffset, height]);

  // Position navigation handlers
  const handlePreviousPosition = useCallback(() => {
    if (symbolPositions.length > 1) {
      const newIndex = currentPositionIndex > 0 ? currentPositionIndex - 1 : symbolPositions.length - 1;
      onPositionChange?.(newIndex);
    }
  }, [symbolPositions.length, currentPositionIndex, onPositionChange]);

  const handleNextPosition = useCallback(() => {
    if (symbolPositions.length > 1) {
      const newIndex = currentPositionIndex < symbolPositions.length - 1 ? currentPositionIndex + 1 : 0;
      onPositionChange?.(newIndex);
    }
  }, [symbolPositions.length, currentPositionIndex, onPositionChange]);

  // Render position lines for all positions
  const renderPositionLines = useCallback(() => {
    if (!priceScale || symbolPositions.length === 0) return null;

    return symbolPositions.map((position, index) => {
      const isCurrentPosition = index === currentPositionIndex;
      const entryOffset = priceToOffset(position.entryPrice);
      const isLong = position.side === OrderSide.BUY;
      
      // Entry price line
      const entryLine = (
        <View
          key={`entry-${position.id}`}
          style={[
            styles.horizontalLine,
            styles.positionEntryLine,
            {
              top: clamp(entryOffset, 0, height),
              borderColor: isLong ? '#00ff88' : '#ff4444',
              opacity: isCurrentPosition ? 1 : 0.6,
              borderWidth: isCurrentPosition ? 2 : 1,
            },
          ]}
        />
      );

      // Entry price label
      const entryLabel = (
        <View
          key={`entry-label-${position.id}`}
          style={[
            styles.positionLabel,
            styles.entryLabel,
            {
              top: clamp(entryOffset, 0, height) - 12,
              left: 8,
              backgroundColor: isLong ? 'rgba(0, 255, 136, 0.9)' : 'rgba(255, 68, 68, 0.9)',
              opacity: isCurrentPosition ? 1 : 0.8,
            },
          ]}
        >
          <Text style={styles.positionLabelText}>
            ENTRY: ${formatPrice(position.entryPrice, symbol)}
          </Text>
        </View>
      );

      const lines = [entryLine, entryLabel];

      // TP line if exists
      if (position.takeProfitPrice) {
        const tpOffset = priceToOffset(position.takeProfitPrice);
        lines.push(
          <View
            key={`tp-${position.id}`}
            style={[
              styles.horizontalLine,
              styles.positionTpLine,
              {
                top: clamp(tpOffset, 0, height),
                opacity: isCurrentPosition ? 1 : 0.6,
              },
            ]}
          />,
          <View
            key={`tp-label-${position.id}`}
            style={[
              styles.positionLabel,
              styles.tpLabel,
              {
                top: clamp(tpOffset, 0, height) - 12,
                left: 8,
                opacity: isCurrentPosition ? 1 : 0.8,
              },
            ]}
          >
            <Text style={styles.positionLabelText}>
              TP: ${formatPrice(position.takeProfitPrice, symbol)}
            </Text>
          </View>
        );
      }

      // SL line if exists
      if (position.stopLossPrice) {
        const slOffset = priceToOffset(position.stopLossPrice);
        lines.push(
          <View
            key={`sl-${position.id}`}
            style={[
              styles.horizontalLine,
              styles.positionSlLine,
              {
                top: clamp(slOffset, 0, height),
                opacity: isCurrentPosition ? 1 : 0.6,
              },
            ]}
          />,
          <View
            key={`sl-label-${position.id}`}
            style={[
              styles.positionLabel,
              styles.slLabel,
              {
                top: clamp(slOffset, 0, height) - 12,
                left: 8,
                opacity: isCurrentPosition ? 1 : 0.8,
              },
            ]}
          >
            <Text style={styles.positionLabelText}>
              SL: ${formatPrice(position.stopLossPrice, symbol)}
            </Text>
          </View>
        );
      }

      return lines;
    }).flat();
  }, [priceScale, symbolPositions, currentPositionIndex, priceToOffset, height, symbol]);

  if (!isVisible) {
    return null;
  }

  const handleTouchEnd = (event: GestureResponderEvent) => {
    onOverlayClick?.(event);
  };

  const hasScale = !!priceScale && latestPrice !== undefined && latestPrice !== null;

  return (
    <View
      style={[
        styles.overlay,
        {
          width: chartDimensions.width,
          height,
          left: chartDimensions.x ?? 0,
          top: chartDimensions.y ?? 0,
        },
      ]}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close Button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>

      {symbolPositions.length === 0 && (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No hay posiciones abiertas para {symbol}</Text>
        </View>
      )}

      {hasScale && symbolPositions.length > 0 && (
        <>
          {/* Current price line */}
          <View
            style={[
              styles.horizontalLine,
              styles.currentPriceLine,
              { top: clamp(latestPriceOffset, 0, height) },
            ]}
          />

          {/* Render all position lines */}
          {renderPositionLines()}
        </>
      )}

      {/* Position Navigation - Moved to bottom */}
      {symbolPositions.length > 0 && (
        <View style={styles.positionNavigationBottom}>
          <TouchableOpacity
            style={[
              styles.positionNavigationButton,
              { opacity: symbolPositions.length > 1 ? 1 : 0.3 }
            ]}
            onPress={handlePreviousPosition}
            disabled={symbolPositions.length <= 1}
          >
            <Text style={styles.positionNavigationText}>‹</Text>
          </TouchableOpacity>

          {currentPosition && (
            <TouchableOpacity
              style={styles.positionInfo}
              onPress={() => onPositionPress?.(currentPosition)}
            >
              <Text style={styles.positionInfoText}>
                {currentPosition.side} • ${formatPrice(currentPosition.entryPrice, symbol)}
              </Text>
              <Text style={[
                styles.positionPnlText,
                { color: currentPosition.unrealizedPnL >= 0 ? '#00ff88' : '#ff4444' }
              ]}>
                {currentPosition.unrealizedPnL >= 0 ? '+' : ''}${currentPosition.unrealizedPnL.toFixed(2)}
              </Text>
              <Text style={styles.positionCountText}>
                {currentPositionIndex + 1} de {symbolPositions.length}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.positionNavigationButton,
              { opacity: symbolPositions.length > 1 ? 1 : 0.3 }
            ]}
            onPress={handleNextPosition}
            disabled={symbolPositions.length <= 1}
          >
            <Text style={styles.positionNavigationText}>›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 1000,
    overflow: 'visible',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  noDataContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  noDataText: {
    color: '#ffffff',
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.7,
  },
  horizontalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  positionEntryLine: {
    borderStyle: 'solid',
  },
  positionTpLine: {
    borderStyle: 'dashed',
    borderColor: '#00ff88',
  },
  positionSlLine: {
    borderStyle: 'dashed',
    borderColor: '#ff4444',
  },
  currentPriceLine: {
    borderColor: '#ffffff',
    opacity: 0.3,
  },
  positionLabel: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1002,
  },
  entryLabel: {
    // backgroundColor set dynamically
  },
  tpLabel: {
    backgroundColor: 'rgba(0, 255, 136, 0.9)',
  },
  slLabel: {
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
  },
  positionLabelText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Position navigation styles - moved to bottom
  positionNavigationBottom: {
    position: 'absolute',
    bottom: 20,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1003,
  },
  positionNavigationButton: {
    backgroundColor: 'rgba(42, 42, 42, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444444',
  },
  positionNavigationText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  positionInfo: {
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333333',
  },
  positionInfoText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  positionPnlText: {
    fontSize: 11,
    fontWeight: '600',
  },
  positionCountText: {
    fontSize: 10,
    color: '#888888',
    marginTop: 2,
  },
});

export default TradingOverlay;