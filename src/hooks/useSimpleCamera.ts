import { useState, useCallback, useRef, useEffect } from 'react';

// Clave para localStorage
const CAMERA_STORAGE_KEY = 'houndtrade_camera_state';

// Función para cargar estado desde localStorage
const loadCameraState = () => {
  try {
    const saved = localStorage.getItem(CAMERA_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed;
    }
  } catch (error) {
    console.warn('📷 [SimpleCamera] Error cargando estado desde localStorage:', error);
  }
  return null;
};

// Función para guardar estado en localStorage con debounce
let saveTimeout: NodeJS.Timeout | null = null;
const saveCameraState = (state: any) => {
  // Debounce las escrituras para evitar spam
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(state));
      console.log('📷 [SimpleCamera] Estado guardado en localStorage (debounced):', state);
    } catch (error) {
      console.warn('📷 [SimpleCamera] Error guardando estado en localStorage:', error);
    }
  }, 100); // 100ms debounce
};

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
  
  // Cargar estado inicial desde localStorage SOLO UNA VEZ usando useState lazy initialization
  const [savedState] = useState(() => {
    const state = loadCameraState();
    console.log('📷 [SimpleCamera] Carga inicial ÚNICA desde localStorage:', state);
    return state;
  });
  
  // Estado principal - inicializar con datos guardados si existen
  const [visibleCandles, setVisibleCandles] = useState(defaultVisibleCandles);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(defaultVisibleCandles);
  const [isUserInteracting, setIsUserInteracting] = useState(savedState?.isUserInteracting || false);
  const [lastUserAction, setLastUserAction] = useState<number | null>(savedState?.lastUserAction || null);
  const [chartJsState, setChartJsState] = useState({
    min: savedState?.chartJsState?.min || null,
    max: savedState?.chartJsState?.max || null,
    centerX: savedState?.chartJsState?.centerX || null,
    zoomLevel: savedState?.chartJsState?.zoomLevel || null,
  });
  
  // Referencias para timers
  const autoResetTimer = useRef<NodeJS.Timeout | null>(null);
  const interactionDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  
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
  
  // Notificar cambios de estado y guardar en localStorage con debounce
  useEffect(() => {
    console.log('📸 [SimpleCamera] Estado cambió:', {
      isUserInteracting,
      lastUserAction: lastUserAction ? new Date(lastUserAction).toLocaleTimeString() : null,
      chartJsState,
      isLocked: lastUserAction !== null && (
        chartJsState.min !== null || 
        chartJsState.max !== null || 
        isUserInteracting
      )
    });
    
    onStateChange?.(state);
    
    // Guardar en localStorage solo si el usuario ha interactuado (con debounce ya incluido)
    if (lastUserAction !== null) {
      saveCameraState({
        isUserInteracting,
        lastUserAction,
        chartJsState,
        visibleCandles,
        startIndex,
        endIndex
      });
    }
  }, [isUserInteracting, lastUserAction, chartJsState.min, chartJsState.max]); // Reducir dependencias para evitar guardado excesivo
  
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
    // Debounce para evitar llamadas repetitivas
    if (interactionDebounceTimer.current) {
      clearTimeout(interactionDebounceTimer.current);
    }
    
    interactionDebounceTimer.current = setTimeout(() => {
      console.log('📷 [SimpleCamera] Usuario INICIA interacción - BLOQUEANDO auto-seguimiento');
      setIsUserInteracting(true);
      setLastUserAction(Date.now());
      
      // Cancelar auto-reset mientras interactúa
      if (autoResetTimer.current) {
        clearTimeout(autoResetTimer.current);
      }
    }, 10); // 10ms debounce muy corto para interacciones
  }, []);
  
  // Cuando el usuario TERMINA interacción
  const onUserEndInteraction = useCallback(() => {
    // Debounce para evitar llamadas repetitivas
    if (interactionDebounceTimer.current) {
      clearTimeout(interactionDebounceTimer.current);
    }
    
    interactionDebounceTimer.current = setTimeout(() => {
      console.log('📷 [SimpleCamera] Usuario TERMINA interacción - MANTENIENDO posición fija (sin auto-reset)');
      setLastUserAction(Date.now());
      
      // NO iniciar timer de auto-reset - la cámara debe quedarse donde el usuario la dejó
      // startAutoResetTimer(); // ← COMENTADO: esto causaba que se resetee automáticamente
      
      // La cámara se queda exactamente donde el usuario la dejó
      console.log('📷 [SimpleCamera] Cámara fijada en posición del usuario permanentemente');
    }, 50); // 50ms debounce para permitir que terminen todas las interacciones
  }, []);
  
  // Cuando el usuario hace zoom
  const onUserZoom = useCallback((min: number, max: number, centerX?: number, zoomLevel?: number) => {
    console.log('📷 [SimpleCamera] Usuario hizo ZOOM - guardando estado:', { min, max, centerX, zoomLevel });
    console.log('📷 [SimpleCamera] Timestamp del ZOOM:', new Date().toLocaleTimeString());
    
    setChartJsState({
      min,
      max,
      centerX: centerX || null,
      zoomLevel: zoomLevel || null,
    });
    
    setLastUserAction(Date.now());
    
    // Asegurarse de que isUserInteracting esté en true
    setIsUserInteracting(true);
  }, []);
  
  // Cuando el usuario hace pan
  const onUserPan = useCallback((min: number, max: number, centerX?: number) => {
    console.log('📷 [SimpleCamera] Usuario hizo PAN - guardando estado:', { min, max, centerX });
    console.log('📷 [SimpleCamera] Timestamp del PAN:', new Date().toLocaleTimeString());
    
    setChartJsState(prev => ({
      ...prev,
      min,
      max,
      centerX: centerX || null,
    }));
    
    setLastUserAction(Date.now());
    
    // Asegurarse de que isUserInteracting esté en true
    setIsUserInteracting(true);
  }, []);
  
  // Reset manual a las últimas velas
  const resetToLatest = useCallback(() => {
    console.log('📷 [SimpleCamera] RESET MANUAL a las últimas', defaultVisibleCandles, 'velas');
    
    // Limpiar todos los timers
    if (autoResetTimer.current) {
      clearTimeout(autoResetTimer.current);
    }
    if (interactionDebounceTimer.current) {
      clearTimeout(interactionDebounceTimer.current);
    }
    if (saveTimeout) {
      clearTimeout(saveTimeout);
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
    
    // Limpiar localStorage
    try {
      localStorage.removeItem(CAMERA_STORAGE_KEY);
      console.log('📷 [SimpleCamera] Estado limpiado de localStorage');
    } catch (error) {
      console.warn('📷 [SimpleCamera] Error limpiando localStorage:', error);
    }
  }, [defaultVisibleCandles]);
  
  // Bloquear posición actual
  const lockCurrentPosition = useCallback(() => {
    console.log('📷 [SimpleCamera] BLOQUEANDO posición actual');
    setIsUserInteracting(true);
    setLastUserAction(Date.now());
  }, []);
  
  // Verificar si está bloqueado
  const isLocked = useCallback(() => {
    // Bloqueado si el usuario ha interactuado alguna vez Y tiene configuración guardada
    const hasUserInteracted = lastUserAction !== null;
    const hasViewportConfiguration = chartJsState.min !== null || chartJsState.max !== null;
    const isCurrentlyInteracting = isUserInteracting;
    
    const locked = hasUserInteracted && (hasViewportConfiguration || isCurrentlyInteracting);
    
    if (locked) {
      console.log('🔒 [SimpleCamera] Cámara BLOQUEADA - usuario tiene control:', {
        hasUserInteracted,
        hasViewportConfiguration,
        isCurrentlyInteracting,
        lastUserAction: lastUserAction ? new Date(lastUserAction).toLocaleTimeString() : null,
        chartJsState: { min: chartJsState.min, max: chartJsState.max }
      });
    }
    
    return locked;
  }, [lastUserAction, chartJsState.min, chartJsState.max, isUserInteracting]);
  
  // Obtener viewport recomendado - SOLO para carga inicial
  const getRecommendedViewport = useCallback((totalCandles: number, candleData: any[]) => {
    // Si el usuario YA interactuó, NO devolver NADA para evitar interferencias
    if (lastUserAction !== null) {
      console.log('📷 [SimpleCamera] Usuario ya interactuó - NO proporcionar viewport automático');
      return {
        startIndex: 0,
        endIndex: totalCandles,
        min: null, // Importante: null para que Chart.js no cambie viewport
        max: null, // Importante: null para que Chart.js no cambie viewport
      };
    }
    
    // Solo configurar vista inicial automática si NO hay configuración del usuario
    const targetVisible = Math.min(visibleCandles, totalCandles);
    const calculatedStartIndex = Math.max(0, totalCandles - targetVisible);
    const calculatedEndIndex = totalCandles;
    
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
    
    console.log('📷 [SimpleCamera] Configuración inicial automática (solo sin usuario):', { min, max, targetVisible });
    
    return {
      startIndex: calculatedStartIndex,
      endIndex: calculatedEndIndex,
      min,
      max,
    };
  }, [lastUserAction, visibleCandles]);
  
  // Limpiar timers al desmontar
  useEffect(() => {
    return () => {
      if (autoResetTimer.current) {
        clearTimeout(autoResetTimer.current);
      }
      if (interactionDebounceTimer.current) {
        clearTimeout(interactionDebounceTimer.current);
      }
      if (saveTimeout) {
        clearTimeout(saveTimeout);
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
