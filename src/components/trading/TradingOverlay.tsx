import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  GestureResponderEvent,
  Text,
  PanResponder,
  PanResponderInstance,
} from 'react-native';
import { formatPrice } from '../../utils/formatters';

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
}

const PRICE_AXIS_OFFSET = 68;
const SLIDER_RAIL_WIDTH = 48;
const HANDLE_SIZE = 44;
const HANDLE_RADIUS = HANDLE_SIZE / 2;
const EDGE_THRESHOLD = 12;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const TradingOverlay: React.FC<TradingOverlayProps> = ({
  chartDimensions,
  isVisible,
  onOverlayClick,
  symbol = 'BTCUSDT',
  priceScale,
  latestPrice,
  initialTakeProfit = null,
  initialStopLoss = null,
  onTakeProfitChange,
  onStopLossChange,
}) => {
  const [tpHandleY, setTpHandleY] = useState(0);
  const [slHandleY, setSlHandleY] = useState(chartDimensions.height);
  const tpHandleRef = useRef(tpHandleY);
  const slHandleRef = useRef(slHandleY);
  const tpStartRef = useRef(0);
  const slStartRef = useRef(0);
  const tpPanResponderRef = useRef<PanResponderInstance | null>(null);
  const slPanResponderRef = useRef<PanResponderInstance | null>(null);
  const previousTpPrice = useRef<number | null>(null);
  const previousSlPrice = useRef<number | null>(null);

  const height = chartDimensions.height;

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

  const offsetToPrice = useCallback(
    (offset: number) => {
      if (!priceScale || !priceRange || priceRange === 0) {
        return null;
      }

      const ratio = clamp(offset / height, 0, 1);
      const price = priceScale.max - ratio * priceRange;
      return clamp(price, priceScale.min, priceScale.max);
    },
    [priceScale, priceRange, height]
  );

  const latestPriceOffset = useMemo(() => {
    if (!priceScale || latestPrice === undefined || latestPrice === null) {
      return height / 2;
    }
    return priceToOffset(latestPrice);
  }, [priceScale, latestPrice, priceToOffset, height]);

  const tpActivePrice = useMemo(() => {
    if (!priceScale) return null;
    if (tpHandleY <= EDGE_THRESHOLD) return null;

    const price = offsetToPrice(tpHandleY);
    if (price === null) return null;
    if (latestPrice !== undefined && latestPrice !== null) {
      return Math.max(price, latestPrice);
    }
    return price;
  }, [tpHandleY, priceScale, offsetToPrice, latestPrice]);

  const slActivePrice = useMemo(() => {
    if (!priceScale) return null;
    if (height - slHandleY <= EDGE_THRESHOLD) return null;

    const price = offsetToPrice(slHandleY);
    if (price === null) return null;
    if (latestPrice !== undefined && latestPrice !== null) {
      return Math.min(price, latestPrice);
    }
    return price;
  }, [slHandleY, priceScale, offsetToPrice, latestPrice, height]);

  useEffect(() => {
    tpHandleRef.current = tpHandleY;
  }, [tpHandleY]);

  useEffect(() => {
    slHandleRef.current = slHandleY;
  }, [slHandleY]);

  useEffect(() => {
    if (!priceScale || latestPrice === undefined || latestPrice === null) {
      return;
    }

    const lastPriceOffset = priceToOffset(latestPrice);

    if (initialTakeProfit !== null && initialTakeProfit !== undefined) {
      const tpOffset = clamp(priceToOffset(initialTakeProfit), 0, lastPriceOffset);
      setTpHandleY(tpOffset);
    } else {
      setTpHandleY(0);
    }

    if (initialStopLoss !== null && initialStopLoss !== undefined) {
      const slOffset = clamp(priceToOffset(initialStopLoss), lastPriceOffset, height);
      setSlHandleY(slOffset);
    } else {
      setSlHandleY(height);
    }
  }, [
    priceScale,
    latestPrice,
    initialTakeProfit,
    initialStopLoss,
    priceToOffset,
    height,
  ]);

  useEffect(() => {
    if (tpActivePrice !== previousTpPrice.current) {
      previousTpPrice.current = tpActivePrice ?? null;
      onTakeProfitChange?.(tpActivePrice ?? null);
    }
  }, [tpActivePrice, onTakeProfitChange]);

  useEffect(() => {
    if (slActivePrice !== previousSlPrice.current) {
      previousSlPrice.current = slActivePrice ?? null;
      onStopLossChange?.(slActivePrice ?? null);
    }
  }, [slActivePrice, onStopLossChange]);

  const createTpPanResponder = useCallback((): PanResponderInstance =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        tpStartRef.current = tpHandleRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const maxY = latestPriceOffset;
        const next = clamp(tpStartRef.current + gestureState.dy, 0, maxY);
        setTpHandleY(next);
      },
      onPanResponderRelease: (_, gestureState) => {
        const maxY = latestPriceOffset;
        const next = clamp(tpStartRef.current + gestureState.dy, 0, maxY);
        setTpHandleY(next);
      },
    }), [latestPriceOffset]);

  const createSlPanResponder = useCallback((): PanResponderInstance =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        slStartRef.current = slHandleRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const minY = latestPriceOffset;
        const next = clamp(slStartRef.current + gestureState.dy, minY, height);
        setSlHandleY(next);
      },
      onPanResponderRelease: (_, gestureState) => {
        const minY = latestPriceOffset;
        const next = clamp(slStartRef.current + gestureState.dy, minY, height);
        setSlHandleY(next);
      },
    }), [latestPriceOffset, height]);

  useEffect(() => {
    tpPanResponderRef.current = createTpPanResponder();
  }, [createTpPanResponder]);

  useEffect(() => {
    slPanResponderRef.current = createSlPanResponder();
  }, [createSlPanResponder]);

  if (!isVisible) {
    return null;
  }

  const handleTouchEnd = (event: GestureResponderEvent) => {
    onOverlayClick?.(event);
  };

  const hasScale = !!priceScale && latestPrice !== undefined && latestPrice !== null;
  const formattedTp = tpActivePrice ? formatPrice(tpActivePrice, symbol) : '∞';
  const formattedSl = slActivePrice ? formatPrice(slActivePrice, symbol) : '0.00';
  const tpHandlers = tpPanResponderRef.current?.panHandlers ?? {};
  const slHandlers = slPanResponderRef.current?.panHandlers ?? {};

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
      {!hasScale && (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>Sin datos de precio para configurar TP/SL</Text>
        </View>
      )}

      {hasScale && (
        <>
          {tpActivePrice && (
            <View
              style={[
                styles.horizontalLine,
                styles.tpLine,
                { top: clamp(tpHandleY, 0, height) },
              ]}
            />
          )}

          {slActivePrice && (
            <View
              style={[
                styles.horizontalLine,
                styles.slLine,
                { top: clamp(slHandleY, 0, height) },
              ]}
            />
          )}

          <View
            style={[
              styles.horizontalLine,
              styles.currentPriceLine,
              { top: clamp(latestPriceOffset, 0, height) },
            ]}
          />

          <View
            style={[
              styles.sliderRail,
              {
                height,
                right: -PRICE_AXIS_OFFSET,
              },
            ]}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.sliderTrack,
                styles.tpTrack,
                { height: clamp(latestPriceOffset, 0, height) },
              ]}
            />
            <View
              style={[
                styles.sliderTrack,
                styles.slTrack,
                {
                  top: clamp(latestPriceOffset, 0, height),
                  height: clamp(height - latestPriceOffset, 0, height),
                },
              ]}
            />

            <View
              style={[
                styles.sliderHandle,
                styles.tpHandle,
                {
                  transform: [
                    {
                      translateY: clamp(tpHandleY, 0, latestPriceOffset) - HANDLE_RADIUS,
                    },
                  ],
                },
              ]}
              {...tpHandlers}
            >
              <Text style={styles.handleLabel}>TP</Text>
              <Text style={styles.handleValue}>{formattedTp}</Text>
            </View>

            <View
              style={[
                styles.sliderHandle,
                styles.slHandle,
                {
                  transform: [
                    {
                      translateY:
                        clamp(slHandleY, latestPriceOffset, height) - HANDLE_RADIUS,
                    },
                  ],
                },
              ]}
              {...slHandlers}
            >
              <Text style={styles.handleLabel}>SL</Text>
              <Text style={styles.handleValue}>{formattedSl}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: '#00ff88',
    borderRadius: 8,
    zIndex: 1000,
    overflow: 'visible',
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
  tpLine: {
    borderStyle: 'dashed',
    borderColor: '#00ff88',
  },
  slLine: {
    borderStyle: 'dashed',
    borderColor: '#ff5c5c',
  },
  currentPriceLine: {
    borderColor: '#ffffff',
    opacity: 0.3,
  },
  sliderRail: {
    position: 'absolute',
    width: SLIDER_RAIL_WIDTH,
    alignItems: 'center',
  },
  sliderTrack: {
    position: 'absolute',
    width: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    left: (SLIDER_RAIL_WIDTH - 8) / 2,
  },
  tpTrack: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
  },
  slTrack: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
  },
  sliderHandle: {
    position: 'absolute',
    top: 0,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
  },
  tpHandle: {
    backgroundColor: '#00ff8820',
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  slHandle: {
    backgroundColor: '#ff444420',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  handleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  handleValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default TradingOverlay;