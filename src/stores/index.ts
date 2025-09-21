// Export all stores
export { useAuthStore } from './authStore';
export { useMarketStore } from './marketStore';
export { useTradingStore } from './tradingStore';
export { useChartDataStore, chartDataStore } from './chartDataStore';

// Store types
export type { AuthStore } from './authStore';
export type { TradingStore } from './tradingStore';
export type { MarketStore } from './marketStore';

// Combined store hook for accessing multiple stores
import { useAuthStore } from './authStore';
import { useTradingStore } from './tradingStore';
import { useMarketStore } from './marketStore';
import { useChartDataStore } from './chartDataStore';

export const useStores = () => ({
  auth: useAuthStore,
  trading: useTradingStore,
  market: useMarketStore,
  chartData: useChartDataStore,
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
  useChartDataStore.getState().clearSymbolData('BTCUSDT');
};

// Store persistence keys
export const STORE_KEYS = {
  AUTH: 'auth-storage',
  TRADING: 'trading-storage',
  THEME: 'theme-storage',
  CHART_DATA: 'chart-data-storage',
} as const;