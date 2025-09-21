// Export all stores
export * from './authStore';
export * from './tradingStore';
export * from './marketStore';

// Store types
export type { AuthStore } from './authStore';
export type { TradingStore } from './tradingStore';
export type { MarketStore } from './marketStore';

// Combined store hook for accessing multiple stores
import { useAuthStore } from './authStore';
import { useTradingStore } from './tradingStore';
import { useMarketStore } from './marketStore';

export const useStores = () => ({
  auth: useAuthStore,
  trading: useTradingStore,
  market: useMarketStore,
});

// Store reset function for testing or account reset
export const resetAllStores = () => {
  useTradingStore.getState().resetAccount();
  useMarketStore.setState({
    selectedPair: 'BTCUSDT',
    tickers: {},
    candleData: {},
    orderBooks: {},
    error: null,
  });
};

// Store persistence keys
export const STORE_KEYS = {
  AUTH: 'auth-storage',
  TRADING: 'trading-storage',
  THEME: 'theme-storage',
} as const;