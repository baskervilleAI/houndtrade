import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { TamaguiProvider } from '@tamagui/core';
import tamaguiConfig from './tamagui.config';
import { AppProvider, useAuth, useMarket } from './src/context/AppContext';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { TradingScreen } from './src/screens/trading/TradingScreen';

const AppContent: React.FC = () => {
  const { isAuthenticated, login } = useAuth();
  const { tickers, updatePositions } = useMarket();

  // Auto-login on app start for development/testing
  useEffect(() => {
    if (!isAuthenticated) {
      // console.log('🔑 Auto-login iniciado...');
      login('baskerville@houndtrade.com', '444binance').catch(console.error);
    }
  }, [isAuthenticated, login]);

  // Update positions with current prices
  useEffect(() => {
    const interval = setInterval(() => {
      const prices: Record<string, number> = {};
      Object.entries(tickers).forEach(([symbol, ticker]) => {
        prices[symbol] = ticker.price;
      });
      updatePositions(prices);
    }, 1000);

    return () => clearInterval(interval);
  }, [tickers, updatePositions]);

  return (
    <View style={styles.container}>
      {isAuthenticated ? <TradingScreen /> : <LoginScreen />}
      <StatusBar style="light" />
    </View>
  );
};

export default function App() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark_hound">
      <AppProvider>
        <AppContent />
      </AppProvider>
    </TamaguiProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
