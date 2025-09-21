export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected' | 'partially_filled';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';
export type OrderSource = 'manual' | 'tp' | 'sl' | 'trailing';

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  stopPrice?: number;
  executedQuantity: number;
  executedPrice?: number;
  status: OrderStatus;
  timeInForce: TimeInForce;
  createdAt: string;
  executedAt?: string;
  cancelledAt?: string;
  commission: number;
  pnl: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  trailingStopPercent?: number;
  orderSource: OrderSource;
  parentOrderId?: string;
  clientOrderId?: string;
}

export interface Position {
  id: string;
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  openedAt: string;
  updatedAt: string;
  closedAt?: string;
  status: 'open' | 'closed';
  leverage: number;
  margin: number;
  marginRatio: number;
}

export interface PlaceOrderRequest {
  symbol: string;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  stopPrice?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  trailingStopPercent?: number;
  timeInForce?: TimeInForce;
  clientOrderId?: string;
}

export interface PlaceOrderResponse {
  success: boolean;
  order: Order;
  message?: string;
}

export interface CancelOrderRequest {
  orderId: string;
  symbol: string;
}

export interface CancelOrderResponse {
  success: boolean;
  orderId: string;
  message?: string;
}

export interface OrderHistoryRequest {
  symbol?: string;
  status?: OrderStatus;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

export interface OrderHistoryResponse {
  orders: Order[];
  total: number;
  hasMore: boolean;
}

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: 'TRADING' | 'BREAK' | 'HALT';
  minQuantity: number;
  maxQuantity: number;
  stepSize: number;
  tickSize: number;
  minNotional: number;
  category: string;
  isMarginTradingAllowed: boolean;
  permissions: string[];
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdateId: number;
  timestamp: string;
}

export interface Trade {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  time: string;
  isBuyerMaker: boolean;
}

export interface TradingState {
  balance: number;
  equity: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  pnlPercentage: number;
  positions: Position[];
  openOrders: Order[];
  orderHistory: Order[];
  isLoading: boolean;
  error: string | null;
}

export interface RiskManagement {
  maxPositionSize: number;
  maxDailyLoss: number;
  maxDrawdown: number;
  riskPerTrade: number;
  stopLossPercentage: number;
  takeProfitRatio: number;
}

export interface TradingMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  averageHoldTime: number;
  bestTrade: number;
  worstTrade: number;
}