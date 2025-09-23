import { useCallback, useEffect, useRef } from 'react';
import { useChartCamera, CameraControls } from './useChartCamera';
import { useSmartCameraState, SmartCameraControls } from './useSmartCameraState';

export interface IntegratedCameraControls extends CameraControls {
  // Smart camera controls
  smart: SmartCameraControls;
  
  // Enhanced methods that integrate both systems
  resetToLatest100: () => void;
  onUserZoom: (zoomLevel: number, centerX?: number) => void;
  onUserPan: (x: number, y?: number) => void;
  onChartUpdate: () => void;
  
  // Estado combinado
  shouldAutoFollow: () => boolean;
  getRecommendedSettings: () => {
    zoom: number | null;
    pan: { x: number | null; y: number | null };
    visibleCandles: number;
    followLatest: boolean;
  };
}

interface UseIntegratedCameraProps {
  candleCount: number;
  chartWidth?: number;
  chartHeight?: number;
  defaultVisibleCandles?: number;
  onCameraChange?: (state: any) => void;
  onNewDataReceived?: boolean;
}

export const useIntegratedCamera = ({
  candleCount,
  chartWidth = 400,
  chartHeight = 300,
  defaultVisibleCandles = 100,
  onCameraChange,
  onNewDataReceived = false,
}: UseIntegratedCameraProps): IntegratedCameraControls => {
  
  // Hook de cámara tradicional
  const cameraControls = useChartCamera({
    candleCount,
    chartWidth,
    chartHeight,
    onCameraChange,
    onNewDataReceived,
  });
  
  // Hook de estado inteligente
  const smartCamera = useSmartCameraState({
    defaultVisibleCandles,
    autoResetAfterMs: 300000, // 5 minutos (mucho más tiempo para explorar)
    onStateChange: (state) => {
      console.log('📷 [IntegratedCamera] Smart state changed:', state);
    },
  });
  
  // Referencias para evitar loops
  const isUpdatingRef = useRef(false);
  
  // Sincronizar cuando cambia el estado inteligente (solo cambios importantes)
  useEffect(() => {
    if (isUpdatingRef.current) return;
    
    const state = smartCamera.state;
    
    // Solo actuar si realmente debe seguir las últimas velas Y no está en modo usuario
    if (smartCamera.shouldFollowLatest() && !state.isUserControlled) {
      console.log('📷 [IntegratedCamera] Auto-seguimiento activado (usuario no controlando)');
      isUpdatingRef.current = true;
      cameraControls.resetCameraToLatest();
      cameraControls.setMaxVisibleCandlesCount(defaultVisibleCandles);
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    }
    
    // Si hay estado de Chart.js guardado Y el usuario está controlando, aplicarlo
    if (state.isUserControlled && state.chartJsState.min !== null && state.chartJsState.max !== null) {
      console.log('📷 [IntegratedCamera] Aplicando estado guardado del usuario');
      isUpdatingRef.current = true;
      cameraControls.setChartJsZoomState(
        state.chartJsState.min,
        state.chartJsState.max,
        state.chartJsState.centerX
      );
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    }
  }, [smartCamera.shouldFollowLatest(), smartCamera.state.isUserControlled]); // Usar valores, no funciones
  
  // Cuando llegan nuevos datos - solo actuar si no está en modo usuario
  useEffect(() => {
    if (isUpdatingRef.current) return;
    
    if (onNewDataReceived && !smartCamera.state.isUserControlled) {
      console.log('📷 [IntegratedCamera] Nuevos datos recibidos - modo automático');
      smartCamera.onCandleUpdate();
      
      // Solo seguir las últimas velas si realmente debe hacerlo
      if (smartCamera.shouldFollowLatest()) {
        console.log('📷 [IntegratedCamera] Auto-seguimiento a las últimas velas');
        isUpdatingRef.current = true;
        cameraControls.goToEnd();
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 100);
      }
    } else if (onNewDataReceived && smartCamera.state.isUserControlled) {
      console.log('📷 [IntegratedCamera] Nuevos datos recibidos - usuario controlando, manteniendo posición');
      // Solo notificar la actualización sin mover la cámara
      smartCamera.onCandleUpdate();
    }
  }, [onNewDataReceived, candleCount]); // Solo dependencias esenciales
  
  // Reset manual a las últimas 100 velas
  const resetToLatest100 = useCallback(() => {
    console.log('📷 [IntegratedCamera] Reset manual a las últimas 100 velas');
    smartCamera.resetToDefault();
    cameraControls.resetCameraToLatest();
    cameraControls.setMaxVisibleCandlesCount(defaultVisibleCandles);
  }, [smartCamera, cameraControls, defaultVisibleCandles]);
  
  // Cuando el usuario hace zoom
  const onUserZoom = useCallback((zoomLevel: number, centerX?: number) => {
    console.log('📷 [IntegratedCamera] Usuario hizo zoom:', { zoomLevel, centerX });
    
    isUpdatingRef.current = true;
    
    // Notificar al sistema inteligente
    smartCamera.onUserInteraction('zoom', { zoomLevel, centerX });
    
    // Actualizar el estado de Chart.js
    smartCamera.updateChartJsState(undefined, undefined, centerX, zoomLevel);
    
    // Aplicar zoom en el sistema tradicional
    cameraControls.setZoom(zoomLevel);
    
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);
  }, [smartCamera, cameraControls]);
  
  // Cuando el usuario hace pan
  const onUserPan = useCallback((x: number, y?: number) => {
    console.log('📷 [IntegratedCamera] Usuario hizo pan:', { x, y });
    
    isUpdatingRef.current = true;
    
    // Notificar al sistema inteligente
    smartCamera.onUserInteraction('pan', { x, y });
    
    // Aplicar pan en el sistema tradicional
    cameraControls.setPan(x, y || 0);
    
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);
  }, [smartCamera, cameraControls]);
  
  // Cuando se actualiza el gráfico (nueva vela)
  const onChartUpdate = useCallback(() => {
    console.log('📷 [IntegratedCamera] Actualización del gráfico');
    smartCamera.onCandleUpdate();
  }, [smartCamera]);
  
  // Determinar si debe seguir automáticamente
  const shouldAutoFollow = useCallback(() => {
    return smartCamera.shouldFollowLatest();
  }, [smartCamera]);
  
  // Obtener configuración recomendada
  const getRecommendedSettings = useCallback(() => {
    const state = smartCamera.state;
    const viewport = smartCamera.getRecommendedViewport(candleCount);
    
    return {
      zoom: state.userZoom || state.chartJsState.zoomLevel,
      pan: {
        x: state.userPanX || state.chartJsState.centerX,
        y: state.userPanY,
      },
      visibleCandles: state.currentVisibleCandles,
      followLatest: smartCamera.shouldFollowLatest(),
    };
  }, [smartCamera, candleCount]);
  
  // Retornar interfaz combinada
  return {
    // Todos los métodos del sistema tradicional
    ...cameraControls,
    
    // Sistema inteligente
    smart: smartCamera,
    
    // Métodos mejorados
    resetToLatest100,
    onUserZoom,
    onUserPan,
    onChartUpdate,
    shouldAutoFollow,
    getRecommendedSettings,
  };
};
