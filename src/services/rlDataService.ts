import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order, Position } from '../types/trading';
import { TickerData, CandleData } from '../types/market';

export interface RLTradeAction {
  id: string;
  timestamp: string;
  userId: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  quantity: number;
  price: number;
  orderType: 'market' | 'limit';
  marketData: {
    currentPrice: number;
    volume24h: number;
    change24h: number;
    high24h: number;
    low24h: number;
  };
  portfolioState: {
    balance: number;
    equity: number;
    totalPnl: number;
    openPositions: number;
  };
  technicalIndicators?: {
    rsi?: number;
    macd?: number;
    sma20?: number;
    sma50?: number;
    bollinger?: {
      upper: number;
      middle: number;
      lower: number;
    };
  };
  outcome?: {
    pnl: number;
    holdingPeriod: number;
    maxDrawdown: number;
    success: boolean;
  };
}

export interface RLMarketSnapshot {
  id: string;
  timestamp: string;
  symbol: string;
  ohlcv: CandleData[];
  ticker: TickerData;
  orderBook?: {
    bids: [number, number][];
    asks: [number, number][];
  };
}

export interface RLSession {
  id: string;
  startTime: string;
  endTime?: string;
  userId: string;
  initialBalance: number;
  finalBalance?: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  maxDrawdown: number;
  sharpeRatio?: number;
  actions: RLTradeAction[];
  marketSnapshots: RLMarketSnapshot[];
}

class RLDataService {
  private currentSession: RLSession | null = null;
  private readonly STORAGE_KEY = 'rl_trading_data';
  private readonly MAX_SESSIONS = 100; // Keep last 100 sessions

  async startSession(userId: string, initialBalance: number): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      id: sessionId,
      startTime: new Date().toISOString(),
      userId,
      initialBalance,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      maxDrawdown: 0,
      actions: [],
      marketSnapshots: [],
    };

    return sessionId;
  }

  async endSession(finalBalance: number): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date().toISOString();
    this.currentSession.finalBalance = finalBalance;
    
    // Calculate session metrics
    const totalPnl = finalBalance - this.currentSession.initialBalance;
    const winRate = this.currentSession.totalTrades > 0 
      ? this.currentSession.winningTrades / this.currentSession.totalTrades 
      : 0;

    // Save session to storage
    await this.saveSession(this.currentSession);
    this.currentSession = null;
  }

  async recordTradeAction(
    symbol: string,
    action: 'buy' | 'sell' | 'hold',
    quantity: number,
    price: number,
    orderType: 'market' | 'limit',
    marketData: RLTradeAction['marketData'],
    portfolioState: RLTradeAction['portfolioState'],
    technicalIndicators?: RLTradeAction['technicalIndicators']
  ): Promise<void> {
    if (!this.currentSession) return;

    const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const tradeAction: RLTradeAction = {
      id: actionId,
      timestamp: new Date().toISOString(),
      userId: this.currentSession.userId,
      symbol,
      action,
      quantity,
      price,
      orderType,
      marketData,
      portfolioState,
      technicalIndicators,
    };

    this.currentSession.actions.push(tradeAction);
    this.currentSession.totalTrades++;

    // Auto-save every 10 actions
    if (this.currentSession.actions.length % 10 === 0) {
      await this.saveCurrentSession();
    }
  }

  async recordMarketSnapshot(
    symbol: string,
    ohlcv: CandleData[],
    ticker: TickerData,
    orderBook?: RLMarketSnapshot['orderBook']
  ): Promise<void> {
    if (!this.currentSession) return;

    const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const snapshot: RLMarketSnapshot = {
      id: snapshotId,
      timestamp: new Date().toISOString(),
      symbol,
      ohlcv: ohlcv.slice(-1000), // Keep last 1000 candles
      ticker,
      orderBook,
    };

    this.currentSession.marketSnapshots.push(snapshot);

    // Keep only last 1000 snapshots per session
    if (this.currentSession.marketSnapshots.length > 1000) {
      this.currentSession.marketSnapshots = this.currentSession.marketSnapshots.slice(-1000);
    }
  }

  async updateTradeOutcome(
    actionId: string,
    pnl: number,
    holdingPeriod: number,
    maxDrawdown: number
  ): Promise<void> {
    if (!this.currentSession) return;

    const action = this.currentSession.actions.find(a => a.id === actionId);
    if (!action) return;

    action.outcome = {
      pnl,
      holdingPeriod,
      maxDrawdown,
      success: pnl > 0,
    };

    if (pnl > 0) {
      this.currentSession.winningTrades++;
    } else {
      this.currentSession.losingTrades++;
    }

    this.currentSession.maxDrawdown = Math.max(this.currentSession.maxDrawdown, maxDrawdown);
  }

  async getAllSessions(): Promise<RLSession[]> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading RL sessions:', error);
      return [];
    }
  }

  async getSessionById(sessionId: string): Promise<RLSession | null> {
    const sessions = await this.getAllSessions();
    return sessions.find(s => s.id === sessionId) || null;
  }

  async exportSessionData(sessionId: string): Promise<string> {
    const session = await this.getSessionById(sessionId);
    if (!session) throw new Error('Session not found');

    return JSON.stringify(session, null, 2);
  }

  async exportAllData(): Promise<string> {
    const sessions = await this.getAllSessions();
    return JSON.stringify(sessions, null, 2);
  }

  async clearAllData(): Promise<void> {
    await AsyncStorage.removeItem(this.STORAGE_KEY);
    this.currentSession = null;
  }

  private async saveSession(session: RLSession): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      sessions.push(session);

      // Keep only the most recent sessions
      if (sessions.length > this.MAX_SESSIONS) {
        sessions.splice(0, sessions.length - this.MAX_SESSIONS);
      }

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving RL session:', error);
    }
  }

  private async saveCurrentSession(): Promise<void> {
    if (!this.currentSession) return;
    
    try {
      const sessions = await this.getAllSessions();
      const existingIndex = sessions.findIndex(s => s.id === this.currentSession!.id);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = { ...this.currentSession };
      } else {
        sessions.push({ ...this.currentSession });
      }

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving current RL session:', error);
    }
  }

  getCurrentSession(): RLSession | null {
    return this.currentSession;
  }

  getSessionStats(): {
    totalSessions: number;
    totalTrades: number;
    avgWinRate: number;
    avgReturn: number;
  } {
    // This would be implemented to analyze historical sessions
    return {
      totalSessions: 0,
      totalTrades: 0,
      avgWinRate: 0,
      avgReturn: 0,
    };
  }
}

export const rlDataService = new RLDataService();