import { useRef, useCallback } from 'react';
import { Chart } from 'chart.js';
import { 
  logViewportState, 
  logPersistenceOp, 
  logError,
  logTiming,
  debugLogger
} from '../utils/debugLogger';

/**
 * Hook que implementa persistencia robusta del viewport para Chart.js usando la API oficial
 * 
 * Este hook sigue las mejores prácticas de Chart.js:
 * 1. Usa la API de chartjs-plugin-zoom (getZoomedScaleBounds, zoomScale)
 * 2. Muta las opciones en sitio en lugar de recrearlas
 * 3. Usa chart.update('none') para actualizaciones sin animación
 * 
 * Inspirado en la documentación oficial:
 * https://www.chartjs.org/chartjs-plugin-zoom/latest/guide/developers.html
 */
export function usePersistentViewport(chartRef: React.RefObject<{ chart: Chart }>) {
  const savedRange = useRef<{ min?: number, max?: number } | null>(null);
  const operationCount = useRef<number>(0);
  const lastOperationTime = useRef<number>(0);

  // Helper function to get chart state for logging
  const getChartState = useCallback(() => {
    const chart = chartRef.current?.chart;
    if (!chart) return { exists: false };
    
    return {
      exists: true,
      readyState: chart.data ? 'ready' : 'not_ready',
      hasZoomPlugin: typeof (chart as any).getZoomedScaleBounds === 'function',
      hasResetZoom: typeof (chart as any).resetZoom === 'function',
      hasZoomScale: typeof (chart as any).zoomScale === 'function',
      xScaleExists: !!chart.scales?.x,
      xScaleMin: chart.scales?.x?.min,
      xScaleMax: chart.scales?.x?.max,
      canvasSize: chart.canvas ? { width: chart.canvas.width, height: chart.canvas.height } : null
    };
  }, [chartRef]);

  /**
   * Captura el viewport actual del usuario
   * Usa tanto la API del plugin como fallback directo a escalas
   */
  const snapshot = useCallback(() => {
    const startTime = Date.now();
    operationCount.current++;
    
    debugLogger.log('PERSISTENCE', 'Starting viewport snapshot capture', {
      operationNumber: operationCount.current,
      hasExistingSnapshot: !!savedRange.current,
      existingSnapshot: savedRange.current
    });

    const chart = chartRef.current?.chart;
    if (!chart) {
      logError('Cannot capture snapshot - chart not available', {
        chartRef: !!chartRef.current,
        operationNumber: operationCount.current
      });
      return;
    }

    const chartState = getChartState();
    debugLogger.log('PERSISTENCE', 'Chart state for snapshot', chartState);

    let snapshotMethod = 'none';
    let capturedViewport: { min: number; max: number } | null = null;

    try {
      // Método preferido: usar API del plugin chartjs-plugin-zoom
      const zoomedBounds = (chart as any).getZoomedScaleBounds?.();
      
      debugLogger.log('PERSISTENCE', 'Attempting snapshot via zoom plugin', {
        hasGetZoomedScaleBounds: typeof (chart as any).getZoomedScaleBounds === 'function',
        zoomedBounds: zoomedBounds,
        hasXBounds: !!zoomedBounds?.x,
        xMin: zoomedBounds?.x?.min,
        xMax: zoomedBounds?.x?.max
      });
      
      if (zoomedBounds?.x?.min != null && zoomedBounds?.x?.max != null) {
        capturedViewport = { 
          min: zoomedBounds.x.min, 
          max: zoomedBounds.x.max 
        };
        snapshotMethod = 'zoom_plugin';
        
        debugLogger.log('PERSISTENCE', 'Snapshot captured via zoom plugin', {
          viewport: capturedViewport,
          range: capturedViewport.max - capturedViewport.min,
          center: (capturedViewport.min + capturedViewport.max) / 2
        });
      }
    } catch (error) {
      logError('Failed to capture snapshot via zoom plugin', {
        error: error instanceof Error ? error.message : String(error),
        operationNumber: operationCount.current
      });
    }

    // Fallback: leer directamente de las escalas
    if (!capturedViewport) {
      const xScale = chart.scales.x;
      
      debugLogger.log('PERSISTENCE', 'Attempting snapshot via scales fallback', {
        hasXScale: !!xScale,
        xScaleMin: xScale?.min,
        xScaleMax: xScale?.max,
        xScaleType: xScale?.type
      });
      
      if (xScale?.min != null && xScale?.max != null) {
        capturedViewport = { 
          min: xScale.min, 
          max: xScale.max 
        };
        snapshotMethod = 'scales_fallback';
        
        debugLogger.log('PERSISTENCE', 'Snapshot captured via scales fallback', {
          viewport: capturedViewport,
          range: capturedViewport.max - capturedViewport.min,
          center: (capturedViewport.min + capturedViewport.max) / 2
        });
      }
    }

    if (capturedViewport) {
      const oldSnapshot = savedRange.current;
      savedRange.current = capturedViewport;
      
      const duration = Date.now() - startTime;
      logTiming('Viewport snapshot captured successfully', duration, {
        method: snapshotMethod,
        viewport: capturedViewport,
        previousSnapshot: oldSnapshot,
        changed: !oldSnapshot || oldSnapshot.min !== capturedViewport.min || oldSnapshot.max !== capturedViewport.max,
        operationNumber: operationCount.current
      });
      
      logPersistenceOp('VIEWPORT_SNAPSHOT_CAPTURE', capturedViewport, true);
    } else {
      const duration = Date.now() - startTime;
      
      logError('Failed to capture viewport snapshot', {
        duration,
        chartState,
        attemptedMethods: ['zoom_plugin', 'scales_fallback'],
        operationNumber: operationCount.current
      });
      
      logPersistenceOp('VIEWPORT_SNAPSHOT_CAPTURE', null, false);
    }
    
    lastOperationTime.current = Date.now();
  }, [chartRef, getChartState]);

  /**
   * Restaura el viewport previamente guardado
   * Usa tanto la API del plugin como fallback directo
   */
  const restore = useCallback((mode: 'none' | 'active' = 'none') => {
    const startTime = Date.now();
    operationCount.current++;
    
    debugLogger.log('PERSISTENCE', 'Starting viewport restore', {
      operationNumber: operationCount.current,
      mode,
      hasSnapshot: !!savedRange.current,
      snapshot: savedRange.current,
      timeSinceLastOperation: lastOperationTime.current ? Date.now() - lastOperationTime.current : null
    });

    const chart = chartRef.current?.chart;
    if (!chart) {
      logError('Cannot restore viewport - chart not available', {
        chartRef: !!chartRef.current,
        operationNumber: operationCount.current
      });
      return;
    }

    if (!savedRange.current) {
      debugLogger.log('PERSISTENCE', 'Cannot restore viewport - no snapshot available', {
        operationNumber: operationCount.current
      });
      return;
    }

    const { min, max } = savedRange.current;
    if (min == null || max == null) {
      logError('Cannot restore viewport - invalid snapshot data', {
        snapshot: savedRange.current,
        operationNumber: operationCount.current
      });
      return;
    }

    const chartState = getChartState();
    debugLogger.log('PERSISTENCE', 'Chart state for restore', chartState);

    let restoreMethod = 'none';
    let success = false;

    try {
      // Método preferido: usar API del plugin chartjs-plugin-zoom
      if (typeof (chart as any).zoomScale === 'function') {
        debugLogger.log('PERSISTENCE', 'Attempting restore via zoom plugin', {
          viewport: { min, max },
          mode,
          hasZoomScale: true
        });
        
        (chart as any).zoomScale('x', { min, max }, mode);
        restoreMethod = 'zoom_plugin';
        success = true;
        
        debugLogger.log('PERSISTENCE', 'Restore via zoom plugin completed', {
          viewport: { min, max },
          mode,
          range: max - min,
          center: (min + max) / 2
        });
        
      } else {
        debugLogger.log('PERSISTENCE', 'Zoom plugin not available - will use fallback', {
          hasZoomScale: false,
          chartExists: !!chart
        });
      }
    } catch (error) {
      logError('Failed to restore via zoom plugin', {
        error: error instanceof Error ? error.message : String(error),
        viewport: { min, max },
        mode,
        operationNumber: operationCount.current
      });
    }

    // Fallback: mutar options directamente (sin recrear el objeto)
    if (!success && chart.options.scales?.x) {
      debugLogger.log('PERSISTENCE', 'Attempting restore via scales fallback', {
        viewport: { min, max },
        mode,
        hasXScale: !!chart.options.scales.x,
        currentXMin: chart.options.scales.x.min,
        currentXMax: chart.options.scales.x.max
      });
      
      try {
        const beforeUpdate = Date.now();
        chart.options.scales.x.min = min;
        chart.options.scales.x.max = max;
        chart.update(mode);
        const updateDuration = Date.now() - beforeUpdate;
        
        restoreMethod = 'scales_fallback';
        success = true;
        
        debugLogger.log('PERSISTENCE', 'Restore via scales fallback completed', {
          viewport: { min, max },
          mode,
          updateDuration,
          range: max - min,
          center: (min + max) / 2
        });
      } catch (error) {
        logError('Failed to restore via scales fallback', {
          error: error instanceof Error ? error.message : String(error),
          viewport: { min, max },
          mode,
          operationNumber: operationCount.current
        });
      }
    }

    const duration = Date.now() - startTime;
    
    if (success) {
      logTiming('Viewport restore completed successfully', duration, {
        method: restoreMethod,
        viewport: { min, max },
        mode,
        operationNumber: operationCount.current
      });
      
      logPersistenceOp('VIEWPORT_RESTORE', { min, max, method: restoreMethod }, true);
    } else {
      logError('All viewport restore methods failed', {
        duration,
        viewport: { min, max },
        mode,
        chartState,
        attemptedMethods: ['zoom_plugin', 'scales_fallback'],
        operationNumber: operationCount.current
      });
      
      logPersistenceOp('VIEWPORT_RESTORE', { min, max }, false);
    }
    
    lastOperationTime.current = Date.now();
  }, [chartRef, getChartState]);

  /**
   * Verifica si tenemos un viewport guardado válido
   */
  const hasSnapshot = useCallback(() => {
    return savedRange.current?.min != null && savedRange.current?.max != null;
  }, []);

  /**
   * Limpia el viewport guardado
   */
  const clearSnapshot = useCallback(() => {
    const previousSnapshot = savedRange.current;
    
    debugLogger.log('PERSISTENCE', 'Clearing viewport snapshot', {
      hadSnapshot: !!previousSnapshot,
      clearedSnapshot: previousSnapshot,
      operationCount: operationCount.current
    });
    
    savedRange.current = null;
    
    logPersistenceOp('SNAPSHOT_CLEAR', { previousSnapshot }, true);
  }, []);

  /**
   * Obtiene el viewport actual sin guardarlo
   */
  const getCurrentViewport = useCallback(() => {
    const chart = chartRef.current?.chart;
    if (!chart) return null;

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
  }, [chartRef]);

  /**
   * Aplica un viewport específico sin guardarlo
   */
  const applyViewport = useCallback((min: number, max: number, mode: 'none' | 'active' = 'none') => {
    const chart = chartRef.current?.chart;
    if (!chart) return;

    try {
      // Método preferido: usar API del plugin
      if (typeof (chart as any).zoomScale === 'function') {
        (chart as any).zoomScale('x', { min, max }, mode);
        console.log('🎯 [PersistentViewport] Apply viewport via plugin:', { min, max });
        return;
      }
    } catch (error) {
      console.warn('🎯 [PersistentViewport] Plugin API no disponible, usando fallback');
    }

    // Fallback: mutar options directamente
    if (chart.options.scales?.x) {
      chart.options.scales.x.min = min;
      chart.options.scales.x.max = max;
      chart.update(mode);
      console.log('🎯 [PersistentViewport] Apply viewport via fallback:', { min, max });
    }
  }, [chartRef]);

  /**
   * Resetea el zoom usando la API del plugin
   */
  const resetZoom = useCallback((mode: 'none' | 'active' = 'none') => {
    const startTime = Date.now();
    operationCount.current++;
    
    debugLogger.log('PERSISTENCE', 'Starting zoom reset', {
      operationNumber: operationCount.current,
      mode,
      hasSnapshot: !!savedRange.current,
      currentSnapshot: savedRange.current
    });

    const chart = chartRef.current?.chart;
    if (!chart) {
      logError('Cannot reset zoom - chart not available', {
        chartRef: !!chartRef.current,
        operationNumber: operationCount.current
      });
      return;
    }

    const chartState = getChartState();
    debugLogger.log('PERSISTENCE', 'Chart state for reset', chartState);

    let resetMethod = 'none';
    let success = false;

    try {
      // Método preferido: usar API del plugin
      if (typeof (chart as any).resetZoom === 'function') {
        debugLogger.log('PERSISTENCE', 'Attempting reset via zoom plugin', {
          mode,
          hasResetZoom: true
        });
        
        (chart as any).resetZoom(mode);
        resetMethod = 'zoom_plugin';
        success = true;
        
        debugLogger.log('PERSISTENCE', 'Reset via zoom plugin completed', {
          mode,
          previousSnapshot: savedRange.current
        });
      } else {
        debugLogger.log('PERSISTENCE', 'Zoom plugin reset not available - will use fallback', {
          hasResetZoom: false
        });
      }
    } catch (error) {
      logError('Failed to reset via zoom plugin', {
        error: error instanceof Error ? error.message : String(error),
        mode,
        operationNumber: operationCount.current
      });
    }

    // Fallback: limpiar min/max de options
    if (!success && chart.options.scales?.x) {
      debugLogger.log('PERSISTENCE', 'Attempting reset via scales fallback', {
        mode,
        hasXScale: !!chart.options.scales.x,
        currentXMin: chart.options.scales.x.min,
        currentXMax: chart.options.scales.x.max
      });
      
      try {
        const beforeUpdate = Date.now();
        delete chart.options.scales.x.min;
        delete chart.options.scales.x.max;
        chart.update(mode);
        const updateDuration = Date.now() - beforeUpdate;
        
        resetMethod = 'scales_fallback';
        success = true;
        
        debugLogger.log('PERSISTENCE', 'Reset via scales fallback completed', {
          mode,
          updateDuration,
          previousSnapshot: savedRange.current
        });
      } catch (error) {
        logError('Failed to reset via scales fallback', {
          error: error instanceof Error ? error.message : String(error),
          mode,
          operationNumber: operationCount.current
        });
      }
    }

    // Clear snapshot regardless of success
    const previousSnapshot = savedRange.current;
    clearSnapshot();

    const duration = Date.now() - startTime;
    
    if (success) {
      logTiming('Zoom reset completed successfully', duration, {
        method: resetMethod,
        mode,
        clearedSnapshot: previousSnapshot,
        operationNumber: operationCount.current
      });
      
      logPersistenceOp('ZOOM_RESET', { method: resetMethod, previousSnapshot }, true);
    } else {
      logError('All zoom reset methods failed', {
        duration,
        mode,
        chartState,
        attemptedMethods: ['zoom_plugin', 'scales_fallback'],
        clearedSnapshot: previousSnapshot,
        operationNumber: operationCount.current
      });
      
      logPersistenceOp('ZOOM_RESET', { previousSnapshot }, false);
    }
    
    lastOperationTime.current = Date.now();
  }, [chartRef, getChartState, clearSnapshot]);

  return {
    snapshot,
    restore,
    hasSnapshot,
    clearSnapshot,
    getCurrentViewport,
    applyViewport,
    resetZoom
  };
}
