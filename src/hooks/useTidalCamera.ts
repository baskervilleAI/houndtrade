import { useCallback } from 'react';
import { Chart } from 'chart.js';
import { useSimpleCamera, SimpleCameraControls } from './useSimpleCamera';

/**
 * Hook de conveniencia que expone las funciones de gobernanza tidal
 * de forma más intuitiva para usar en componentes
 */
export function useTidalCamera(options?: {
  defaultVisibleCandles?: number;
  tide?: number;
  cooldownMs?: number;
}): SimpleCameraControls & {
  // Funciones auxiliares con mejor naming
  snapshotAndUpdate: (chart: Chart, newCandle: any, isFinal: boolean) => void;
  configureForAutoFollow: () => void;
  configureForUserControl: () => void;
  getCurrentViewportAuthority: () => { min: number; max: number } | null;
} {
  const camera = useSimpleCamera(options);

  // Configurar parámetros iniciales si se proporcionan
  if (options?.tide !== undefined && options.tide !== camera.state.tide) {
    camera.setTide(options.tide);
  }
  
  if (options?.cooldownMs !== undefined && options.cooldownMs !== camera.state.cooldownMs) {
    camera.setCooldownMs(options.cooldownMs);
  }

  // Función que implementa el flujo completo de snapshot → mutate → apply
  const snapshotAndUpdate = useCallback((chart: Chart, newCandle: any, isFinal: boolean) => {
    console.log('🌊 [TidalCamera] snapshotAndUpdate - INICIO');
    
    // A) SNAPSHOT: Capturar viewport ANTES de tocar data
    const snap = camera.getViewportFromCamera() ?? {
      min: chart.scales?.x?.min ?? 0,
      max: chart.scales?.x?.max ?? 0
    };
    
    console.log('📸 [TidalCamera] Snapshot PRE-mutación:', snap);
    
    // B) Aquí el componente debe mutar la data (se hace externamente)
    
    // C) COMPUTAR viewport objetivo
    const lastCandleTime = newCandle.x;
    const desiredViewport = camera.computeTidalViewport({
      snap,
      lastCandleTime
    });
    
    console.log('🌊 [TidalCamera] Viewport objetivo:', desiredViewport);
    
    // D) APLICAR viewport objetivo
    camera.applyViewportToChart(chart, desiredViewport);
    
    console.log('✅ [TidalCamera] snapshotAndUpdate - completado');
  }, [camera]);

  // Configurar para seguimiento automático de cola
  const configureForAutoFollow = useCallback(() => {
    console.log('🎯 [TidalCamera] Configurando para seguimiento automático');
    camera.setTide(0.8); // 80% seguimiento
    camera.unlockCamera();
  }, [camera]);

  // Configurar para control total del usuario
  const configureForUserControl = useCallback(() => {
    console.log('🔒 [TidalCamera] Configurando para control del usuario');
    camera.setTide(0); // 0% seguimiento (totalmente fijo)
    camera.lockCamera();
  }, [camera]);

  // Obtener viewport autoritativo (fuente de verdad)
  const getCurrentViewportAuthority = useCallback(() => {
    return camera.getViewportFromCamera();
  }, [camera]);

  return {
    ...camera,
    snapshotAndUpdate,
    configureForAutoFollow,
    configureForUserControl,
    getCurrentViewportAuthority
  };
}

/**
 * Configuraciones preestablecidas para diferentes casos de uso
 */
export const TIDAL_PRESETS = {
  // Seguimiento total de cola (para nuevos usuarios)
  FULL_FOLLOW: { tide: 1.0, cooldownMs: 2000 },
  
  // Seguimiento suave (balance entre seguimiento y estabilidad)
  SMOOTH_FOLLOW: { tide: 0.8, cooldownMs: 3000 },
  
  // Seguimiento mínimo (mayormente fijo con leve adaptación)
  MINIMAL_FOLLOW: { tide: 0.3, cooldownMs: 5000 },
  
  // Completamente fijo (para análisis detallado)
  FIXED: { tide: 0.0, cooldownMs: 10000 }
} as const;
