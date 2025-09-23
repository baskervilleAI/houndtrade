import { useState, useCallback, useRef, useEffect } from 'react';

export interface SimpleCameraState {
  // Configuración de la cámara
  visibleCandles: number;
  startIndex: number;
  endIndex: number;
  
  // Estado del usuario
  isUserInteracting: boolean;
  lastUserAction: number | null;
  
  // Estado de Chart.js (para web)
  chartJsState: {
    min: number | null;
    max: number | null;
    centerX: number | null;
    zoomLevel: number | null;
  };
  
  // Configuración básica
  defaultVisibleCandles: number;
}

export interface SimpleCameraControls {
  state: SimpleCameraState;
  
  // Métodos principales
  onUserStartInteraction: () => void;
  onUserEndInteraction: () => void;
  onUserZoom: (min: number, max: number, centerX?: number, zoomLevel?: number) => void;
  onUserPan: (min: number, max: number, centerX?: number) => void;
  
  // Control de cámara
  resetToLatest: () => void;
  lockCurrentPosition: () => void;
  isLocked: () => boolean;
  
  // Para integración con Chart.js
  getRecommendedViewport: (totalCandles: number, candleData: any[]) => {
    startIndex: number;
    endIndex: number;
    min: number | null;
    max: number | null;
  };
}

interface UseSimpleCameraProps {
  defaultVisibleCandles?: number;
  autoResetTimeMs?: number;
  onStateChange?: (state: SimpleCameraState) => void;
}

