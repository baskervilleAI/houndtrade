import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet,
  Alert 
} from 'react-native';
import { useTradingStore } from '../../stores/tradingStore';
import { useChartDataStore } from '../../stores/chartDataStore';
import { formatPrice, formatVolume, formatPercentage } from '../../utils/formatters';

interface OrderPanelProps {
  symbol: string;
  currentPrice: number;
  onOrderSubmit?: (order: any) => void;
}

interface Order {
  id: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'filled' | 'cancelled';
  timestamp: string;
}

interface Position {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

const COLORS = {
  background: '#0d1117',
  surface: '#161b22',
  surfaceHover: '#21262d',
  border: '#30363d',
  text: '#f0f6fc',
  textSecondary: '#8b949e',
  textMuted: '#6e7681',
  success: '#00ff88',
  danger: '#ff4757',
  warning: '#feca57',
  buy: '#00ff88',
  sell: '#ff4757',
  active: '#0969da',
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: COLORS.active,
  },
  inactiveTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  
  // Order Form Styles
  orderForm: {
    padding: 16,
    backgroundColor: COLORS.surface,
    margin: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderTypeRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  orderTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
  },
  activeOrderType: {
    backgroundColor: COLORS.buy,
    borderColor: COLORS.buy,
  },
  inactiveOrderType: {
    backgroundColor: 'transparent',
    borderColor: COLORS.border,
  },
  sideButtons: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  sideButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buyButton: {
    backgroundColor: COLORS.buy,
  },
  sellButton: {
    backgroundColor: COLORS.sell,
  },
  
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: 14,
  },
  
  percentageButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 4,
  },
  percentageButton: {
    flex: 1,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceHover,
  },
  percentageButtonText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  
  orderSummary: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 12,
    color: COLORS.text,
  },
  
  submitButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  
  // Positions Styles
  positionsList: {
    padding: 12,
  },
  positionCard: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  positionSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  positionSide: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  longSide: {
    backgroundColor: COLORS.success + '20',
    color: COLORS.success,
  },
  shortSide: {
    backgroundColor: COLORS.danger + '20',
    color: COLORS.danger,
  },
  positionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  positionColumn: {
    flex: 1,
  },
  positionLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  positionValue: {
    fontSize: 12,
    color: COLORS.text,
  },
  pnlValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Orders Styles
  ordersList: {
    padding: 12,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderStatus: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  pendingStatus: {
    backgroundColor: COLORS.warning + '20',
    color: COLORS.warning,
  },
  filledStatus: {
    backgroundColor: COLORS.success + '20',
    color: COLORS.success,
  },
  cancelledStatus: {
    backgroundColor: COLORS.danger + '20',
    color: COLORS.danger,
  },
  
  cancelButton: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cancelButtonText: {
    fontSize: 10,
    color: COLORS.text,
  },
  
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export const OrderPanel: React.FC<OrderPanelProps> = ({
  symbol,
  currentPrice,
  onOrderSubmit,
}) => {
  const [activeTab, setActiveTab] = useState<'order' | 'positions' | 'orders'>('order');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState(currentPrice.toString());
  const [stopPrice, setStopPrice] = useState('');
  
  // Mock data - in real app this would come from stores
  const [orders, setOrders] = useState<Order[]>([
    {
      id: '1',
      symbol: 'BTCUSDT',
      type: 'limit',
      side: 'buy',
      amount: 0.01,
      price: 114000,
      status: 'pending',
      timestamp: new Date().toISOString(),
    },
    {
      id: '2',
      symbol: 'BTCUSDT',
      type: 'market',
      side: 'sell',
      amount: 0.005,
      status: 'filled',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
  ]);
  
  const [positions, setPositions] = useState<Position[]>([
    {
      symbol: 'BTCUSDT',
      side: 'long',
      size: 0.015,
      entryPrice: 114500,
      currentPrice: currentPrice,
      unrealizedPnL: (currentPrice - 114500) * 0.015,
      unrealizedPnLPercent: ((currentPrice - 114500) / 114500) * 100,
    },
  ]);

  const { balance } = useTradingStore();

  const addTrade = (trade: any) => {
    // Mock implementation - in real app this would be in the store
    console.log('Trade added:', trade);
  };

  const handleAmountPercentage = (percentage: number) => {
    const availableBalance = side === 'buy' ? balance / currentPrice : balance; // Simplified
    const calculatedAmount = (availableBalance * percentage / 100).toFixed(6);
    setAmount(calculatedAmount);
  };

  const handleSubmitOrder = useCallback(() => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (orderType !== 'market' && (!price || parseFloat(price) <= 0)) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    const newOrder: Order = {
      id: Date.now().toString(),
      symbol,
      type: orderType,
      side,
      amount: parseFloat(amount),
      price: orderType !== 'market' ? parseFloat(price) : undefined,
      stopPrice: orderType === 'stop' ? parseFloat(stopPrice) : undefined,
      status: orderType === 'market' ? 'filled' : 'pending',
      timestamp: new Date().toISOString(),
    };

    setOrders(prev => [newOrder, ...prev]);

    // If market order, also create position
    if (orderType === 'market') {
      const orderPrice = currentPrice;
      const orderAmount = parseFloat(amount);
      
      // Add to trading store
      addTrade({
        symbol,
        side,
        amount: orderAmount,
        price: orderPrice,
        timestamp: new Date().toISOString(),
      });

      // Update positions
      setPositions(prev => {
        const existingPosition = prev.find(p => p.symbol === symbol);
        const positionSide = side === 'buy' ? 'long' : 'short';
        
        if (existingPosition) {
          // Update existing position
          const newSize = positionSide === existingPosition.side 
            ? existingPosition.size + orderAmount
            : existingPosition.size - orderAmount;
            
          if (newSize <= 0) {
            // Position closed
            return prev.filter(p => p.symbol !== symbol);
          } else {
            // Update position
            return prev.map(p => p.symbol === symbol 
              ? {
                  ...p,
                  size: newSize,
                  entryPrice: positionSide === p.side 
                    ? (p.entryPrice * p.size + orderPrice * orderAmount) / (p.size + orderAmount)
                    : p.entryPrice,
                }
              : p
            );
          }
        } else {
          // New position
          return [...prev, {
            symbol,
            side: positionSide,
            size: orderAmount,
            entryPrice: orderPrice,
            currentPrice,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
          }];
        }
      });
    }

    // Reset form
    setAmount('');
    setPrice(currentPrice.toString());
    setStopPrice('');

    onOrderSubmit?.(newOrder);
    
    Alert.alert('Success', `${side.toUpperCase()} order submitted successfully!`);
  }, [symbol, orderType, side, amount, price, stopPrice, currentPrice, addTrade, onOrderSubmit]);

  const handleCancelOrder = (orderId: string) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { ...order, status: 'cancelled' as const }
        : order
    ));
  };

  const renderOrderForm = () => (
    <View style={styles.orderForm}>
      {/* Order Type Selection */}
      <View style={styles.orderTypeRow}>
        {(['market', 'limit', 'stop'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.orderTypeButton,
              orderType === type ? styles.activeOrderType : styles.inactiveOrderType,
            ]}
            onPress={() => setOrderType(type)}
          >
            <Text style={styles.tabText}>{type.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Buy/Sell Buttons */}
      <View style={styles.sideButtons}>
        <TouchableOpacity
          style={[styles.sideButton, styles.buyButton]}
          onPress={() => setSide('buy')}
        >
          <Text style={[styles.submitButtonText, { opacity: side === 'buy' ? 1 : 0.6 }]}>
            BUY {symbol}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sideButton, styles.sellButton]}
          onPress={() => setSide('sell')}
        >
          <Text style={[styles.submitButtonText, { opacity: side === 'sell' ? 1 : 0.6 }]}>
            SELL {symbol}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Amount Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
        />
        <View style={styles.percentageButtons}>
          {[25, 50, 75, 100].map(percentage => (
            <TouchableOpacity
              key={percentage}
              style={styles.percentageButton}
              onPress={() => handleAmountPercentage(percentage)}
            >
              <Text style={styles.percentageButtonText}>{percentage}%</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Price Input (for limit and stop orders) */}
      {orderType !== 'market' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Price</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder={formatPrice(currentPrice, symbol)}
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
          />
        </View>
      )}

      {/* Stop Price Input (for stop orders) */}
      {orderType === 'stop' && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Stop Price</Text>
          <TextInput
            style={styles.input}
            value={stopPrice}
            onChangeText={setStopPrice}
            placeholder={formatPrice(currentPrice, symbol)}
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
          />
        </View>
      )}

      {/* Order Summary */}
      <View style={styles.orderSummary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Value</Text>
          <Text style={styles.summaryValue}>
            {amount && price ? 
              formatPrice(parseFloat(amount) * parseFloat(price), 'USDT') + ' USDT' : 
              '0.00 USDT'
            }
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Fee (0.1%)</Text>
          <Text style={styles.summaryValue}>
            {amount && price ? 
              formatPrice(parseFloat(amount) * parseFloat(price) * 0.001, 'USDT') + ' USDT' : 
              '0.00 USDT'
            }
          </Text>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: side === 'buy' ? COLORS.buy : COLORS.sell }
        ]}
        onPress={handleSubmitOrder}
      >
        <Text style={styles.submitButtonText}>
          {side.toUpperCase()} {symbol}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPositions = () => (
    <ScrollView style={styles.positionsList}>
      {positions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No open positions</Text>
        </View>
      ) : (
        positions.map((position, index) => (
          <View key={index} style={styles.positionCard}>
            <View style={styles.positionHeader}>
              <Text style={styles.positionSymbol}>{position.symbol}</Text>
              <Text style={[
                styles.positionSide,
                position.side === 'long' ? styles.longSide : styles.shortSide
              ]}>
                {position.side.toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.positionDetails}>
              <View style={styles.positionColumn}>
                <Text style={styles.positionLabel}>Size</Text>
                <Text style={styles.positionValue}>{position.size}</Text>
              </View>
              <View style={styles.positionColumn}>
                <Text style={styles.positionLabel}>Entry</Text>
                <Text style={styles.positionValue}>
                  {formatPrice(position.entryPrice, symbol)}
                </Text>
              </View>
              <View style={styles.positionColumn}>
                <Text style={styles.positionLabel}>Mark</Text>
                <Text style={styles.positionValue}>
                  {formatPrice(position.currentPrice, symbol)}
                </Text>
              </View>
              <View style={styles.positionColumn}>
                <Text style={styles.positionLabel}>PnL</Text>
                <Text style={[
                  styles.pnlValue,
                  { color: position.unrealizedPnL >= 0 ? COLORS.success : COLORS.danger }
                ]}>
                  {position.unrealizedPnL >= 0 ? '+' : ''}{formatPrice(position.unrealizedPnL, 'USDT')}
                </Text>
                <Text style={[
                  styles.pnlValue,
                  { color: position.unrealizedPnL >= 0 ? COLORS.success : COLORS.danger, fontSize: 10 }
                ]}>
                  ({position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%)
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderOrders = () => (
    <ScrollView style={styles.ordersList}>
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No orders</Text>
        </View>
      ) : (
        orders.map((order) => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.positionSymbol}>
                  {order.symbol} - {order.side.toUpperCase()} {order.type.toUpperCase()}
                </Text>
                <Text style={styles.positionLabel}>
                  {new Date(order.timestamp).toLocaleString()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[
                  styles.orderStatus,
                  order.status === 'pending' ? styles.pendingStatus :
                  order.status === 'filled' ? styles.filledStatus : styles.cancelledStatus
                ]}>
                  {order.status.toUpperCase()}
                </Text>
                {order.status === 'pending' && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => handleCancelOrder(order.id)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            <View style={styles.orderInfo}>
              <View style={styles.positionColumn}>
                <Text style={styles.positionLabel}>Amount</Text>
                <Text style={styles.positionValue}>{order.amount}</Text>
              </View>
              {order.price && (
                <View style={styles.positionColumn}>
                  <Text style={styles.positionLabel}>Price</Text>
                  <Text style={styles.positionValue}>
                    {formatPrice(order.price, symbol)}
                  </Text>
                </View>
              )}
              <View style={styles.positionColumn}>
                <Text style={styles.positionLabel}>Total</Text>
                <Text style={styles.positionValue}>
                  {formatPrice(order.amount * (order.price || currentPrice), 'USDT')} USDT
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {(['order', 'positions', 'orders'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab ? styles.activeTab : styles.inactiveTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={styles.tabText}>
              {tab === 'order' ? 'ORDER' : tab === 'positions' ? 'POSITIONS' : 'ORDERS'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'order' && renderOrderForm()}
      {activeTab === 'positions' && renderPositions()}
      {activeTab === 'orders' && renderOrders()}
    </View>
  );
};
