import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, PanResponder, Animated } from 'react-native';
import { debugLogger } from '../../utils/debugLogger';
import { useTrading } from '../../hooks/useTrading';
import { useChart } from '../../context/ChartContext';
import { OrderSide, OrderType } from '../../types/trading';

interface TradingOverlayProps {
  chartDimensions: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  isVisible: boolean;
  onOverlayClick?: (event: any) => void;
  onClose?: () => void;
  symbol?: string;
  priceScale?: {
    min: number;
    max: number;
    pixelsPerPrice: number;
  };
  latestPrice?: number;
}

interface OrderConfig {
  isConfiguring: boolean;
  entryPrice: number | null;
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  quantity: number;
  quantityType: 'percentage' | 'amount';
  quantityPercentage: number;
  quantityAmount: number;
  side: OrderSide;
}

const TradingOverlay: React.FC<TradingOverlayProps> = ({
  chartDimensions,
  isVisible,
  onOverlayClick,
  onClose,
  symbol = 'BTCUSDT',
  priceScale,
  latestPrice
}) => {
  const overlayRef = useRef<View>(null);
  const { portfolio, createOrder, settings } = useTrading();
  const { getCandles } = useChart();
  
  // Estado de configuración de orden
  const [orderConfig, setOrderConfig] = useState<OrderConfig>({
    isConfiguring: false,
    entryPrice: null,
    takeProfitPrice: null,
    stopLossPrice: null,
    quantity: 0,
    quantityType: 'percentage',
    quantityPercentage: 1, // 1% por defecto
    quantityAmount: 100, // $100 por defecto
    side: OrderSide.BUY
  });

  // Animaciones para las barras de TP/SL
  const tpBarPosition = useRef(new Animated.Value(-100)).current; // Arriba del chart
  const slBarPosition = useRef(new Animated.Value(chartDimensions.height + 100)).current; // Abajo del chart

  // Estado para colores del gráfico (mantenemos funcionalidad existente)
  const [colorState, setColorState] = useState({
    supportResistance: true,
    tradingLines: true,
    indicators: true
  });

  // Obtener precio actual de la última vela
  const getCurrentPrice = () => {
    if (latestPrice) return latestPrice;
    
    const candles = getCandles(symbol, '1m');
    if (candles.length > 0) {
      return candles[candles.length - 1].close;
    }
    return 0;
  };

  // Convertir posición Y en precio basado en la escala del gráfico
  const yPositionToPrice = (yPosition: number): number => {
    if (!priceScale) return 0;
    
    const { min, max, pixelsPerPrice } = priceScale;
    const chartHeight = chartDimensions.height;
    
    // La posición Y=0 corresponde al precio máximo, Y=chartHeight al precio mínimo
    const priceRange = max - min;
    const normalizedY = yPosition / chartHeight;
    const price = max - (normalizedY * priceRange);
    
    return Math.max(min, Math.min(max, price));
  };

  // Convertir precio en posición Y
  const priceToYPosition = (price: number): number => {
    if (!priceScale) return 0;
    
    const { min, max } = priceScale;
    const chartHeight = chartDimensions.height;
    const priceRange = max - min;
    const normalizedPrice = (max - price) / priceRange;
    
    return normalizedPrice * chartHeight;
  };

  // Inicializar configuración de orden con precio actual
  const initializeOrderConfig = (side: OrderSide) => {
    const currentPrice = getCurrentPrice();
    const balance = portfolio?.totalBalance || 10000;
    const defaultAmount = (balance * orderConfig.quantityPercentage) / 100;
    
    setOrderConfig(prev => ({
      ...prev,
      isConfiguring: true,
      entryPrice: currentPrice,
      side,
      quantity: defaultAmount,
      takeProfitPrice: null, // Infinito por defecto
      stopLossPrice: null,   // 0 por defecto
    }));

    // Animar las barras a posiciones iniciales
    Animated.parallel([
      Animated.timing(tpBarPosition, {
        toValue: -30, // 30px arriba del chart
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(slBarPosition, {
        toValue: chartDimensions.height + 30, // 30px abajo del chart
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };

  // Crear PanResponder para la barra de TP
  const createTPPanResponder = () => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        debugLogger.debug('Iniciando arrastre de TP');
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = Math.max(0, Math.min(chartDimensions.height, gestureState.moveY - (chartDimensions.y || 0)));
        const newPrice = yPositionToPrice(newY);
        
        setOrderConfig(prev => ({
          ...prev,
          takeProfitPrice: newPrice
        }));
        
        tpBarPosition.setValue(gestureState.moveY - (chartDimensions.y || 0) - 15);
      },
      onPanResponderRelease: () => {
        debugLogger.debug('Finalizando arrastre de TP', { 
          price: orderConfig.takeProfitPrice 
        });
      },
    });
  };

  // Crear PanResponder para la barra de SL
  const createSLPanResponder = () => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        debugLogger.debug('Iniciando arrastre de SL');
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = Math.max(0, Math.min(chartDimensions.height, gestureState.moveY - (chartDimensions.y || 0)));
        const newPrice = yPositionToPrice(newY);
        
        setOrderConfig(prev => ({
          ...prev,
          stopLossPrice: newPrice
        }));
        
        slBarPosition.setValue(gestureState.moveY - (chartDimensions.y || 0) - 15);
      },
      onPanResponderRelease: () => {
        debugLogger.debug('Finalizando arrastre de SL', { 
          price: orderConfig.stopLossPrice 
        });
      },
    });
  };

  const tpPanResponder = createTPPanResponder();
  const slPanResponder = createSLPanResponder();

  // Ejecutar la orden configurada
  const executeOrder = async () => {
    if (!orderConfig.isConfiguring || !orderConfig.entryPrice) return;

    const orderParams = {
      symbol,
      side: orderConfig.side,
      type: OrderType.MARKET,
      usdtAmount: orderConfig.quantity,
      takeProfitPrice: orderConfig.takeProfitPrice || undefined,
      stopLossPrice: orderConfig.stopLossPrice || undefined,
      notes: `Orden visual desde overlay - ${orderConfig.side}`,
    };

    debugLogger.debug('Ejecutando orden visual', orderParams);

    try {
      const result = await createOrder(orderParams);
      
      if (result.success) {
        // Resetear configuración
        setOrderConfig(prev => ({
          ...prev,
          isConfiguring: false,
          entryPrice: null,
          takeProfitPrice: null,
          stopLossPrice: null,
        }));
        
        // Ocultar barras
        Animated.parallel([
          Animated.timing(tpBarPosition, {
            toValue: -100,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(slBarPosition, {
            toValue: chartDimensions.height + 100,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start();

        debugLogger.debug('Orden ejecutada exitosamente', result.order);
      } else {
        debugLogger.error('Error al ejecutar orden', result.errors);
      }
    } catch (error) {
      debugLogger.error('Error al ejecutar orden', error);
    }
  };

  // Cancelar configuración
  const cancelOrderConfig = () => {
    setOrderConfig(prev => ({
      ...prev,
      isConfiguring: false,
      entryPrice: null,
      takeProfitPrice: null,
      stopLossPrice: null,
    }));
    
    // Ocultar barras
    Animated.parallel([
      Animated.timing(tpBarPosition, {
        toValue: -100,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(slBarPosition, {
        toValue: chartDimensions.height + 100,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  };

  // Actualizar cantidad por porcentaje
  const updateQuantityPercentage = (percentage: number) => {
    const balance = portfolio?.totalBalance || 10000;
    const amount = (balance * percentage) / 100;
    
    setOrderConfig(prev => ({
      ...prev,
      quantityPercentage: percentage,
      quantity: amount,
      quantityType: 'percentage'
    }));
  };

  // Actualizar cantidad por monto
  const updateQuantityAmount = (amount: number) => {
    const balance = portfolio?.totalBalance || 10000;
    const percentage = (amount / balance) * 100;
    
    setOrderConfig(prev => ({
      ...prev,
      quantityAmount: amount,
      quantity: amount,
      quantityType: 'amount',
      quantityPercentage: percentage
    }));
  };

  // Log cuando se crea el overlay
  useEffect(() => {
    if (isVisible) {
      debugLogger.overlayCreate(chartDimensions, {
        visible: isVisible,
        zIndex: 1000
      });
    }
  }, [isVisible, chartDimensions]);

  // Efecto para inicializar barras fuera de vista
  useEffect(() => {
    tpBarPosition.setValue(-100);
    slBarPosition.setValue(chartDimensions.height + 100);
  }, [chartDimensions.height, tpBarPosition, slBarPosition]);

  // Log cuando se posiciona el overlay
  useEffect(() => {
    if (isVisible && overlayRef.current) {
      const chartBounds = {
        width: chartDimensions.width,
        height: chartDimensions.height,
        x: chartDimensions.x || 0,
        y: chartDimensions.y || 0
      };

      const overlayBounds = {
        width: chartDimensions.width,
        height: chartDimensions.height,
        x: chartDimensions.x || 0,
        y: chartDimensions.y || 0
      };

      const aligned = JSON.stringify(chartBounds) === JSON.stringify(overlayBounds);
      
      debugLogger.overlayPosition(chartBounds, overlayBounds, aligned);
    }
  }, [isVisible, chartDimensions]);

  // Manejar clicks en el overlay
  const handleOverlayClick = (event: any) => {
    const clickPosition = {
      x: event.nativeEvent?.pageX || event.pageX || 0,
      y: event.nativeEvent?.pageY || event.pageY || 0,
      target: 'TradingOverlay'
    };

    debugLogger.overlayClick(clickPosition, {
      colorState,
      visible: isVisible,
      timestamp: Date.now()
    });

    // Sistema de un click para activar, otro para ejecutar
    if (!orderConfig.isConfiguring) {
      // Primer click: determinar si es BUY o SELL basado en la posición del click
      const clickY = event.nativeEvent?.locationY || 0;
      const centerY = chartDimensions.height / 2;
      const side = clickY < centerY ? OrderSide.BUY : OrderSide.SELL;
      
      // Activar configuración
      initializeOrderConfig(side);
      debugLogger.debug('Activando configuración de orden', { side, clickY, centerY });
    } else {
      // Segundo click: ejecutar orden
      executeOrder();
      debugLogger.debug('Ejecutando orden configurada');
    }

    // Llamar al callback si existe
    if (onOverlayClick) {
      onOverlayClick(event);
    }
  };

  // Cerrar overlay (solo con botón "Cerrar Orden")
  const handleClose = (reason: 'CLOSE_ORDER_BUTTON' | 'MANUAL' | 'ERROR' = 'MANUAL') => {
    debugLogger.overlayClose(reason, {
      colorState,
      visible: isVisible,
      finalTimestamp: Date.now()
    });

    // Si está configurando una orden, cancelarla
    if (orderConfig.isConfiguring) {
      cancelOrderConfig();
    }

    if (onClose) {
      onClose();
    }
  };

  // Funciones para manejar colores independientes
  const toggleSupportResistance = () => {
    setColorState(prev => ({
      ...prev,
      supportResistance: !prev.supportResistance
    }));
  };

  const toggleTradingLines = () => {
    setColorState(prev => ({
      ...prev,
      tradingLines: !prev.tradingLines
    }));
  };

  const toggleIndicators = () => {
    setColorState(prev => ({
      ...prev,
      indicators: !prev.indicators
    }));
  };

  if (!isVisible) {
    return null;
  }

  const currentPrice = getCurrentPrice();
  const balance = portfolio?.totalBalance || 10000;

  return (
    <>
      {/* Barra de Take Profit (Verde) - Arriba del gráfico */}
      {orderConfig.isConfiguring && (
        <Animated.View
          style={[
            styles.tpBar,
            {
              top: tpBarPosition,
              left: chartDimensions.x || 0,
              width: chartDimensions.width,
            }
          ]}
          {...tpPanResponder.panHandlers}
        >
          <View style={styles.tpBarHandle}>
            <Text style={styles.tpBarText}>
              TP: {orderConfig.takeProfitPrice ? `$${orderConfig.takeProfitPrice.toFixed(2)}` : '∞'}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Barra de Stop Loss (Roja) - Abajo del gráfico */}
      {orderConfig.isConfiguring && (
        <Animated.View
          style={[
            styles.slBar,
            {
              top: slBarPosition,
              left: chartDimensions.x || 0,
              width: chartDimensions.width,
            }
          ]}
          {...slPanResponder.panHandlers}
        >
          <View style={styles.slBarHandle}>
            <Text style={styles.slBarText}>
              SL: {orderConfig.stopLossPrice ? `$${orderConfig.stopLossPrice.toFixed(2)}` : '0'}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Panel de Control de Cantidad - Solo cuando se está configurando */}
      {orderConfig.isConfiguring && (
        <View style={[
          styles.quantityPanel,
          {
            top: (chartDimensions.y || 0) - 120,
            left: (chartDimensions.x || 0) + 20,
          }
        ]}>
          <Text style={styles.quantityTitle}>Cantidad</Text>
          
          {/* Controles de porcentaje */}
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={[
                styles.quantityButton,
                orderConfig.quantityPercentage === 1 && styles.quantityButtonActive
              ]}
              onPress={() => updateQuantityPercentage(1)}
            >
              <Text style={styles.quantityButtonText}>1%</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.quantityButton,
                orderConfig.quantityPercentage === 2 && styles.quantityButtonActive
              ]}
              onPress={() => updateQuantityPercentage(2)}
            >
              <Text style={styles.quantityButtonText}>2%</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.quantityButton,
                orderConfig.quantityPercentage === 5 && styles.quantityButtonActive
              ]}
              onPress={() => updateQuantityPercentage(5)}
            >
              <Text style={styles.quantityButtonText}>5%</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.quantityButton,
                orderConfig.quantityPercentage === 10 && styles.quantityButtonActive
              ]}
              onPress={() => updateQuantityPercentage(10)}
            >
              <Text style={styles.quantityButtonText}>10%</Text>
            </TouchableOpacity>
          </View>
          
          {/* Información de la cantidad */}
          <View style={styles.quantityInfo}>
            <Text style={styles.quantityInfoText}>
              ${orderConfig.quantity.toFixed(2)} ({orderConfig.quantityPercentage.toFixed(1)}%)
            </Text>
            <Text style={styles.quantityInfoBalance}>
              Balance: ${balance.toFixed(2)}
            </Text>
          </View>
          
          {/* Información de la orden */}
          <View style={styles.orderInfo}>
            <Text style={styles.orderInfoText}>
              {orderConfig.side} @ ${currentPrice.toFixed(2)}
            </Text>
            {orderConfig.takeProfitPrice && (
              <Text style={styles.orderInfoTP}>
                TP: ${orderConfig.takeProfitPrice.toFixed(2)}
              </Text>
            )}
            {orderConfig.stopLossPrice && (
              <Text style={styles.orderInfoSL}>
                SL: ${orderConfig.stopLossPrice.toFixed(2)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Botón Ejecutar Orden - Solo cuando se está configurando */}
      {orderConfig.isConfiguring && (
        <TouchableOpacity
          style={[
            styles.executeButton,
            {
              top: (chartDimensions.y || 0) + chartDimensions.height - 60,
              left: (chartDimensions.x || 0) + chartDimensions.width - 120,
            }
          ]}
          onPress={executeOrder}
        >
          <Text style={styles.executeButtonText}>Ejecutar {orderConfig.side}</Text>
        </TouchableOpacity>
      )}

      {/* Botón Cancelar - Solo cuando se está configurando */}
      {orderConfig.isConfiguring && (
        <TouchableOpacity
          style={[
            styles.cancelButton,
            {
              top: (chartDimensions.y || 0) + chartDimensions.height - 60,
              left: (chartDimensions.x || 0) + 20,
            }
          ]}
          onPress={cancelOrderConfig}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      )}

      {/* Botón Cerrar Orden - Posicionado encima del panel */}
      <TouchableOpacity
        style={[
          styles.closeButton,
          {
            top: (chartDimensions.y || 80) - 45, // 45px arriba del panel, default 80
            right: 20,
          }
        ]}
        onPress={() => handleClose('CLOSE_ORDER_BUTTON')}
      >
        <Text style={styles.closeButtonText}>Cerrar Orden</Text>
      </TouchableOpacity>

      {/* Panel del Overlay */}
      <View
        ref={overlayRef}
        style={[
          styles.overlay,
          {
            width: chartDimensions.width,
            height: chartDimensions.height,
            left: chartDimensions.x || 0,
            top: chartDimensions.y || 0,
          }
        ]}
        onTouchEnd={handleOverlayClick}
        pointerEvents="box-none" // Permite que eventos pasen al gráfico debajo
      >
        {/* Líneas punteadas para TP/SL en el gráfico */}
        {orderConfig.isConfiguring && orderConfig.takeProfitPrice && (
          <View style={[
            styles.tpLine,
            {
              top: priceToYPosition(orderConfig.takeProfitPrice),
            }
          ]} />
        )}
        
        {orderConfig.isConfiguring && orderConfig.stopLossPrice && (
          <View style={[
            styles.slLine,
            {
              top: priceToYPosition(orderConfig.stopLossPrice),
            }
          ]} />
        )}

        {/* Área de colores superpuesta (funcionalidad existente) */}
        <View style={styles.colorContainer}>
          {/* Header del panel */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>
              {orderConfig.isConfiguring ? `Configurar ${orderConfig.side}` : 'Click para Configurar Orden'}
            </Text>
            <Text style={styles.panelSubtitle}>
              {orderConfig.isConfiguring 
                ? 'Arrastra barras TP/SL, luego click para ejecutar'
                : 'Arriba = BUY, Abajo = SELL'
              }
            </Text>
          </View>

          {/* Líneas de soporte y resistencia */}
          {colorState.supportResistance && !orderConfig.isConfiguring && (
            <>
              <View style={[styles.colorLine, styles.supportLine]} />
              <Text style={[styles.colorLabel, styles.supportLabel]}>Soporte</Text>
              <View style={[styles.colorLine, styles.resistanceLine]} />
              <Text style={[styles.colorLabel, styles.resistanceLabel]}>Resistencia</Text>
            </>
          )}
          
          {/* Líneas de trading */}
          {colorState.tradingLines && !orderConfig.isConfiguring && (
            <>
              <View style={[styles.colorLine, styles.buyLine]} />
              <Text style={[styles.colorLabel, styles.buyLabel]}>Entrada Compra</Text>
              <View style={[styles.colorLine, styles.sellLine]} />
              <Text style={[styles.colorLabel, styles.sellLabel]}>Stop Loss</Text>
            </>
          )}

          {/* Indicadores técnicos */}
          {colorState.indicators && !orderConfig.isConfiguring && (
            <View style={styles.indicatorOverlay}>
              <Text style={styles.indicatorLabel}>Indicadores Técnicos</Text>
            </View>
          )}
        </View>

        {/* Panel de control pequeño (opcional) */}
        {__DEV__ && !orderConfig.isConfiguring && (
          <View style={styles.debugPanel}>
            <TouchableOpacity style={styles.debugButton} onPress={toggleSupportResistance}>
              <View style={[
                styles.debugIndicator,
                { backgroundColor: colorState.supportResistance ? '#00ff00' : '#ff0000' }
              ]} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.debugButton} onPress={toggleTradingLines}>
              <View style={[
                styles.debugIndicator,
                { backgroundColor: colorState.tradingLines ? '#00ff00' : '#ff0000' }
              ]} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.debugButton} onPress={toggleIndicators}>
              <View style={[
                styles.debugIndicator,
                { backgroundColor: colorState.indicators ? '#00ff00' : '#ff0000' }
              ]} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  // Botón Cerrar Orden - encima del panel
  closeButton: {
    position: 'absolute',
    backgroundColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001, // Encima del overlay
  },
  closeButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  
  // Barras de TP/SL
  tpBar: {
    position: 'absolute',
    height: 30,
    backgroundColor: 'rgba(0, 255, 0, 0.8)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1002,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  tpBarHandle: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tpBarText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  
  slBar: {
    position: 'absolute',
    height: 30,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1002,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  slBarHandle: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slBarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  
  // Líneas punteadas en el gráfico
  tpLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0, 255, 0, 0.6)',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.8)',
  },
  slLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 0, 0, 0.6)',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.8)',
  },
  
  // Panel de configuración de cantidad
  quantityPanel: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#00ff88',
    zIndex: 1003,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  quantityTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quantityButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 50,
    alignItems: 'center',
  },
  quantityButtonActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.3)',
    borderColor: '#00ff88',
  },
  quantityButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quantityInfo: {
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  quantityInfoText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  quantityInfoBalance: {
    color: '#888',
    fontSize: 12,
  },
  orderInfo: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  orderInfoText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  orderInfoTP: {
    color: '#00ff00',
    fontSize: 12,
    marginBottom: 2,
  },
  orderInfoSL: {
    color: '#ff0000',
    fontSize: 12,
  },
  
  // Botones de acción
  executeButton: {
    position: 'absolute',
    backgroundColor: '#00ff88',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    zIndex: 1003,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  executeButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cancelButton: {
    position: 'absolute',
    backgroundColor: '#666',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    zIndex: 1003,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  
  // Overlay principal
  overlay: {
    position: 'absolute',
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Más transparente cuando no se está configurando
    borderWidth: 2,
    borderColor: '#00ff88',
    borderStyle: 'solid',
    borderRadius: 8,
  },
  colorContainer: {
    flex: 1,
    position: 'relative',
    padding: 16,
  },
  
  // Header del panel
  panelHeader: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 255, 136, 0.3)',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  panelSubtitle: {
    fontSize: 14,
    color: '#888888',
  },
  
  // Líneas de colores (funcionalidad existente)
  colorLine: {
    position: 'absolute',
    height: 2,
    left: 0,
    right: 0,
  },
  supportLine: {
    backgroundColor: 'rgba(0, 255, 0, 0.7)',
    top: '30%',
  },
  resistanceLine: {
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    top: '20%',
  },
  buyLine: {
    backgroundColor: 'rgba(0, 255, 255, 0.6)',
    top: '70%',
  },
  sellLine: {
    backgroundColor: 'rgba(255, 255, 0, 0.6)',
    top: '80%',
  },
  
  // Labels para las líneas
  colorLabel: {
    position: 'absolute',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#ffffff',
  },
  supportLabel: {
    backgroundColor: 'rgba(0, 255, 0, 0.8)',
    top: '28%',
    left: 10,
  },
  resistanceLabel: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    top: '18%',
    left: 10,
  },
  buyLabel: {
    backgroundColor: 'rgba(0, 255, 255, 0.8)',
    top: '68%',
    left: 10,
  },
  sellLabel: {
    backgroundColor: 'rgba(255, 255, 0, 0.8)',
    top: '78%',
    left: 10,
  },
  indicatorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(128, 0, 128, 0.1)',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  debugPanel: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 5,
    borderRadius: 5,
  },
  debugButton: {
    marginHorizontal: 2,
    padding: 3,
  },
  debugIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

export default TradingOverlay;