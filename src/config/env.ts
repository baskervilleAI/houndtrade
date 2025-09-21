import Constants from 'expo-constants';

interface Config {
  API_BASE_URL: string;
  WS_BASE_URL: string;
  BINANCE_API_URL: string;
  BINANCE_WS_URL: string;
  AWS_REGION: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  GOOGLE_CLIENT_ID: string;
  APPLE_CLIENT_ID: string;
  TELEMETRY_ENDPOINT: string;
  TELEMETRY_ENABLED: boolean;
  SENTRY_DSN: string;
  APP_VERSION: string;
  DEFAULT_BALANCE: number;
  COMMISSION_RATE: number;
}

const getConfig = (): Config => {
  const extra = Constants.expoConfig?.extra || {};
  
  return {
    API_BASE_URL: 
      process.env.EXPO_PUBLIC_API_BASE_URL || 
      extra.API_BASE_URL || 
      'http://localhost:3000',
    
    WS_BASE_URL: 
      process.env.EXPO_PUBLIC_WS_BASE_URL || 
      extra.WS_BASE_URL || 
      'ws://localhost:3001',
    
    BINANCE_API_URL: 
      process.env.EXPO_PUBLIC_BINANCE_API_URL || 
      extra.BINANCE_API_URL || 
      'https://api.binance.com/api/v3',
    
    BINANCE_WS_URL: 
      process.env.EXPO_PUBLIC_BINANCE_WS_URL || 
      extra.BINANCE_WS_URL || 
      'wss://stream.binance.com:9443/ws',
    
    AWS_REGION: 
      process.env.EXPO_PUBLIC_AWS_REGION || 
      extra.AWS_REGION || 
      'us-east-1',
    
    COGNITO_USER_POOL_ID: 
      process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || 
      extra.COGNITO_USER_POOL_ID || 
      '',
    
    COGNITO_CLIENT_ID: 
      process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || 
      extra.COGNITO_CLIENT_ID || 
      '',
    
    GOOGLE_CLIENT_ID: 
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 
      extra.GOOGLE_CLIENT_ID || 
      '',
    
    APPLE_CLIENT_ID: 
      process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || 
      extra.APPLE_CLIENT_ID || 
      '',
    
    TELEMETRY_ENDPOINT: 
      process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT || 
      extra.TELEMETRY_ENDPOINT || 
      'http://localhost:3000/telemetry',
    
    TELEMETRY_ENABLED: 
      process.env.EXPO_PUBLIC_TELEMETRY_ENABLED === 'true' || 
      extra.TELEMETRY_ENABLED === true || 
      true,
    
    SENTRY_DSN: 
      process.env.EXPO_PUBLIC_SENTRY_DSN || 
      extra.SENTRY_DSN || 
      '',
    
    APP_VERSION: 
      process.env.EXPO_PUBLIC_APP_VERSION || 
      extra.APP_VERSION || 
      Constants.expoConfig?.version || 
      '1.0.0',
    
    DEFAULT_BALANCE: 
      Number(process.env.EXPO_PUBLIC_DEFAULT_BALANCE) || 
      extra.DEFAULT_BALANCE || 
      1000000,
    
    COMMISSION_RATE: 
      Number(process.env.EXPO_PUBLIC_COMMISSION_RATE) || 
      extra.COMMISSION_RATE || 
      0.001,
  };
};

export const config = getConfig();

// Environment helpers
export const isDevelopment = __DEV__;
export const isProduction = !__DEV__;

// API endpoints
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  REFRESH: '/auth/refresh',
  RESET_PASSWORD: '/auth/reset-password',
  SOCIAL_LOGIN: '/auth/social-login',
  
  // Trading
  PORTFOLIO: '/trading/portfolio',
  PLACE_ORDER: '/trading/order',
  ORDER_HISTORY: '/trading/orders',
  RESET_ACCOUNT: '/trading/reset-account',
  
  // Market Data
  TRADING_PAIRS: '/market/pairs',
  TICKER: '/market/ticker',
  OHLCV: '/market/ohlcv',
  
  // Leaderboard
  LEADERBOARD: '/leaderboard',
  USER_PROFILE: '/profile',
  
  // Telemetry
  LOG_EVENTS: '/telemetry/events',
  TELEMETRY_SETTINGS: '/telemetry/settings',
} as const;

// WebSocket channels
export const WS_CHANNELS = {
  TICKER: 'ticker',
  KLINE: 'kline',
  ORDER_UPDATES: 'orders',
  POSITION_UPDATES: 'positions',
  LEADERBOARD_UPDATES: 'leaderboard',
} as const;

// Trading constants
export const TRADING_CONSTANTS = {
  MIN_ORDER_SIZE: 0.001,
  MAX_ORDER_SIZE: 1000000,
  DEFAULT_LEVERAGE: 1,
  MAX_LEVERAGE: 10,
  COMMISSION_RATE: config.COMMISSION_RATE,
  SLIPPAGE_TOLERANCE: 0.005, // 0.5%
} as const;

// Chart constants
export const CHART_CONSTANTS = {
  DEFAULT_TIMEFRAME: '1h',
  TIMEFRAMES: ['1m', '5m', '15m', '1h', '4h', '1d'] as const,
  MAX_CANDLES: 1000,
  UPDATE_INTERVAL: 1000, // 1 second
} as const;

// Theme constants
export const THEME_CONSTANTS = {
  COLORS: {
    GREEN: '#00ff88',
    RED: '#ff4444',
    BLUE: '#0088ff',
    YELLOW: '#ffaa00',
    PURPLE: '#aa44ff',
    ORANGE: '#ff6600',
  },
  ANIMATION_DURATION: 300,
  HAPTIC_FEEDBACK: true,
} as const;

export default config;