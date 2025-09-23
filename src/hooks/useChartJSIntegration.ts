import { useCallback, useRef, useState } from 'react';
import { useChartCamera, CameraControls } from './useChartCamera';

interface ChartJSIntegrationHook {
  cameraControls: CameraControls;
  chartRef: React.RefObject<any>;
  onChartAction: (action: string, params?: any) => void;
  isChartReady: boolean;
  setChartRef: (ref: any) => void;
}

interface UseChartJSIntegrationProps {
  candleCount: number;
  chartWidth?: number;
  chartHeight?: number;
  onCameraChange?: (camera: any) => void;
}

export const useChartJSIntegration = ({
  candleCount,
  chartWidth,
  chartHeight,
  onCameraChange,
}: UseChartJSIntegrationProps): ChartJSIntegrationHook => {
  const chartRef = useRef<any>(null);
  const [isChartReady, setIsChartReady] = useState(false);

  // Usar el hook de cámara nativo como fallback
  const cameraControls = useChartCamera({
    candleCount,
    chartWidth,
    chartHeight,
    onCameraChange,
  });

  const setChartRef = useCallback((ref: any) => {
    chartRef.current = ref;
    setIsChartReady(!!ref);
    console.log('📊 Chart.js ref establecido:', !!ref);
  }, []);

  const onChartAction = useCallback((action: string, params?: any) => {
    console.log('🎬 Chart action:', action, params);
    
    if (!chartRef.current) {
      console.warn('⚠️ Chart ref no disponible, usando controles nativos');
      // Fallback a controles nativos
      switch (action) {
        case 'ZOOM_IN':
          cameraControls.zoomIn();
          break;
        case 'ZOOM_OUT':
          cameraControls.zoomOut();
          break;
        case 'RESET_ZOOM':
          cameraControls.resetZoom();
          break;
        case 'RESET_CAMERA':
          cameraControls.resetCameraToLatest();
          break;
        case 'LOCK_CAMERA':
          cameraControls.lockCameraPosition();
          break;
        case 'PAN_LEFT':
          cameraControls.panLeft();
          break;
        case 'PAN_RIGHT':
          cameraControls.panRight();
          break;
        case 'GO_TO_LATEST':
          cameraControls.goToEnd();
          break;
        case 'AUTO_FIT':
          cameraControls.fitAll();
          break;
        case 'SET_ZOOM':
          if (params?.zoom) {
            cameraControls.setZoom(params.zoom);
          }
          break;
        case 'SET_MAX_CANDLES':
          if (params?.count) {
            cameraControls.setMaxVisibleCandlesCount(params.count);
          }
          break;
        case 'START_USER_INTERACTION':
          cameraControls.startUserInteraction();
          break;
        case 'END_USER_INTERACTION':
          cameraControls.endUserInteraction();
          break;
        case 'SET_TEMPORARY_POSITION':
          if (params?.zoomLevel !== undefined && params?.offsetX !== undefined && params?.offsetY !== undefined) {
            cameraControls.setTemporaryPosition(params.zoomLevel, params.offsetX, params.offsetY);
          }
          break;
      }
      return;
    }

    // Enviar acción al Chart.js si está disponible
    try {
      if (chartRef.current.postMessage) {
        // Para WebView
        chartRef.current.postMessage(JSON.stringify({ 
          type: action, 
          ...params 
        }));
      } else if (typeof chartRef.current[action.toLowerCase()] === 'function') {
        // Para Chart.js directo
        chartRef.current[action.toLowerCase()]();
      } else {
        console.log('📨 Enviando mensaje personalizado al Chart.js:', action);
        // Enviar mensaje personalizado
        if (chartRef.current.postMessage) {
          chartRef.current.postMessage(JSON.stringify({ 
            type: action, 
            ...params 
          }));
        }
      }
    } catch (error) {
      console.error('❌ Error enviando acción al Chart.js:', error);
      // Fallback a controles nativos en caso de error
      onChartAction(action, params);
    }
  }, [cameraControls]);

  return {
    cameraControls,
    chartRef,
    onChartAction,
    isChartReady,
    setChartRef,
  };
};

