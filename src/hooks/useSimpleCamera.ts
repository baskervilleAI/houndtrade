import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Chart } from 'chart.js';
import { CandleData } from '../services/binanceService';
import { 
  logViewportState, 
  logStateTransition, 
  logPersistenceOp, 
  logUserInteractionDetailed, 
  logTidalFlow,
  logLifecycle,
  logCamera
} from '../utils/debugLogger';

// Utility functions
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null;
  return ((...args: any[]) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

/**
 * GOBERNANZA TIDAL DE CÁMARA - Implementación completa basada en análisis de logs
 * 
 * Esta implementación resuelve los problemas identificados:
 * - Snapshot ANTES de mutar data (no después)
 * - Viewport autoritativo desde CameraState (no del chart)
 * - Histeresis de interacción con cooldown
 * - Marea (tide) para seguimiento suave de cola
 * - Una sola fuente de verdad (SoT) para el viewport
 */

export type CameraMode = 'AUTO' | 'FOLLOW_TAIL' | 'USER_LOCKED' | 'USER_INTERACTING' | 'FIRST_LOAD' | 'AUTO_ADJUST';

export interface SimpleCameraState {
  mode: CameraMode;
  viewport: { min: number; max: number } | null;
  tide: number;              // 0..1 (0 = fijo, 1 = seguir cola)
  cooldownMs: number;        // tiempo de histeresis después de interacción
  lastUserActionTs: number | null;
  
  // Legacy para compatibilidad - se eliminará gradualmente
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
  getRecommendedViewport: (totalCandles: number, candleData?: any[], showAllCandles?: boolean) => { min?: number; max?: number };
  
  // NUEVOS métodos para compatibilidad con Chart.js oficial
  updateFromChartViewport: (min: number | null, max: number | null) => void;
  shouldPersistViewport: () => boolean;
  lockCamera: () => void;
  unlockCamera: () => void;
  
  // NUEVOS métodos para gobernanza tidal
  getViewportFromCamera: () => { min: number; max: number } | null;
  computeTidalViewport: (options: {
    snap: { min: number; max: number };
    lastCandleTime: number;
  }) => { min: number; max: number };
  applyViewportToChart: (chart: Chart, viewport: { min: number; max: number }) => boolean;
  shouldFollowTail: () => boolean;
  setTide: (tide: number) => void;
  setCooldownMs: (cooldownMs: number) => void;
  
    // NUEVOS métodos para cambios de temporalidad y criptomoneda
  resetForTimeframeChange: () => void;
  resetForCryptoCurrencyChange: () => void;
  setViewportToLatestData: (candleData: any[], visibleCandles?: number) => boolean;
}

/**
 * FUNCIONES AUXILIARES PARA GOBERNANZA TIDAL
 */

/**
 * Obtiene el viewport autoritativo desde CameraState (no del chart)
 */
function getViewportFromCameraState(state: SimpleCameraState): { min: number; max: number } | null {
  if (state.viewport?.min != null && state.viewport?.max != null) {
    return { min: state.viewport.min, max: state.viewport.max };
  }
  
  // Fallback a legacy state para compatibilidad
  if (state.chartJsState.min != null && state.chartJsState.max != null) {
    return { min: state.chartJsState.min, max: state.chartJsState.max };
  }
  
  return null;
}

/**
 * Computa el viewport "tidal" que mezcla seguimiento de cola vs. posición fija
 */
function computeTidalViewport({
  camera,
  snap,
  lastCandleTime
}: {
  camera: SimpleCameraState;
  snap: { min: number; max: number };
  lastCandleTime: number;
}): { min: number; max: number } {
  const width = snap.max - snap.min;

  // Si el usuario está interactuando o bloqueado, mantener posición fija
  const interacting = camera.mode === 'USER_INTERACTING'
    || (camera.lastUserActionTs && (Date.now() - camera.lastUserActionTs) < camera.cooldownMs);

  // CRÍTICO: Cualquier estado bloqueado (incluyendo legacy isLocked) debe mantener posición fija
  if (interacting || camera.mode === 'USER_LOCKED' || camera.isLocked || camera.tide === 0) {
    const fixedViewport = getViewportFromCameraState(camera) ?? snap;
    return fixedViewport;
  }

  // FOLLOW_TAIL o AUTO con "tide">0: anclar al extremo derecho (última vela)
  const rightTarget = lastCandleTime; // Sin padding adicional
  const leftTarget = rightTarget - width;

  // Blend lineal entre posición actual y posición de cola
  const tideFactor = camera.tide;
  const min = snap.min * (1 - tideFactor) + leftTarget * tideFactor;
  const max = snap.max * (1 - tideFactor) + rightTarget * tideFactor;
  
  return { min, max };
}

/**
 * Aplica viewport al chart de forma robusta (con múltiples métodos de fallback)
 */
function applyViewportToChart(chart: Chart, viewport: { min: number; max: number }): boolean {
  try {
    // Método 1: Usar API de zoom si está disponible (más confiable)
    if (typeof (chart as any).zoomScale === 'function') {
      try {
        (chart as any).zoomScale('x', { min: viewport.min, max: viewport.max }, 'none');
        return true;
      } catch (error) {
        // zoomScale API failed, continue to fallback methods
      }
    }

    // Método 2: Modificar opciones directamente (fallback)
    if (chart.options.scales?.x) {
      chart.options.scales.x.min = viewport.min;
      chart.options.scales.x.max = viewport.max;
      return true;
    }

    // Método 3: Modificar escalas directamente (último recurso)
    if (chart.scales?.x) {
      chart.scales.x.min = viewport.min;
      chart.scales.x.max = viewport.max;
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Obtiene viewport desde el chart como fallback (con manejo robusto de undefined)
 */
function getViewportFromChart(chart: Chart): { min: number; max: number } | null {
  try {
    // Método preferido: usar API del plugin
    const zoomedBounds = (chart as any).getZoomedScaleBounds?.();
    if (zoomedBounds?.x?.min != null && zoomedBounds?.x?.max != null) {
      return { min: zoomedBounds.x.min, max: zoomedBounds.x.max };
    }
  } catch (error) {
    // Fallback silencioso
  }

  // Fallback: escalas directas
  const xScale = chart.scales.x;
  if (xScale?.min != null && xScale?.max != null) {
    return { min: xScale.min, max: xScale.max };
  }

  return null;
}

interface UseSimpleCameraProps {
  defaultVisibleCandles?: number;
  onStateChange?: (state: SimpleCameraState) => void;
}

export const useSimpleCamera = ({
  defaultVisibleCandles = 1000,
  onStateChange
}: UseSimpleCameraProps = {}): SimpleCameraControls => {
  
  // Referencias para control de carga y reentrada
  const loadingRef = useRef(true);
  const inMutationRef = useRef(false);
  
  // Cargar estado inicial desde sessionStorage SOLO UNA VEZ
  const [state, setState] = useState<SimpleCameraState>(() => {
    logLifecycle('INIT_START', 'useSimpleCamera', { typeof_window: typeof window });
    
    if (typeof window === 'undefined') {
      const initialState = {
        mode: 'FIRST_LOAD',
        viewport: null,
        tide: 0.8,
        cooldownMs: 3500, // Incrementado para mejor debounce
        lastUserActionTs: null,
        // Legacy para compatibilidad
        isLocked: false,
        lastUserAction: null,
        chartJsState: { min: null, max: null, centerX: null }
      };
      logViewportState(initialState, 'INITIAL_STATE_SSR');
      return initialState;
    }
    
    try {
      const raw = sessionStorage.getItem('simpleCamera_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        logPersistenceOp('LOAD_FROM_SESSIONSTORAGE', parsed, true);
        
        const restoredState = {
          mode: parsed.mode || 'FIRST_LOAD',
          viewport: parsed.viewport || null,
          tide: parsed.tide ?? 0.8,
          cooldownMs: parsed.cooldownMs ?? 3500, // Incrementado para mejor debounce
          lastUserActionTs: parsed.lastUserActionTs || null,
          // Legacy para compatibilidad
          isLocked: parsed.isLocked || false,
          lastUserAction: parsed.lastUserAction || null,
          chartJsState: parsed.chartJsState || { min: null, max: null, centerX: null }
        };
        
        logViewportState(restoredState, 'RESTORED_FROM_STORAGE');
        return restoredState;
      }
    } catch (error) {
      logPersistenceOp('LOAD_FROM_SESSIONSTORAGE', null, false);
      // Error loading from sessionStorage, continue with default state
    }
    
    const defaultState = {
      mode: 'FIRST_LOAD',
      viewport: null,
      tide: 0.8,
      cooldownMs: 3500, // Incrementado para mejor debounce
      lastUserActionTs: null,
      // Legacy para compatibilidad
      isLocked: false,
      lastUserAction: null,
      chartJsState: { min: null, max: null, centerX: null }
    };
    
    logViewportState(defaultState, 'DEFAULT_STATE');
    return defaultState;
  });

  // Use a ref to maintain current state accessible from callbacks
  const stateRef = useRef(state);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const interactionDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Función atómica para evitar reentradas
  const atomic = useCallback((fn: () => void) => {
    if (inMutationRef.current) {
      // Reentrancy detected - ignoring update
      return;
    }
    inMutationRef.current = true;
    try { 
      fn(); 
    } finally { 
      inMutationRef.current = false; 
    }
  }, []);

  // Marcar fin de carga inicial
  useEffect(() => {
    loadingRef.current = false;
  }, []);

  // Persistir estado (solo después de carga inicial y sin reentradas)
  useEffect(() => {
    if (loadingRef.current || inMutationRef.current) {
      logPersistenceOp('SKIP_PERSIST - loading or in mutation', { loading: loadingRef.current, inMutation: inMutationRef.current });
      return;
    }
    
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('simpleCamera_state', JSON.stringify(state));
        logPersistenceOp('SAVE_TO_SESSIONSTORAGE', { 
          mode: state.mode, 
          isLocked: state.isLocked,
          viewport: state.viewport,
          lastUserAction: state.lastUserAction ? new Date(state.lastUserAction).toLocaleTimeString() : null
        }, true);
      } catch (error) {
        logPersistenceOp('SAVE_TO_SESSIONSTORAGE', null, false);
        // Error saving to sessionStorage
      }
    }
    
    // Callback para notificar cambios de estado
    if (onStateChange) {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  // Update ref whenever state changes
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Check if camera is locked (user has interacted) - use ref for immediate access
  const isLocked = useCallback(() => {
    const currentState = stateRef.current;
    const hasViewport = currentState.chartJsState.min !== null && currentState.chartJsState.max !== null;
    
    // Solo bloquear si:
    // 1. El usuario ha interactuado (lastUserAction existe)
    // 2. Tenemos un viewport guardado del usuario
    // 3. El estado isLocked está activo
    const shouldBeLocked = currentState.isLocked && hasViewport && currentState.lastUserAction !== null;
    
    // Log detallado para debugging (solo 1% de las veces para evitar spam)
    if (Math.random() < 0.01) {
      logCamera('CAMERA_LOCK_CHECK', { 
        stateIsLocked: currentState.isLocked, 
        hasViewport,
        shouldBeLocked,
        mode: currentState.mode,
        lastUserAction: currentState.lastUserAction ? new Date(currentState.lastUserAction).toLocaleTimeString() : null,
        viewport: currentState.viewport
      });
    }
    
    return shouldBeLocked;
  }, []); // No dependencies - always uses current ref

  // Check if user is actively interacting (recently) - different from just having preferences
  const isActivelyInteracting = useCallback(() => {
    const currentState = stateRef.current;
    
    logCamera('ACTIVELY_INTERACTING_CHECK', {
      mode: currentState.mode, 
      lastUserAction: currentState.lastUserAction ? new Date(currentState.lastUserAction).toLocaleTimeString() : 'null',
      timeSinceAction: currentState.lastUserAction ? Date.now() - currentState.lastUserAction : null
    });
    
    // Usar el nuevo modo de cámara para determinar interacción activa
    if (currentState.mode === 'USER_INTERACTING') {
      logCamera('ACTIVELY_INTERACTING: TRUE - USER_INTERACTING mode');
      return true;
    }
    
    // También considerar interacción activa si la última acción fue muy reciente (menos de 5 segundos)
    if (currentState.lastUserAction !== null) {
      const timeSinceLastAction = Date.now() - currentState.lastUserAction;
      const isActive = timeSinceLastAction < 5000; // 5 segundos para considerarse interacción activa
      logCamera(`ACTIVELY_INTERACTING: ${isActive}`, {
        timeSinceAction: timeSinceLastAction,
        threshold: 5000
      });
      return isActive;
    }
    
    logCamera('ACTIVELY_INTERACTING: FALSE - no recent interaction');
    return false;
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

  // Start user interaction (con protección atómica)
  const onUserStartInteraction = useCallback(() => {
    const timestamp = Date.now();
    const preState = stateRef.current;
    
    logUserInteractionDetailed('START_INTERACTION', {
      timestamp: new Date(timestamp).toLocaleTimeString(),
      triggeredBy: 'user_gesture'
    }, preState);
    
    atomic(() => {
      setState(prev => {
        const newState = {
          ...prev,
          isLocked: true,
          lastUserAction: timestamp,
          lastUserActionTs: timestamp,
          mode: 'USER_INTERACTING' as const
        };
        
        logStateTransition(prev, newState, 'onUserStartInteraction');
        return shallowEqual(prev, newState) ? prev : newState;
      });
    });
    
    // Clear any existing timeouts
    if (interactionTimeoutRef.current) {
      logCamera('START_INTERACTION - clearing existing timeout');
      clearTimeout(interactionTimeoutRef.current);
    }
    if (interactionDebounceRef.current) {
      logCamera('START_INTERACTION - clearing existing debounce timeout');
      clearTimeout(interactionDebounceRef.current);
    }
  }, [atomic]);

  // End user interaction (con protección atómica y debounce mejorado)
  const onUserEndInteraction = useCallback(() => {
    const timestamp = Date.now();
    const preState = stateRef.current;
    
    logUserInteractionDetailed('END_INTERACTION', {
      timestamp: new Date(timestamp).toLocaleTimeString(),
      debounceDelay: 750 // Incrementado para mejor debounce
    }, preState);
    
    // Clear existing debounce timeout
    if (interactionDebounceRef.current) {
      logCamera('END_INTERACTION - clearing existing debounce timeout');
      clearTimeout(interactionDebounceRef.current);
    }
    
    // NUEVO: Debounce mejorado que espera a que el usuario termine completamente
    interactionDebounceRef.current = setTimeout(() => {
      logCamera('END_INTERACTION - applying final state after debounce');
      atomic(() => {
        setState(prev => {
          const newState = {
            ...prev,
            isLocked: true, // Confirmar que está bloqueado después de interacción
            lastUserAction: timestamp,
            lastUserActionTs: timestamp,
            mode: 'USER_LOCKED' as const
          };
          
          logStateTransition(prev, newState, 'onUserEndInteraction_debounced');
          logViewportState(newState, 'FINAL_INTERACTION_STATE');
          return shallowEqual(prev, newState) ? prev : newState;
        });
      });
    }, 750); // Incrementado a 750ms para evitar cambios prematuros
  }, [atomic]);

  // Handle user zoom - con protección atómica contra reentradas
  const onUserZoom = useCallback((min: number, max: number, centerX: number) => {
    const timestamp = Date.now();
    const preState = stateRef.current;
    
    logUserInteractionDetailed('USER_ZOOM', {
      min, 
      max, 
      centerX, 
      timestamp: new Date(timestamp).toLocaleTimeString(),
      range: max - min
    }, preState);
    
    atomic(() => {
      setState(prev => {
        const newState = {
          ...prev,
          isLocked: true,
          lastUserAction: timestamp,
          lastUserActionTs: timestamp,
          mode: 'USER_LOCKED' as const,
          viewport: { min, max }, // NUEVO: usar viewport autoritativo
          chartJsState: {
            min,
            max,
            centerX
          }
        };
        
        logStateTransition(prev, newState, 'onUserZoom');
        logViewportState(newState, 'AFTER_USER_ZOOM');
        return shallowEqual(prev, newState) ? prev : newState;
      });
    });
  }, [atomic]);

  // Handle user pan - con protección atómica contra reentradas
  const onUserPan = useCallback((min: number, max: number, centerX: number) => {
    const timestamp = Date.now();
    const preState = stateRef.current;
    
    logUserInteractionDetailed('USER_PAN', {
      min, 
      max, 
      centerX, 
      timestamp: new Date(timestamp).toLocaleTimeString(),
      range: max - min
    }, preState);
    
    atomic(() => {
      setState(prev => {
        const newState = {
          ...prev,
          isLocked: true,
          lastUserAction: timestamp,
          lastUserActionTs: timestamp,
          viewport: { min, max }, // NUEVO: usar viewport autoritativo
          chartJsState: {
            min,
            max,
            centerX
          },
          mode: 'USER_LOCKED' as const
        };
        
        logStateTransition(prev, newState, 'onUserPan');
        logViewportState(newState, 'AFTER_USER_PAN');
        return shallowEqual(prev, newState) ? prev : newState;
      });
    });
  }, [atomic]);

  // Reset to latest candles - con limpieza inmediata de sessionStorage
  const resetToLatest = useCallback(() => {
    const preState = stateRef.current;
    logUserInteractionDetailed('RESET_TO_LATEST', {
      reason: 'user_requested_reset',
      clearingSessionStorage: true
    }, preState);
    
    atomic(() => {
      const newState: SimpleCameraState = {
        mode: 'AUTO', // Cambiar a AUTO en lugar de FIRST_LOAD para seguimiento inmediato
        viewport: null,
        tide: 0.8,
        cooldownMs: 3500, // Incrementado para mejor debounce
        lastUserActionTs: null,
        // Legacy para compatibilidad
        isLocked: false,
        lastUserAction: null,
        chartJsState: {
          min: null,
          max: null,
          centerX: null
        }
      };
      
      logStateTransition(preState, newState, 'resetToLatest');
      setState(newState);
      stateRef.current = newState; // Actualizar ref inmediatamente
      
      logViewportState(newState, 'AFTER_RESET');
      
      if (onStateChange) {
        onStateChange(newState);
      }
    });
    
    // Limpiar sessionStorage inmediatamente (sin debounce para reset)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('simpleCamera_state');
        logPersistenceOp('CLEAR_SESSIONSTORAGE', null, true);
      } catch (error) {
        logPersistenceOp('CLEAR_SESSIONSTORAGE', null, false);
        // Error clearing sessionStorage
      }
    }
  }, [atomic, onStateChange]);

  // NUEVO: Reset específico para cambios de temporalidad
  const resetForTimeframeChange = useCallback(() => {
    const preState = stateRef.current;
    logUserInteractionDetailed('RESET_FOR_TIMEFRAME_CHANGE', {
      reason: 'timeframe_change_requested',
      clearingSessionStorage: true,
      forcingAutoMode: true
    }, preState);
    
    atomic(() => {
      const newState: SimpleCameraState = {
        mode: 'FIRST_LOAD', // FIRST_LOAD para permitir ajuste inicial automático
        viewport: null,
        tide: 1.0, // Máximo seguimiento para mostrar datos más recientes
        cooldownMs: 1000, // Cooldown reducido para cambios de temporalidad
        lastUserActionTs: null,
        // Legacy para compatibilidad - completamente limpio
        isLocked: false,
        lastUserAction: null,
        chartJsState: {
          min: null,
          max: null,
          centerX: null
        }
      };
      
      logStateTransition(preState, newState, 'resetForTimeframeChange');
      setState(newState);
      stateRef.current = newState; // Actualizar ref inmediatamente
      
      logViewportState(newState, 'AFTER_TIMEFRAME_RESET');
      
      if (onStateChange) {
        onStateChange(newState);
      }
    });
    
    // Limpiar sessionStorage para forzar estado completamente fresco
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('simpleCamera_state');
        logPersistenceOp('CLEAR_SESSIONSTORAGE_TIMEFRAME_CHANGE', null, true);
      } catch (error) {
        logPersistenceOp('CLEAR_SESSIONSTORAGE_TIMEFRAME_CHANGE', null, false);
      }
    }
  }, [atomic, onStateChange]);

  // NUEVO: Reset específico para cambios de criptomoneda
  const resetForCryptoCurrencyChange = useCallback(() => {
    const preState = stateRef.current;
    logUserInteractionDetailed('RESET_FOR_CRYPTOCURRENCY_CHANGE', {
      reason: 'cryptocurrency_change_requested',
      clearingSessionStorage: true,
      forcingAutoMode: true,
      showingFullGraph: true
    }, preState);
    
    atomic(() => {
      const newState: SimpleCameraState = {
        mode: 'FIRST_LOAD', // FIRST_LOAD para permitir ajuste inicial automático
        viewport: null,
        tide: 1.0, // Máximo seguimiento para mostrar datos más recientes  
        cooldownMs: 1000, // Cooldown reducido para cambios de criptomoneda
        lastUserActionTs: null,
        // Legacy para compatibilidad - completamente limpio
        isLocked: false,
        lastUserAction: null,
        chartJsState: {
          min: null,
          max: null,
          centerX: null
        }
      };
      
      logStateTransition(preState, newState, 'resetForCryptoCurrencyChange');
      setState(newState);
      stateRef.current = newState; // Actualizar ref inmediatamente
      
      logViewportState(newState, 'AFTER_CRYPTOCURRENCY_RESET');
      
      if (onStateChange) {
        onStateChange(newState);
      }
    });
    
    // Limpiar sessionStorage para forzar estado completamente fresco
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('simpleCamera_state');
        logPersistenceOp('CLEAR_SESSIONSTORAGE_CRYPTOCURRENCY_CHANGE', null, true);
      } catch (error) {
        logPersistenceOp('CLEAR_SESSIONSTORAGE_CRYPTOCURRENCY_CHANGE', null, false);
      }
    }
  }, [atomic, onStateChange]);

  // NUEVO: Configurar viewport para mostrar todo el gráfico (cambio de temporalidad)
  const setViewportToLatestData = useCallback((candleData: any[], visibleCandles?: number) => {
    if (!candleData || candleData.length === 0) {
      logCamera('SET_VIEWPORT_TO_LATEST - no data available');
      return false;
    }

    const dataLength = candleData.length;
    // Si no se especifica visibleCandles, mostrar todo el gráfico
    const startIndex = visibleCandles ? Math.max(0, dataLength - visibleCandles) : 0;
    const endIndex = dataLength - 1;

    if (startIndex >= dataLength || endIndex >= dataLength) {
      logCamera('SET_VIEWPORT_TO_LATEST - invalid indices', { startIndex, endIndex, dataLength });
      return false;
    }

    // Detectar el tipo de estructura de datos y extraer timestamp
    let minTimestamp: number;
    let maxTimestamp: number;

    if (candleData[startIndex]?.x !== undefined) {
      // Formato liveStreamingService: { x: timestamp, o, h, l, c, v }
      minTimestamp = candleData[startIndex].x;
      maxTimestamp = candleData[endIndex].x;
    } else if (candleData[startIndex]?.timestamp !== undefined) {
      // Formato binanceService: { timestamp: string, open, high, low, close, volume }
      minTimestamp = new Date(candleData[startIndex].timestamp).getTime();
      maxTimestamp = new Date(candleData[endIndex].timestamp).getTime();
    } else {
      logCamera('SET_VIEWPORT_TO_LATEST - unsupported data format');
      return false;
    }

    if (isNaN(minTimestamp) || isNaN(maxTimestamp)) {
      logCamera('SET_VIEWPORT_TO_LATEST - invalid timestamps');
      return false;
    }

    // Agregar padding del 2%
    const timeRange = maxTimestamp - minTimestamp;
    const padding = timeRange * 0.02;

    const newViewport = {
      min: minTimestamp - padding,
      max: maxTimestamp + padding
    };

    atomic(() => {
      setState(prev => {
        const newState = {
          ...prev,
          viewport: newViewport,
          // NO cambiar el modo aquí - mantener el modo actual (FIRST_LOAD para cambios de temporalidad)
          chartJsState: {
            min: newViewport.min,
            max: newViewport.max,
            centerX: (newViewport.min + newViewport.max) / 2
          }
        };
        
        logCamera('SET_VIEWPORT_TO_LATEST_DATA', {
          viewport: newViewport,
          dataLength,
          visibleCandles: visibleCandles || 'all_data',
          showingFullGraph: !visibleCandles,
          timeRange,
          padding
        });
        
        return shallowEqual(prev, newState) ? prev : newState;
      });
    });

    return true;
  }, [atomic]);

  // Get recommended viewport for initial setup
  const getRecommendedViewport = useCallback((totalCandles: number, candleData?: any[], showAllCandles?: boolean) => {
    if (!candleData || candleData.length === 0) {
      return { min: undefined, max: undefined };
    }

    // Si showAllCandles es true o estamos en modo FIRST_LOAD, mostrar todas las velas
    const currentState = stateRef.current;
    const shouldShowAll = showAllCandles || currentState.mode === 'FIRST_LOAD';
    
    const visibleCandles = shouldShowAll ? candleData.length : Math.min(defaultVisibleCandles, candleData.length);
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
      const centerX = (min + max) / 2;
      
      setState(prev => {
        const newState = {
          ...prev,
          chartJsState: {
            ...prev.chartJsState,
            min,
            max,
            centerX
          }
        };
        return newState;
      });
    }
  }, []);

  // Determinar si el viewport debe persistirse basado en el estado actual
  const shouldPersistViewport = useCallback(() => {
    const currentState = stateRef.current;
    const shouldPersist = currentState.isLocked && 
           currentState.chartJsState.min !== null && 
           currentState.chartJsState.max !== null;
    
    return shouldPersist;
  }, []);

  // Bloquear la cámara en su posición actual (con protección atómica)
  const lockCamera = useCallback((viewport?: { min: number; max: number }) => {
    atomic(() => {
      setState(prev => {
        const newState = {
          ...prev,
          isLocked: true,
          lastUserAction: Date.now(),
          lastUserActionTs: Date.now(),
          mode: 'USER_LOCKED' as const,
          ...(viewport && { viewport })
        };
        return shallowEqual(prev, newState) ? prev : newState;
      });
    });
  }, [atomic]);

  // Desbloquear la cámara para seguimiento automático (con protección atómica)
  const unlockCamera = useCallback(() => {
    atomic(() => {
      setState(prev => {
        const newState = {
          ...prev,
          isLocked: false,
          mode: 'AUTO' as const
        };
        return shallowEqual(prev, newState) ? prev : newState;
      });
    });
  }, [atomic]);

  // ============================================
  // NUEVOS MÉTODOS PARA GOBERNANZA TIDAL
  // ============================================

  // Obtener viewport autoritativo desde CameraState
  const getViewportFromCamera = useCallback(() => {
    const currentState = stateRef.current;
    return getViewportFromCameraState(currentState);
  }, []);

  // Computar viewport tidal que mezcla seguimiento vs. posición fija
  const computeTidalViewportMethod = useCallback((options: {
    snap: { min: number; max: number };
    lastCandleTime: number;
  }) => {
    const currentState = stateRef.current;
    
    logTidalFlow('COMPUTE_TIDAL_VIEWPORT', {
      input: options,
      cameraState: {
        mode: currentState.mode,
        tide: currentState.tide,
        isLocked: currentState.isLocked,
        lastUserActionTs: currentState.lastUserActionTs
      }
    });
    
    const result = computeTidalViewport({
      camera: currentState,
      snap: options.snap,
      lastCandleTime: options.lastCandleTime
    });
    
    logTidalFlow('TIDAL_VIEWPORT_RESULT', {
      input: options,
      output: result,
      shift: {
        deltaMin: result.min - options.snap.min,
        deltaMax: result.max - options.snap.max
      }
    });
    
    return result;
  }, []);

  // Aplicar viewport al chart de forma robusta (con múltiples métodos de fallback)
  const applyViewportToChartMethod = useCallback((chart: Chart, viewport: { min: number; max: number }): boolean => {
    logTidalFlow('APPLY_VIEWPORT_TO_CHART', {
      viewport,
      chartExists: !!chart,
      hasZoomApi: typeof (chart as any).zoomScale === 'function',
      hasScales: !!chart.options?.scales?.x
    });
    
    const success: boolean = applyViewportToChart(chart, viewport);
    
    if (success) {
      logTidalFlow('VIEWPORT_APPLIED_SUCCESSFULLY', { viewport, method: 'multiple_fallbacks' });
    } else {
      logTidalFlow('VIEWPORT_APPLICATION_FAILED', { viewport, reason: 'all_methods_failed' });
    }
    
    return success;
  }, []);

  // Determinar si debe seguir la cola basado en tide y modo
  const shouldFollowTail = useCallback(() => {
    const currentState = stateRef.current;
    
    // Si está en interacción o bloqueado, no seguir cola
    const interacting = currentState.mode === 'USER_INTERACTING'
      || (currentState.lastUserActionTs && (Date.now() - currentState.lastUserActionTs) < currentState.cooldownMs);

    // CRÍTICO: Respetar CUALQUIER estado bloqueado (incluyendo legacy isLocked)
    if (interacting || currentState.mode === 'USER_LOCKED' || currentState.isLocked) {
      return false;
    }

    // Si está en modo AUTO o FOLLOW_TAIL y tiene tide > 0
    return (currentState.mode === 'AUTO' || currentState.mode === 'FOLLOW_TAIL') && currentState.tide > 0;
  }, []);

  // Configurar factor de marea (0..1)
  const setTide = useCallback((tide: number) => {
    const clampedTide = Math.max(0, Math.min(1, tide));
    setState(prev => ({
      ...prev,
      tide: clampedTide
    }));
  }, []);

  // Configurar tiempo de cooldown
  const setCooldownMs = useCallback((cooldownMs: number) => {
    const clampedCooldown = Math.max(1000, Math.min(30000, cooldownMs)); // Entre 1s y 30s
    setState(prev => ({
      ...prev,
      cooldownMs: clampedCooldown
    }));
  }, []);

  // Cooldown automático para cambiar de USER_INTERACTING a USER_LOCKED (SIN setState en tick)
  useEffect(() => {
    if (state.mode === 'USER_INTERACTING' && state.lastUserActionTs) {
      logLifecycle('COOLDOWN_TIMER_START', 'useSimpleCamera', {
        cooldownMs: state.cooldownMs,
        lastUserActionTs: new Date(state.lastUserActionTs).toLocaleTimeString()
      });
      
      const timeoutId = setTimeout(() => {
        logLifecycle('COOLDOWN_TIMER_COMPLETE', 'useSimpleCamera', {
          transitionFrom: 'USER_INTERACTING',
          transitionTo: 'USER_LOCKED'
        });
        
        atomic(() => {
          setState(prev => {
            if (prev.mode === 'USER_INTERACTING') {
              const newState = { 
                ...prev, 
                mode: 'USER_LOCKED' as const,
                // CRÍTICO: Asegurar que permanezca bloqueado permanentemente
                isLocked: true
              };
              logStateTransition(prev, newState, 'cooldown_timeout');
              return shallowEqual(prev, newState) ? prev : newState;
            }
            return prev;
          });
        });
      }, state.cooldownMs);

      return () => {
        logLifecycle('COOLDOWN_TIMER_CLEANUP', 'useSimpleCamera');
        clearTimeout(timeoutId);
      };
    }
  }, [state.mode, state.lastUserActionTs, state.cooldownMs, atomic]);

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
    unlockCamera,
    // NUEVOS métodos para gobernanza tidal
    getViewportFromCamera,
    computeTidalViewport: computeTidalViewportMethod,
    applyViewportToChart: applyViewportToChartMethod,
    shouldFollowTail,
    setTide,
    setCooldownMs,
    // NUEVOS métodos para cambios de temporalidad y criptomoneda
    resetForTimeframeChange,
    resetForCryptoCurrencyChange,
    setViewportToLatestData
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
    unlockCamera,
    getViewportFromCamera,
    computeTidalViewportMethod,
    applyViewportToChartMethod,
    shouldFollowTail,
    setTide,
    setCooldownMs,
    resetForTimeframeChange,
    resetForCryptoCurrencyChange,
    setViewportToLatestData
  ]);

  return controls;
};
