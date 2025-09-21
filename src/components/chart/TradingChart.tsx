import React, { useEffect, useRef, useMemo, useState } from 'react';
import { 
  View, 
  Dimensions, 
  TouchableOpacity, 
  ScrollView, 
  Text, 
  Modal,
  Switch,
  StyleSheet,
  Pressable,
  PanResponder
} from 'react-native';
import { Svg, Rect, Line, Text as SvgText, Circle, Path } from 'react-native-svg';
import { useChartDataStore } from '../../stores/chartDataStore';
import { CandleData } from '../../types/market';
import { formatPrice, formatVolume } from '../../utils/formatters';

interface TradingChartProps {
  symbol: string;
  timeframe: string;
  height?: number;
  onOrderCreate?: (type: 'buy' | 'sell', price: number) => void;
  showIndicators?: boolean;
  showVolume?: boolean;
}

interface ChartDimensions {
  width: number;
  height: number;
  chartHeight: number;
  volumeHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
}

interface IndicatorConfig {
  sma: { enabled: boolean; periods: number[] };
  ema: { enabled: boolean; periods: number[] };
  rsi: { enabled: boolean; period: number };
  macd: { enabled: boolean };
  bollinger: { enabled: boolean; period: number; stdDev: number };
}

const COLORS = {
  candleUp: '#00ff88',
  candleDown: '#ff4757',
  wick: '#8b949e',
  volume: '#30363d',
  volumeUp: '#00ff8840',
  volumeDown: '#ff475740',
  grid: '#21262d',
  text: '#f0f6fc',
  textSecondary: '#8b949e',
  background: '#0d1117',
  indicators: {
    sma10: '#ff6b6b',
    sma20: '#4ecdc4',
    sma50: '#45b7d1',
    ema12: '#96ceb4',
    ema26: '#feca57',
    rsi: '#ff9ff3',
    macd: '#54a0ff',
    signal: '#5f27cd',
    bollinger: '#00d2d3',
  },
  priceZones: {
    above: '#00ff8820',
    below: '#ff475720',
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  priceContainer: {
    flexDirection: 'column',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  changeText: {
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  buyButton: {
    backgroundColor: COLORS.candleUp,
  },
  sellButton: {
    backgroundColor: COLORS.candleDown,
  },
  chartContainer: {
    flex: 1,
  },
  indicatorControls: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  indicatorRow: {
    flexDirection: 'row',
    gap: 16,
  },
  indicatorControl: {
    alignItems: 'center',
    gap: 4,
  },
  indicatorLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    padding: 20,
    borderRadius: 12,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  orderTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  orderTypeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 80,
  },
  orderTypeButtonActive: {
    backgroundColor: COLORS.candleUp,
  },
  orderTypeButtonInactive: {
    backgroundColor: COLORS.grid,
  },
  priceInfo: {
    color: COLORS.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.grid,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  createButton: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  candleInfo: {
    position: 'absolute',
    top: 80,
    right: 8,
    backgroundColor: COLORS.background + 'cc',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.grid,
  },
  candleInfoText: {
    fontSize: 10,
    color: COLORS.text,
    marginBottom: 2,
  },
  candleInfoLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
});

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol,
  timeframe,
  height = 400,
  onOrderCreate,
  showIndicators = true,
  showVolume = true,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const [selectedCandle, setSelectedCandle] = useState<CandleData | null>(null);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const [showOrderSheet, setShowOrderSheet] = useState(false);
  const [orderPrice, setOrderPrice] = useState(0);
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [indicatorConfig, setIndicatorConfig] = useState<IndicatorConfig>({
    sma: { enabled: true, periods: [10, 20, 50] },
    ema: { enabled: true, periods: [12, 26] },
    rsi: { enabled: false, period: 14 },
    macd: { enabled: false },
    bollinger: { enabled: false, period: 20, stdDev: 2 },
  });

  const {
    getCandles,
    getTicker,
    getIndicators,
    getPriceDirection,
  } = useChartDataStore();

  const candles = getCandles(symbol, timeframe);
  const ticker = getTicker(symbol);
  const indicators = getIndicators(symbol, timeframe);
  const priceDirection = getPriceDirection(symbol);

  // Chart dimensions calculation
  const dimensions: ChartDimensions = useMemo(() => {
    const volumeHeight = showVolume ? height * 0.2 : 0;
    const chartHeight = height - volumeHeight - 60; // 60px for timeframe controls
    
    return {
      width: screenWidth - 20,
      height,
      chartHeight,
      volumeHeight,
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 60,
      marginRight: 20,
    };
  }, [screenWidth, height, showVolume]);

  // Price and volume calculations
  const { priceRange, volumeRange, visibleCandles } = useMemo(() => {
    if (candles.length === 0) {
      return {
        priceRange: { min: 0, max: 100 },
        volumeRange: { min: 0, max: 1000 },
        visibleCandles: [],
      };
    }

    // Show last 50 candles for better performance
    const visible = candles.slice(-50);
    
    const prices = visible.flatMap(c => [c.high, c.low, c.open, c.close]);
    const volumes = visible.map(c => c.volume);
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceBuffer = (maxPrice - minPrice) * 0.1; // 10% buffer
    
    return {
      priceRange: {
        min: minPrice - priceBuffer,
        max: maxPrice + priceBuffer,
      },
      volumeRange: {
        min: 0,
        max: Math.max(...volumes) * 1.1,
      },
      visibleCandles: visible,
    };
  }, [candles]);

  // Current price for price zones
  const currentPrice = ticker?.price || (candles[candles.length - 1]?.close || 0);

  // Scale functions
  const xScale = (index: number) => {
    const chartWidth = dimensions.width - dimensions.marginLeft - dimensions.marginRight;
    return dimensions.marginLeft + (index / Math.max(visibleCandles.length - 1, 1)) * chartWidth;
  };

  const yScale = (price: number) => {
    const { min, max } = priceRange;
    const chartArea = dimensions.chartHeight - dimensions.marginTop - dimensions.marginBottom;
    return dimensions.marginTop + ((max - price) / (max - min)) * chartArea;
  };

  const volumeYScale = (volume: number) => {
    const volumeTop = dimensions.chartHeight + 10;
    return volumeTop + (1 - volume / volumeRange.max) * (dimensions.volumeHeight - 20);
  };

  // Render candlestick
  const renderCandle = (candle: CandleData, index: number) => {
    const x = xScale(index);
    const candleWidth = Math.max(2, (dimensions.width - dimensions.marginLeft - dimensions.marginRight) / visibleCandles.length * 0.8);
    
    const isUp = candle.close >= candle.open;
    const color = isUp ? COLORS.candleUp : COLORS.candleDown;
    
    const high = yScale(candle.high);
    const low = yScale(candle.low);
    const open = yScale(candle.open);
    const close = yScale(candle.close);
    
    const bodyTop = Math.min(open, close);
    const bodyHeight = Math.abs(close - open);
    
    return (
      <React.Fragment key={`candle-${index}`}>
        {/* Wick */}
        <Line
          x1={x}
          y1={high}
          x2={x}
          y2={low}
          stroke={COLORS.wick}
          strokeWidth={1}
        />
        
        {/* Body */}
        <Rect
          x={x - candleWidth / 2}
          y={bodyTop}
          width={candleWidth}
          height={Math.max(bodyHeight, 1)}
          fill={color}
          stroke={color}
          strokeWidth={1}
        />
      </React.Fragment>
    );
  };

  // Render volume bar
  const renderVolumeBar = (candle: CandleData, index: number) => {
    if (!showVolume) return null;
    
    const x = xScale(index);
    const barWidth = Math.max(1, (dimensions.width - dimensions.marginLeft - dimensions.marginRight) / visibleCandles.length * 0.6);
    
    const isUp = candle.close >= candle.open;
    const color = isUp ? COLORS.volumeUp : COLORS.volumeDown;
    
    const volumeTop = volumeYScale(candle.volume);
    const volumeBottom = dimensions.chartHeight + dimensions.volumeHeight - 10;
    const barHeight = volumeBottom - volumeTop;
    
    return (
      <Rect
        key={`volume-${index}`}
        x={x - barWidth / 2}
        y={volumeTop}
        width={barWidth}
        height={Math.max(barHeight, 1)}
        fill={color}
        stroke={color}
        strokeWidth={0.5}
      />
    );
  };

  // Render SMA lines
  const renderSMA = () => {
    if (!indicators || !indicatorConfig.sma.enabled) return null;
    
    return indicatorConfig.sma.periods.map(period => {
      const smaData = indicators.sma[period];
      if (!smaData || smaData.length === 0) return null;
      
      const color = period === 10 ? COLORS.indicators.sma10 : 
                   period === 20 ? COLORS.indicators.sma20 : COLORS.indicators.sma50;
      
      const pathData = smaData
        .map((value, i) => {
          const x = xScale(i + (visibleCandles.length - smaData.length));
          const y = yScale(value);
          return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        })
        .join(' ');
      
      return (
        <Path
          key={`sma-${period}`}
          d={pathData}
          stroke={color}
          strokeWidth={1}
          fill="none"
        />
      );
    });
  };

  // Render price zones (green above current price, red below)
  const renderPriceZones = () => {
    const currentY = yScale(currentPrice);
    const chartTop = dimensions.marginTop;
    const chartBottom = dimensions.chartHeight - dimensions.marginBottom;
    const chartLeft = dimensions.marginLeft;
    const chartRight = dimensions.width - dimensions.marginRight;
    
    return (
      <React.Fragment>
        {/* Green zone above current price */}
        <Rect
          x={chartLeft}
          y={chartTop}
          width={chartRight - chartLeft}
          height={currentY - chartTop}
          fill={COLORS.priceZones.above}
        />
        
        {/* Red zone below current price */}
        <Rect
          x={chartLeft}
          y={currentY}
          width={chartRight - chartLeft}
          height={chartBottom - currentY}
          fill={COLORS.priceZones.below}
        />
        
        {/* Current price line */}
        <Line
          x1={chartLeft}
          y1={currentY}
          x2={chartRight}
          y2={currentY}
          stroke={priceDirection === 'up' ? COLORS.candleUp : priceDirection === 'down' ? COLORS.candleDown : COLORS.text}
          strokeWidth={2}
          strokeDasharray="5,5"
        />
      </React.Fragment>
    );
  };

  // Render grid lines
  const renderGrid = () => {
    const gridLines = [];
    const priceStep = (priceRange.max - priceRange.min) / 5;
    
    // Horizontal grid lines (price levels)
    for (let i = 0; i <= 5; i++) {
      const price = priceRange.min + i * priceStep;
      const y = yScale(price);
      
      gridLines.push(
        <Line
          key={`hgrid-${i}`}
          x1={dimensions.marginLeft}
          y1={y}
          x2={dimensions.width - dimensions.marginRight}
          y2={y}
          stroke={COLORS.grid}
          strokeWidth={0.5}
        />
      );
      
      // Price label
      gridLines.push(
        <SvgText
          key={`price-label-${i}`}
          x={dimensions.marginLeft - 5}
          y={y + 4}
          fontSize="10"
          fill={COLORS.textSecondary}
          textAnchor="end"
        >
          {formatPrice(price, symbol)}
        </SvgText>
      );
    }
    
    return gridLines;
  };

  // Handle chart touch
  const handleChartTouch = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    
    // Find nearest candle
    const candleIndex = Math.round(
      ((locationX - dimensions.marginLeft) / (dimensions.width - dimensions.marginLeft - dimensions.marginRight)) * (visibleCandles.length - 1)
    );
    
    if (candleIndex >= 0 && candleIndex < visibleCandles.length) {
      setSelectedCandle(visibleCandles[candleIndex]);
      setCrosshair({ x: locationX, y: locationY });
      
      // Calculate price at touch point
      const price = priceRange.max - ((locationY - dimensions.marginTop) / (dimensions.chartHeight - dimensions.marginTop - dimensions.marginBottom)) * (priceRange.max - priceRange.min);
      setOrderPrice(price);
    }
  };

  const toggleIndicator = (indicator: keyof IndicatorConfig) => {
    setIndicatorConfig(prev => ({
      ...prev,
      [indicator]: { ...prev[indicator], enabled: !prev[indicator].enabled }
    }));
  };

  return (
    <View style={styles.container}>
      {/* Chart Header */}
      <View style={styles.header}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceText}>
            {symbol} {formatPrice(currentPrice, symbol)}
          </Text>
          <Text 
            style={[
              styles.changeText,
              { color: priceDirection === 'up' ? COLORS.candleUp : priceDirection === 'down' ? COLORS.candleDown : COLORS.textSecondary }
            ]}
          >
            {ticker?.change24h ? `${ticker.change24h > 0 ? '+' : ''}${ticker.change24h.toFixed(2)}%` : ''}
          </Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.buyButton]} 
            onPress={() => {
              setOrderType('buy');
              setShowOrderSheet(true);
            }}
          >
            <Text style={styles.buttonText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.sellButton]} 
            onPress={() => {
              setOrderType('sell');
              setShowOrderSheet(true);
            }}
          >
            <Text style={styles.buttonText}>Sell</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Chart */}
      <View 
        style={[styles.chartContainer, { height: dimensions.height }]}
        onTouchEnd={handleChartTouch}
      >
        <Svg width={dimensions.width} height={dimensions.height}>
          {/* Price zones (must be rendered first) */}
          {renderPriceZones()}
          
          {/* Grid */}
          {renderGrid()}
          
          {/* Technical indicators */}
          {renderSMA()}
          
          {/* Candles */}
          {visibleCandles.map((candle, index) => renderCandle(candle, index))}
          
          {/* Volume bars */}
          {visibleCandles.map((candle, index) => renderVolumeBar(candle, index))}
          
          {/* Crosshair */}
          {crosshair && (
            <>
              <Line
                x1={crosshair.x}
                y1={dimensions.marginTop}
                x2={crosshair.x}
                y2={dimensions.chartHeight - dimensions.marginBottom}
                stroke={COLORS.text}
                strokeWidth={1}
                opacity={0.5}
              />
              <Line
                x1={dimensions.marginLeft}
                y1={crosshair.y}
                x2={dimensions.width - dimensions.marginRight}
                y2={crosshair.y}
                stroke={COLORS.text}
                strokeWidth={1}
                opacity={0.5}
              />
              <Circle
                cx={crosshair.x}
                cy={crosshair.y}
                r={3}
                fill={COLORS.text}
              />
            </>
          )}
        </Svg>
      </View>

      {/* Indicator Controls */}
      {showIndicators && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.indicatorControls}>
          <View style={styles.indicatorRow}>
            {/* SMA Controls */}
            <View style={styles.indicatorControl}>
              <Text style={styles.indicatorLabel}>SMA</Text>
              <Switch
                value={indicatorConfig.sma.enabled}
                onValueChange={() => toggleIndicator('sma')}
              />
            </View>

            {/* EMA Controls */}
            <View style={styles.indicatorControl}>
              <Text style={styles.indicatorLabel}>EMA</Text>
              <Switch
                value={indicatorConfig.ema.enabled}
                onValueChange={() => toggleIndicator('ema')}
              />
            </View>

            {/* Bollinger Bands Controls */}
            <View style={styles.indicatorControl}>
              <Text style={styles.indicatorLabel}>BB</Text>
              <Switch
                value={indicatorConfig.bollinger.enabled}
                onValueChange={() => toggleIndicator('bollinger')}
              />
            </View>

            {/* RSI Controls */}
            <View style={styles.indicatorControl}>
              <Text style={styles.indicatorLabel}>RSI</Text>
              <Switch
                value={indicatorConfig.rsi.enabled}
                onValueChange={() => toggleIndicator('rsi')}
              />
            </View>

            {/* MACD Controls */}
            <View style={styles.indicatorControl}>
              <Text style={styles.indicatorLabel}>MACD</Text>
              <Switch
                value={indicatorConfig.macd.enabled}
                onValueChange={() => toggleIndicator('macd')}
              />
            </View>
          </View>
        </ScrollView>
      )}

      {/* Order Modal */}
      <Modal
        visible={showOrderSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOrderSheet(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Order</Text>
            
            <View style={styles.orderTypeContainer}>
              <TouchableOpacity 
                style={[
                  styles.orderTypeButton,
                  orderType === 'buy' ? styles.orderTypeButtonActive : styles.orderTypeButtonInactive
                ]}
                onPress={() => setOrderType('buy')}
              >
                <Text style={styles.buttonText}>Buy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.orderTypeButton,
                  orderType === 'sell' ? { backgroundColor: COLORS.candleDown } : styles.orderTypeButtonInactive
                ]}
                onPress={() => setOrderType('sell')}
              >
                <Text style={styles.buttonText}>Sell</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.priceInfo}>
              Price: {formatPrice(orderPrice, symbol)}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowOrderSheet(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.createButton,
                  { backgroundColor: orderType === 'buy' ? COLORS.candleUp : COLORS.candleDown }
                ]}
                onPress={() => {
                  onOrderCreate?.(orderType, orderPrice);
                  setShowOrderSheet(false);
                }}
              >
                <Text style={styles.buttonText}>Create Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Selected Candle Info */}
      {selectedCandle && (
        <View style={styles.candleInfo}>
          <Text style={styles.candleInfoLabel}>
            {new Date(selectedCandle.timestamp).toLocaleTimeString()}
          </Text>
          <Text style={styles.candleInfoText}>O: {formatPrice(selectedCandle.open, symbol)}</Text>
          <Text style={styles.candleInfoText}>H: {formatPrice(selectedCandle.high, symbol)}</Text>
          <Text style={styles.candleInfoText}>L: {formatPrice(selectedCandle.low, symbol)}</Text>
          <Text style={styles.candleInfoText}>C: {formatPrice(selectedCandle.close, symbol)}</Text>
          <Text style={styles.candleInfoText}>V: {formatVolume(selectedCandle.volume)}</Text>
        </View>
      )}
    </View>
  );
};