// Hook para Chart.js WebView específicamente
export const useChartJSWebView = (candleCount: number) => {
  const webViewRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  const sendAction = useCallback((action: string, params?: any) => {
    if (webViewRef.current) {
      try {
        const message = JSON.stringify({ type: action, ...params });
        webViewRef.current.postMessage(message);
        console.log(`📡 Enviado a WebView: ${action}`);
      } catch (error) {
        console.error('❌ Error enviando mensaje a WebView:', error);
      }
    } else {
      console.warn('⚠️ WebView ref no disponible');
    }
  }, []);

  const setWebViewRef = useCallback((ref: any) => {
    webViewRef.current = ref;
    setIsReady(!!ref);
  }, []);

  const actions = {
    zoomIn: () => sendAction('ZOOM_IN'),
    zoomOut: () => sendAction('ZOOM_OUT'),
    resetZoom: () => sendAction('RESET_ZOOM'),
    resetCamera: () => sendAction('RESET_CAMERA'),
    lockCamera: () => sendAction('LOCK_CAMERA'),
    panLeft: () => sendAction('PAN_LEFT'),
    panRight: () => sendAction('PAN_RIGHT'),
    goToLatest: () => sendAction('GO_TO_LATEST'),
    autoFit: () => sendAction('AUTO_FIT'),
    toggleVolume: () => sendAction('TOGGLE_VOLUME'),
    setZoom: (zoom: number) => sendAction('SET_ZOOM', { zoom }),
    setMaxCandles: (count: number) => sendAction('SET_MAX_CANDLES', { count }),
    adjustCameraAfterUpdate: () => sendAction('ADJUST_CAMERA_AFTER_UPDATE'),
  };

  return {
    webViewRef,
    isReady,
    setWebViewRef,
    sendAction,
    actions,
  };
};

// Hook para Chart.js directo (web)
export const useChartJSDirect = (candleCount: number) => {
  const chartRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  const executeAction = useCallback((action: string, params?: any) => {
    if (!chartRef.current) {
      console.warn('⚠️ Chart.js ref no disponible');
      return;
    }

    try {
      switch (action) {
        case 'ZOOM_IN':
          if (chartRef.current.scales?.x) {
            const xScale = chartRef.current.scales.x;
            const center = (xScale.min + xScale.max) / 2;
            const currentRange = xScale.max - xScale.min;
            const newRange = currentRange * 0.75;
            
            chartRef.current.options.scales.x.min = center - newRange / 2;
            chartRef.current.options.scales.x.max = center + newRange / 2;
            chartRef.current.update('none');
          }
          break;
        case 'ZOOM_OUT':
          if (chartRef.current.scales?.x) {
            const xScale = chartRef.current.scales.x;
            const center = (xScale.min + xScale.max) / 2;
            const currentRange = xScale.max - xScale.min;
            const newRange = currentRange * 1.33;
            
            chartRef.current.options.scales.x.min = center - newRange / 2;
            chartRef.current.options.scales.x.max = center + newRange / 2;
            chartRef.current.update('none');
          }
          break;
        case 'RESET_ZOOM':
          if (chartRef.current.resetZoom) {
            chartRef.current.resetZoom();
          }
          break;
        case 'SET_ZOOM':
          if (params?.zoom && chartRef.current.zoom) {
            chartRef.current.zoom(params.zoom);
          }
          break;
        case 'RESET_CAMERA':
          // Reset camera to show latest data
          if (chartRef.current.resetZoom) {
            chartRef.current.resetZoom();
          }
          break;
        case 'LOCK_CAMERA':
          // For direct Chart.js, we can store the current view state
          console.log('🔒 Camera locked at current position');
          break;
        case 'SET_MAX_CANDLES':
          // This would need to be handled at the data level
          console.log('📊 Max candles set to:', params?.count);
          break;
        // Agregar más acciones según sea necesario
      }
      console.log(`✅ Acción ejecutada: ${action}`);
    } catch (error) {
      console.error(`❌ Error ejecutando ${action}:`, error);
    }
  }, []);

  const setChartRef = useCallback((ref: any) => {
    chartRef.current = ref;
    setIsReady(!!ref);
  }, []);

  const actions = {
    zoomIn: () => executeAction('ZOOM_IN'),
    zoomOut: () => executeAction('ZOOM_OUT'),
    resetZoom: () => executeAction('RESET_ZOOM'),
    resetCamera: () => executeAction('RESET_CAMERA'),
    lockCamera: () => executeAction('LOCK_CAMERA'),
    setZoom: (zoom: number) => executeAction('SET_ZOOM', { zoom }),
    setMaxCandles: (count: number) => executeAction('SET_MAX_CANDLES', { count }),
  };

  return {
    chartRef,
    isReady,
    setChartRef,
    executeAction,
    actions,
  };
};
