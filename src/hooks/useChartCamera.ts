import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { logCameraAction, logCameraState } from '../utils/debugLogger';

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
  // Camera lock state - prevents auto-updates during streaming
  isLocked: boolean;
  // Preserve manual adjustments during streaming
  manuallyAdjusted: boolean;
  // Chart.js specific camera state
  chartJsZoom: {
    min: number | null;
    max: number | null;
    centerX: number | null;
  };
  // Force show latest candles flag
  followLatest: boolean;
  // Maximum candles to display (default 1000)
  maxVisibleCandles: number;
  // User interaction state
  isUserInteracting: boolean;
  // Temporary camera position during interaction (separate from fixed position)
  temporaryPosition: {
    zoomLevel: number;
    offsetX: number;
    offsetY: number;
  } | null;
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
  
  // Camera lock controls - preserves camera state during streaming
  lockCamera: () => void;
  unlockCamera: () => void;
  toggleLock: () => void;
  isLocked: () => boolean;
  
  // Auto-follow controls for live data
  enableAutoFollow: () => void;  // Automatically follow new data
  disableAutoFollow: () => void; // Stay at current position
  isAutoFollowing: () => boolean;
  
  // User interaction controls
  startUserInteraction: () => void;   // Se llama cuando el usuario empieza a interactuar
  endUserInteraction: () => void;     // Se llama cuando el usuario termina de interactuar
  setTemporaryPosition: (zoomLevel: number, offsetX: number, offsetY: number) => void; // Posición temporal durante interacción
  
  // Chart.js specific camera controls
  setChartJsZoomState: (min: number | null, max: number | null, centerX?: number | null) => void;
  resetCameraToLatest: () => void;
  lockCameraPosition: () => void;
  setMaxVisibleCandlesCount: (count: number) => void;
  
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
  onNewDataReceived?: boolean; // Signal that new data was received
}

