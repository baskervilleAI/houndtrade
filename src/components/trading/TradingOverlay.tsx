import React from 'react';
import { View, StyleSheet, GestureResponderEvent } from 'react-native';

interface TradingOverlayProps {
  chartDimensions: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  isVisible: boolean;
  onOverlayClick?: (event: GestureResponderEvent) => void;
  onClose?: () => void;
  symbol?: string;
  priceScale?: {
    min: number;
    max: number;
    pixelsPerPrice: number;
  };
  latestPrice?: number;
}

const TradingOverlay: React.FC<TradingOverlayProps> = ({
  chartDimensions,
  isVisible,
  onOverlayClick,
}) => {
  if (!isVisible) {
    return null;
  }

  const handleTouchEnd = (event: GestureResponderEvent) => {
    onOverlayClick?.(event);
  };

  return (
    <View
      style={[
        styles.overlay,
        {
          width: chartDimensions.width,
          height: chartDimensions.height,
          left: chartDimensions.x ?? 0,
          top: chartDimensions.y ?? 0,
        },
      ]}
      onTouchEnd={handleTouchEnd}
    />
  );
};

 

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#00ff88',
    borderRadius: 8,
    zIndex: 1000,
  },
});

export default TradingOverlay;