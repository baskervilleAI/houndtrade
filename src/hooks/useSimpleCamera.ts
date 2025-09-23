import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Chart } from 'chart.js';

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
  getRecommendedViewport: (totalCandles: number, candleData?: any[]) => { min?: number; max?: number };
  
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
  applyViewportToChart: (chart: Chart, viewport: { min: number; max: number }) => void;
  shouldFollowTail: () => boolean;
  setTide: (tide: number) => void;
  setCooldownMs: (cooldownMs: number) => void;
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

  if (interacting || camera.mode === 'USER_LOCKED' || camera.tide === 0) {
    const fixedViewport = getViewportFromCameraState(camera) ?? snap;
    console.log('🌊 [TidalViewport] Modo FIJO:', { 
      mode: camera.mode, 
      interacting, 
      viewport: fixedViewport 
    });
    return fixedViewport;
  }

  // FOLLOW_TAIL o AUTO con "tide">0: anclar al extremo derecho (última vela)
  const rightTarget = lastCandleTime; // Sin padding adicional
  const leftTarget = rightTarget - width;

  // Blend lineal entre posición actual y posición de cola
  const tideFactor = camera.tide;
  const min = snap.min * (1 - tideFactor) + leftTarget * tideFactor;
  const max = snap.max * (1 - tideFactor) + rightTarget * tideFactor;
  
  console.log('🌊 [TidalViewport] Modo TIDAL:', { 
    mode: camera.mode, 
    tide: camera.tide,
    snap: { min: snap.min, max: snap.max },
    target: { min: leftTarget, max: rightTarget },
    result: { min, max }
  });
  
  return { min, max };
}

/**
 * Aplica viewport al chart de forma robusta (plugin primero, fallback a scales)
 */
