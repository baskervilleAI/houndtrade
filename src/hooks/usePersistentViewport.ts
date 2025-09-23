import { useRef, useCallback } from 'react';
import { Chart } from 'chart.js';

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

  /**
   * Captura el viewport actual del usuario
   * Usa tanto la API del plugin como fallback directo a escalas
   */
  const snapshot = useCallback(() => {
    const chart = chartRef.current?.chart;
    if (!chart) return;

    try {
      // Método preferido: usar API del plugin chartjs-plugin-zoom
      const zoomedBounds = (chart as any).getZoomedScaleBounds?.();
      if (zoomedBounds?.x?.min != null && zoomedBounds?.x?.max != null) {
        savedRange.current = { 
          min: zoomedBounds.x.min, 
          max: zoomedBounds.x.max 
        };
        console.log('📸 [PersistentViewport] Snapshot via zoom plugin:', savedRange.current);
        return;
      }
    } catch (error) {
      console.warn('📸 [PersistentViewport] Plugin API no disponible, usando fallback');
    }

    // Fallback: leer directamente de las escalas
    const xScale = chart.scales.x;
    if (xScale?.min != null && xScale?.max != null) {
      savedRange.current = { 
        min: xScale.min, 
        max: xScale.max 
      };
      console.log('📸 [PersistentViewport] Snapshot via scales fallback:', savedRange.current);
    }
  }, [chartRef]);

  /**
   * Restaura el viewport previamente guardado
   * Usa tanto la API del plugin como fallback directo
   */
  const restore = useCallback((mode: 'none' | 'active' = 'none') => {
    const chart = chartRef.current?.chart;
    if (!chart || !savedRange.current) return;

    const { min, max } = savedRange.current;
    if (min == null || max == null) return;

    try {
      // Método preferido: usar API del plugin chartjs-plugin-zoom
      if (typeof (chart as any).zoomScale === 'function') {
        (chart as any).zoomScale('x', { min, max }, mode);
        console.log('🔄 [PersistentViewport] Restore via zoom plugin:', { min, max });
        return;
      }
    } catch (error) {
      console.warn('🔄 [PersistentViewport] Plugin API no disponible, usando fallback');
    }

    // Fallback: mutar options directamente (sin recrear el objeto)
    if (chart.options.scales?.x) {
      chart.options.scales.x.min = min;
      chart.options.scales.x.max = max;
      chart.update(mode);
      console.log('🔄 [PersistentViewport] Restore via scales fallback:', { min, max });
    }
  }, [chartRef]);

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
    savedRange.current = null;
    console.log('🗑️ [PersistentViewport] Snapshot cleared');
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
    const chart = chartRef.current?.chart;
    if (!chart) return;

    try {
      // Método preferido: usar API del plugin
      if (typeof (chart as any).resetZoom === 'function') {
        (chart as any).resetZoom(mode);
        console.log('🔄 [PersistentViewport] Reset zoom via plugin');
        clearSnapshot();
        return;
      }
    } catch (error) {
      console.warn('🔄 [PersistentViewport] Plugin API no disponible, usando fallback');
    }

    // Fallback: limpiar min/max de options
    if (chart.options.scales?.x) {
      delete chart.options.scales.x.min;
      delete chart.options.scales.x.max;
      chart.update(mode);
      console.log('🔄 [PersistentViewport] Reset zoom via fallback');
      clearSnapshot();
    }
  }, [chartRef, clearSnapshot]);

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
