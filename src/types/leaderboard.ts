import { PerformanceMetrics, EquityPoint } from './portfolio';

export type LeaderboardPeriod = '7d' | '30d' | 'all';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatar?: string;
  pnlPercentage: number;
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  badge?: string;
  isVerified: boolean;
  countryCode?: string;
  joinedAt: string;
}

export interface LeaderboardResponse {
  period: LeaderboardPeriod;
  rankings: LeaderboardEntry[];
  total: number;
  userRank?: number;
  lastUpdated: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  joinedAt: string;
  isVerified: boolean;
  badges: string[];
  
  // Trading Stats
  totalTrades: number;
  winRate: number;
  bestTrade: number;
  worstTrade: number;
  averageHoldTime: number;
  favoriteAssets: string[];
  
  // Performance by Period
  performance: {
    '7d': PerformanceMetrics;
    '30d': PerformanceMetrics;
    'all': PerformanceMetrics;
  };
  
  // Equity Curve Data
  equityCurve: EquityPoint[];
  
  // Recent Activity
  recentTrades: RecentTrade[];
  achievements: Achievement[];
}

export interface RecentTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  pnl: number;
  pnlPercentage: number;
  executedAt: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt: string;
  progress?: {
    current: number;
    target: number;
  };
}

export interface LeaderboardFilter {
  period: LeaderboardPeriod;
  country?: string;
  minTrades?: number;
  verified?: boolean;
}

export interface LeaderboardState {
  rankings: Record<LeaderboardPeriod, LeaderboardEntry[]>;
  userProfile: UserProfile | null;
  selectedPeriod: LeaderboardPeriod;
  filter: LeaderboardFilter;
  isLoading: boolean;
  error: string | null;
  lastUpdate: string;
}

export interface RankingUpdate {
  userId: string;
  oldRank: number;
  newRank: number;
  pnlPercentage: number;
  period: LeaderboardPeriod;
  timestamp: string;
}