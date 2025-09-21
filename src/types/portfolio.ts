import { Position, Order, TradingMetrics } from './trading';

export interface PortfolioSummary {
  userId: string;
  balance: number;
  equity: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  pnlPercentage: number;
  dayChange: number;
  dayChangePercent: number;
  positions: Position[];
  openOrders: Order[];
  lastUpdated: string;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  balance: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export interface AssetAllocation {
  symbol: string;
  percentage: number;
  value: number;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercentage: number;
}

export interface PerformanceMetrics extends TradingMetrics {
  period: '1d' | '7d' | '30d' | '90d' | '1y' | 'all';
  startDate: string;
  endDate: string;
  startingBalance: number;
  endingBalance: number;
  totalReturn: number;
  totalReturnPercentage: number;
  annualizedReturn: number;
  volatility: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  calmarRatio: number;
  sortinoRatio: number;
}

export interface PortfolioState {
  summary: PortfolioSummary | null;
  equityCurve: EquityPoint[];
  assetAllocation: AssetAllocation[];
  performanceMetrics: Record<string, PerformanceMetrics>;
  isLoading: boolean;
  error: string | null;
  lastUpdate: string;
}

export interface RiskMetrics {
  valueAtRisk: number;
  expectedShortfall: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  currentDrawdown: number;
  currentDrawdownDuration: number;
  volatility: number;
  skewness: number;
  kurtosis: number;
  correlationMatrix: Record<string, Record<string, number>>;
}