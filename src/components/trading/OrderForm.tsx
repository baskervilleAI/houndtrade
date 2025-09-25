import React, { useEffect, useState } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { OrderCreationParams, OrderSide, OrderType } from '../../types/trading';

interface OrderFormProps {
  onCreateOrder: (params: OrderCreationParams) => Promise<{ success: boolean; order?: any; errors?: string[] }>;
  isLoading: boolean;
  availableSymbols?: string[];
  defaultSymbol?: string;
  defaultTakeProfitPrice?: number | null;
  defaultStopLossPrice?: number | null;
}

const CRYPTO_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'ADAUSDT',
  'SOLUSDT',
  'DOTUSDT',
  'LINKUSDT',
  'MATICUSDT',
  'AVAXUSDT',
  'UNIUSDT'
];

// Componente selector simple
interface SimpleSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  width?: number | string;
}

const SimpleSelect: React.FC<SimpleSelectProps> = ({ 
  value, 
  onValueChange, 
  options, 
  placeholder = "Selecciona...",
  width = "100%"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <View style={{ position: 'relative', width: width as any }}>
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={{
          borderWidth: 1,
          borderColor: '#555555',
          borderRadius: 6,
          padding: 12,
          backgroundColor: '#1a1a1a',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: 44
        }}
      >
        <Text style={{ fontSize: 16, color: selectedOption ? '#ffffff' : '#888888' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Text style={{ fontSize: 12, color: '#888888' }}>
          {isOpen ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      
      {isOpen && (
        <View style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: '#1a1a1a',
          borderWidth: 1,
          borderColor: '#555555',
          borderRadius: 6,
          marginTop: 2,
          maxHeight: 200,
          zIndex: 1000,
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}>
          <ScrollView style={{ maxHeight: 200 }}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  onValueChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: '#333333',
                  backgroundColor: option.value === value ? '#2a2a2a' : '#1a1a1a'
                }}
              >
                <Text style={{ 
                  fontSize: 16,
                  color: option.value === value ? '#00ff88' : '#ffffff'
                }}>
                  {option.label}
                  {option.value === value && ' ✓'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export const OrderForm: React.FC<OrderFormProps> = ({ 
  onCreateOrder, 
  isLoading, 
  availableSymbols = CRYPTO_SYMBOLS,
  defaultSymbol = 'BTCUSDT',
  defaultTakeProfitPrice,
  defaultStopLossPrice,
}) => {
  // Estados del formulario
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<OrderSide>(OrderSide.BUY);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.MARKET);
  const [usdtAmount, setUsdtAmount] = useState('100');
  
  // TP/SL modes: 'price' para precio específico, 'usdt' para cantidad en USDT
  const [tpMode, setTpMode] = useState<'price' | 'usdt'>('usdt');
  const [slMode, setSlMode] = useState<'price' | 'usdt'>('usdt');
  
  const [takeProfitUSDT, setTakeProfitUSDT] = useState('20');
  const [stopLossUSDT, setStopLossUSDT] = useState('10');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  
  const [notes, setNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (defaultSymbol && defaultSymbol !== symbol) {
      setSymbol(defaultSymbol);
    }
  }, [defaultSymbol]);

  useEffect(() => {
    if (defaultTakeProfitPrice === undefined) return;

    if (defaultTakeProfitPrice === null) {
      setTakeProfitPrice('');
      setTpMode('usdt');
    } else {
      setTpMode('price');
      setTakeProfitUSDT('');
      setTakeProfitPrice(defaultTakeProfitPrice.toString());
    }
  }, [defaultTakeProfitPrice]);

  useEffect(() => {
    if (defaultStopLossPrice === undefined) return;

    if (defaultStopLossPrice === null) {
      setStopLossPrice('');
      setSlMode('usdt');
    } else {
      setSlMode('price');
      setStopLossUSDT('');
      setStopLossPrice(defaultStopLossPrice.toString());
    }
  }, [defaultStopLossPrice]);

  // Validación del formulario
  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!symbol.trim()) {
      errors.push('Selecciona un símbolo');
    }

    const amount = parseFloat(usdtAmount);
    if (isNaN(amount) || amount <= 0) {
      errors.push('La cantidad debe ser un número mayor que 0');
    }

    if (amount < 10) {
      errors.push('La cantidad mínima recomendada es $10 USDT');
    }

    if (tpMode === 'usdt') {
      const tpAmount = parseFloat(takeProfitUSDT);
      if (takeProfitUSDT.trim() && (isNaN(tpAmount) || tpAmount <= 0)) {
        errors.push('El Take Profit debe ser un número mayor que 0');
      }
    } else {
      const tpPrice = parseFloat(takeProfitPrice);
      if (takeProfitPrice.trim() && (isNaN(tpPrice) || tpPrice <= 0)) {
        errors.push('El precio de Take Profit debe ser mayor que 0');
      }
    }

    if (slMode === 'usdt') {
      const slAmount = parseFloat(stopLossUSDT);
      if (stopLossUSDT.trim() && (isNaN(slAmount) || slAmount <= 0)) {
        errors.push('El Stop Loss debe ser un número mayor que 0');
      }
    } else {
      const slPrice = parseFloat(stopLossPrice);
      if (stopLossPrice.trim() && (isNaN(slPrice) || slPrice <= 0)) {
        errors.push('El precio de Stop Loss debe ser mayor que 0');
      }
    }

    return errors;
  };

  // Maneja el envío del formulario
  const handleSubmit = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      Alert.alert('Errores en el formulario', errors.join('\n'));
      return;
    }

    const params: OrderCreationParams = {
      symbol,
      side,
      type: orderType,
      usdtAmount: parseFloat(usdtAmount),
      notes: notes.trim() || undefined
    };

    // Agregar TP/SL según el modo seleccionado
    if (tpMode === 'usdt' && takeProfitUSDT.trim()) {
      params.takeProfitUSDT = parseFloat(takeProfitUSDT);
    } else if (tpMode === 'price' && takeProfitPrice.trim()) {
      params.takeProfitPrice = parseFloat(takeProfitPrice);
    }

    if (slMode === 'usdt' && stopLossUSDT.trim()) {
      params.stopLossUSDT = parseFloat(stopLossUSDT);
    } else if (slMode === 'price' && stopLossPrice.trim()) {
      params.stopLossPrice = parseFloat(stopLossPrice);
    }

    try {
      const result = await onCreateOrder(params);
      
      if (result.success) {
        Alert.alert('¡Éxito!', 'Orden creada correctamente');
        // Limpiar formulario
        setUsdtAmount('100');
        setTakeProfitUSDT('20');
        setStopLossUSDT('10');
        setTakeProfitPrice('');
        setStopLossPrice('');
        setNotes('');
      } else {
        Alert.alert('Error', result.errors?.join('\n') || 'Error al crear la orden');
      }
    } catch (error) {
      Alert.alert('Error', 'Error interno al crear la orden');
    }
  };

  // Calcula el riesgo/recompensa
  const calculateRiskReward = () => {
    if (tpMode === 'usdt' && slMode === 'usdt') {
      const tp = parseFloat(takeProfitUSDT) || 0;
      const sl = parseFloat(stopLossUSDT) || 0;
      if (tp > 0 && sl > 0) {
        return (tp / sl).toFixed(2);
      }
    }
    return null;
  };

  // Calcula el porcentaje de riesgo
  const calculateRiskPercentage = () => {
    const amount = parseFloat(usdtAmount) || 0;
    const sl = parseFloat(stopLossUSDT) || 0;
    if (amount > 0 && sl > 0) {
      return ((sl / amount) * 100).toFixed(1);
    }
    return null;
  };

  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={{ padding: 16, gap: 16, backgroundColor: '#0a0a0a' }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: '#ffffff' }}>
          Nueva Orden
        </Text>

        {/* Símbolo */}
        <View>
          <Text style={{ fontSize: 16, marginBottom: 8, color: '#ffffff' }}>Criptomoneda</Text>
          <SimpleSelect 
            value={symbol} 
            onValueChange={setSymbol}
            options={availableSymbols.map(sym => ({ value: sym, label: sym }))}
            placeholder="Selecciona una criptomoneda"
          />
        </View>

        {/* Tipo de orden y dirección */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, marginBottom: 8, color: '#ffffff' }}>Dirección</Text>
            <SimpleSelect 
              value={side} 
              onValueChange={(value) => setSide(value as OrderSide)}
              options={[
                { value: OrderSide.BUY, label: 'BUY (Comprar)' },
                { value: OrderSide.SELL, label: 'SELL (Vender)' }
              ]}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, marginBottom: 8, color: '#ffffff' }}>Tipo</Text>
            <SimpleSelect 
              value={orderType} 
              onValueChange={(value) => setOrderType(value as OrderType)}
              options={[
                { value: OrderType.MARKET, label: 'MARKET' },
                { value: OrderType.LIMIT, label: 'LIMIT' }
              ]}
            />
          </View>
        </View>

        {/* Cantidad en USDT */}
        <View>
          <Text style={{ fontSize: 16, marginBottom: 8, color: '#ffffff' }}>Cantidad (USDT)</Text>
          <TextInput
            value={usdtAmount}
            onChangeText={setUsdtAmount}
            placeholder="100"
            placeholderTextColor="#888888"
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: '#555555',
              borderRadius: 6,
              padding: 12,
              backgroundColor: '#1a1a1a',
              color: '#ffffff',
              fontSize: 16,
              minHeight: 44
            }}
          />
        </View>

        {/* Take Profit */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 16, flex: 1, color: '#ffffff' }}>Take Profit</Text>
            <SimpleSelect 
              value={tpMode} 
              onValueChange={(value) => setTpMode(value as 'price' | 'usdt')}
              options={[
                { value: 'usdt', label: 'USDT' },
                { value: 'price', label: 'Precio' }
              ]}
              width={100}
            />
          </View>
          
          {tpMode === 'usdt' ? (
            <TextInput
              value={takeProfitUSDT}
              onChangeText={setTakeProfitUSDT}
              placeholder="Ganancia esperada en USDT"
              placeholderTextColor="#888888"
              keyboardType="numeric"
              style={{
                borderWidth: 1,
                borderColor: '#555555',
                borderRadius: 6,
                padding: 12,
                backgroundColor: '#1a1a1a',
                color: '#ffffff',
                fontSize: 16,
                minHeight: 44
              }}
            />
          ) : (
            <TextInput
              value={takeProfitPrice}
              onChangeText={setTakeProfitPrice}
              placeholder="Precio objetivo"
              placeholderTextColor="#888888"
              keyboardType="numeric"
              style={{
                borderWidth: 1,
                borderColor: '#555555',
                borderRadius: 6,
                padding: 12,
                backgroundColor: '#1a1a1a',
                color: '#ffffff',
                fontSize: 16,
                minHeight: 44
              }}
            />
          )}
        </View>

        {/* Stop Loss */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 16, flex: 1, color: '#ffffff' }}>Stop Loss</Text>
            <SimpleSelect 
              value={slMode} 
              onValueChange={(value) => setSlMode(value as 'price' | 'usdt')}
              options={[
                { value: 'usdt', label: 'USDT' },
                { value: 'price', label: 'Precio' }
              ]}
              width={100}
            />
          </View>
          
          {slMode === 'usdt' ? (
            <TextInput
              value={stopLossUSDT}
              onChangeText={setStopLossUSDT}
              placeholder="Pérdida máxima en USDT"
              placeholderTextColor="#888888"
              keyboardType="numeric"
              style={{
                borderWidth: 1,
                borderColor: '#555555',
                borderRadius: 6,
                padding: 12,
                backgroundColor: '#1a1a1a',
                color: '#ffffff',
                fontSize: 16,
                minHeight: 44
              }}
            />
          ) : (
            <TextInput
              value={stopLossPrice}
              onChangeText={setStopLossPrice}
              placeholder="Precio de stop"
              placeholderTextColor="#888888"
              keyboardType="numeric"
              style={{
                borderWidth: 1,
                borderColor: '#555555',
                borderRadius: 6,
                padding: 12,
                backgroundColor: '#1a1a1a',
                color: '#ffffff',
                fontSize: 16,
                minHeight: 44
              }}
            />
          )}
        </View>

        {/* Métricas calculadas */}
        {(calculateRiskReward() || calculateRiskPercentage()) && (
          <View style={{ 
            backgroundColor: '#2a2a2a', 
            padding: 12, 
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#555555',
            gap: 4
          }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#ffffff' }}>Análisis de Riesgo</Text>
            {calculateRiskReward() && (
              <Text style={{ fontSize: 14, color: '#888888' }}>
                Riesgo/Recompensa: 1:{calculateRiskReward()}
              </Text>
            )}
            {calculateRiskPercentage() && (
              <Text style={{ fontSize: 14, color: '#888888' }}>
                Riesgo: {calculateRiskPercentage()}% del capital
              </Text>
            )}
          </View>
        )}

        {/* Opciones avanzadas */}
        <TouchableOpacity 
          onPress={() => setShowAdvanced(!showAdvanced)}
          style={{
            borderWidth: 1,
            borderColor: '#555555',
            borderRadius: 6,
            padding: 12,
            backgroundColor: '#1a1a1a',
            alignItems: 'center',
            minHeight: 44
          }}
        >
          <Text style={{ fontSize: 16, color: '#00ff88' }}>
            {showAdvanced ? 'Ocultar' : 'Mostrar'} opciones avanzadas
          </Text>
        </TouchableOpacity>

        {showAdvanced && (
          <View>
            <Text style={{ fontSize: 16, marginBottom: 8, color: '#ffffff' }}>Notas</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notas sobre esta orden (opcional)"
              placeholderTextColor="#888888"
              multiline
              numberOfLines={3}
              style={{
                borderWidth: 1,
                borderColor: '#555555',
                borderRadius: 6,
                padding: 12,
                backgroundColor: '#1a1a1a',
                color: '#ffffff',
                fontSize: 16,
                minHeight: 80,
                textAlignVertical: 'top'
              }}
            />
          </View>
        )}

        {/* Botón de crear orden */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isLoading}
          style={{
            backgroundColor: side === OrderSide.BUY ? '#28a745' : '#dc3545',
            borderRadius: 6,
            padding: 16,
            alignItems: 'center',
            minHeight: 52,
            opacity: isLoading ? 0.6 : 1
          }}
        >
          <Text style={{ fontSize: 18, color: 'white', fontWeight: 'bold' }}>
            {isLoading ? 'Creando...' : `Crear Orden ${side}`}
          </Text>
        </TouchableOpacity>

        {/* Advertencias */}
        <View style={{ 
          backgroundColor: '#2a1f00', 
          padding: 12, 
          borderRadius: 8,
          borderLeftWidth: 4,
          borderLeftColor: '#ffaa00',
          borderWidth: 1,
          borderColor: '#555500'
        }}>
          <Text style={{ fontSize: 12, color: '#ffcc88' }}>
            ⚠️ Este es un simulador de trading. Las órdenes no son reales y los precios son simulados para fines educativos.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};