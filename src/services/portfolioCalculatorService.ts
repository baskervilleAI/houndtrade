import { TradingOrder, Portfolio, TradingStats, OrderStatus, TradingSettings } from '../types/trading';
import { TradingStorageService } from './tradingStorageService';
import { TradingOrderService } from './tradingOrderService';
import { debugLogger } from '../utils/debugLogger';

/**
 * Servicio para calcular estadísticas del portfolio y métricas de trading
 */
export class PortfolioCalculatorService {
  private static instance: PortfolioCalculatorService;
  private storageService: TradingStorageService;
  private orderService: TradingOrderService;

  private constructor() {
    this.storageService = TradingStorageService.getInstance();
    this.orderService = TradingOrderService.getInstance();
  }

  public static getInstance(): PortfolioCalculatorService {
    if (!PortfolioCalculatorService.instance) {
      PortfolioCalculatorService.instance = new PortfolioCalculatorService();
    }
    return PortfolioCalculatorService.instance;
  }

  /**
   * Calcula el PnL total realizado de todas las órdenes cerradas
   */
  private calculateRealizedPnL(orders: TradingOrder[]): number {
    return orders
      .filter(order => order.status !== OrderStatus.ACTIVE && order.realizedPnL !== null)
      .reduce((total, order) => total + (order.realizedPnL || 0), 0);
  }

  /**
   * Calcula el PnL no realizado de todas las órdenes activas
   */
  private async calculateUnrealizedPnL(activeOrders: TradingOrder[]): Promise<number> {
    let totalUnrealizedPnL = 0;

    for (const order of activeOrders) {
      try {
        const unrealizedPnL = await this.orderService.calculateUnrealizedPnL(order);
        totalUnrealizedPnL += unrealizedPnL;
      } catch (error) {
        debugLogger.error(`Error al calcular PnL no realizado para orden ${order.id}`, error);
      }
    }

    return totalUnrealizedPnL;
  }

  /**
   * Calcula estadísticas básicas de trading
   */
  private calculateTradingStats(orders: TradingOrder[]): TradingStats {
    const closedOrders = orders.filter(order => 
      order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.CANCELLED
    );
    
    const profitableOrders = closedOrders.filter(order => (order.realizedPnL || 0) > 0);
    const unprofitableOrders = closedOrders.filter(order => (order.realizedPnL || 0) < 0);

    // Estadísticas por tipo de cierre
    const tpClosedCount = orders.filter(order => order.status === OrderStatus.FILLED_TP).length;
    const slClosedCount = orders.filter(order => order.status === OrderStatus.FILLED_SL).length;
    const manualClosedCount = orders.filter(order => order.status === OrderStatus.CLOSED_MANUAL).length;

    // Calcular volumen total
    const totalVolume = orders.reduce((sum, order) => sum + order.usdtAmount, 0);
    const avgOrderSize = orders.length > 0 ? totalVolume / orders.length : 0;

    // Calcular racha actual
    const currentStreak = this.calculateCurrentStreak(orders);
    const { maxWinStreak, maxLossStreak } = this.calculateMaxStreaks(orders);

    return {
      totalOrders: orders.length,
      activeOrders: orders.filter(order => order.status === OrderStatus.ACTIVE).length,
      closedOrders: closedOrders.length,
      cancelledOrders: orders.filter(order => order.status === OrderStatus.CANCELLED).length,
      
      profitableOrders: profitableOrders.length,
      unprofitableOrders: unprofitableOrders.length,
      
      totalVolume,
      avgOrderSize,
      
      tpClosedCount,
      slClosedCount,
      manualClosedCount,
      
      currentStreak,
      maxWinStreak,
      maxLossStreak
    };
  }

