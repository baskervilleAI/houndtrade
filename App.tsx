import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { AppProvider, useAuth, useMarket } from './src/context/AppContext';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { TradingScreen } from './src/screens/trading/TradingScreen';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { tickers, updatePositions } = useMarket();

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
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});