function applyViewportToChart(chart: Chart, viewport: { min: number; max: number }): void {
  try {
    // Método preferido: usar API del plugin chartjs-plugin-zoom
    if (typeof (chart as any).zoomScale === 'function') {
      (chart as any).zoomScale('x', viewport, 'none');
      console.log('🎯 [ApplyViewport] Plugin usado:', viewport);
      return;
    }
  } catch (error) {
    console.warn('🎯 [ApplyViewport] Plugin no disponible, usando fallback');
  }

  // Fallback: mutar options directamente
  if (chart.options.scales?.x) {
    chart.options.scales.x.min = viewport.min;
    chart.options.scales.x.max = viewport.max;
    console.log('🎯 [ApplyViewport] Fallback usado:', viewport);
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
  defaultVisibleCandles = 100,
  onStateChange
}: UseSimpleCameraProps = {}): SimpleCameraControls => {
  
  // Referencias para control de carga y reentrada
  const loadingRef = useRef(true);
  const inMutationRef = useRef(false);
  
  // Cargar estado inicial desde sessionStorage SOLO UNA VEZ
  const [state, setState] = useState<SimpleCameraState>(() => {
    if (typeof window === 'undefined') {
      return {
        mode: 'FIRST_LOAD',
        viewport: null,
        tide: 0.8,
        cooldownMs: 3000,
        lastUserActionTs: null,
        // Legacy para compatibilidad
        isLocked: false,
        lastUserAction: null,
        chartJsState: { min: null, max: null, centerX: null }
      };
    }
    
    try {
      const raw = sessionStorage.getItem('simpleCamera_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        console.log('📷 [SimpleCamera] Estado cargado desde sessionStorage:', parsed);
        return {
          mode: parsed.mode || 'FIRST_LOAD',
          viewport: parsed.viewport || null,
          tide: parsed.tide ?? 0.8,
          cooldownMs: parsed.cooldownMs ?? 3000,
          lastUserActionTs: parsed.lastUserActionTs || null,
          // Legacy para compatibilidad
          isLocked: parsed.isLocked || false,
          lastUserAction: parsed.lastUserAction || null,
          chartJsState: parsed.chartJsState || { min: null, max: null, centerX: null }
        };
      }
    } catch (error) {
      console.warn('📷 [SimpleCamera] Error cargando estado desde sessionStorage:', error);
    }
    
    return {
      mode: 'FIRST_LOAD',
      viewport: null,
      tide: 0.8,
      cooldownMs: 3000,
      lastUserActionTs: null,
      // Legacy para compatibilidad
      isLocked: false,
      lastUserAction: null,
      chartJsState: { min: null, max: null, centerX: null }
    };
  });

  // Use a ref to maintain current state accessible from callbacks
  const stateRef = useRef(state);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Función atómica para evitar reentradas
  const atomic = useCallback((fn: () => void) => {
    if (inMutationRef.current) {
      console.warn('📷 [SimpleCamera] Reentrancia detectada - ignorando actualización');
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
    if (loadingRef.current || inMutationRef.current) return;
    
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('simpleCamera_state', JSON.stringify(state));
        console.log('📷 [SimpleCamera] Estado persistido en sessionStorage');
      } catch (error) {
        console.warn('📷 [SimpleCamera] Error guardando estado en sessionStorage:', error);
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
    
    console.log(`🔍 [SimpleCamera] isActivelyInteracting - Estado actual: {mode: ${currentState.mode}, lastUserAction: ${currentState.lastUserAction ? new Date(currentState.lastUserAction).toLocaleTimeString() : 'null'}}`);
    
    // Usar el nuevo modo de cámara para determinar interacción activa
    if (currentState.mode === 'USER_INTERACTING') {
      console.log('🔍 [SimpleCamera] isActivelyInteracting: TRUE - modo USER_INTERACTING');
      return true;
    }
    
    // También considerar interacción activa si la última acción fue muy reciente (menos de 5 segundos)
    if (currentState.lastUserAction !== null) {
      const timeSinceLastAction = Date.now() - currentState.lastUserAction;
      const isActive = timeSinceLastAction < 5000; // 5 segundos para considerarse interacción activa
      console.log(`🔍 [SimpleCamera] isActivelyInteracting: ${isActive} - tiempo desde última acción: ${timeSinceLastAction}ms (límite: 5000ms)`);
      return isActive;
    }
    
    console.log('🔍 [SimpleCamera] isActivelyInteracting: FALSE - no hay interacción reciente');
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
    console.log(`📷 [SimpleCamera] onUserStartInteraction - timestamp: ${new Date(timestamp).toLocaleTimeString()}`);
    
    atomic(() => {
      setState(prev => {
        const newState = {
          ...prev,
          isLocked: true,
          lastUserAction: timestamp,
          lastUserActionTs: timestamp,
          mode: 'USER_INTERACTING' as const
        };
        return shallowEqual(prev, newState) ? prev : newState;
      });
    });
    
    // Clear any existing timeout
    if (interactionTimeoutRef.current) {
      console.log('📷 [SimpleCamera] onUserStartInteraction - Limpiando timeout existente');
      clearTimeout(interactionTimeoutRef.current);
    }
  }, [atomic]);

  // End user interaction (con protección atómica)
  const onUserEndInteraction = useCallback(() => {
    const timestamp = Date.now();
    console.log(`📷 [SimpleCamera] onUserEndInteraction - timestamp: ${new Date(timestamp).toLocaleTimeString()}`);
    // Small delay to ensure we capture the final state
    interactionTimeoutRef.current = setTimeout(() => {
      console.log('📷 [SimpleCamera] onUserEndInteraction - Aplicando estado final después del timeout');
      atomic(() => {
        setState(prev => {
          const newState = {
            ...prev,
            isLocked: true, // Confirmar que está bloqueado después de interacción
            lastUserAction: timestamp,
            lastUserActionTs: timestamp,
            mode: 'USER_LOCKED' as const
          };
          return shallowEqual(prev, newState) ? prev : newState;
        });
      });
    }, 50);
  }, [atomic]);

  // Handle user zoom - con protección atómica contra reentradas
  const onUserZoom = useCallback((min: number, max: number, centerX: number) => {
    const timestamp = Date.now();
    console.log(`📷 [SimpleCamera] onUserZoom - {min: ${min}, max: ${max}, centerX: ${centerX}, timestamp: ${new Date(timestamp).toLocaleTimeString()}}`);
    
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
        
        return shallowEqual(prev, newState) ? prev : newState;
      });
    });
  }, [atomic]);

  // Handle user pan - con protección atómica contra reentradas
  const onUserPan = useCallback((min: number, max: number, centerX: number) => {
    const timestamp = Date.now();
    console.log(`📷 [SimpleCamera] onUserPan - {min: ${min}, max: ${max}, centerX: ${centerX}, timestamp: ${new Date(timestamp).toLocaleTimeString()}}`);
    
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
        
        return shallowEqual(prev, newState) ? prev : newState;
      });
    });
  }, [atomic]);

  // Reset to latest candles - con limpieza inmediata de sessionStorage
  const resetToLatest = useCallback(() => {
    console.log('📷 [SimpleCamera] Reset to latest - limpiando todo el estado');
    const newState: SimpleCameraState = {
      mode: 'FIRST_LOAD',
      viewport: null,
      tide: 0.8,
      cooldownMs: 3000,
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
      const centerX = (min + max) / 2;
      console.log(`📷 [SimpleCamera] updateFromChartViewport - {min: ${min}, max: ${max}, centerX: ${centerX}}`);
      
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
        console.log(`📷 [SimpleCamera] updateFromChartViewport - Estado actualizado: {mode: ${newState.mode}, isLocked: ${newState.isLocked}}`);
        return newState;
      });
    } else {
      console.log(`📷 [SimpleCamera] updateFromChartViewport - Valores inválidos: {min: ${min}, max: ${max}}`);
    }
  }, []);

  // Determinar si el viewport debe persistirse basado en el estado actual
  const shouldPersistViewport = useCallback(() => {
    const currentState = stateRef.current;
    const shouldPersist = currentState.isLocked && 
           currentState.chartJsState.min !== null && 
           currentState.chartJsState.max !== null;
    
    console.log(`🎯 [SimpleCamera] shouldPersistViewport: ${shouldPersist} - {isLocked: ${currentState.isLocked}, hasViewport: ${currentState.chartJsState.min !== null && currentState.chartJsState.max !== null}}`);
    
    return shouldPersist;
  }, []);

  // Bloquear la cámara en su posición actual (con protección atómica)
  const lockCamera = useCallback((viewport?: { min: number; max: number }) => {
    console.log('🔒 [SimpleCamera] lockCamera llamado');
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
    console.log('🔓 [SimpleCamera] Desbloqueando cámara para auto-seguimiento');
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
    return computeTidalViewport({
      camera: currentState,
      snap: options.snap,
      lastCandleTime: options.lastCandleTime
    });
  }, []);

  // Aplicar viewport al chart de forma robusta (SIN RECURSIÓN)
  const applyViewportToChart = useCallback((chart: Chart, viewport: { min: number; max: number }) => {
    // Esta función NO debe llamarse a sí misma - arreglando la recursión
    try {
      // Método preferido: usar API del plugin chartjs-plugin-zoom
      if (typeof (chart as any).zoomScale === 'function') {
        (chart as any).zoomScale('x', viewport, 'none');
        console.log('🎯 [ApplyViewport] Plugin usado:', viewport);
        return;
      }
    } catch (error) {
      console.warn('🎯 [ApplyViewport] Plugin no disponible, usando fallback');
    }

    // Fallback: mutar options directamente
    if (chart.options.scales?.x) {
      chart.options.scales.x.min = viewport.min;
      chart.options.scales.x.max = viewport.max;
      console.log('🎯 [ApplyViewport] Fallback usado:', viewport);
    }
  }, []);

  // Determinar si debe seguir la cola basado en tide y modo
  const shouldFollowTail = useCallback(() => {
    const currentState = stateRef.current;
    
    // Si está en interacción o bloqueado, no seguir cola
    const interacting = currentState.mode === 'USER_INTERACTING'
      || (currentState.lastUserActionTs && (Date.now() - currentState.lastUserActionTs) < currentState.cooldownMs);

    if (interacting || currentState.mode === 'USER_LOCKED') {
      return false;
    }

    // Si está en modo AUTO o FOLLOW_TAIL y tiene tide > 0
    return (currentState.mode === 'AUTO' || currentState.mode === 'FOLLOW_TAIL') && currentState.tide > 0;
  }, []);

  // Configurar factor de marea (0..1)
  const setTide = useCallback((tide: number) => {
    const clampedTide = Math.max(0, Math.min(1, tide));
    console.log(`🌊 [SimpleCamera] Configurando tide: ${clampedTide}`);
    setState(prev => ({
      ...prev,
      tide: clampedTide
    }));
  }, []);

  // Configurar tiempo de cooldown
  const setCooldownMs = useCallback((cooldownMs: number) => {
    const clampedCooldown = Math.max(1000, Math.min(30000, cooldownMs)); // Entre 1s y 30s
    console.log(`⏱️ [SimpleCamera] Configurando cooldown: ${clampedCooldown}ms`);
    setState(prev => ({
      ...prev,
      cooldownMs: clampedCooldown
    }));
  }, []);

  // Cooldown automático para cambiar de USER_INTERACTING a USER_LOCKED (SIN setState en tick)
  useEffect(() => {
    if (state.mode === 'USER_INTERACTING' && state.lastUserActionTs) {
      const timeoutId = setTimeout(() => {
        console.log('⏰ [SimpleCamera] Cooldown completado - cambiando a USER_LOCKED');
        atomic(() => {
          setState(prev => {
            if (prev.mode === 'USER_INTERACTING') {
              const newState = { ...prev, mode: 'USER_LOCKED' as const };
              return shallowEqual(prev, newState) ? prev : newState;
            }
            return prev;
          });
        });
      }, state.cooldownMs);

      return () => clearTimeout(timeoutId);
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
    applyViewportToChart,
    shouldFollowTail,
    setTide,
    setCooldownMs
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
    applyViewportToChart,
    shouldFollowTail,
    setTide,
    setCooldownMs
  ]);

  return controls;
};
