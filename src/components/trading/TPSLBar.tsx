import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { formatPrice } from '../../utils/formatters';

interface TPSLBarProps {
  id: string;
  type: 'tp' | 'sl';
  price: number;
  symbol: string;
  position: { x: number; y: number };
  chartDimensions: { width: number; height: number };
  onPositionChange: (type: 'tp' | 'sl', newY: number) => void;
  isDraggable?: boolean;
}

const TPSLBar: React.FC<TPSLBarProps> = ({
  id,
  type,
  price,
  symbol,
  position,
  chartDimensions,
  onPositionChange,
  isDraggable = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [currentY, setCurrentY] = useState(position.y);

  // Crear PanResponder para manejar el arrastre
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: () => isDraggable,
    onPanResponderGrant: () => {
      setIsDragging(true);
    },
    onPanResponderMove: (evt, gestureState) => {
      if (!isDraggable) return;

      const newY = position.y + gestureState.dy;
      
      // Limitar movimiento dentro del área del gráfico
      const clampedY = Math.max(10, Math.min(newY, chartDimensions.height - 10));
      setCurrentY(clampedY);
    },
    onPanResponderRelease: (evt, gestureState) => {
      setIsDragging(false);
      
      if (!isDraggable) return;
      
      const newY = position.y + gestureState.dy;
      const clampedY = Math.max(10, Math.min(newY, chartDimensions.height - 10));
      
      // Notificar cambio de posición
      onPositionChange(type, clampedY);
    },
  });

  // Actualizar posición cuando cambie externamente
  useEffect(() => {
    if (!isDragging) {
      setCurrentY(position.y);
    }
  }, [position.y, isDragging]);

  const barColor = type === 'tp' ? '#00ff88' : '#ff4444';
  const barLabel = type === 'tp' ? 'TP' : 'SL';
  const displayY = isDragging ? currentY : position.y;

  return (
    <View style={[styles.barContainer, { top: displayY }]}>
      {/* Línea horizontal que se extiende a través del gráfico */}
      <View
        style={[
          styles.horizontalLine,
          {
            backgroundColor: barColor,
            width: chartDimensions.width - position.x,
            opacity: isDragging ? 0.9 : 0.7,
          },
        ]}
      />
      
      {/* Controlador/indicador en la esquina izquierda */}
      <TouchableOpacity
        style={[
          styles.barController, 
          { 
            backgroundColor: barColor,
            opacity: isDragging ? 1 : 0.9,
            transform: [{ scale: isDragging ? 1.1 : 1 }],
          }
        ]}
        {...panResponder.panHandlers}
        activeOpacity={0.8}
      >
        <View style={styles.gripLines}>
          <View style={[styles.gripLine, { backgroundColor: '#ffffff' }]} />
          <View style={[styles.gripLine, { backgroundColor: '#ffffff' }]} />
          <View style={[styles.gripLine, { backgroundColor: '#ffffff' }]} />
        </View>
        
        <Text style={styles.barLabel}>{barLabel}</Text>
        
        <Text style={styles.priceText}>
          ${formatPrice(price, symbol)}
        </Text>
      </TouchableOpacity>
      
      {/* Indicador de arrastre visual */}
      {isDraggable && (
        <View style={[styles.dragIndicator, { borderColor: barColor }]}>
          <Text style={[styles.dragText, { color: barColor }]}>⇅</Text>
        </View>
      )}
    </View>
  );
};

interface TPSLControlsProps {
  tpBar?: {
    id: string;
    price: number;
    position: { x: number; y: number };
  } | null;
  slBar?: {
    id: string;
    price: number;
    position: { x: number; y: number };
  } | null;
  symbol: string;
  chartDimensions: { width: number; height: number };
  onTPPositionChange: (newY: number) => void;
  onSLPositionChange: (newY: number) => void;
  isDraggable?: boolean;
}

export const TPSLControls: React.FC<TPSLControlsProps> = ({
  tpBar,
  slBar,
  symbol,
  chartDimensions,
  onTPPositionChange,
  onSLPositionChange,
  isDraggable = true,
}) => {
  return (
    <View style={styles.controlsContainer}>
      {tpBar && (
        <TPSLBar
          id={tpBar.id}
          type="tp"
          price={tpBar.price}
          symbol={symbol}
          position={tpBar.position}
          chartDimensions={chartDimensions}
          onPositionChange={(type, newY) => onTPPositionChange(newY)}
          isDraggable={isDraggable}
        />
      )}
      
      {slBar && (
        <TPSLBar
          id={slBar.id}
          type="sl"
          price={slBar.price}
          symbol={symbol}
          position={slBar.position}
          chartDimensions={chartDimensions}
          onPositionChange={(type, newY) => onSLPositionChange(newY)}
          isDraggable={isDraggable}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  controlsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 150,
    pointerEvents: 'box-none', // Permitir que eventos pasen a través excepto en los controles
  },
  barContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 151,
    pointerEvents: 'box-none',
  },
  horizontalLine: {
    height: 2,
    position: 'absolute',
    left: 0,
  },
  barController: {
    position: 'absolute',
    left: 10,
    width: 80,
    height: 36,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#ffffff',
    pointerEvents: 'auto', // Habilitar eventos en el controlador
  },
  gripLines: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  gripLine: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
  barLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  priceText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 20,
  },
  dragIndicator: {
    position: 'absolute',
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none', // No interceptar eventos de arrastre
  },
  dragText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default TPSLBar;