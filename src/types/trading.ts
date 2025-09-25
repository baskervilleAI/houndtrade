/**
 * Tipos y interfaces para el sistema de trading simulado
 */

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT'
}

export enum OrderSide {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum OrderStatus {
  ACTIVE = 'ACTIVE',
  FILLED_TP = 'FILLED_TP',
  FILLED_SL = 'FILLED_SL',
  CLOSED_MANUAL = 'CLOSED_MANUAL',
  CANCELLED = 'CANCELLED'
}

export interface TradingOrder {
  id: string;
  symbol: string; // Ej: 'BTCUSDT'
  type: OrderType;
  side: OrderSide;
  status: OrderStatus;
  
  // Precios y cantidades
  entryPrice: number;
  quantity: number; // Cantidad de crypto
  usdtAmount: number; // Cantidad en USDT
  
  // Take Profit y Stop Loss
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  takeProfitUSDT: number | null; // Ganancia esperada en USDT
  stopLossUSDT: number | null; // Pérdida máxima en USDT
  
  // Cierre de la orden
  exitPrice: number | null;
  realizedPnL: number | null; // PnL real al cerrar (positivo/negativo)
  
  // Timestamps
  createdAt: number;
  closedAt: number | null;
  
  // Metadatos
  notes?: string;
  tags?: string[];
}

export interface Portfolio {
  totalBalance: number; // Balance total en USDT
  realizedPnL: number; // PnL realizado total
  unrealizedPnL: number; // PnL no realizado de ordenes activas
  
  // Estadísticas
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // Porcentaje de trades ganadores
  
  // Mejor y peor trade
  bestTrade: number;
  worstTrade: number;
  
  // Promedio de trades
  averageWin: number;
  averageLoss: number;
  
  // Drawdown
  maxDrawdown: number;
  currentDrawdown: number;
  
  // Fechas
  lastUpdated: number;
}

export interface TradingSettings {
  initialBalance: number;
  defaultRiskPercentage: number; // Porcentaje del balance para riesgo por defecto
  maxOpenOrders: number;
  enableNotifications: boolean;
}

export interface MarketPrice {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface OrderCreationParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  usdtAmount: number;
  
  // TP/SL pueden ser en precio o en USDT de ganancia/pérdida
  takeProfitUSDT?: number;
  stopLossUSDT?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  
  notes?: string;
  tags?: string[];
}

export interface TradingStats {
  totalOrders: number;
  activeOrders: number;
  closedOrders: number;
  cancelledOrders: number;
  
  profitableOrders: number;
  unprofitableOrders: number;
  
  totalVolume: number; // Volumen total operado en USDT
  avgOrderSize: number;
  
  // Por tipo de cierre
  tpClosedCount: number;
  slClosedCount: number;
  manualClosedCount: number;
  
  // Racha actual
  currentStreak: number; // Positivo para racha ganadora, negativo para perdedora
  maxWinStreak: number;
  maxLossStreak: number;
}

export interface StorageKeys {
  ORDERS: 'houndtrade_orders';
  SETTINGS: 'houndtrade_settings';
  PORTFOLIO: 'houndtrade_portfolio';
}

export const STORAGE_KEYS: StorageKeys = {
  ORDERS: 'houndtrade_orders',
  SETTINGS: 'houndtrade_settings',
  PORTFOLIO: 'houndtrade_portfolio'
};

// Utilidades para validación
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface OrderValidation extends ValidationResult {
  warnings?: string[];
}