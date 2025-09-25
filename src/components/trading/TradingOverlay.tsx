import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { debugLogger } from '../../utils/debugLogger';

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
}

const TradingOverlay: React.FC<TradingOverlayProps> = ({
  chartDimensions,
  isVisible,
  onOverlayClick,
  onClose
}) => {
  const overlayRef = useRef<View>(null);
  const [colorState, setColorState] = useState({
    supportResistance: true,
    tradingLines: true,
    indicators: true
  });

  // Log cuando se crea el overlay
  useEffect(() => {
    if (isVisible) {
      debugLogger.overlayCreate(chartDimensions, {
        visible: isVisible,
        zIndex: 1000
      });
    }
  }, [isVisible, chartDimensions]);

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

  return (
    <>
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
        {/* Área de colores superpuesta */}
        <View style={styles.colorContainer}>
          {/* Header del panel */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Configurar Orden</Text>
            <Text style={styles.panelSubtitle}>Ajustar niveles de trading</Text>
          </View>

          {/* Líneas de soporte y resistencia */}
          {colorState.supportResistance && (
            <>
              <View style={[styles.colorLine, styles.supportLine]} />
              <Text style={[styles.colorLabel, styles.supportLabel]}>Soporte</Text>
              <View style={[styles.colorLine, styles.resistanceLine]} />
              <Text style={[styles.colorLabel, styles.resistanceLabel]}>Resistencia</Text>
            </>
          )}
          
          {/* Líneas de trading */}
          {colorState.tradingLines && (
            <>
              <View style={[styles.colorLine, styles.buyLine]} />
              <Text style={[styles.colorLabel, styles.buyLabel]}>Entrada Compra</Text>
              <View style={[styles.colorLine, styles.sellLine]} />
              <Text style={[styles.colorLabel, styles.sellLabel]}>Stop Loss</Text>
            </>
          )}

          {/* Indicadores técnicos */}
          {colorState.indicators && (
            <View style={styles.indicatorOverlay}>
              <Text style={styles.indicatorLabel}>Indicadores Técnicos</Text>
            </View>
          )}
        </View>

        {/* Panel de control pequeño (opcional) */}
        {__DEV__ && (
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
  overlay: {
    position: 'absolute',
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.8)', // Fondo más visible para el panel
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