import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  TradingState, 
  Order, 
  Position, 
  PlaceOrderRequest,
  OrderType,
  OrderSide 
} from '../types/trading';
import { config } from '../config/env';

interface TradingStore extends TradingState {
  // Actions
  placeOrder: (orderData: PlaceOrderRequest) => Promise<string>;
  cancelOrder: (orderId: string) => Promise<void>;
  updatePositions: (prices: Record<string, number>) => void;
  resetAccount: () => void;
  setBalance: (balance: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed values
  getPositionBySymbol: (symbol: string) => Position | undefined;
  getOpenOrdersBySymbol: (symbol: string) => Order[];
  getTotalUnrealizedPnL: () => number;
  getTotalRealizedPnL: () => number;
}

const generateOrderId = (): string => {
  return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const generatePositionId = (): string => {
  return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const calculateCommission = (quantity: number, price: number): number => {
  return quantity * price * config.COMMISSION_RATE;
};

const getCurrentPrice = (symbol: string): number => {
  // Mock price - in real app this would come from market data
  const mockPrices: Record<string, number> = {
    'BTCUSDT': 45000 + (Math.random() - 0.5) * 1000,
    'ETHUSDT': 3000 + (Math.random() - 0.5) * 100,
    'ADAUSDT': 1.2 + (Math.random() - 0.5) * 0.1,
  };
  return mockPrices[symbol] || 100;
};

export const useTradingStore = create<TradingStore>()(
  persist(
    (set, get) => ({
      // Initial state
      balance: config.DEFAULT_BALANCE,
      equity: config.DEFAULT_BALANCE,
      unrealizedPnl: 0,
      realizedPnl: 0,
      totalPnl: 0,
      pnlPercentage: 0,
      positions: [],
      openOrders: [],
      orderHistory: [],
      isLoading: false,
      error: null,

      // Actions
      placeOrder: async (orderData: PlaceOrderRequest): Promise<string> => {
        const orderId = generateOrderId();
        const currentPrice = getCurrentPrice(orderData.symbol);
        const executionPrice = orderData.type === 'market' ? currentPrice : (orderData.price || currentPrice);
        const commission = calculateCommission(orderData.quantity, executionPrice);

        // Check if user has sufficient balance
        const { balance } = get();
        const orderValue = orderData.quantity * executionPrice + commission;
        
        if (orderData.side === 'buy' && orderValue > balance) {
          throw new Error('Insufficient balance');
        }

        const order: Order = {
          id: orderId,
          userId: 'current_user', // TODO: Get from auth store
          symbol: orderData.symbol,
          type: orderData.type,
          side: orderData.side,
          quantity: orderData.quantity,
          price: orderData.price,
          stopPrice: orderData.stopPrice,
          executedQuantity: 0,
          executedPrice: undefined,
          status: 'pending',
          timeInForce: orderData.timeInForce || 'GTC',
          createdAt: new Date().toISOString(),
          commission,
          pnl: 0,
          takeProfitPrice: orderData.takeProfitPrice,
          stopLossPrice: orderData.stopLossPrice,
          trailingStopPercent: orderData.trailingStopPercent,
          orderSource: 'manual',
          clientOrderId: orderData.clientOrderId,
        };

        set(state => ({
          openOrders: [...state.openOrders, order]
        }));

        // Execute market orders immediately
        if (orderData.type === 'market') {
          setTimeout(() => {
            get().executeOrder(orderId, executionPrice);
          }, 100);
        }

        return orderId;
      },

      executeOrder: (orderId: string, executionPrice: number) => {
        set(state => {
          const orderIndex = state.openOrders.findIndex(o => o.id === orderId);
          if (orderIndex === -1) return state;

          const order = state.openOrders[orderIndex];
          const executedOrder: Order = {
            ...order,
            status: 'filled',
            executedAt: new Date().toISOString(),
            executedPrice: executionPrice,
            executedQuantity: order.quantity,
          };

          // Update balance
          const orderValue = order.quantity * executionPrice;
          const totalCost = orderValue + order.commission;
          const newBalance = order.side === 'buy' 
            ? state.balance - totalCost 
            : state.balance + orderValue - order.commission;

          // Update or create position
          const existingPositionIndex = state.positions.findIndex(
            p => p.symbol === order.symbol
          );

          let newPositions = [...state.positions];
          
          if (existingPositionIndex >= 0) {
            const position = state.positions[existingPositionIndex];
            const isClosing = (position.side === 'long' && order.side === 'sell') ||
                             (position.side === 'short' && order.side === 'buy');

            if (isClosing) {
              // Calculate PnL for closing position
              const pnlPerUnit = position.side === 'long' 
                ? executionPrice - position.entryPrice
                : position.entryPrice - executionPrice;
              const positionPnl = pnlPerUnit * Math.min(order.quantity, position.quantity);

              if (order.quantity >= position.quantity) {
                // Close entire position
                newPositions.splice(existingPositionIndex, 1);
              } else {
                // Partially close position
                newPositions[existingPositionIndex] = {
                  ...position,
                  quantity: position.quantity - order.quantity,
                  realizedPnl: position.realizedPnl + positionPnl,
                };
              }

              executedOrder.pnl = positionPnl;
            } else {
              // Add to existing position
              const totalQuantity = position.quantity + order.quantity;
              const newAvgPrice = (position.entryPrice * position.quantity + executionPrice * order.quantity) / totalQuantity;
              
              newPositions[existingPositionIndex] = {
                ...position,
                quantity: totalQuantity,
                entryPrice: newAvgPrice,
                updatedAt: new Date().toISOString(),
              };
            }
          } else {
            // Create new position
            newPositions.push({
              id: generatePositionId(),
              userId: 'current_user',
              symbol: order.symbol,
              side: order.side === 'buy' ? 'long' : 'short',
              quantity: order.quantity,
              entryPrice: executionPrice,
              currentPrice: executionPrice,
              unrealizedPnl: 0,
              realizedPnl: 0,
              totalPnl: 0,
              openedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              status: 'open',
              leverage: 1,
              margin: orderValue,
              marginRatio: 0,
              takeProfitPrice: order.takeProfitPrice,
              stopLossPrice: order.stopLossPrice,
            });
          }

          return {
            ...state,
            balance: newBalance,
            openOrders: [
              ...state.openOrders.slice(0, orderIndex),
              ...state.openOrders.slice(orderIndex + 1)
            ],
            orderHistory: [...state.orderHistory, executedOrder],
            positions: newPositions,
          };
        });
      },

      cancelOrder: async (orderId: string): Promise<void> => {
        set(state => ({
          openOrders: state.openOrders.filter(order => order.id !== orderId)
        }));
      },

      updatePositions: (prices: Record<string, number>) => {
        set(state => {
          const updatedPositions = state.positions.map(position => {
            const currentPrice = prices[position.symbol];
            if (!currentPrice) return position;

            const priceDiff = currentPrice - position.entryPrice;
            const unrealizedPnl = position.side === 'long' 
              ? priceDiff * position.quantity
              : -priceDiff * position.quantity;

            return {
              ...position,
              currentPrice,
              unrealizedPnl,
              totalPnl: position.realizedPnl + unrealizedPnl,
              updatedAt: new Date().toISOString(),
            };
          });

          const totalUnrealizedPnl = updatedPositions.reduce(
            (sum, pos) => sum + pos.unrealizedPnl, 0
          );

          const totalRealizedPnl = updatedPositions.reduce(
            (sum, pos) => sum + pos.realizedPnl, 0
          );

          const totalPnl = totalUnrealizedPnl + totalRealizedPnl;
          const equity = state.balance + totalUnrealizedPnl;
          const pnlPercentage = (totalPnl / config.DEFAULT_BALANCE) * 100;

          return {
            ...state,
            positions: updatedPositions,
            equity,
            unrealizedPnl: totalUnrealizedPnl,
            realizedPnl: totalRealizedPnl,
            totalPnl,
            pnlPercentage,
          };
        });
      },

      resetAccount: () => {
        set({
          balance: config.DEFAULT_BALANCE,
          equity: config.DEFAULT_BALANCE,
          unrealizedPnl: 0,
          realizedPnl: 0,
          totalPnl: 0,
          pnlPercentage: 0,
          positions: [],
          openOrders: [],
          orderHistory: [],
          error: null,
        });
      },

      // Utility actions
      setBalance: (balance: number) => set({ balance }),
      setLoading: (isLoading: boolean) => set({ isLoading }),
      setError: (error: string | null) => set({ error }),

      // Computed values
      getPositionBySymbol: (symbol: string) => {
        return get().positions.find(p => p.symbol === symbol);
      },

      getOpenOrdersBySymbol: (symbol: string) => {
        return get().openOrders.filter(o => o.symbol === symbol);
      },

      getTotalUnrealizedPnL: () => {
        return get().positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
      },

      getTotalRealizedPnL: () => {
        return get().positions.reduce((sum, pos) => sum + pos.realizedPnl, 0);
      },
    }),
    {
      name: 'trading-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        balance: state.balance,
        positions: state.positions,
        orderHistory: state.orderHistory,
        realizedPnl: state.realizedPnl,
      }),
    }
  )
);

// Selectors
export const useBalance = () => useTradingStore((state) => state.balance);
export const useEquity = () => useTradingStore((state) => state.equity);
export const usePositions = () => useTradingStore((state) => state.positions);
export const useOpenOrders = () => useTradingStore((state) => state.openOrders);
export const useTotalPnL = () => useTradingStore((state) => state.totalPnl);
export const usePnLPercentage = () => useTradingStore((state) => state.pnlPercentage);