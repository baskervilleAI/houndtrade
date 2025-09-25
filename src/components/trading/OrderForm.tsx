import React, { useState } from 'react';
import { View, Text, Alert, ScrollView } from 'react-native';
import { Button, Input, Select, Adapt, Sheet } from '@tamagui/core';
import { OrderCreationParams, OrderSide, OrderType } from '../../types/trading';

interface OrderFormProps {
  onCreateOrder: (params: OrderCreationParams) => Promise<{ success: boolean; order?: any; errors?: string[] }>;
  isLoading: boolean;
  availableSymbols?: string[];
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

export const OrderForm: React.FC<OrderFormProps> = ({ 
  onCreateOrder, 
  isLoading, 
  availableSymbols = CRYPTO_SYMBOLS 
}) => {
  // Estados del formulario
  const [symbol, setSymbol] = useState('BTCUSDT');
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
      <View style={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
          Nueva Orden
        </Text>

        {/* Símbolo */}
        <View>
          <Text style={{ fontSize: 16, marginBottom: 8 }}>Criptomoneda</Text>
          <Select value={symbol} onValueChange={setSymbol}>
            <Select.Trigger>
              <Select.Value placeholder="Selecciona una criptomoneda" />
            </Select.Trigger>
            <Select.Content zIndex={200000}>
              <Select.ScrollUpButton />
              <Select.Viewport>
                {availableSymbols.map((sym, index) => (
                  <Select.Item key={sym} index={index} value={sym}>
                    <Select.ItemText>{sym}</Select.ItemText>
                    <Select.ItemIndicator marginLeft="auto">✓</Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton />
            </Select.Content>
          </Select>
        </View>

        {/* Tipo de orden y dirección */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, marginBottom: 8 }}>Dirección</Text>
            <Select value={side} onValueChange={setSide}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content zIndex={200000}>
                <Select.Viewport>
                  <Select.Item index={0} value={OrderSide.BUY}>
                    <Select.ItemText>BUY (Comprar)</Select.ItemText>
                    <Select.ItemIndicator marginLeft="auto">✓</Select.ItemIndicator>
                  </Select.Item>
                  <Select.Item index={1} value={OrderSide.SELL}>
                    <Select.ItemText>SELL (Vender)</Select.ItemText>
                    <Select.ItemIndicator marginLeft="auto">✓</Select.ItemIndicator>
                  </Select.Item>
                </Select.Viewport>
              </Select.Content>
            </Select>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, marginBottom: 8 }}>Tipo</Text>
            <Select value={orderType} onValueChange={setOrderType}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content zIndex={200000}>
                <Select.Viewport>
                  <Select.Item index={0} value={OrderType.MARKET}>
                    <Select.ItemText>MARKET</Select.ItemText>
                    <Select.ItemIndicator marginLeft="auto">✓</Select.ItemIndicator>
                  </Select.Item>
                  <Select.Item index={1} value={OrderType.LIMIT}>
                    <Select.ItemText>LIMIT</Select.ItemText>
                    <Select.ItemIndicator marginLeft="auto">✓</Select.ItemIndicator>
                  </Select.Item>
                </Select.Viewport>
              </Select.Content>
            </Select>
          </View>
        </View>

        {/* Cantidad en USDT */}
        <View>
          <Text style={{ fontSize: 16, marginBottom: 8 }}>Cantidad (USDT)</Text>
          <Input
            value={usdtAmount}
            onChangeText={setUsdtAmount}
            placeholder="100"
            keyboardType="numeric"
            size="$4"
          />
        </View>

        {/* Take Profit */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 16, flex: 1 }}>Take Profit</Text>
            <Select value={tpMode} onValueChange={setTpMode} size="$3">
              <Select.Trigger width={100}>
                <Select.Value />
              </Select.Trigger>
              <Select.Content zIndex={200000}>
                <Select.Viewport>
                  <Select.Item index={0} value="usdt">
                    <Select.ItemText>USDT</Select.ItemText>
                  </Select.Item>
                  <Select.Item index={1} value="price">
                    <Select.ItemText>Precio</Select.ItemText>
                  </Select.Item>
                </Select.Viewport>
              </Select.Content>
            </Select>
          </View>
          
          {tpMode === 'usdt' ? (
            <Input
              value={takeProfitUSDT}
              onChangeText={setTakeProfitUSDT}
              placeholder="Ganancia esperada en USDT"
              keyboardType="numeric"
              size="$4"
            />
          ) : (
            <Input
              value={takeProfitPrice}
              onChangeText={setTakeProfitPrice}
              placeholder="Precio objetivo"
              keyboardType="numeric"
              size="$4"
            />
          )}
        </View>

        {/* Stop Loss */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 16, flex: 1 }}>Stop Loss</Text>
            <Select value={slMode} onValueChange={setSlMode} size="$3">
              <Select.Trigger width={100}>
                <Select.Value />
              </Select.Trigger>
              <Select.Content zIndex={200000}>
                <Select.Viewport>
                  <Select.Item index={0} value="usdt">
                    <Select.ItemText>USDT</Select.ItemText>
                  </Select.Item>
                  <Select.Item index={1} value="price">
                    <Select.ItemText>Precio</Select.ItemText>
                  </Select.Item>
                </Select.Viewport>
              </Select.Content>
            </Select>
          </View>
          
