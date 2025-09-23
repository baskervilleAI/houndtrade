import { useState, useCallback, useRef, useMemo, useEffect } from 'react';

// Utility function para debounce
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null;
  return ((...args: any[]) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

/**
 * Patrón mejorado para persistencia del viewport siguiendo las mejores prácticas de Chart.js:
 * - No recrea options/plugins en cada render
 * - Usa mutación en sitio para preservar escalas
 * - Implementa el patrón snapshot/restore oficial
 */

export interface SimpleCameraState {
  isLocked: boolean;
  lastUserAction: number | null;
  chartJsState: {
    min: number | null;
    max: number | null;
    centerX: number | null;
  };
  // Nuevo: Estado explícito del modo de cámara
  mode: 'FIRST_LOAD' | 'USER_INTERACTING' | 'USER_LOCKED' | 'AUTO_ADJUST';
}

export interface SimpleCameraControls {
  state: SimpleCameraState;
  isLocked: () => boolean;
  isActivelyInteracting: () => boolean;
  getCurrentState: () => SimpleCameraState;
  shouldForceViewport: () => boolean;
  shouldAutoAdjust: () => boolean;
  getForcedViewport: () => { min: number; max: number } | null;
  onUserStartInteraction: () => void;
  onUserEndInteraction: () => void;
  onUserZoom: (min: number, max: number, centerX: number) => void;
  onUserPan: (min: number, max: number, centerX: number) => void;
  resetToLatest: () => void;
  getRecommendedViewport: (totalCandles: number, candleData?: any[]) => { min?: number; max?: number };
  
  // NUEVOS métodos para compatibilidad con Chart.js oficial
  updateFromChartViewport: (min: number | null, max: number | null) => void;
  shouldPersistViewport: () => boolean;
  lockCamera: () => void;
  unlockCamera: () => void;
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
        chartJsState: { min: null, max: null, centerX: null },
        mode: 'FIRST_LOAD'
      };
    }
    
    try {
      const saved = sessionStorage.getItem('simpleCamera_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // console.log('📷 [SimpleCamera] Estado cargado desde sessionStorage:', parsed);
        return {
          ...parsed,
          mode: parsed.mode || 'FIRST_LOAD' // Migración de estados antiguos
        };
      }
    } catch (error) {
      console.warn('📷 [SimpleCamera] Error cargando estado desde sessionStorage:', error);
    }
    
    return {
      isLocked: false,
      lastUserAction: null,
      chartJsState: { min: null, max: null, centerX: null },
      mode: 'FIRST_LOAD'
    };
  };
  
  const [state, setState] = useState<SimpleCameraState>(getInitialState());

  // Use a ref to maintain current state accessible from callbacks
  const stateRef = useRef(state);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced persistence function para reducir escrituras a sessionStorage
  const debouncedPersist = useMemo(
    () => debounce((stateToSave: SimpleCameraState) => {
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('simpleCamera_state', JSON.stringify(stateToSave));
          console.log('📷 [SimpleCamera] Estado persistido en sessionStorage (debounced)');
        } catch (error) {
          console.warn('📷 [SimpleCamera] Error guardando estado en sessionStorage:', error);
        }
      }
    }, 500), // 500ms debounce para agrupar múltiples cambios
    []
  );

  // Update ref whenever state changes and persist with debounce
  useEffect(() => {
    stateRef.current = state;
    
    // Persistir estado con debounce para evitar escrituras excesivas
    debouncedPersist(state);
    
    // Callback para notificar cambios de estado
    if (onStateChange) {
      onStateChange(state);
    }
  }, [state, onStateChange, debouncedPersist]);

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
    
    // Usar el nuevo modo de cámara para determinar interacción activa
    return currentState.mode === 'USER_INTERACTING' || 
           (currentState.mode === 'USER_LOCKED' && 
            currentState.lastUserAction !== null && 
            (Date.now() - currentState.lastUserAction) < 30000); // 30 segundos
  }, []);

  // ============================================
  // Lógica inteligente basada en modos de cámara
  // ============================================
  
  // Determinar si el sistema debe ajustar automáticamente la vista
  const shouldAutoAdjustForMode = useCallback(() => {
    const currentState = stateRef.current;
    
    // FIRST_LOAD: Permitir auto-ajuste inicial
    if (currentState.mode === 'FIRST_LOAD') {
      return true;
    }
    
    // USER_INTERACTING/USER_LOCKED: Nunca auto-ajustar
    if (currentState.mode === 'USER_INTERACTING' || currentState.mode === 'USER_LOCKED') {
      return false;
    }
    
    // AUTO_ADJUST: Permitir ajustes automáticos
    if (currentState.mode === 'AUTO_ADJUST') {
      return true;
    }
    
    // Por defecto, no auto-ajustar si hay interacción del usuario reciente
    const now = Date.now();
    const timeSinceUserAction = currentState.lastUserAction ? 
      now - currentState.lastUserAction : Infinity;
    
    // Usar 30 segundos como timeout por defecto
    return timeSinceUserAction > 30000;
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
    // Usar la nueva lógica basada en modos
    return shouldAutoAdjustForMode();
  }, [shouldAutoAdjustForMode]);

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

  // Handle user zoom - con persistencia optimizada
  const onUserZoom = useCallback((min: number, max: number, centerX: number) => {
    console.log('📷 [SimpleCamera] User zoom:', { min, max, centerX });
    
    const newState = {
      isLocked: true,
      lastUserAction: Date.now(),
      chartJsState: {
        min,
        max,
        centerX
      },
      mode: 'USER_INTERACTING' as const
    };
    
    // Actualizar estado local inmediatamente
    setState(prev => ({ ...prev, ...newState }));
    
    // Actualizar también el ref inmediatamente para acceso sincrónico
    stateRef.current = { ...stateRef.current, ...newState };
    
    // El callback onStateChange y persistencia se manejan en el useEffect con debounce
  }, []);

  // Handle user pan - con persistencia optimizada
  const onUserPan = useCallback((min: number, max: number, centerX: number) => {
    console.log('📷 [SimpleCamera] User pan:', { min, max, centerX });
    
    const newState = {
      isLocked: true,
      lastUserAction: Date.now(),
      chartJsState: {
        min,
        max,
        centerX
      },
      mode: 'USER_LOCKED' as const
    };
    
    // Actualizar estado local inmediatamente
    setState(prev => ({ ...prev, ...newState }));
    
    // Actualizar también el ref inmediatamente para acceso sincrónico
    stateRef.current = { ...stateRef.current, ...newState };
    
    // El callback onStateChange y persistencia se manejan en el useEffect con debounce
  }, []);

  // Reset to latest candles - con limpieza inmediata de sessionStorage
  const resetToLatest = useCallback(() => {
    console.log('📷 [SimpleCamera] Reset to latest - limpiando todo el estado');
    const newState = {
      isLocked: false,
      lastUserAction: null,
      chartJsState: {
        min: null,
        max: null,
        centerX: null
      },
      mode: 'FIRST_LOAD' as const
    };
    
    setState(newState);
    
    // Limpiar sessionStorage inmediatamente (sin debounce para reset)
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

  // NUEVOS métodos para compatibilidad con Chart.js oficial

  // Actualizar estado desde el viewport actual del chart (sin persistir)
  const updateFromChartViewport = useCallback((min: number | null, max: number | null) => {
    if (min !== null && max !== null) {
      console.log('📷 [SimpleCamera] Actualizando desde Chart viewport:', { min, max });
      setState(prev => ({
        ...prev,
        chartJsState: {
          ...prev.chartJsState,
          min,
          max,
          centerX: (min + max) / 2
        }
      }));
    }
  }, []);

  // Determinar si el viewport debe persistirse basado en el estado actual
  const shouldPersistViewport = useCallback(() => {
    const currentState = stateRef.current;
    return currentState.isLocked && 
           currentState.chartJsState.min !== null && 
           currentState.chartJsState.max !== null;
  }, []);

  // Bloquear la cámara en su posición actual
  const lockCamera = useCallback(() => {
    console.log('🔒 [SimpleCamera] Bloqueando cámara en posición actual');
    setState(prev => ({
      ...prev,
      isLocked: true,
      lastUserAction: Date.now(),
      mode: 'USER_LOCKED'
    }));
  }, []);

  // Desbloquear la cámara para seguimiento automático
  const unlockCamera = useCallback(() => {
    console.log('🔓 [SimpleCamera] Desbloqueando cámara para auto-seguimiento');
    setState(prev => ({
      ...prev,
      isLocked: false,
      mode: 'AUTO_ADJUST'
    }));
  }, []);

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
    getRecommendedViewport,
    // NUEVOS métodos para Chart.js oficial
    updateFromChartViewport,
    shouldPersistViewport,
    lockCamera,
    unlockCamera
  }), [
    state, 
    isLocked, 
    isActivelyInteracting, 
    getCurrentState, 
    shouldForceViewport, 
    shouldAutoAdjust, 
    shouldAutoAdjustForMode, 
    getForcedViewport, 
    onUserStartInteraction, 
    onUserEndInteraction, 
    onUserZoom, 
    onUserPan, 
    resetToLatest, 
    getRecommendedViewport,
    updateFromChartViewport,
    shouldPersistViewport,
    lockCamera,
    unlockCamera
  ]);

  return controls;
};