export const useChartCamera = ({
  candleCount,
  chartWidth = screenWidth - 32,
  chartHeight = 300,
  minCandleWidth = 2,
  maxCandleWidth = 50,
  defaultZoom = 1.0,
  onCameraChange,
  onNewDataReceived = false,
}: UseChartCameraProps): CameraControls => {
  const [zoomLevel, setZoomLevel] = useState(defaultZoom);
  const [offsetX, setOffsetX] = useState(1); // Start at the end (most recent data)
  const [offsetY, setOffsetY] = useState(0); // Center vertically
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100 });
  const [isLocked, setIsLocked] = useState(false); // Camera lock state
  const [autoFollow, setAutoFollow] = useState(true); // Auto-follow new data
  const [manuallyAdjusted, setManuallyAdjusted] = useState(false);
  
  // Nuevos estados para manejar interacción del usuario
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [temporaryPosition, setTempPosition] = useState<{
    zoomLevel: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  
  // Chart.js specific camera state
  const [chartJsZoom, setChartJsZoom] = useState<{ min: number | null; max: number | null; centerX: number | null }>({
    min: null,
    max: null,
    centerX: null,
  });
  const [followLatest, setFollowLatest] = useState(true);
  const [maxVisibleCandles, setMaxVisibleCandles] = useState(1000);
  
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
    zoomLevel: temporaryPosition?.zoomLevel ?? zoomLevel,
    offsetX: temporaryPosition?.offsetX ?? offsetX,
    offsetY: temporaryPosition?.offsetY ?? offsetY,
    minPrice: priceRange.min,
    maxPrice: priceRange.max,
    startIndex,
    endIndex,
    isLocked,
    manuallyAdjusted,
    chartJsZoom,
    followLatest,
    maxVisibleCandles,
    isUserInteracting,
    temporaryPosition,
  }), [
    zoomLevel, 
    offsetX, 
    offsetY, 
    priceRange, 
    startIndex, 
    endIndex, 
    isLocked, 
    manuallyAdjusted, 
    chartJsZoom, 
    followLatest, 
    maxVisibleCandles,
    isUserInteracting,
    temporaryPosition
  ]);
  
  // Auto-follow effect: when new data is received and camera is not locked/manually adjusted
  useEffect(() => {
    if (onNewDataReceived && autoFollow && !isLocked && !manuallyAdjusted) {
      // Automatically follow new data by staying at the end
      setOffsetX(1);
      logCameraAction('Auto-following new data - staying at end');
    }
  }, [onNewDataReceived, autoFollow, isLocked, manuallyAdjusted]);
  
  // Notify when camera changes
  const notifyChange = useCallback(() => {
    onCameraChange?.(camera);
  }, [camera, onCameraChange]);
  
  // Zoom controls
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.5, 20)); // Max 20x zoom
    setManuallyAdjusted(true);
    notifyChange();
  }, [notifyChange]);
  
  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.1)); // Min 0.1x zoom
    setManuallyAdjusted(true);
    notifyChange();
  }, [notifyChange]);
  
  const setZoom = useCallback((level: number) => {
    const constrainedLevel = Math.max(0.1, Math.min(20, level));
    
    if (isUserInteracting) {
      // Durante la interacción, actualizar solo la posición temporal
      setTempPosition(prev => prev ? {
        ...prev,
        zoomLevel: constrainedLevel
      } : {
        zoomLevel: constrainedLevel,
        offsetX,
        offsetY
      });
      // Notificar cambio inmediatamente para retroalimentación visual
      notifyChange();
    } else {
      // Cuando no hay interacción, actualizar la posición permanente
      setZoomLevel(constrainedLevel);
      setManuallyAdjusted(true);
      notifyChange();
    }
  }, [isUserInteracting, offsetX, offsetY, notifyChange]);
  
  const resetZoom = useCallback(() => {
    setZoomLevel(defaultZoom);
    setManuallyAdjusted(false);
    notifyChange();
  }, [defaultZoom, notifyChange]);
  
  // Pan controls
  const panLeft = useCallback(() => {
    setOffsetX(prev => Math.max(0, prev - 0.1));
    setManuallyAdjusted(true);
    notifyChange();
  }, [notifyChange]);
  
  const panRight = useCallback(() => {
    setOffsetX(prev => Math.min(1, prev + 0.1));
    setManuallyAdjusted(true);
    notifyChange();
  }, [notifyChange]);
  
  const panUp = useCallback(() => {
    setOffsetY(prev => Math.max(-1, prev - 0.1));
    setManuallyAdjusted(true);
    notifyChange();
  }, [notifyChange]);
  
  const panDown = useCallback(() => {
    setOffsetY(prev => Math.min(1, prev + 0.1));
    setManuallyAdjusted(true);
    notifyChange();
  }, [notifyChange]);
  
  const setPan = useCallback((x: number, y: number) => {
    const constrainedX = Math.max(0, Math.min(1, x));
    const constrainedY = Math.max(-1, Math.min(1, y));
    
    if (isUserInteracting) {
      // Durante la interacción, actualizar solo la posición temporal
      setTempPosition(prev => prev ? {
        ...prev,
        offsetX: constrainedX,
        offsetY: constrainedY
      } : {
        zoomLevel,
        offsetX: constrainedX,
        offsetY: constrainedY
      });
      // Notificar cambio inmediatamente para retroalimentación visual
      notifyChange();
    } else {
      // Cuando no hay interacción, actualizar la posición permanente
      setOffsetX(constrainedX);
      setOffsetY(constrainedY);
      setManuallyAdjusted(true);
      notifyChange();
    }
  }, [isUserInteracting, zoomLevel, notifyChange]);
  
  // Navigation controls
  const goToStart = useCallback(() => {
    setOffsetX(0);
    setManuallyAdjusted(true);
    setAutoFollow(false);
    notifyChange();
  }, [notifyChange]);
  
  const goToEnd = useCallback(() => {
    setOffsetX(1);
    setManuallyAdjusted(false); // Going to end is not considered manual if auto-follow is enabled
    if (!autoFollow) {
      setManuallyAdjusted(true);
    }
    notifyChange();
  }, [notifyChange, autoFollow]);
  
  const goToIndex = useCallback((index: number) => {
    if (candleCount === 0) return;
    
    const normalizedIndex = Math.max(0, Math.min(candleCount - 1, index));
    const newOffsetX = normalizedIndex / (candleCount - 1);
    setOffsetX(newOffsetX);
    setManuallyAdjusted(true);
    setAutoFollow(false);
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
    setManuallyAdjusted(false);
    setAutoFollow(true);
    notifyChange();
  }, [defaultZoom, notifyChange]);
  
  const fitVisible = useCallback(() => {
    // Adjust zoom to fit visible candles optimally
    const optimalZoom = chartWidth / (visibleCandleCount * 8); // 8px per candle
    setZoomLevel(Math.max(0.1, Math.min(20, optimalZoom)));
    setManuallyAdjusted(true);
    notifyChange();
  }, [chartWidth, visibleCandleCount, notifyChange]);
  
  const fitPriceRange = useCallback((min: number, max: number) => {
    setPriceRange({ min, max });
    setOffsetY(0); // Center on new price range
    setManuallyAdjusted(true);
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
  
  // Camera lock controls
  const lockCamera = useCallback(() => {
    setIsLocked(true);
    logCameraAction('Camera locked - streaming updates will not affect view');
  }, []);

  const unlockCamera = useCallback(() => {
    setIsLocked(false);
    logCameraAction('Camera unlocked - will follow live data');
  }, []);

  const toggleLock = useCallback(() => {
    setIsLocked(prev => {
      const newLocked = !prev;
      logCameraAction(`Camera ${newLocked ? 'locked' : 'unlocked'}`);
      return newLocked;
    });
  }, []);  const isLockedFn = useCallback(() => isLocked, [isLocked]);
  
  // Auto-follow controls
  const enableAutoFollow = useCallback(() => {
    setAutoFollow(true);
    setOffsetX(1); // Go to end when enabling auto-follow
    setManuallyAdjusted(false);
    logCameraAction('Auto-follow enabled - will track new data');
    notifyChange();
  }, [notifyChange]);

  const disableAutoFollow = useCallback(() => {
    setAutoFollow(false);
    setManuallyAdjusted(true);
    logCameraAction('Auto-follow disabled - staying at current position');
  }, []);  const isAutoFollowing = useCallback(() => autoFollow && !manuallyAdjusted, [autoFollow, manuallyAdjusted]);
  
  // Chart.js specific camera controls
  const setChartJsZoomState = useCallback((min: number | null, max: number | null, centerX?: number | null) => {
    setChartJsZoom({
      min,
      max,
      centerX: centerX || null,
    });
    if (min !== null || max !== null) {
      setManuallyAdjusted(true);
    }
    logCameraAction('Chart.js zoom state updated', { min, max, centerX });
    notifyChange();
  }, [notifyChange]);

  const resetCameraToLatest = useCallback(() => {
    setFollowLatest(true);
    setManuallyAdjusted(false);
    setAutoFollow(true);
    setOffsetX(1);
    setChartJsZoom({ min: null, max: null, centerX: null });
    logCameraAction('Camera reset to follow latest candles');
    notifyChange();
  }, [notifyChange]);

  const lockCameraPosition = useCallback(() => {
    setIsLocked(true);
    setFollowLatest(false);
    setAutoFollow(false);
    logCameraAction('Camera position locked');
  }, []);

  const setMaxVisibleCandlesCount = useCallback((count: number) => {
    setMaxVisibleCandles(Math.max(1000, Math.min(2000, count)));
    logCameraAction(`Max visible candles set to: ${count}`);
    notifyChange();
  }, [notifyChange]);  // User interaction controls
  const startUserInteraction = useCallback(() => {
    setIsUserInteracting(true);
    // Guardar la posición actual como posición base antes de empezar la interacción
    setTempPosition({
      zoomLevel,
      offsetX,
      offsetY,
    });
    logCameraAction('User interaction started - camera following user gestures');
  }, [zoomLevel, offsetX, offsetY]);

  const endUserInteraction = useCallback(() => {
    setIsUserInteracting(false);
    // Cuando termina la interacción, fijar la posición temporal como la nueva posición permanente
    if (temporaryPosition) {
      setZoomLevel(temporaryPosition.zoomLevel);
      setOffsetX(temporaryPosition.offsetX);
      setOffsetY(temporaryPosition.offsetY);
      setManuallyAdjusted(true);
      setAutoFollow(false); // Deshabilitar auto-follow cuando el usuario fija una posición
      logCameraAction('User interaction ended - camera locked at final position', temporaryPosition);
    }
    setTempPosition(null);
    notifyChange();
  }, [temporaryPosition, notifyChange]);
  
  const setTemporaryPosition = useCallback((newZoomLevel: number, newOffsetX: number, newOffsetY: number) => {
    if (isUserInteracting) {
      setTempPosition({
        zoomLevel: newZoomLevel,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      });
      // Durante la interacción, notificar inmediatamente los cambios para actualizaciones en tiempo real
      notifyChange();
      
      // También notificar para que se pueda propagar al Chart.js
      onCameraChange?.({
        ...camera,
        zoomLevel: newZoomLevel,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
        isUserInteracting: true,
        temporaryPosition: {
          zoomLevel: newZoomLevel,
          offsetX: newOffsetX,
          offsetY: newOffsetY,
        }
      });
    }
  }, [isUserInteracting, notifyChange, camera, onCameraChange]);
  
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
    lockCamera,
    unlockCamera,
    toggleLock,
    isLocked: isLockedFn,
    enableAutoFollow,
    disableAutoFollow,
    isAutoFollowing,
    startUserInteraction,
    endUserInteraction,
    setTemporaryPosition,
    setChartJsZoomState,
    resetCameraToLatest,
    lockCameraPosition,
    setMaxVisibleCandlesCount,
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