          {slMode === 'usdt' ? (
            <Input
              value={stopLossUSDT}
              onChangeText={setStopLossUSDT}
              placeholder="Pérdida máxima en USDT"
              keyboardType="numeric"
              size="$4"
            />
          ) : (
            <Input
              value={stopLossPrice}
              onChangeText={setStopLossPrice}
              placeholder="Precio de stop"
              keyboardType="numeric"
              size="$4"
            />
          )}
        </View>

        {/* Métricas calculadas */}
        {(calculateRiskReward() || calculateRiskPercentage()) && (
          <View style={{ 
            backgroundColor: '#f5f5f5', 
            padding: 12, 
            borderRadius: 8,
            gap: 4
          }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold' }}>Análisis de Riesgo</Text>
            {calculateRiskReward() && (
              <Text style={{ fontSize: 14 }}>
                Riesgo/Recompensa: 1:{calculateRiskReward()}
              </Text>
            )}
            {calculateRiskPercentage() && (
              <Text style={{ fontSize: 14 }}>
                Riesgo: {calculateRiskPercentage()}% del capital
              </Text>
            )}
          </View>
        )}

        {/* Opciones avanzadas */}
        <Button 
          variant="outlined" 
          onPress={() => setShowAdvanced(!showAdvanced)}
          size="$3"
        >
          {showAdvanced ? 'Ocultar' : 'Mostrar'} opciones avanzadas
        </Button>

        {showAdvanced && (
          <View>
            <Text style={{ fontSize: 16, marginBottom: 8 }}>Notas</Text>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Notas sobre esta orden (opcional)"
              multiline
              numberOfLines={3}
              size="$4"
            />
          </View>
        )}

        {/* Botón de crear orden */}
        <Button
          onPress={handleSubmit}
          disabled={isLoading}
          backgroundColor={side === OrderSide.BUY ? '$green10' : '$red10'}
          color="white"
          size="$5"
        >
          {isLoading ? 'Creando...' : `Crear Orden ${side}`}
        </Button>

        {/* Advertencias */}
        <View style={{ 
          backgroundColor: '#fff3cd', 
          padding: 12, 
          borderRadius: 8,
          borderLeftWidth: 4,
          borderLeftColor: '#ffc107'
        }}>
          <Text style={{ fontSize: 12, color: '#856404' }}>
            ⚠️ Este es un simulador de trading. Las órdenes no son reales y los precios son simulados para fines educativos.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};