  /**
   * Calcula la racha actual (positiva para ganadores, negativa para perdedores)
   */
  private calculateCurrentStreak(orders: TradingOrder[]): number {
    const closedOrders = orders
      .filter(order => order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.CANCELLED && order.closedAt)
      .sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0)); // Más recientes primero

    if (closedOrders.length === 0) return 0;

    let streak = 0;
    const firstOrderProfitable = (closedOrders[0].realizedPnL || 0) > 0;

    for (const order of closedOrders) {
      const isProfitable = (order.realizedPnL || 0) > 0;
      
      if (isProfitable === firstOrderProfitable) {
        streak += firstOrderProfitable ? 1 : -1;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Calcula las rachas máximas
   */
  private calculateMaxStreaks(orders: TradingOrder[]): { maxWinStreak: number; maxLossStreak: number } {
    const closedOrders = orders
      .filter(order => order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.CANCELLED && order.closedAt)
      .sort((a, b) => (a.closedAt || 0) - (b.closedAt || 0)); // Más antiguos primero

    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    for (const order of closedOrders) {
      const isProfitable = (order.realizedPnL || 0) > 0;
      
      if (isProfitable) {
        currentWinStreak++;
        currentLossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      }
    }

    return { maxWinStreak, maxLossStreak };
  }

  /**
   * Calcula el drawdown actual y máximo
   */
  private calculateDrawdown(orders: TradingOrder[], initialBalance: number): { currentDrawdown: number; maxDrawdown: number } {
    const closedOrders = orders
      .filter(order => order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.CANCELLED && order.closedAt)
      .sort((a, b) => (a.closedAt || 0) - (b.closedAt || 0)); // Más antiguos primero

    let runningBalance = initialBalance;
    let peak = initialBalance;
    let maxDrawdown = 0;

    for (const order of closedOrders) {
      runningBalance += (order.realizedPnL || 0);
      
      if (runningBalance > peak) {
        peak = runningBalance;
      }
      
      const currentDrawdown = ((peak - runningBalance) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
    }

    const currentBalance = runningBalance;
    const currentDrawdown = peak > 0 ? ((peak - currentBalance) / peak) * 100 : 0;

    return { currentDrawdown, maxDrawdown };
  }

  /**
   * Calcula el portfolio completo con todas las métricas
   */
  async calculatePortfolio(): Promise<Portfolio> {
    debugLogger.debug('Calculando portfolio completo...');

    const orders = this.storageService.loadOrders();
    const settings = this.storageService.loadSettings();
    const activeOrders = orders.filter(order => order.status === OrderStatus.ACTIVE);
    const closedOrders = orders.filter(order => 
      order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.CANCELLED
    );

    // Cálculos básicos
    const realizedPnL = this.calculateRealizedPnL(orders);
    const unrealizedPnL = await this.calculateUnrealizedPnL(activeOrders);
    const totalBalance = settings.initialBalance + realizedPnL + unrealizedPnL;

    // Estadísticas de trading
    const profitableOrders = closedOrders.filter(order => (order.realizedPnL || 0) > 0);
    const losingOrders = closedOrders.filter(order => (order.realizedPnL || 0) < 0);
    
    const totalTrades = closedOrders.length;
    const winningTrades = profitableOrders.length;
    const losingTrades = losingOrders.length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Mejor y peor trade
    const pnlValues = closedOrders.map(order => order.realizedPnL || 0);
    const bestTrade = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
    const worstTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;

    // Promedios
    const winningPnLs = profitableOrders.map(order => order.realizedPnL || 0);
    const losingPnLs = losingOrders.map(order => order.realizedPnL || 0);
    
    const averageWin = winningPnLs.length > 0 ? winningPnLs.reduce((sum, pnl) => sum + pnl, 0) / winningPnLs.length : 0;
    const averageLoss = losingPnLs.length > 0 ? losingPnLs.reduce((sum, pnl) => sum + pnl, 0) / losingPnLs.length : 0;

    // Drawdown
    const { currentDrawdown, maxDrawdown } = this.calculateDrawdown(orders, settings.initialBalance);

    const portfolio: Portfolio = {
      totalBalance,
      realizedPnL,
      unrealizedPnL,
      
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      
      bestTrade,
      worstTrade,
      
      averageWin,
      averageLoss,
      
      maxDrawdown,
      currentDrawdown,
      
      lastUpdated: Date.now()
    };

    // Guardar portfolio calculado
    this.storageService.savePortfolio(portfolio);

    debugLogger.debug('Portfolio calculado', {
      totalBalance: totalBalance.toFixed(2),
      realizedPnL: realizedPnL.toFixed(2),
      unrealizedPnL: unrealizedPnL.toFixed(2),
      winRate: winRate.toFixed(1) + '%',
      totalTrades
    });

    return portfolio;
  }

  /**
   * Obtiene las estadísticas de trading detalladas
   */
  getTradingStats(): TradingStats {
    const orders = this.storageService.loadOrders();
    return this.calculateTradingStats(orders);
  }

  /**
   * Calcula el performance por símbolo
   */
  getPerformanceBySymbol(): Record<string, {
    symbol: string;
    totalOrders: number;
    totalVolume: number;
    realizedPnL: number;
    winRate: number;
    avgPnL: number;
  }> {
    const orders = this.storageService.loadOrders();
    const symbolStats: Record<string, any> = {};

    orders.forEach(order => {
      if (!symbolStats[order.symbol]) {
        symbolStats[order.symbol] = {
          symbol: order.symbol,
          orders: [],
          totalVolume: 0
        };
      }
      
      symbolStats[order.symbol].orders.push(order);
      symbolStats[order.symbol].totalVolume += order.usdtAmount;
    });

    // Calcular métricas para cada símbolo
    Object.keys(symbolStats).forEach(symbol => {
      const data = symbolStats[symbol];
      const closedOrders = data.orders.filter((order: TradingOrder) => 
        order.status !== OrderStatus.ACTIVE && order.status !== OrderStatus.CANCELLED
      );
      
      const realizedPnL = closedOrders.reduce((sum: number, order: TradingOrder) => sum + (order.realizedPnL || 0), 0);
      const profitableOrders = closedOrders.filter((order: TradingOrder) => (order.realizedPnL || 0) > 0);
      const winRate = closedOrders.length > 0 ? (profitableOrders.length / closedOrders.length) * 100 : 0;
      const avgPnL = closedOrders.length > 0 ? realizedPnL / closedOrders.length : 0;

      symbolStats[symbol] = {
        symbol,
        totalOrders: data.orders.length,
        totalVolume: data.totalVolume,
        realizedPnL,
        winRate,
        avgPnL
      };
    });

    return symbolStats;
  }

  /**
   * Calcula el performance diario/mensual
   */
  getPerformanceOverTime(period: 'daily' | 'weekly' | 'monthly' = 'daily'): Array<{
    date: string;
    trades: number;
    volume: number;
    pnl: number;
    cumulativePnL: number;
    winRate: number;
  }> {
    const orders = this.storageService.loadOrders();
    const closedOrders = orders.filter(order => 
      order.status !== OrderStatus.ACTIVE && 
      order.status !== OrderStatus.CANCELLED && 
      order.closedAt
    );

    // Agrupar por período
    const periodData: Record<string, TradingOrder[]> = {};
    
    closedOrders.forEach(order => {
      const date = new Date(order.closedAt!);
      let periodKey: string;
      
      switch (period) {
        case 'daily':
          periodKey = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0] + '_week';
          break;
        case 'monthly':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          periodKey = date.toISOString().split('T')[0];
      }
      
      if (!periodData[periodKey]) {
        periodData[periodKey] = [];
      }
      periodData[periodKey].push(order);
    });

    // Calcular métricas para cada período
    const results = Object.keys(periodData)
      .sort()
      .map(dateKey => {
        const periodOrders = periodData[dateKey];
        const trades = periodOrders.length;
        const volume = periodOrders.reduce((sum, order) => sum + order.usdtAmount, 0);
        const pnl = periodOrders.reduce((sum, order) => sum + (order.realizedPnL || 0), 0);
        const profitableOrders = periodOrders.filter(order => (order.realizedPnL || 0) > 0);
        const winRate = trades > 0 ? (profitableOrders.length / trades) * 100 : 0;

        return {
          date: dateKey,
          trades,
          volume,
          pnl,
          cumulativePnL: 0, // Se calculará después
          winRate
        };
      });

    // Calcular PnL acumulativo
    let cumulativePnL = 0;
    results.forEach(result => {
      cumulativePnL += result.pnl;
      result.cumulativePnL = cumulativePnL;
    });

    return results;
  }

  /**
   * Obtiene métricas de riesgo
   */
  getRiskMetrics(): {
    sharpeRatio: number;
    profitFactor: number;
    maxConsecutiveLosses: number;
    maxConsecutiveWins: number;
    averageRiskReward: number;
    winLossRatio: number;
  } {
    const orders = this.storageService.loadOrders();
    const closedOrders = orders.filter(order => 
      order.status !== OrderStatus.ACTIVE && 
      order.status !== OrderStatus.CANCELLED &&
      order.realizedPnL !== null
    );

    if (closedOrders.length === 0) {
      return {
        sharpeRatio: 0,
        profitFactor: 0,
        maxConsecutiveLosses: 0,
        maxConsecutiveWins: 0,
        averageRiskReward: 0,
        winLossRatio: 0
      };
    }

    const pnlValues = closedOrders.map(order => order.realizedPnL || 0);
    const winningTrades = pnlValues.filter(pnl => pnl > 0);
    const losingTrades = pnlValues.filter(pnl => pnl < 0);

    // Profit Factor
    const totalWins = winningTrades.reduce((sum, pnl) => sum + pnl, 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, pnl) => sum + pnl, 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Sharpe Ratio (simplificado)
    const avgReturn = pnlValues.reduce((sum, pnl) => sum + pnl, 0) / pnlValues.length;
    const variance = pnlValues.reduce((sum, pnl) => sum + Math.pow(pnl - avgReturn, 2), 0) / pnlValues.length;
    const standardDeviation = Math.sqrt(variance);
    const sharpeRatio = standardDeviation > 0 ? avgReturn / standardDeviation : 0;

    // Rachas consecutivas
    const { maxWinStreak, maxLossStreak } = this.calculateMaxStreaks(orders);

    // Risk-Reward Ratio
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, pnl) => sum + pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, pnl) => sum + pnl, 0) / losingTrades.length) : 0;
    const averageRiskReward = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Win/Loss Ratio
    const winLossRatio = losingTrades.length > 0 ? winningTrades.length / losingTrades.length : winningTrades.length > 0 ? Infinity : 0;

    return {
      sharpeRatio,
      profitFactor,
      maxConsecutiveLosses: maxLossStreak,
      maxConsecutiveWins: maxWinStreak,
      averageRiskReward,
      winLossRatio
    };
  }

  /**
   * Obtiene un resumen rápido del portfolio
   */
  async getPortfolioSummary(): Promise<{
    totalBalance: number;
    totalPnL: number;
    totalPnLPercentage: number;
    activeOrders: number;
    todayPnL: number;
    winRate: number;
  }> {
    const portfolio = await this.calculatePortfolio();
    const settings = this.storageService.loadSettings();
    const stats = this.getTradingStats();

    // PnL de hoy
    const today = new Date().toISOString().split('T')[0];
    const todayPerformance = this.getPerformanceOverTime('daily').find(p => p.date === today);
    const todayPnL = todayPerformance ? todayPerformance.pnl : 0;

    const totalPnL = portfolio.realizedPnL + portfolio.unrealizedPnL;
    const totalPnLPercentage = (totalPnL / settings.initialBalance) * 100;
    const winRate = portfolio.totalTrades > 0 ? (portfolio.winningTrades / portfolio.totalTrades) * 100 : 0;

    return {
      totalBalance: portfolio.totalBalance,
      totalPnL,
      totalPnLPercentage,
      activeOrders: stats.activeOrders,
      todayPnL,
      winRate
    };
  }
}