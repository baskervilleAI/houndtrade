import { useState, useCallback, useRef, useEffect } from 'react';

export interface SmartCameraState {
  // Estado de la cámara
  isUserControlled: boolean;
  lastUserInteraction: number | null;
  
  // Configuración por defecto
  defaultVisibleCandles: number;
  currentVisibleCandles: number;
  
  // Estado de zoom y posición
  userZoom: number | null;
  userPanX: number | null;
  userPanY: number | null;
  
  // Chart.js specific state
  chartJsState: {
    min: number | null;
    max: number | null;
    centerX: number | null;
    zoomLevel: number | null;
  };
  
  // Configuración de comportamiento
  autoResetAfterMs: number;
  followLatestWhenIdle: boolean;
}

export interface SmartCameraControls {
  state: SmartCameraState;
  
  // Métodos principales
  onUserInteraction: (type: 'zoom' | 'pan' | 'manual', data?: any) => void;
  onCandleUpdate: () => void;
  resetToDefault: () => void;
  
  // Chart.js integration
  updateChartJsState: (min?: number | null, max?: number | null, centerX?: number | null, zoomLevel?: number | null) => void;
  shouldFollowLatest: () => boolean;
  getRecommendedViewport: (totalCandles: number) => { startIndex: number; endIndex: number };
  
  // Estado actual
  isInDefaultMode: () => boolean;
  getVisibleCandlesCount: () => number;
  shouldPreservePosition: () => boolean;
}

interface UseSmartCameraStateProps {
  defaultVisibleCandles?: number;
  autoResetAfterMs?: number;
  onStateChange?: (state: SmartCameraState) => void;
}

