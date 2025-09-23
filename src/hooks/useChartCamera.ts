import { useState, useCallback, useMemo, useRef } from 'react';
import { Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export interface CameraState {
  // Zoom level (1.0 = fit all data, higher = zoomed in)
  zoomLevel: number;
  // Horizontal offset (0 = start, 1 = end)
  offsetX: number;
  // Vertical offset for price scale (0 = center, -1 = top, 1 = bottom)
  offsetY: number;
  // Price range focus (auto-calculated based on visible candles)
  minPrice: number;
  maxPrice: number;
  // Visible range in terms of candle indices
  startIndex: number;
  endIndex: number;
}

export interface CameraControls {
  // Current camera state
  camera: CameraState;
  
  // Zoom controls
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (level: number) => void;
  resetZoom: () => void;
  
  // Pan controls
  panLeft: () => void;
  panRight: () => void;
  panUp: () => void;
  panDown: () => void;
  setPan: (x: number, y: number) => void;
  
  // Navigation controls
  goToStart: () => void;
  goToEnd: () => void;
  goToIndex: (index: number) => void;
  goToTimestamp: (timestamp: number) => void;
  
  // Fit controls
  fitAll: () => void;
  fitVisible: () => void;
  fitPriceRange: (min: number, max: number) => void;
  
  // Helper functions
  getVisibleRange: () => { start: number; end: number; count: number };
  isFullyVisible: () => boolean;
  getCandleWidth: () => number;
  getVisibleCandleCount: () => number;
}

interface UseChartCameraProps {
  candleCount: number;
  chartWidth?: number;
  chartHeight?: number;
  minCandleWidth?: number;
  maxCandleWidth?: number;
  defaultZoom?: number;
  onCameraChange?: (camera: CameraState) => void;
}

export const useChartCamera = ({
  candleCount,
  chartWidth = screenWidth - 32,
  chartHeight = 300,
  minCandleWidth = 2,
  maxCandleWidth = 50,
  defaultZoom = 1.0,
  onCameraChange,
}: UseChartCameraProps): CameraControls => {
  const [zoomLevel, setZoomLevel] = useState(defaultZoom);
  const [offsetX, setOffsetX] = useState(1); // Start at the end (most recent data)
  const [offsetY, setOffsetY] = useState(0); // Center vertically
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100 });
  
  // Calculate derived values
  const candleWidth = useMemo(() => {
    if (candleCount === 0) return minCandleWidth;
    
    // Base width calculation: fit all candles in chart width
    const baseWidth = chartWidth / candleCount;
    
    // Apply zoom
    const zoomedWidth = baseWidth * zoomLevel;
    
    // Clamp to min/max bounds
    return Math.max(minCandleWidth, Math.min(maxCandleWidth, zoomedWidth));
  }, [candleCount, chartWidth, zoomLevel, minCandleWidth, maxCandleWidth]);
  
  const visibleCandleCount = useMemo(() => {
    return Math.floor(chartWidth / candleWidth);
  }, [chartWidth, candleWidth]);
  
  const { startIndex, endIndex } = useMemo(() => {
    if (candleCount === 0) return { startIndex: 0, endIndex: 0 };
    
    const totalVisibleCandles = Math.min(visibleCandleCount, candleCount);
    const maxOffset = candleCount - totalVisibleCandles;
    
    // Calculate start position based on offsetX (0 = start, 1 = end)
    const startIdx = Math.floor(offsetX * maxOffset);
    const endIdx = Math.min(startIdx + totalVisibleCandles, candleCount);
    
    return {
      startIndex: Math.max(0, startIdx),
      endIndex: Math.max(0, endIdx),
    };
  }, [candleCount, visibleCandleCount, offsetX]);
  
  // Camera state object
  const camera: CameraState = useMemo(() => ({
    zoomLevel,
    offsetX,
    offsetY,
    minPrice: priceRange.min,
    maxPrice: priceRange.max,
    startIndex,
    endIndex,
  }), [zoomLevel, offsetX, offsetY, priceRange, startIndex, endIndex]);
  
  // Notify when camera changes
  const notifyChange = useCallback(() => {
    onCameraChange?.(camera);
  }, [camera, onCameraChange]);
  
  // Zoom controls
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.5, 20)); // Max 20x zoom
    notifyChange();
  }, [notifyChange]);
  
  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.1)); // Min 0.1x zoom
    notifyChange();
  }, [notifyChange]);
  
  const setZoom = useCallback((level: number) => {
    setZoomLevel(Math.max(0.1, Math.min(20, level)));
    notifyChange();
  }, [notifyChange]);
  
  const resetZoom = useCallback(() => {
    setZoomLevel(defaultZoom);
    notifyChange();
  }, [defaultZoom, notifyChange]);
  
  // Pan controls
  const panLeft = useCallback(() => {
    setOffsetX(prev => Math.max(0, prev - 0.1));
    notifyChange();
  }, [notifyChange]);
  
  const panRight = useCallback(() => {
    setOffsetX(prev => Math.min(1, prev + 0.1));
    notifyChange();
  }, [notifyChange]);
  
  const panUp = useCallback(() => {
    setOffsetY(prev => Math.max(-1, prev - 0.1));
    notifyChange();
  }, [notifyChange]);
  
  const panDown = useCallback(() => {
    setOffsetY(prev => Math.min(1, prev + 0.1));
    notifyChange();
  }, [notifyChange]);
  
  const setPan = useCallback((x: number, y: number) => {
    setOffsetX(Math.max(0, Math.min(1, x)));
    setOffsetY(Math.max(-1, Math.min(1, y)));
    notifyChange();
  }, [notifyChange]);
  
  // Navigation controls
  const goToStart = useCallback(() => {
    setOffsetX(0);
    notifyChange();
  }, [notifyChange]);
  
  const goToEnd = useCallback(() => {
    setOffsetX(1);
    notifyChange();
  }, [notifyChange]);
  
  const goToIndex = useCallback((index: number) => {
    if (candleCount === 0) return;
    
    const normalizedIndex = Math.max(0, Math.min(candleCount - 1, index));
    const newOffsetX = normalizedIndex / (candleCount - 1);
    setOffsetX(newOffsetX);
    notifyChange();
  }, [candleCount, notifyChange]);
  
  const goToTimestamp = useCallback((timestamp: number) => {
    // This would need to be implemented with actual candle data
    // For now, just go to end
    goToEnd();
  }, [goToEnd]);
  
  // Fit controls
  const fitAll = useCallback(() => {
    setZoomLevel(defaultZoom);
    setOffsetX(1); // Show most recent data
    setOffsetY(0);
    notifyChange();
  }, [defaultZoom, notifyChange]);
  
  const fitVisible = useCallback(() => {
    // Adjust zoom to fit visible candles optimally
    const optimalZoom = chartWidth / (visibleCandleCount * 8); // 8px per candle
    setZoomLevel(Math.max(0.1, Math.min(20, optimalZoom)));
    notifyChange();
  }, [chartWidth, visibleCandleCount, notifyChange]);
  
  const fitPriceRange = useCallback((min: number, max: number) => {
    setPriceRange({ min, max });
    setOffsetY(0); // Center on new price range
    notifyChange();
  }, [notifyChange]);
  
  // Helper functions
  const getVisibleRange = useCallback(() => ({
    start: startIndex,
    end: endIndex,
    count: endIndex - startIndex,
  }), [startIndex, endIndex]);
  
  const isFullyVisible = useCallback(() => {
    return startIndex === 0 && endIndex === candleCount;
  }, [startIndex, endIndex, candleCount]);
  
  const getCandleWidth = useCallback(() => candleWidth, [candleWidth]);
  
  const getVisibleCandleCount = useCallback(() => visibleCandleCount, [visibleCandleCount]);
  
  return {
    camera,
    zoomIn,
    zoomOut,
    setZoom,
    resetZoom,
    panLeft,
    panRight,
    panUp,
    panDown,
    setPan,
    goToStart,
    goToEnd,
    goToIndex,
    goToTimestamp,
    fitAll,
    fitVisible,
    fitPriceRange,
    getVisibleRange,
    isFullyVisible,
    getCandleWidth,
    getVisibleCandleCount,
  };
};

// Re-export integration hooks
export { 
  useChartJSIntegration, 
  useChartJSWebView, 
  useChartJSDirect 
} from './useChartJSIntegration';