export const useSimpleCamera = ({
  defaultVisibleCandles = 100,
  autoResetTimeMs = 0, // Deshabilitado - sin auto-reset
  onStateChange
}: UseSimpleCameraProps = {}): SimpleCameraControls => {
  
  // Estado principal
  const [visibleCandles, setVisibleCandles] = useState(defaultVisibleCandles);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(defaultVisibleCandles);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [lastUserAction, setLastUserAction] = useState<number | null>(null);
  const [chartJsState, setChartJsState] = useState({
    min: null as number | null,
    max: null as number | null,
    centerX: null as number | null,
    zoomLevel: null as number | null,
  });
  
  // Referencias para timers
  const autoResetTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Estado combinado
  const state: SimpleCameraState = {
    visibleCandles,
    startIndex,
    endIndex,
    isUserInteracting,
    lastUserAction,
    chartJsState,
    defaultVisibleCandles,
  };
  
  // Notificar cambios de estado
  useEffect(() => {
    onStateChange?.(state);
  }, [isUserInteracting, lastUserAction, visibleCandles, startIndex, endIndex]);
  
  // Auto-reset timer (DESHABILITADO - cámara debe ser independiente del streaming)
  const startAutoResetTimer = useCallback(() => {
    console.log('📷 [SimpleCamera] Auto-reset DESHABILITADO - cámara permanece donde usuario la dejó');
    
    // NO ejecutar auto-reset automático
    // La cámara debe quedarse independiente del live streaming
    /*
    if (autoResetTimer.current) {
      clearTimeout(autoResetTimer.current);
    }
    
    autoResetTimer.current = setTimeout(() => {
      console.log('📷 [SimpleCamera] Auto-reset después de inactividad');
      setIsUserInteracting(false);
      setLastUserAction(null);
      setChartJsState({
        min: null,
        max: null,
        centerX: null,
        zoomLevel: null,
      });
      setVisibleCandles(defaultVisibleCandles);
    }, autoResetTimeMs);
    */
  }, []);
  
  // Cuando el usuario INICIA interacción
  const onUserStartInteraction = useCallback(() => {
    console.log('📷 [SimpleCamera] Usuario INICIA interacción - BLOQUEANDO auto-seguimiento');
    setIsUserInteracting(true);
    setLastUserAction(Date.now());
    
    // Cancelar auto-reset mientras interactúa
    if (autoResetTimer.current) {
      clearTimeout(autoResetTimer.current);
    }
  }, []);
  
  // Cuando el usuario TERMINA interacción
  const onUserEndInteraction = useCallback(() => {
    console.log('📷 [SimpleCamera] Usuario TERMINA interacción - MANTENIENDO posición fija (sin auto-reset)');
    setLastUserAction(Date.now());
    
    // NO iniciar timer de auto-reset - la cámara debe quedarse donde el usuario la dejó
    // startAutoResetTimer(); // ← COMENTADO: esto causaba que se resetee automáticamente
    
    // La cámara se queda exactamente donde el usuario la dejó
    console.log('📷 [SimpleCamera] Cámara fijada en posición del usuario permanentemente');
  }, []);
  
  // Cuando el usuario hace zoom
  const onUserZoom = useCallback((min: number, max: number, centerX?: number, zoomLevel?: number) => {
    console.log('📷 [SimpleCamera] Usuario hizo ZOOM - guardando estado:', { min, max, centerX, zoomLevel });
    
    setChartJsState({
      min,
      max,
      centerX: centerX || null,
      zoomLevel: zoomLevel || null,
    });
    
    setLastUserAction(Date.now());
  }, []);
  
  // Cuando el usuario hace pan
  const onUserPan = useCallback((min: number, max: number, centerX?: number) => {
    console.log('📷 [SimpleCamera] Usuario hizo PAN - guardando estado:', { min, max, centerX });
    
    setChartJsState(prev => ({
      ...prev,
      min,
      max,
      centerX: centerX || null,
    }));
    
    setLastUserAction(Date.now());
  }, []);
  
  // Reset manual a las últimas velas
  const resetToLatest = useCallback(() => {
    console.log('📷 [SimpleCamera] RESET MANUAL a las últimas', defaultVisibleCandles, 'velas');
    
    // Limpiar timer
    if (autoResetTimer.current) {
      clearTimeout(autoResetTimer.current);
    }
    
    // Reset completo
    setIsUserInteracting(false);
    setLastUserAction(null);
    setChartJsState({
      min: null,
      max: null,
      centerX: null,
      zoomLevel: null,
    });
    setVisibleCandles(defaultVisibleCandles);
    setStartIndex(0);
    setEndIndex(defaultVisibleCandles);
  }, [defaultVisibleCandles]);
  
  // Bloquear posición actual
  const lockCurrentPosition = useCallback(() => {
    console.log('📷 [SimpleCamera] BLOQUEANDO posición actual');
    setIsUserInteracting(true);
    setLastUserAction(Date.now());
  }, []);
  
  // Verificar si está bloqueado
  const isLocked = useCallback(() => {
    return lastUserAction !== null; // Bloqueado si el usuario ha interactuado alguna vez
  }, [lastUserAction]);
  
  // Obtener viewport recomendado
  const getRecommendedViewport = useCallback((totalCandles: number, candleData: any[]) => {
    // Si el usuario ha interactuado alguna vez, usar su configuración guardada
    if (lastUserAction) {
      // Verificar si tenemos configuración guardada válida
      if (chartJsState.min !== null && chartJsState.max !== null) {
        console.log('📷 [SimpleCamera] Usuario ha interactuado - usando configuración guardada');
        return {
          startIndex: 0, // Chart.js maneja esto internamente
          endIndex: totalCandles,
          min: chartJsState.min,
          max: chartJsState.max,
        };
      } else {
        console.log('📷 [SimpleCamera] Usuario ha interactuado pero configuración perdida - manteniendo posición fija');
        // Si el usuario interactuó pero perdimos la configuración, mantener la vista actual
        // En lugar de resetear a las últimas 100
        return {
          startIndex: 0,
          endIndex: totalCandles,
          min: null, // Chart.js mantendrá la vista actual
          max: null,
        };
      }
    }
    
    // Modo automático: mostrar las últimas N velas
    const targetVisible = Math.min(visibleCandles, totalCandles);
    const calculatedStartIndex = Math.max(0, totalCandles - targetVisible);
    const calculatedEndIndex = totalCandles;
    
    // Si tenemos datos de velas, calcular min/max basado en timestamps
    let min: number | null = null;
    let max: number | null = null;
    
    if (candleData && candleData.length > 0) {
      const startCandle = candleData[calculatedStartIndex];
      const endCandle = candleData[calculatedEndIndex - 1];
      
      if (startCandle && endCandle) {
        min = startCandle.x || startCandle.time;
        max = endCandle.x || endCandle.time;
      }
    }
    
    console.log('📷 [SimpleCamera] Modo automático - últimas', targetVisible, 'velas de', totalCandles);
    
    return {
      startIndex: calculatedStartIndex,
      endIndex: calculatedEndIndex,
      min,
      max,
    };
  }, [lastUserAction, chartJsState, visibleCandles]);
  
  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (autoResetTimer.current) {
        clearTimeout(autoResetTimer.current);
      }
    };
  }, []);
  
  return {
    state,
    onUserStartInteraction,
    onUserEndInteraction,
    onUserZoom,
    onUserPan,
    resetToLatest,
    lockCurrentPosition,
    isLocked,
    getRecommendedViewport,
  };
};