export const useSmartCameraState = ({
  defaultVisibleCandles = 1000,
  autoResetAfterMs = 300000, // 5 minutos (mucho más tiempo para explorar)
  onStateChange
}: UseSmartCameraStateProps = {}): SmartCameraControls => {
  
  // Estado interno
  const [isUserControlled, setIsUserControlled] = useState(false);
  const [lastUserInteraction, setLastUserInteraction] = useState<number | null>(null);
  const [currentVisibleCandles, setCurrentVisibleCandles] = useState(defaultVisibleCandles);
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const [userPanX, setUserPanX] = useState<number | null>(null);
  const [userPanY, setUserPanY] = useState<number | null>(null);
  const [chartJsState, setChartJsState] = useState({
    min: null as number | null,
    max: null as number | null,
    centerX: null as number | null,
    zoomLevel: null as number | null,
  });
  const [followLatestWhenIdle, setFollowLatestWhenIdle] = useState(true);
  
  // Referencias para timers
  const autoResetTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Estado combinado
  const state: SmartCameraState = {
    isUserControlled,
    lastUserInteraction,
    defaultVisibleCandles,
    currentVisibleCandles,
    userZoom,
    userPanX,
    userPanY,
    chartJsState,
    autoResetAfterMs,
    followLatestWhenIdle,
  };
  
  // Notificar cambios de estado - SOLO cuando realmente cambian cosas importantes
  useEffect(() => {
    if (onStateChange) {
      onStateChange(state);
    }
  }, [isUserControlled, lastUserInteraction, currentVisibleCandles]); // Solo dependencias críticas
  
  // Auto-reset timer
  const startAutoResetTimer = useCallback(() => {
    if (autoResetTimer.current) {
      clearTimeout(autoResetTimer.current);
    }
    
    autoResetTimer.current = setTimeout(() => {
      console.log('📷 [SmartCamera] Auto-reset activado después de', autoResetAfterMs, 'ms sin interacción');
      setIsUserControlled(false);
      setLastUserInteraction(null);
      setUserZoom(null);
      setUserPanX(null);
      setUserPanY(null);
      setChartJsState({
        min: null,
        max: null,
        centerX: null,
        zoomLevel: null,
      });
      setCurrentVisibleCandles(defaultVisibleCandles);
      setFollowLatestWhenIdle(true);
    }, autoResetAfterMs);
  }, [autoResetAfterMs, defaultVisibleCandles]);
  
  // Cuando el usuario interactúa con el gráfico
  const onUserInteraction = useCallback((type: 'zoom' | 'pan' | 'manual', data?: any) => {
    const now = Date.now();
    
    // Solo considerar interacciones significativas
    let isSignificantInteraction = false;
    
    switch (type) {
      case 'zoom':
        // Solo si el zoom es significativo (más del 10% de cambio)
        if (data?.zoomLevel && Math.abs(data.zoomLevel - (userZoom || 1)) > 0.1) {
          isSignificantInteraction = true;
        }
        break;
      case 'pan':
        // Solo si el pan es significativo (más del 5% de movimiento)
        if (data?.x !== undefined && Math.abs(data.x - (userPanX || 0.5)) > 0.05) {
          isSignificantInteraction = true;
        }
        break;
      case 'manual':
        // Interacción manual siempre es significativa
        isSignificantInteraction = true;
        break;
    }
    
    if (!isSignificantInteraction) {
      console.log(`📷 [SmartCamera] Interacción ${type} no significativa, ignorando`);
      return;
    }
    
    console.log(`📷 [SmartCamera] Interacción significativa: ${type}`, data);
    
    setIsUserControlled(true);
    setLastUserInteraction(now);
    setFollowLatestWhenIdle(false);
    
    // Guardar el estado específico según el tipo de interacción
    switch (type) {
      case 'zoom':
        if (data?.zoomLevel) setUserZoom(data.zoomLevel);
        if (data?.centerX) setUserPanX(data.centerX);
        break;
      case 'pan':
        if (data?.x !== undefined) setUserPanX(data.x);
        if (data?.y !== undefined) setUserPanY(data.y);
        break;
      case 'manual':
        // Interacción manual genérica
        break;
    }
    
    // Iniciar el timer de auto-reset solo para interacciones significativas
    startAutoResetTimer();
  }, [startAutoResetTimer]);
  
  // Cuando se actualiza una vela
  const onCandleUpdate = useCallback(() => {
    // Si el usuario no ha interactuado, seguir comportamiento por defecto
    if (!isUserControlled) {
      console.log('📷 [SmartCamera] Actualización de vela - modo automático');
      setFollowLatestWhenIdle(true);
      return;
    }
    
    // Si el usuario ha interactuado, mantener su posición
    console.log('📷 [SmartCamera] Actualización de vela - preservando posición del usuario');
  }, [isUserControlled]);
  
  // Reset manual al estado por defecto
  const resetToDefault = useCallback(() => {
    console.log('📷 [SmartCamera] Reset manual al estado por defecto');
    
    if (autoResetTimer.current) {
      clearTimeout(autoResetTimer.current);
    }
    
    setIsUserControlled(false);
    setLastUserInteraction(null);
    setUserZoom(null);
    setUserPanX(null);
    setUserPanY(null);
    setChartJsState({
      min: null,
      max: null,
      centerX: null,
      zoomLevel: null,
    });
    setCurrentVisibleCandles(defaultVisibleCandles);
    setFollowLatestWhenIdle(true);
  }, [defaultVisibleCandles]);
  
  // Actualizar estado específico de Chart.js
  const updateChartJsState = useCallback((
    min?: number | null, 
    max?: number | null, 
    centerX?: number | null, 
    zoomLevel?: number | null
  ) => {
    setChartJsState(prev => ({
      ...prev,
      ...(min !== undefined && { min }),
      ...(max !== undefined && { max }),
      ...(centerX !== undefined && { centerX }),
      ...(zoomLevel !== undefined && { zoomLevel }),
    }));
  }, []);
  
  // Determinar si debe seguir las últimas velas
  const shouldFollowLatest = useCallback(() => {
    return !isUserControlled && followLatestWhenIdle;
  }, [isUserControlled, followLatestWhenIdle]);
  
  // Obtener viewport recomendado basado en el estado actual
  const getRecommendedViewport = useCallback((totalCandles: number) => {
    if (!isUserControlled) {
      // Modo por defecto: mostrar las últimas N velas
      const startIndex = Math.max(0, totalCandles - defaultVisibleCandles);
      const endIndex = totalCandles - 1;
      return { startIndex, endIndex };
    }
    
    // Modo controlado por usuario: usar su configuración
    if (userPanX !== null) {
      // Calcular basado en la posición del usuario
      const visibleCount = currentVisibleCandles;
      const centerIndex = Math.round(userPanX * totalCandles);
      const halfVisible = Math.floor(visibleCount / 2);
      
      return {
        startIndex: Math.max(0, centerIndex - halfVisible),
        endIndex: Math.min(totalCandles - 1, centerIndex + halfVisible),
      };
    }
    
    // Fallback al comportamiento por defecto
    return {
      startIndex: Math.max(0, totalCandles - defaultVisibleCandles),
      endIndex: totalCandles - 1,
    };
  }, [isUserControlled, defaultVisibleCandles, currentVisibleCandles, userPanX]);
  
  // Verificar si está en modo por defecto
  const isInDefaultMode = useCallback(() => {
    return !isUserControlled;
  }, [isUserControlled]);
  
  // Obtener número actual de velas visibles
  const getVisibleCandlesCount = useCallback(() => {
    return currentVisibleCandles;
  }, [currentVisibleCandles]);
  
  // Determinar si debe preservar la posición actual
  const shouldPreservePosition = useCallback(() => {
    return isUserControlled;
  }, [isUserControlled]);
  
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
    onUserInteraction,
    onCandleUpdate,
    resetToDefault,
    updateChartJsState,
    shouldFollowLatest,
    getRecommendedViewport,
    isInDefaultMode,
    getVisibleCandlesCount,
    shouldPreservePosition,
  };
};
