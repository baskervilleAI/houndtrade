import { useState, useCallback, useRef, useMemo, useEffect } from 'react';

export interface SimpleCameraState {
  isLocked: boolean;
  lastUserAction: number | null;
  chartJsState: {
    min: number | null;
    max: number | null;
    centerX: number | null;
  };
}

export interface SimpleCameraControls {
  state: SimpleCameraState;
  isLocked: () => boolean;
  isActivelyInteracting: () => boolean; // New method
  getCurrentState: () => SimpleCameraState; // Add this for immediate state access
  shouldForceViewport: () => boolean; // New method to check if viewport should be forced
  shouldAutoAdjust: () => boolean; // New method to check if should auto-adjust
  getForcedViewport: () => { min: number; max: number } | null; // Get forced viewport
  onUserStartInteraction: () => void;
  onUserEndInteraction: () => void;
  onUserZoom: (min: number, max: number, centerX: number) => void;
  onUserPan: (min: number, max: number, centerX: number) => void;
  resetToLatest: () => void;
  getRecommendedViewport: (totalCandles: number, candleData?: any[]) => { min?: number; max?: number };
}

interface UseSimpleCameraProps {
  defaultVisibleCandles?: number;
  onStateChange?: (state: SimpleCameraState) => void;
}

export const useSimpleCamera = ({
  defaultVisibleCandles = 100,
  onStateChange
}: UseSimpleCameraProps = {}): SimpleCameraControls => {
  
  // Cargar estado inicial desde sessionStorage si existe
  const getInitialState = (): SimpleCameraState => {
    if (typeof window === 'undefined') {
      return {
        isLocked: false,
        lastUserAction: null,
        chartJsState: { min: null, max: null, centerX: null }
      };
    }
    
    try {
      const saved = sessionStorage.getItem('simpleCamera_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // console.log('📷 [SimpleCamera] Estado cargado desde sessionStorage:', parsed);
        return parsed;
      }
    } catch (error) {
      console.warn('📷 [SimpleCamera] Error cargando estado desde sessionStorage:', error);
    }
    
    return {
      isLocked: false,
      lastUserAction: null,
      chartJsState: { min: null, max: null, centerX: null }
    };
  };
  
  const [state, setState] = useState<SimpleCameraState>(getInitialState());

  // Use a ref to maintain current state accessible from callbacks
  const stateRef = useRef(state);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update ref whenever state changes and persist to sessionStorage
  useEffect(() => {
    stateRef.current = state;
    
    // Persistir estado en sessionStorage
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('simpleCamera_state', JSON.stringify(state));
      } catch (error) {
        console.warn('📷 [SimpleCamera] Error guardando estado en sessionStorage:', error);
      }
    }
    
    // Callback para notificar cambios de estado
    if (onStateChange) {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  // Check if camera is locked (user has interacted) - use ref for immediate access
  const isLocked = useCallback(() => {
    const currentState = stateRef.current;
    const hasViewport = currentState.chartJsState.min !== null && currentState.chartJsState.max !== null;
    
    // Solo bloquear si:
    // 1. El usuario ha interactuado (lastUserAction existe)
    // 2. Tenemos un viewport guardado del usuario
    // 3. El estado isLocked está activo
    const shouldBeLocked = currentState.isLocked && hasViewport && currentState.lastUserAction !== null;
    
    // Log ocasional para debug (solo 1% de las veces para evitar spam)
    if (Math.random() < 0.01) {
      console.log('📷 [SimpleCamera] isLocked check:', { 
        stateIsLocked: currentState.isLocked, 
        hasViewport,
        shouldBeLocked,
        lastUserAction: currentState.lastUserAction ? new Date(currentState.lastUserAction).toLocaleTimeString() : null
      });
    }
    
    return shouldBeLocked;
  }, []); // No dependencies - always uses current ref

  // Check if user is actively interacting (recently) - different from just having preferences
  const isActivelyInteracting = useCallback(() => {
    const currentState = stateRef.current;
    if (!currentState.lastUserAction) return false;
    
    // Consider user as "actively interacting" if last action was within 30 seconds
    const now = Date.now();
    const timeSinceLastAction = now - currentState.lastUserAction;
    const isRecent = timeSinceLastAction < 30000; // 30 seconds
    
    return currentState.isLocked && isRecent;
  }, []);

  // Get current state immediately
  const getCurrentState = useCallback(() => {
    return stateRef.current;
  }, []);

  // Check if viewport should be forced (user has interacted and we have saved viewport)
  const shouldForceViewport = useCallback(() => {
    const currentState = stateRef.current;
    
    // Solo forzar viewport si:
    // 1. El usuario está bloqueado (tiene preferencias)
    // 2. Tenemos un viewport guardado
    // 3. NO se está interactuando activamente en este momento
    const hasValidViewport = currentState.chartJsState.min !== null && currentState.chartJsState.max !== null;
    const shouldForce = currentState.isLocked && hasValidViewport && currentState.lastUserAction !== null;
    
    return shouldForce;
  }, []);

  // Check if should auto-adjust (opposite of forcing viewport)
  const shouldAutoAdjust = useCallback(() => {
    const currentState = stateRef.current;
    
    // Auto-ajustar cuando:
    // 1. El usuario no ha interactuado nunca (primera vez)
    // 2. O cuando explícitamente se reseteó la cámara
    const neverInteracted = currentState.lastUserAction === null;
    const notLocked = !currentState.isLocked;
    
    return neverInteracted || notLocked;
  }, []);

  // Get the forced viewport values
  const getForcedViewport = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.chartJsState.min !== null && currentState.chartJsState.max !== null) {
      return {
        min: currentState.chartJsState.min,
        max: currentState.chartJsState.max
      };
    }
    return null;
  }, []);

  // Start user interaction
  const onUserStartInteraction = useCallback(() => {
    console.log('📷 [SimpleCamera] User started interaction');
    setState(prev => ({
      ...prev,
      isLocked: true,
      lastUserAction: Date.now()
    }));
    
    // Clear any existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
  }, []);

  // End user interaction (with slight delay to capture final state)
  const onUserEndInteraction = useCallback(() => {
    console.log('📷 [SimpleCamera] User ended interaction');
    // Small delay to ensure we capture the final state
    interactionTimeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        isLocked: true, // Confirmar que está bloqueado después de interacción
        lastUserAction: Date.now()
      }));
    }, 50);
  }, []);

  // Handle user zoom - con persistencia mejorada
  const onUserZoom = useCallback((min: number, max: number, centerX: number) => {
    console.log('📷 [SimpleCamera] User zoom:', { min, max, centerX });
    setState(prev => {
      const newState = {
        ...prev,
        isLocked: true,
        lastUserAction: Date.now(),
        chartJsState: {
          min,
          max,
          centerX
        }
      };
      
      // Actualizar también el ref inmediatamente para acceso sincrónico
      stateRef.current = newState;
      
      if (onStateChange) {
        onStateChange(newState);
      }
      
      return newState;
    });
  }, [onStateChange]);

  // Handle user pan - con persistencia mejorada
  const onUserPan = useCallback((min: number, max: number, centerX: number) => {
    console.log('📷 [SimpleCamera] User pan:', { min, max, centerX });
    setState(prev => {
      const newState = {
        ...prev,
        isLocked: true,
        lastUserAction: Date.now(),
        chartJsState: {
          min,
          max,
          centerX
        }
      };
      
      // Actualizar también el ref inmediatamente para acceso sincrónico
      stateRef.current = newState;
      
      if (onStateChange) {
        onStateChange(newState);
      }
      
      return newState;
    });
  }, [onStateChange]);

  // Reset to latest candles - con limpieza completa
  const resetToLatest = useCallback(() => {
    console.log('📷 [SimpleCamera] Reset to latest - limpiando todo el estado');
    const newState = {
      isLocked: false,
      lastUserAction: null,
      chartJsState: {
        min: null,
        max: null,
        centerX: null
      }
    };
    
    setState(newState);
    
    // Limpiar también sessionStorage
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('simpleCamera_state');
        console.log('📷 [SimpleCamera] Estado limpiado de sessionStorage');
      } catch (error) {
        console.warn('📷 [SimpleCamera] Error limpiando sessionStorage:', error);
      }
    }
    
    if (onStateChange) {
      onStateChange(newState);
    }
  }, [onStateChange]);

  // Get recommended viewport for initial setup
  const getRecommendedViewport = useCallback((totalCandles: number, candleData?: any[]) => {
    if (!candleData || candleData.length === 0) {
      return { min: undefined, max: undefined };
    }

    // Show last defaultVisibleCandles candles
    const visibleCandles = Math.min(defaultVisibleCandles, candleData.length);
    const startIndex = Math.max(0, candleData.length - visibleCandles);
    const endIndex = candleData.length - 1;

    if (startIndex >= candleData.length || endIndex >= candleData.length) {
      return { min: undefined, max: undefined };
    }

    const minTimestamp = candleData[startIndex]?.x;
    const maxTimestamp = candleData[endIndex]?.x;

    if (minTimestamp === undefined || maxTimestamp === undefined) {
      return { min: undefined, max: undefined };
    }

    // Add some padding
    const timeRange = maxTimestamp - minTimestamp;
    const padding = timeRange * 0.05; // 5% padding

    return {
      min: minTimestamp - padding,
      max: maxTimestamp + padding
    };
  }, [defaultVisibleCandles]);

    // Memoize the return object to prevent unnecessary re-creations
  const controls = useMemo(() => ({
    state,
    isLocked,
    isActivelyInteracting,
    getCurrentState,
    shouldForceViewport,
    shouldAutoAdjust,
    getForcedViewport,
    onUserStartInteraction,
    onUserEndInteraction,
    onUserZoom,
    onUserPan,
    resetToLatest,
    getRecommendedViewport
  }), [state, isLocked, isActivelyInteracting, getCurrentState, shouldForceViewport, shouldAutoAdjust, getForcedViewport, onUserStartInteraction, onUserEndInteraction, onUserZoom, onUserPan, resetToLatest, getRecommendedViewport]);

  return controls;
};
