import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { formatPrice } from '../../utils/formatters';
import { OrderSide } from '../../types/trading';

interface SimpleColorOverlayProps {
  chartDimensions: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  position: {
    id: string;
    symbol: string;
    side: OrderSide;
    entryPrice: number;
    quantity: number;
  } | null;
  latestPrice?: number;
  priceScale?: {
    min: number;
    max: number;
    pixelsPerPrice: number;
  };
  onClose?: () => void;
}

const SimpleColorOverlay: React.FC<SimpleColorOverlayProps> = ({
  chartDimensions,
  position,
  latestPrice,
  priceScale,
  onClose,
}) => {
  const height = chartDimensions.height;
  const width = chartDimensions.width;

  // Función para convertir precio a posición Y
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

  // No mostrar si no hay posición o escala de precios
  if (!position || !priceScale) {
    return null;
  }

  const entryOffset = priceToOffset(position.entryPrice);

  // Zona superior (verde) - desde el top hasta el entry price
  const upperZoneHeight = entryOffset;
  
  // Zona inferior (roja) - desde el entry price hasta el bottom
  const lowerZoneHeight = height - entryOffset;

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
    >
      {/* Zona superior - VERDE (Profit zone para LONG, Loss zone para SHORT) */}
      {upperZoneHeight > 0 && (
        <View
          style={[
            styles.colorZone,
            {
              top: 0,
              height: upperZoneHeight,
              backgroundColor: '#00ff88', // Verde
              opacity: 0.15,
            },
          ]}
        />
      )}

      {/* Zona inferior - ROJA (Loss zone para LONG, Profit zone para SHORT) */}
      {lowerZoneHeight > 0 && (
        <View
          style={[
            styles.colorZone,
            {
              top: entryOffset,
              height: lowerZoneHeight,
              backgroundColor: '#ff4444', // Rojo
              opacity: 0.15,
            },
          ]}
        />
      )}

      {/* Línea de precio de entrada */}
      <View
        style={[
          styles.entryLine,
          {
            top: Math.max(0, Math.min(entryOffset, height)),
            borderColor: position.side === OrderSide.BUY ? '#00ff88' : '#ff4444',
          },
        ]}
      />

      {/* Label de precio de entrada */}
      <View
        style={[
          styles.entryLabel,
          {
            top: Math.max(0, Math.min(entryOffset, height)) - 12,
            left: 8,
            backgroundColor: position.side === OrderSide.BUY ? '#00ff88' : '#ff4444',
          },
        ]}
      >
        <Text style={styles.entryLabelText}>
          ENTRY: ${formatPrice(position.entryPrice, position.symbol)}
        </Text>
      </View>

      {/* Información de la posición y botón de cerrar */}
      <View style={styles.positionInfo}>
        <View style={styles.positionInfoContainer}>
          <Text style={styles.positionInfoText}>
            {position.symbol} • {position.side}
          </Text>
          <Text style={styles.positionEntryText}>
            Entry: ${formatPrice(position.entryPrice, position.symbol)}
          </Text>
        </View>

        {/* Botón para cerrar overlay */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            console.log('🧹 [SIMPLE OVERLAY] Cerrando overlay');
            onClose?.();
          }}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
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
  entryLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderStyle: 'solid',
    opacity: 0.9,
  },
  entryLabel: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 102,
  },
  entryLabelText: {
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
  positionEntryText: {
    color: '#888888',
    fontSize: 10,
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

export default SimpleColorOverlay;
