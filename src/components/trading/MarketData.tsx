import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useMarket } from '../../context/AppContext';
import { formatPrice, formatPercentage } from '../../utils/formatters';

const POPULAR_PAIRS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'];

export const MarketData: React.FC = () => {
  const { selectedPair, tickers, setSelectedPair } = useMarket();
  
  // Handle pair selection
  const handlePairSelect = useCallback((symbol: string) => {
    if (symbol === selectedPair) return;

    setSelectedPair(symbol);
  }, [selectedPair, setSelectedPair]);

  // Debug: Log ticker data changes only when count changes
  React.useEffect(() => {
    const tickerCount = Object.keys(tickers).length;
    if (tickerCount > 0) {
      console.log(`� Datos de mercado actualizados: ${tickerCount} pares`);
    }
  }, [Object.keys(tickers).length]); // Only re-run when count changes

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Pares de Trading</Text>
        {Object.keys(tickers).length > 0 && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>
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
              activeOpacity={0.8}
            >
              <Text style={[styles.pairSymbol, isSelected && styles.selectedPairText]}>
                {symbol.replace('USDT', '/USDT')}
              </Text>
              <Text style={[styles.pairPrice, isSelected && styles.selectedPairText]}>
                ${formatPrice(ticker?.price || 0, symbol)}
              </Text>
              <Text style={[styles.pairChange, { color: priceChangeColor }]}>
                {formatPercentage(ticker?.changePercent24h || 0)}
              </Text>
              {ticker && (
                <View style={styles.updateIndicator}>
                  <Text style={styles.updateText}>●</Text>
                </View>
              )}
              {!ticker && (
                <View style={styles.updateIndicator}>
                  <Text style={[styles.updateText, { color: '#888' }]}>○</Text>
                </View>
              )}
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00ff88',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    color: '#00ff88',
    fontWeight: 'bold',
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  selectedPair: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOpacity: 0.5,
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
  updateIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  updateText: {
    fontSize: 8,
    color: '#00ff88',
  },
});
