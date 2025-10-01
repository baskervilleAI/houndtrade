import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  GestureResponderEvent,
  Text,
  TouchableOpacity,
} from 'react-native';
import { formatPrice } from '../../utils/formatters';
import { OrderSide } from '../../types/trading';
import OverlayManagerService, { OverlayPosition } from '../../services/overlayManagerService';
import { TPSLControls } from './TPSLBar';

interface CentralizedTradingOverlayProps {
  chartDimensions: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  symbol: string;
  latestPrice?: number;
  priceScale?: {
    min: number;
    max: number;
    pixelsPerPrice: number;
  };
  onOverlayClick?: (event: GestureResponderEvent) => void;
  onClose?: () => void;
}

const CentralizedTradingOverlay: React.FC<CentralizedTradingOverlayProps> = ({
  chartDimensions,
  symbol,
  latestPrice,
  priceScale,
  onOverlayClick,
  onClose,
}) => {
  const [overlayState, setOverlayState] = useState(OverlayManagerService.getInstance().getState());
  const overlayManager = OverlayManagerService.getInstance();

  // Suscribirse a cambios del overlay manager
  useEffect(() => {
    const unsubscribe = overlayManager.subscribe(setOverlayState);
    return unsubscribe;
  }, [overlayManager]);

  // Actualizar dimensiones del gráfico en el manager
  useEffect(() => {
    overlayManager.setChartDimensions({
      width: chartDimensions.width,
      height: chartDimensions.height,
      x: chartDimensions.x || 0,
      y: chartDimensions.y || 0,
    });
  }, [chartDimensions, overlayManager]);

  // Actualizar escala de precios en el manager
  useEffect(() => {
    if (priceScale) {
      overlayManager.setPriceScale(priceScale);
    }
  }, [priceScale, overlayManager]);

  const height = chartDimensions.height;
  const width = chartDimensions.width;

  // Funciones auxiliares para conversión de precios
  const priceToOffset = useCallback(
    (price: number) => {
      if (!priceScale || !priceScale.max || !priceScale.min) {
        return height / 2;
      }

      const priceRange = priceScale.max - priceScale.min;
      if (priceRange === 0) return height / 2;

      const clampedPrice = Math.min(Math.max(price, priceScale.min), priceScale.max);
      const ratio = (priceScale.max - clampedPrice) / priceRange;
      return ratio * height;
    },
    [priceScale, height]
  );

  const latestPriceOffset = React.useMemo(() => {
    if (!priceScale || latestPrice === undefined || latestPrice === null) {
      return height / 2;
    }
    return priceToOffset(latestPrice);
  }, [priceScale, latestPrice, priceToOffset, height]);

  // Obtener posiciones visibles
  const visiblePositions = overlayState.positions;
  const activePosition = overlayState.activePositionId 
    ? visiblePositions.get(overlayState.activePositionId) 
    : null;

  // Renderizar líneas de posición con colores dinámicos
  const renderPositionLines = useCallback(() => {
    if (!priceScale || visiblePositions.size === 0) return null;

    const lines: React.ReactNode[] = [];

    visiblePositions.forEach((position, positionId) => {
      if (!position.isVisible) return;

      const entryOffset = priceToOffset(position.entryPrice);
      const isLong = position.side === OrderSide.BUY;
      
      // **COLORES DINÁMICOS BASADOS EN EL PRECIO DE ENTRADA**
      // Verde hacia arriba del entry price, rojo hacia abajo
      const currentPriceOffset = latestPrice ? priceToOffset(latestPrice) : entryOffset;
      
      // Crear gradiente visual de colores
      // Zona superior (hacia arriba del entry) = verde
      const upperZoneHeight = entryOffset;
      if (upperZoneHeight > 0) {
        lines.push(
          <View
            key={`upper-zone-${positionId}`}
            style={[
              styles.colorZone,
              {
                top: 0,
                height: upperZoneHeight,
                backgroundColor: position.colors.upper,
                opacity: 0.1,
              },
            ]}
          />
        );
      }

      // Zona inferior (hacia abajo del entry) = rojo
      const lowerZoneHeight = height - entryOffset;
      if (lowerZoneHeight > 0) {
        lines.push(
          <View
            key={`lower-zone-${positionId}`}
            style={[
              styles.colorZone,
              {
                top: entryOffset,
                height: lowerZoneHeight,
                backgroundColor: position.colors.lower,
                opacity: 0.1,
              },
            ]}
          />
        );
      }

      // Línea de precio de entrada
      lines.push(
        <View
          key={`entry-${positionId}`}
          style={[
            styles.horizontalLine,
            styles.positionEntryLine,
            {
              top: Math.max(0, Math.min(entryOffset, height)),
              borderColor: position.colors.entry,
              borderWidth: 2,
              opacity: 0.9,
            },
          ]}
        />
      );

      // Label de precio de entrada
      lines.push(
        <View
          key={`entry-label-${positionId}`}
          style={[
            styles.positionLabel,
            styles.entryLabel,
            {
              top: Math.max(0, Math.min(entryOffset, height)) - 12,
              left: 8,
              backgroundColor: position.colors.entry,
              opacity: 0.9,
            },
          ]}
        >
          <Text style={styles.positionLabelText}>
            ENTRY: ${formatPrice(position.entryPrice, symbol)}
          </Text>
        </View>
      );

      // TP line si existe
      if (position.takeProfitPrice) {
        const tpOffset = priceToOffset(position.takeProfitPrice);
        lines.push(
          <View
            key={`tp-${positionId}`}
            style={[
              styles.horizontalLine,
              styles.positionTpLine,
              {
                top: Math.max(0, Math.min(tpOffset, height)),
                borderColor: position.colors.tp,
              },
            ]}
          />
        );

        lines.push(
          <View
            key={`tp-label-${positionId}`}
            style={[
              styles.positionLabel,
              styles.tpLabel,
              {
                top: Math.max(0, Math.min(tpOffset, height)) - 12,
                left: 8,
                backgroundColor: position.colors.tp,
              },
            ]}
          >
            <Text style={styles.positionLabelText}>
              TP: ${formatPrice(position.takeProfitPrice, symbol)}
            </Text>
          </View>
        );
      }

      // SL line si existe
      if (position.stopLossPrice) {
        const slOffset = priceToOffset(position.stopLossPrice);
        lines.push(
          <View
            key={`sl-${positionId}`}
            style={[
              styles.horizontalLine,
              styles.positionSlLine,
              {
                top: Math.max(0, Math.min(slOffset, height)),
                borderColor: position.colors.sl,
              },
            ]}
          />
        );

        lines.push(
          <View
            key={`sl-label-${positionId}`}
            style={[
              styles.positionLabel,
              styles.slLabel,
              {
                top: Math.max(0, Math.min(slOffset, height)) - 12,
                left: 8,
                backgroundColor: position.colors.sl,
              },
            ]}
          >
            <Text style={styles.positionLabelText}>
              SL: ${formatPrice(position.stopLossPrice, symbol)}
            </Text>
          </View>
        );
      }
    });

    return lines;
  }, [priceScale, visiblePositions, priceToOffset, height, symbol, latestPrice]);

  // Manejar cambios de posición de TP/SL
  const handleTPPositionChange = useCallback((newY: number) => {
    overlayManager.updateTPSLBarPosition('tp', newY);
  }, [overlayManager]);

  const handleSLPositionChange = useCallback((newY: number) => {
    overlayManager.updateTPSLBarPosition('sl', newY);
  }, [overlayManager]);

  // No mostrar overlay si no está activo
  if (!overlayState.isActive) {
    return null;
  }

  const handleTouchEnd = (event: GestureResponderEvent) => {
    onOverlayClick?.(event);
  };

  const hasScale = !!priceScale && latestPrice !== undefined && latestPrice !== null;

  return (
    <View
      style={[
        styles.overlay,
        {
          width: chartDimensions.width,
          height,
          left: chartDimensions.x ?? 0,
          top: chartDimensions.y ?? 0,
        },
      ]}
      onTouchEnd={handleTouchEnd}
    >
      {hasScale && (
        <>
          {/* Renderizar líneas de posición con colores dinámicos */}
          {renderPositionLines()}

          {/* Línea de precio actual */}
          <View
            style={[
              styles.horizontalLine,
              styles.currentPriceLine,
              { top: Math.max(0, Math.min(latestPriceOffset, height)) },
            ]}
          />
        </>
      )}

      {/* Controles TP/SL ajustables */}
      {overlayState.controls && (overlayState.controls.tpBar || overlayState.controls.slBar) && (
        <TPSLControls
          tpBar={overlayState.controls.tpBar}
          slBar={overlayState.controls.slBar}
          symbol={symbol}
          chartDimensions={chartDimensions}
          onTPPositionChange={handleTPPositionChange}
          onSLPositionChange={handleSLPositionChange}
          isDraggable={true}
        />
      )}

      {/* Información de posición activa */}
      {activePosition && (
        <View style={styles.positionInfo}>
          <TouchableOpacity
            style={styles.positionInfoContainer}
            onPress={() => {
              console.log(`🎯 [POSITION INFO] Presionado - posición activa:`, activePosition);
              // Aquí se puede agregar lógica adicional si es necesario
            }}
          >
            <Text style={styles.positionInfoText}>
              {activePosition.side} • ${formatPrice(activePosition.entryPrice, symbol)}
            </Text>
            <Text style={[
              styles.positionPnlText,
              { color: activePosition.unrealizedPnL >= 0 ? '#00ff88' : '#ff4444' }
            ]}>
              {activePosition.unrealizedPnL >= 0 ? '+' : ''}${activePosition.unrealizedPnL.toFixed(2)}
            </Text>
          </TouchableOpacity>

          {/* Botón para cerrar overlay */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              console.log(`🧹 [OVERLAY CLOSE] Cerrando overlay desde botón`);
              overlayManager.deactivateOverlay();
              onClose?.();
            }}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    backgroundColor: 'transparent',
    zIndex: 100,
    overflow: 'visible',
  },
  colorZone: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  horizontalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  positionEntryLine: {
    borderStyle: 'solid',
  },
  positionTpLine: {
    borderStyle: 'dashed',
    borderTopWidth: 2,
  },
  positionSlLine: {
    borderStyle: 'dashed',
    borderTopWidth: 2,
  },
  currentPriceLine: {
    borderColor: '#ffffff',
    opacity: 0.3,
  },
  positionLabel: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 102,
  },
  entryLabel: {
    // backgroundColor set dynamically
  },
  tpLabel: {
    // backgroundColor set dynamically
  },
  slLabel: {
    // backgroundColor set dynamically
  },
  positionLabelText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  positionInfo: {
    position: 'absolute',
    bottom: 20,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 103,
  },
  positionInfoContainer: {
    backgroundColor: 'rgba(26, 26, 26, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333333',
    flex: 1,
    marginRight: 8,
  },
  positionInfoText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  positionPnlText: {
    fontSize: 11,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CentralizedTradingOverlay;