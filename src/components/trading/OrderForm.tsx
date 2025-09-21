import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTrading, useMarket } from '../../context/AppContext';

export const OrderForm: React.FC = () => {
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { placeOrder, balance } = useTrading();
  const { selectedPair, tickers } = useMarket();
  
  const currentPrice = tickers[selectedPair]?.price || 0;

  const handlePlaceOrder = async () => {
    if (!quantity || parseFloat(quantity) <= 0) {
      Alert.alert('Error', 'Ingresa una cantidad válida');
      return;
    }

    if (orderType === 'limit' && (!price || parseFloat(price) <= 0)) {
      Alert.alert('Error', 'Ingresa un precio válido para orden límite');
      return;
    }

    const orderQuantity = parseFloat(quantity);
    const orderPrice = orderType === 'market' ? currentPrice : parseFloat(price);
    const orderValue = orderQuantity * orderPrice;

    if (orderSide === 'buy' && orderValue > balance) {
      Alert.alert('Error', 'Balance insuficiente');
      return;
    }

    setIsLoading(true);
    try {
      await placeOrder({
        symbol: selectedPair,
        type: orderType,
        side: orderSide,
        quantity: orderQuantity,
        price: orderType === 'limit' ? orderPrice : undefined,
      });

      // Reset form
      setQuantity('');
      setPrice('');
      
      Alert.alert('Éxito', 'Orden ejecutada correctamente');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al ejecutar orden');
    } finally {
      setIsLoading(false);
    }
  };

  const getEstimatedValue = () => {
    if (!quantity) return 0;
    const qty = parseFloat(quantity);
    const estimatedPrice = orderType === 'market' ? currentPrice : (parseFloat(price) || 0);
    return qty * estimatedPrice;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ejecutar Orden</Text>
      
      {/* Order Type Selector */}
      <View style={styles.selectorContainer}>
        <TouchableOpacity
          style={[styles.selectorButton, orderType === 'market' && styles.selectedButton]}
          onPress={() => setOrderType('market')}
        >
          <Text style={[styles.selectorText, orderType === 'market' && styles.selectedText]}>
            Mercado
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.selectorButton, orderType === 'limit' && styles.selectedButton]}
          onPress={() => setOrderType('limit')}
        >
          <Text style={[styles.selectorText, orderType === 'limit' && styles.selectedText]}>
            Límite
          </Text>
        </TouchableOpacity>
      </View>

      {/* Order Side Selector */}
      <View style={styles.selectorContainer}>
        <TouchableOpacity
          style={[styles.selectorButton, styles.buyButton, orderSide === 'buy' && styles.selectedBuyButton]}
          onPress={() => setOrderSide('buy')}
        >
          <Text style={[styles.selectorText, orderSide === 'buy' && styles.selectedBuyText]}>
            Comprar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.selectorButton, styles.sellButton, orderSide === 'sell' && styles.selectedSellButton]}
          onPress={() => setOrderSide('sell')}
        >
          <Text style={[styles.selectorText, orderSide === 'sell' && styles.selectedSellText]}>
            Vender
          </Text>
        </TouchableOpacity>
      </View>

      {/* Price Input (for limit orders) */}
      {orderType === 'limit' && (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Precio (USDT)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder={currentPrice.toFixed(2)}
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>
      )}

      {/* Quantity Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>
          Cantidad ({selectedPair.replace('USDT', '')})
        </Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          placeholder="0.00"
          placeholderTextColor="#666"
          keyboardType="numeric"
        />
      </View>

      {/* Current Price Display */}
      <View style={styles.priceDisplay}>
        <Text style={styles.priceLabel}>Precio actual:</Text>
        <Text style={styles.priceValue}>${currentPrice.toFixed(2)}</Text>
      </View>

      {/* Estimated Value */}
      <View style={styles.estimatedValue}>
        <Text style={styles.estimatedLabel}>Valor estimado:</Text>
        <Text style={styles.estimatedAmount}>${getEstimatedValue().toFixed(2)}</Text>
      </View>

      {/* Place Order Button */}
      <TouchableOpacity
        style={[
          styles.placeOrderButton,
          orderSide === 'buy' ? styles.buyOrderButton : styles.sellOrderButton,
          isLoading && styles.disabledButton
        ]}
        onPress={handlePlaceOrder}
        disabled={isLoading}
      >
        <Text style={styles.placeOrderText}>
          {isLoading ? 'Ejecutando...' : `${orderSide === 'buy' ? 'Comprar' : 'Vender'} ${selectedPair.replace('USDT', '')}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  selectorContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  selectorButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#333333',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#00ff88',
  },
  buyButton: {
    backgroundColor: '#333333',
  },
  selectedBuyButton: {
    backgroundColor: '#00ff88',
  },
  sellButton: {
    backgroundColor: '#333333',
  },
  selectedSellButton: {
    backgroundColor: '#ff4444',
  },
  selectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  selectedText: {
    color: '#000000',
  },
  selectedBuyText: {
    color: '#000000',
  },
  selectedSellText: {
    color: '#ffffff',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#555555',
  },
  priceDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#333333',
    borderRadius: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#888888',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  estimatedValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#333333',
    borderRadius: 8,
  },
  estimatedLabel: {
    fontSize: 14,
    color: '#888888',
  },
  estimatedAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00ff88',
  },
  placeOrderButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buyOrderButton: {
    backgroundColor: '#00ff88',
  },
  sellOrderButton: {
    backgroundColor: '#ff4444',
  },
  disabledButton: {
    backgroundColor: '#666666',
  },
  placeOrderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});