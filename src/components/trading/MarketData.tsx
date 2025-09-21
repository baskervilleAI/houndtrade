import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useMarket } from '../../context/AppContext';

const POPULAR_PAIRS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'];

export const MarketData: React.FC = () => {
  const { selectedPair, tickers, setSelectedPair, updateTicker } = useMarket();

  // Simulate real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      POPULAR_PAIRS.forEach(symbol => {
        const basePrice = getBasePrice(symbol);
        const change = (Math.random() - 0.5) * 0.02; // ±1% change
        const newPrice = basePrice * (1 + change);
        const change24h = (Math.random() - 0.5) * 0.1; // ±5% daily change
        
        updateTicker({
          symbol,
          price: newPrice,
          changePercent24h: change24h * 100,
        });
      });
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [updateTicker]);

  const getBasePrice = (symbol: string): number => {
    const basePrices: Record<string, number> = {
      'BTCUSDT': 45000,
      'ETHUSDT': 3000,
      'ADAUSDT': 1.2,
      'BNBUSDT': 300,
      'SOLUSDT': 100,
    };
    return basePrices[symbol] || 100;
  };

  const handlePairSelect = (symbol: string) => {
    setSelectedPair(symbol);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pares de Trading</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pairsList}>
        {POPULAR_PAIRS.map(symbol => {
          const ticker = tickers[symbol];
          const isSelected = symbol === selectedPair;
          const priceChangeColor = ticker?.changePercent24h >= 0 ? '#00ff88' : '#ff4444';
          
          return (
            <TouchableOpacity
              key={symbol}
              style={[styles.pairItem, isSelected && styles.selectedPair]}
              onPress={() => handlePairSelect(symbol)}
            >
              <Text style={[styles.pairSymbol, isSelected && styles.selectedPairText]}>
                {symbol.replace('USDT', '/USDT')}
              </Text>
              <Text style={[styles.pairPrice, isSelected && styles.selectedPairText]}>
                ${ticker?.price?.toFixed(symbol === 'BTCUSDT' ? 0 : 2) || '0.00'}
              </Text>
              <Text style={[styles.pairChange, { color: priceChangeColor }]}>
                {ticker?.changePercent24h >= 0 ? '+' : ''}
                {ticker?.changePercent24h?.toFixed(2) || '0.00'}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pairsList: {
    paddingHorizontal: 16,
  },
  pairItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  selectedPair: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  pairSymbol: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  selectedPairText: {
    color: '#000000',
  },
  pairPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  pairChange: {
    fontSize: 11,
    fontWeight: '500',
  },
});