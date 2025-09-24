/**
 * MinimalistChart - Componente de gráfico con sistema avanzado de debugging de cámara
 * 
 * DEBUGGING DETALLADO DE CÁMARA Y VIEWPORT:
 * 
 * 🔍 Para debuggear el sistema de cámara, usa en la consola del navegador:
 *    window.debugCameraSystem()
 * 
 * 📋 Categorías de logs disponibles:
 *    - 📷 CAMERA: Control general de cámara
 *    - 🖼️ VIEWPORT: Estados detallados de viewport 
 *    - 👆 INTERACTION: Interacciones del usuario (zoom, pan)
 *    - 🌊 TIDAL: Sistema de gobernanza tidal
 *    - ⚡ STATE: Transiciones de estado
 *    - 💾 PERSISTENCE: Operaciones de sessionStorage
 *    - 📊 CHART: Eventos de Chart.js
 * 
 * ⚙️ Para habilitar/deshabilitar categorías específicas:
 *    debugLogger.setEnabled('STREAMING', true)  // Habilitar logs de streaming
 *    debugLogger.setEnabled('PERFORMANCE', true) // Habilitar logs de performance
 * 
 * 🎯 Ciclo de vida completo trackeable:
 *    1. Carga inicial → logs PERSISTENCE + VIEWPORT
 *    2. Interacción usuario → logs INTERACTION + STATE
 *    3. Persistencia viewport → logs TIDAL + CAMERA
 *    4. Actualizaciones streaming → logs CHART + TIDAL
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Text, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { useMarket } from '../../context/AppContext';
import liveStreamingService, { CandleData, StreamUpdate, TimeInterval } from '../../services/liveStreamingService';
import { useTechnicalIndicators, addIndicatorToChart } from '../../hooks/useTechnicalIndicators';
import { useSimpleCamera } from '../../hooks/useSimpleCamera';
import { usePersistentViewport } from '../../hooks/usePersistentViewport';
import { 
  logChart, 
  logTidalFlow, 
  logLifecycle, 
  logUserInteractionDetailed, 
  logViewportState,
  logTiming,
  logSystemSnapshot,
  logInteractionCycle,
  logError
} from '../../utils/debugLogger';

interface MinimalistChartProps {
  height?: number;
  width?: number;
  symbol?: string;
}

const timeIntervals: { label: string; value: TimeInterval }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

const MinimalistChart: React.FC<MinimalistChartProps> = ({
  height = 400,
  width = 600,
  symbol = 'BTCUSDT'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);
  const initialViewportSet = useRef<boolean>(false); // Flag para rastrear si ya se configuró el viewport inicial
  const [status, setStatus] = useState<string>('Inicializando...');
  const [currentInterval, setCurrentInterval] = useState<TimeInterval>('1m');
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set());
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const updateThrottleMs = 100; // Throttle updates to max 10fps for better performance
  
  // Estados para controlar interacciones de usuario y evitar race conditions
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const panTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastZoomTime = useRef<number>(0);
  const lastPanTime = useRef<number>(0);
  
  // NUEVOS: Métricas detalladas para debugging del sistema
  const chartInitializationCount = useRef<number>(0);
  const cameraResetCount = useRef<number>(0);
  const unexpectedViewportChanges = useRef<number>(0);
  const lastChartUpdate = useRef<number>(0);
  const updateSequence = useRef<number>(0);
  
  // NUEVO: Referencias para control avanzado de eventos
  const zoomDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const panDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // NUEVO: Control global para evitar cualquier solapamiento
  const globalInteractionBlocked = useRef<boolean>(false);
  
  // CRÍTICO: Controles separados para zoom y pan + throttle reducido
  const lastZoomProcessedTime = useRef<number>(0);
  const lastPanProcessedTime = useRef<number>(0);
  const isProcessingZoom = useRef<boolean>(false);
  const isProcessingPan = useRef<boolean>(false);
  
  // NUEVO: Flag para distinguir entre eventos automáticos y del usuario
  const isApplyingAutomaticViewport = useRef<boolean>(false);

  const { selectedPair } = useMarket();
  const currentSymbol = symbol || selectedPair;

  // Callback estable para cambios de estado de cámara
  const onCameraStateChange = useCallback((cameraState: any) => {
    logViewportState(cameraState, 'CAMERA_STATE_CALLBACK');
  }, []);

  // Sistema de cámara simple y predecible
  const simpleCamera = useSimpleCamera({
    defaultVisibleCandles: 100,
    // autoResetTimeMs eliminado - la cámara mantiene posición del usuario permanentemente
    onStateChange: onCameraStateChange,
  });

  // Hook para persistencia robusta del viewport
  const persistentViewport = usePersistentViewport(chartRef);

  // Helper functions para manejo de interacciones
  const startUserInteraction = useCallback(() => {
    const timestamp = Date.now();
    const preCameraState = simpleCamera.getCurrentState();
    
    logUserInteractionDetailed('START_USER_INTERACTION_CHART', {
      timestamp: new Date(timestamp).toLocaleTimeString(),
      component: 'MinimalistChart',
      preCameraMode: preCameraState.mode,
      preCameraLocked: preCameraState.isLocked,
      chartExists: !!chartRef.current,
      isStreamingActive: isStreaming,
      totalInteractions: 'starting_new_interaction'
    }, preCameraState);
    
    // Monitor for unexpected state changes
    const beforeInteraction = {
      cameraMode: preCameraState.mode,
      cameraLocked: preCameraState.isLocked,
      viewport: preCameraState.viewport
    };
    
    setIsUserInteracting(true);
    simpleCamera.onUserStartInteraction();
    
    // Log state after camera notification
    const postCameraState = simpleCamera.getCurrentState();
    logUserInteractionDetailed('CAMERA_NOTIFIED_OF_INTERACTION_START', {
      beforeInteraction,
      afterNotification: {
        cameraMode: postCameraState.mode,
        cameraLocked: postCameraState.isLocked,
        viewport: postCameraState.viewport
      },
      stateChanged: beforeInteraction.cameraMode !== postCameraState.mode || 
                    beforeInteraction.cameraLocked !== postCameraState.isLocked
    });
    
    // Limpiar timeout existente
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
      logChart('START_INTERACTION - cleared existing timeout');
    }
  }, [simpleCamera]);

  const endUserInteraction = useCallback(() => {
    const timestamp = Date.now();
    const preCameraState = simpleCamera.getCurrentState();
    
    logUserInteractionDetailed('END_USER_INTERACTION_CHART', {
      timestamp: new Date(timestamp).toLocaleTimeString(),
      component: 'MinimalistChart',
      delay: 300,
      preCameraMode: preCameraState.mode,
      preCameraLocked: preCameraState.isLocked,
      hasViewport: !!preCameraState.viewport
    }, preCameraState);
    
    // Delay para capturar estado final
    userInteractionTimeoutRef.current = setTimeout(() => {
      const preEndState = simpleCamera.getCurrentState();
      
      logUserInteractionDetailed('END_USER_INTERACTION_DELAYED', {
        timestamp: new Date().toLocaleTimeString(),
        component: 'MinimalistChart',
        preEndCameraMode: preEndState.mode,
        preEndCameraLocked: preEndState.isLocked
      });
      
      setIsUserInteracting(false);
      simpleCamera.onUserEndInteraction();
      
      // Log final state after end interaction
      const finalState = simpleCamera.getCurrentState();
      logUserInteractionDetailed('INTERACTION_SEQUENCE_COMPLETE', {
        finalCameraMode: finalState.mode,
        finalCameraLocked: finalState.isLocked,
        finalViewport: finalState.viewport,
        interactionDuration: timestamp - (preCameraState.lastUserAction || timestamp),
        unexpectedChanges: unexpectedViewportChanges.current
      }, finalState);
    }, 300); // 300ms delay para capturar estado final
  }, [simpleCamera]);

  // ============================================
  // DEBOUNCE AGRESIVO PARA EVENTOS DE ZOOM/PAN
  // ============================================
  
  const debouncedZoomHandler = useCallback((chart: any, xScale: any) => {
    const now = Date.now();
    
    logUserInteractionDetailed('ZOOM_EVENT_RECEIVED', {
      min: xScale.min,
      max: xScale.max,
      center: (xScale.min + xScale.max) / 2,
      timestamp: new Date().toLocaleTimeString(),
      globalBlocked: globalInteractionBlocked.current,
      lastZoomTime: lastZoomProcessedTime.current,
      timeSinceLastZoom: now - lastZoomProcessedTime.current,
      isAutomaticViewport: isApplyingAutomaticViewport.current
    });
    
    // CRÍTICO: Ignorar eventos automáticos generados por actualizaciones de stream
    if (isApplyingAutomaticViewport.current) {
      logChart('ZOOM_EVENT_BLOCKED - automatic viewport update');
      return;
    }
    
    // BLOQUEO GLOBAL: Evitar cualquier solapamiento entre zoom y pan
    if (globalInteractionBlocked.current) {
      logChart('ZOOM_EVENT_BLOCKED - global interaction blocked');
      return;
    }
    
    // THROTTLE MEJORADO PARA ZOOM: Reducir bloqueos innecesarios
    if (now - lastZoomProcessedTime.current < 50) { // Reducido de 100ms a 50ms
      logChart('ZOOM_EVENT_BLOCKED - throttle limit');
      return;
    }
    
    // BLOQUEO: Evitar procesamiento simultáneo
    if (isProcessingZoom.current) {
      logChart('ZOOM_EVENT_BLOCKED - already processing zoom');
      return;
    }
    
    isProcessingZoom.current = true;
    globalInteractionBlocked.current = true;
    lastZoomProcessedTime.current = now;
    
    // Cancelar debounce anterior
    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
    }
    
    // NUEVO: Procesar inmediatamente el inicio de la interacción para mejor responsividad
    const preInteractionState = simpleCamera.getCurrentState();
    logUserInteractionDetailed('ZOOM_PROCESSING_START', {
      min: xScale.min,
      max: xScale.max,
      center: (xScale.min + xScale.max) / 2
    }, preInteractionState);
    
    // Notificar inicio de interacción inmediatamente
    startUserInteraction();
    
    // Log del estado después de notificar inicio
    const postStartState = simpleCamera.getCurrentState();
    logViewportState(postStartState, 'POST_START_INTERACTION_ZOOM');
    
    // Debounce reducido solo para el estado final
    zoomDebounceRef.current = setTimeout(() => {
      // Limpiar timeout anterior si existe
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
      
      // Timeout para capturar estado final
      zoomTimeoutRef.current = setTimeout(() => {
        const finalScale = chart.scales.x;
        if (finalScale) {
          logUserInteractionDetailed('ZOOM_FINAL_STATE_CAPTURE', {
            finalMin: finalScale.min,
            finalMax: finalScale.max,
            finalCenter: (finalScale.min + finalScale.max) / 2
          });
          
          // MEJORADO: Usar datos del evento actual, no del chart que puede haber cambiado
          const eventMin = xScale.min;
          const eventMax = xScale.max;
          const eventCenter = (eventMin + eventMax) / 2;
          
          logUserInteractionDetailed('USER_ZOOM', {
            eventMin,
            eventMax,
            eventCenter,
            finalScaleMin: finalScale.min,
            finalScaleMax: finalScale.max
          }, preInteractionState);
          
          simpleCamera.onUserZoom(eventMin, eventMax, eventCenter);
          simpleCamera.lockCamera(); // Bloquear la cámara en la nueva posición
          
          // Log del estado después del zoom completo
          const postZoomState = simpleCamera.getCurrentState();
          logViewportState(postZoomState, 'POST_ZOOM_COMPLETE');
        }
        
        endUserInteraction();
        
        // Log del estado después de end interaction
        const postEndState = simpleCamera.getCurrentState();
        logViewportState(postEndState, 'POST_END_INTERACTION_ZOOM');
        
        // Liberar bloqueos después de completar
        isProcessingZoom.current = false;
        
        // CRÍTICO: Liberar bloqueo global inmediatamente para mejor respuesta
        setTimeout(() => {
          globalInteractionBlocked.current = false;
          logChart('ZOOM_GLOBAL_BLOCK_RELEASED');
        }, 25); // Reducido de 50ms a 25ms para mejor respuesta
      }, 25); // Reducido de 50ms a 25ms para mejor respuesta
    }, 50); // Reducido de 100ms a 50ms para mejor respuesta
  }, [startUserInteraction, endUserInteraction, simpleCamera]);

  const debouncedPanHandler = useCallback((chart: any, xScale: any) => {
    const now = Date.now();
    
    logUserInteractionDetailed('PAN_EVENT_RECEIVED', {
      min: xScale.min,
      max: xScale.max,
      center: (xScale.min + xScale.max) / 2,
      timestamp: new Date().toLocaleTimeString(),
      globalBlocked: globalInteractionBlocked.current,
      lastPanTime: lastPanProcessedTime.current,
      timeSinceLastPan: now - lastPanProcessedTime.current,
      isAutomaticViewport: isApplyingAutomaticViewport.current
    });
    
    // CRÍTICO: Ignorar eventos automáticos generados por actualizaciones de stream
    if (isApplyingAutomaticViewport.current) {
      logChart('PAN_EVENT_BLOCKED - automatic viewport update');
      return;
    }
    
    // BLOQUEO GLOBAL: Evitar cualquier solapamiento entre zoom y pan
    if (globalInteractionBlocked.current) {
      logChart('PAN_EVENT_BLOCKED - global interaction blocked');
      return;
    }
    
    // THROTTLE MEJORADO PARA PAN: Reducir bloqueos innecesarios
    if (now - lastPanProcessedTime.current < 50) { // Reducido de 100ms a 50ms
      logChart('PAN_EVENT_BLOCKED - throttle limit');
      return;
    }
    
    // BLOQUEO: Evitar procesamiento simultáneo
    if (isProcessingPan.current) {
      logChart('PAN_EVENT_BLOCKED - already processing pan');
      return;
    }
    
    isProcessingPan.current = true;
    globalInteractionBlocked.current = true;
    lastPanProcessedTime.current = now;
    
    // Cancelar debounce anterior
    if (panDebounceRef.current) {
      clearTimeout(panDebounceRef.current);
    }
    
    // NUEVO: Procesar inmediatamente el inicio de la interacción para mejor responsividad
    const preInteractionState = simpleCamera.getCurrentState();
    logUserInteractionDetailed('PAN_PROCESSING_START', {
      min: xScale.min,
      max: xScale.max,
      center: (xScale.min + xScale.max) / 2
    }, preInteractionState);
    
    // Notificar inicio de interacción inmediatamente
    startUserInteraction();
    
    // Debounce reducido solo para el estado final
    panDebounceRef.current = setTimeout(() => {
      // Limpiar timeout anterior si existe
      if (panTimeoutRef.current) {
        clearTimeout(panTimeoutRef.current);
      }
      
      // Timeout para capturar estado final
      panTimeoutRef.current = setTimeout(() => {
        const finalScale = chart.scales.x;
        if (finalScale) {
          logUserInteractionDetailed('PAN_FINAL_STATE_CAPTURE', {
            finalMin: finalScale.min,
            finalMax: finalScale.max,
            finalCenter: (finalScale.min + finalScale.max) / 2
          });
          
          // MEJORADO: Usar datos del evento actual, no del chart que puede haber cambiado
          const eventMin = xScale.min;
          const eventMax = xScale.max;
          const eventCenter = (eventMin + eventMax) / 2;
          
          logUserInteractionDetailed('USER_PAN', {
            eventMin,
            eventMax,
            eventCenter,
            finalScaleMin: finalScale.min,
            finalScaleMax: finalScale.max
          }, preInteractionState);
          
          simpleCamera.onUserPan(eventMin, eventMax, eventCenter);
          simpleCamera.lockCamera(); // Bloquear la cámara en la nueva posición
        }
        endUserInteraction();
        
        // Liberar bloqueos después de completar
        isProcessingPan.current = false;
        
        // CRÍTICO: Liberar bloqueo global inmediatamente para mejor respuesta
        setTimeout(() => {
          globalInteractionBlocked.current = false;
          logChart('PAN_GLOBAL_BLOCK_RELEASED');
        }, 25); // Reducido de 50ms a 25ms para mejor respuesta
      }, 25); // Reducido de 50ms a 25ms para mejor respuesta
    }, 50); // Reducido de 100ms a 50ms para mejor respuesta
  }, [startUserInteraction, endUserInteraction, simpleCamera]);

  // ============================================

  // Calcular indicadores técnicos
  const technicalIndicators = useTechnicalIndicators(candleData);

  // ============================================
  // MEMOIZACIÓN DE OPCIONES PARA CHART.JS
  // ============================================
  
  // CRÍTICO: Memoizar opciones para evitar recreación en cada render
  // Esto previente que Chart.js resetee las escalas/zoom
  const chartOptions = useMemo(() => ({
    animation: {
      duration: 0  // Desactivar animaciones para mejor rendimiento en live
    },
    responsive: false,
    maintainAspectRatio: false,
    parsing: false as const, // Importante para performance con datos de velas
    interaction: {
      intersect: false,
      mode: 'index' as const
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: currentInterval.includes('m') ? 'minute' as const : 
                currentInterval.includes('h') ? 'hour' as const : 'day' as const,
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MM/dd'
          }
        },
        ticks: {
          color: '#ffffff',
          maxTicksLimit: 12
        },
        grid: {
          display: false
        },
        border: {
          display: false
        },
        // CRÍTICO: Configuraciones para preservar viewport
        bounds: 'data' as const,
        // No definir min/max aquí - se manejan dinámicamente
        adapters: {
          date: {}
        },
        offset: false
      },
      y: {
        type: 'linear' as const,
        position: 'right' as const,
        ticks: {
          color: '#ffffff',
          callback: function(value: any) {
            return '$' + (value / 1000).toFixed(2) + 'k';
          }
        },
        grid: {
          display: false
        },
        border: {
          display: false
        }
      }
    },
    plugins: {
      title: {
        display: true,
        text: `${currentSymbol} - ${currentInterval.toUpperCase()} ${isStreaming ? '🔴 LIVE' : ''}`,
        color: '#ffffff',
        font: { size: 16 }
      },
      legend: {
        labels: { color: '#ffffff' }
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'x' as const,
          onZoom: function(context: any) {
            const chart = context.chart;
            const xScale = chart.scales.x;
            
            if (!xScale || !chart.data.datasets[0]?.data) return;
            
            // Usar el handler debounced para evitar múltiples eventos
            debouncedZoomHandler(chart, xScale);
          }
        },
        pan: {
          enabled: true,
          mode: 'x' as const,
          onPan: function(context: any) {
            const chart = context.chart;
            const xScale = chart.scales.x;
            
            if (!xScale || !chart.data.datasets[0]?.data) return;
            
            // Usar el handler debounced para evitar múltiples eventos
            debouncedPanHandler(chart, xScale);
          }
        }
      }
    }
  }), [currentSymbol, currentInterval, isStreaming, debouncedZoomHandler, debouncedPanHandler]);

  const addLog = (message: string) => {
    console.log(`[MinimalistChart] ${message}`);
  };

  const updateTechnicalIndicators = useCallback((chart: any) => {
    if (!chart || !chart.data || !chart.data.datasets) return;

    const candleDataset = chart.data.datasets[0];
    if (!candleDataset || !candleDataset.data) return;

    // Extraer datos de velas para recalcular indicadores
    const currentCandles: CandleData[] = candleDataset.data.map((candle: any) => ({
      x: candle.x,
      o: candle.o,
      h: candle.h,
      l: candle.l,
      c: candle.c
    }));

    // Recalcular indicadores técnicos
    const indicators = useTechnicalIndicators(currentCandles);

    // Actualizar datasets de indicadores
    chart.data.datasets.forEach((dataset: any, index: number) => {
      if (index === 0) return; // Skip candlestick dataset

      if (dataset.label === 'SMA 20' && activeIndicators.has('sma20')) {
        dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
          x: candle.x,
          y: indicators.sma20[i]
        })).filter((point: any) => !isNaN(point.y));
      } else if (dataset.label === 'SMA 50' && activeIndicators.has('sma50')) {
        dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
          x: candle.x,
          y: indicators.sma50[i]
        })).filter((point: any) => !isNaN(point.y));
      } else if (dataset.label === 'EMA 20' && activeIndicators.has('ema20')) {
        dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
          x: candle.x,
          y: indicators.ema20[i]
        })).filter((point: any) => !isNaN(point.y));
      } else if (dataset.label && dataset.label.startsWith('BB') && activeIndicators.has('bollinger')) {
        if (dataset.label === 'BB Upper') {
          dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
            x: candle.x,
            y: indicators.bollinger.upper[i]
          })).filter((point: any) => !isNaN(point.y));
        } else if (dataset.label === 'BB Middle') {
          dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
            x: candle.x,
            y: indicators.bollinger.middle[i]
          })).filter((point: any) => !isNaN(point.y));
        } else if (dataset.label === 'BB Lower') {
          dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
            x: candle.x,
            y: indicators.bollinger.lower[i]
          })).filter((point: any) => !isNaN(point.y));
        }
      }
    });
  }, [activeIndicators]);

  const initializeChart = useCallback(async () => {
    const initStartTime = Date.now();
    chartInitializationCount.current++;
    
    logLifecycle('CHART_INITIALIZATION_START', 'MinimalistChart', {
      initializationNumber: chartInitializationCount.current,
      platform: Platform.OS,
      candleDataLength: candleData.length,
      currentSymbol,
      currentInterval,
      activeIndicators: Array.from(activeIndicators),
      existingChart: !!chartRef.current,
      canvasRef: !!canvasRef.current
    });
    
    if (Platform.OS !== 'web') {
      setStatus('Solo disponible en plataforma web');
      logError('Chart initialization failed - not web platform', {
        platform: Platform.OS,
        initializationNumber: chartInitializationCount.current
      });
      return;
    }

    try {
      setStatus('Cargando Chart.js...');
      
      logLifecycle('LOADING_CHARTJS_DEPENDENCIES', 'MinimalistChart', {
        initializationNumber: chartInitializationCount.current
      });

      // Importar Chart.js y plugins
      const importStartTime = Date.now();
      const ChartJS = await import('chart.js/auto');
      const Chart = ChartJS.default;
      const ChartFinancial = await import('chartjs-chart-financial');
      const zoomPlugin = await import('chartjs-plugin-zoom');
      const importDuration = Date.now() - importStartTime;

      logTiming('Chart.js dependencies loaded', importDuration, {
        initializationNumber: chartInitializationCount.current,
        chartJSVersion: Chart.version || 'unknown',
        hasFinancialPlugin: !!ChartFinancial,
        hasZoomPlugin: !!zoomPlugin
      });

      try {
        await import('chartjs-adapter-date-fns');
        logLifecycle('DATE_ADAPTER_LOADED', 'MinimalistChart', {
          adapter: 'date-fns'
        });
      } catch (e) {
        logError('Date adapter not available', {
          error: e instanceof Error ? e.message : String(e),
          initializationNumber: chartInitializationCount.current
        });
        addLog('Adaptador de fechas no disponible');
      }

      // Registrar componentes y plugins
      Chart.register(
        ChartFinancial.CandlestickController,
        ChartFinancial.CandlestickElement,
        ChartFinancial.OhlcController,
        ChartFinancial.OhlcElement,
        zoomPlugin.default
      );
      
      logLifecycle('PLUGINS_REGISTERED', 'MinimalistChart', {
        initializationNumber: chartInitializationCount.current,
        registeredPlugins: ['CandlestickController', 'CandlestickElement', 'OhlcController', 'OhlcElement', 'zoomPlugin']
      });

      if (!canvasRef.current) {
        setStatus('Error: Canvas no disponible');
        logError('Canvas not available for chart initialization', {
          canvasRef: !!canvasRef.current,
          initializationNumber: chartInitializationCount.current
        });
        return;
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) {
        setStatus('Error: Context 2D no disponible');
        logError('2D context not available', {
          canvasRef: !!canvasRef.current,
          initializationNumber: chartInitializationCount.current
        });
        return;
      }

      logLifecycle('CANVAS_CONTEXT_ACQUIRED', 'MinimalistChart', {
        initializationNumber: chartInitializationCount.current,
        canvasWidth: canvasRef.current.width,
        canvasHeight: canvasRef.current.height
      });

      setStatus('Creando gráfico...');

      // Destruir gráfico anterior si existe
      if (chartRef.current) {
        const oldChartId = chartRef.current.id || 'unknown';
        logLifecycle('DESTROYING_EXISTING_CHART', 'MinimalistChart', {
          initializationNumber: chartInitializationCount.current,
          existingChartId: oldChartId
        });
        chartRef.current.destroy();
        chartRef.current = null;
      }

      // Configurar datasets
      const datasets: any[] = [
        {
          label: `${currentSymbol}`,
          type: 'candlestick',
          data: candleData.map(candle => ({
            x: candle.x,
            o: candle.o,
            h: candle.h,
            l: candle.l,
            c: candle.c
          })),
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0, 255, 136, 0.1)',
          borderWidth: 1,
          yAxisID: 'y'
        }
      ];

      // Agregar indicadores técnicos
      if (activeIndicators.has('sma20')) {
        datasets.push({
          label: 'SMA 20',
          type: 'line',
          data: candleData.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.sma20[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: '#ffaa00',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          yAxisID: 'y'
        });
      }

      if (activeIndicators.has('sma50')) {
        datasets.push({
          label: 'SMA 50',
          type: 'line',
          data: candleData.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.sma50[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: '#ff6600',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          yAxisID: 'y'
        });
      }

      if (activeIndicators.has('ema20')) {
        datasets.push({
          label: 'EMA 20',
          type: 'line',
          data: candleData.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.ema20[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: '#00aaff',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          yAxisID: 'y'
        });
      }

      if (activeIndicators.has('bollinger')) {
        // Banda superior
        datasets.push({
          label: 'BB Upper',
          type: 'line',
          data: candleData.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.bollinger.upper[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: 'rgba(255, 255, 255, 0.5)',
          backgroundColor: 'transparent',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [5, 5],
          yAxisID: 'y'
        });

        // Banda media
        datasets.push({
          label: 'BB Middle',
          type: 'line',
          data: candleData.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.bollinger.middle[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: '#ffffff',
          backgroundColor: 'transparent',
          borderWidth: 1,
          pointRadius: 0,
          yAxisID: 'y'
        });

        // Banda inferior
        datasets.push({
          label: 'BB Lower',
          type: 'line',
          data: candleData.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.bollinger.lower[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: 'rgba(255, 255, 255, 0.5)',
          backgroundColor: 'transparent',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [5, 5],
          yAxisID: 'y'
        });
      }

      // Crear gráfico con opciones memoizadas
      const chartCreationStart = Date.now();
      
      logLifecycle('CREATING_CHART_INSTANCE', 'MinimalistChart', {
        initializationNumber: chartInitializationCount.current,
        datasetsCount: datasets.length,
        candleDataLength: candleData.length,
        activeIndicators: Array.from(activeIndicators),
        hasChartOptions: !!chartOptions
      });

      chartRef.current = new Chart(ctx, {
        type: 'candlestick',
        data: { datasets },
        options: chartOptions
      });

      const chartCreationDuration = Date.now() - chartCreationStart;
      const totalInitDuration = Date.now() - initStartTime;

      logLifecycle('CHART_INITIALIZATION_SUCCESS', 'MinimalistChart', {
        initializationNumber: chartInitializationCount.current,
        chartId: chartRef.current.id || 'unknown',
        chartCreationDuration,
        totalInitDuration,
        finalCandleCount: candleData.length,
        datasetsCreated: datasets.length
      });

      logTiming('Chart initialization completed', totalInitDuration, {
        initializationNumber: chartInitializationCount.current,
        success: true
      });

      setStatus(`✅ Gráfico listo (${candleData.length} velas)`);

    } catch (error: any) {
      const initDuration = Date.now() - initStartTime;
      logError('Chart initialization failed', {
        error: error instanceof Error ? error.message : String(error),
        initializationNumber: chartInitializationCount.current,
        initDuration,
        candleDataLength: candleData.length,
        stackTrace: error.stack
      });
      setStatus(`Error: ${error.message}`);
      console.error('Error creando gráfico:', error);
    }
  }, [candleData, currentSymbol, currentInterval, isStreaming, activeIndicators, technicalIndicators, chartOptions, debouncedZoomHandler, debouncedPanHandler]);

  const updateChart = useCallback((newCandle: CandleData, isFinal: boolean) => {
    const startTime = Date.now();
    updateSequence.current++;
    
    // CRÍTICO: Capturar estado ANTES de cualquier modificación
    const preUpdateCameraState = simpleCamera.getCurrentState();
    const preUpdateChart = chartRef.current;
    const preUpdateViewport = preUpdateChart?.scales?.x ? {
      min: preUpdateChart.scales.x.min,
      max: preUpdateChart.scales.x.max
    } : null;
    
    logTidalFlow('UPDATE_CHART_START', {
      updateSequence: updateSequence.current,
      newCandle: {
        timestamp: new Date(newCandle.x).toLocaleTimeString(),
        price: newCandle.c,
        isFinal
      },
      chartExists: !!chartRef.current,
      preUpdateCameraState: {
        mode: preUpdateCameraState.mode,
        isLocked: preUpdateCameraState.isLocked,
        viewport: preUpdateCameraState.viewport
      },
      preUpdateChartViewport: preUpdateViewport,
      isUserCurrentlyInteracting: isUserInteracting,
      timeSinceLastUpdate: lastChartUpdate.current ? Date.now() - lastChartUpdate.current : 0
    });
    
    if (!chartRef.current) {
      logChart('UPDATE_CHART_ABORT - no chart reference', {
        updateSequence: updateSequence.current
      });
      return;
    }

    // Throttle updates for better performance, except for final candles
    const now = Date.now();
    if (!isFinal && now - lastUpdateTime < updateThrottleMs) {
      logChart('UPDATE_CHART_THROTTLED', { 
        updateSequence: updateSequence.current,
        timeSinceLastUpdate: now - lastUpdateTime,
        threshold: updateThrottleMs,
        price: newCandle.c
      });
      return;
    }
    setLastUpdateTime(now);

    const chart = chartRef.current;
    
    // ============================================
    // GOBERNANZA TIDAL - ORDEN FIJO SIN setState
    // ============================================
    
    // A) SNAPSHOT: Capturar viewport ANTES de tocar data - usar estado de cámara (NO chart scales)
    const snap = simpleCamera.getViewportFromCamera() 
                ?? persistentViewport.getCurrentViewport() 
                ?? { min: chart?.scales?.x?.min ?? 0, max: chart?.scales?.x?.max ?? 0 };
    
    logTidalFlow('UPDATE_CHART_SNAPSHOT', {
      source: simpleCamera.getViewportFromCamera() ? 'camera' : 
              persistentViewport.getCurrentViewport() ? 'persistent' : 'chart_scales',
      viewport: snap,
      cameraState: {
        mode: simpleCamera.getCurrentState().mode,
        isLocked: simpleCamera.isLocked()
      }
    });
    
    // B) MUTAR DATA EN SITIO (push/shift/assign), sin recrear arrays/objects
    const dataset = chart.data.datasets[0];
    if (dataset && dataset.data) {
      // Buscar vela existente usando ventana de tiempo
      let existingIndex = -1;
      const updateTimestamp = newCandle.x;
      
      // Función para obtener intervalo en milisegundos
      const getIntervalMs = (interval: string): number => {
        const intervals: { [key: string]: number } = {
          '1m': 60 * 1000,
          '3m': 3 * 60 * 1000,
          '5m': 5 * 60 * 1000,
          '15m': 15 * 60 * 1000,
          '30m': 30 * 60 * 1000,
          '1h': 60 * 60 * 1000,
          '2h': 2 * 60 * 60 * 1000,
          '4h': 4 * 60 * 60 * 1000,
          '6h': 6 * 60 * 60 * 1000,
          '8h': 8 * 60 * 60 * 1000,
          '12h': 12 * 60 * 60 * 1000,
          '1d': 24 * 60 * 60 * 1000,
          '3d': 3 * 24 * 60 * 60 * 1000,
          '1w': 7 * 24 * 60 * 60 * 1000,
          '1M': 30 * 24 * 60 * 60 * 1000,
        };
        return intervals[interval] || 60 * 1000;
      };
      
      const intervalMs = getIntervalMs(currentInterval);
      
      // Buscar en las últimas velas primero (más eficiente para streaming)
      if (dataset.data.length > 0) {
        // Verificar la última vela primero
        const lastIndex = dataset.data.length - 1;
        const lastCandle = dataset.data[lastIndex] as any;
        if (lastCandle && Math.abs(lastCandle.x - updateTimestamp) < intervalMs) {
          existingIndex = lastIndex;
        }
      }
      
      // MUTACIÓN IN-SITU: Actualizar o agregar vela
      const candleData = {
        x: newCandle.x,
        o: newCandle.o,
        h: newCandle.h,
        l: newCandle.l,
        c: newCandle.c
      };
      
      if (existingIndex >= 0) {
        // Actualizar vela existente (mutación in-situ)
        logTidalFlow('UPDATE_CHART_MUTATE_EXISTING', {
          index: existingIndex,
          oldPrice: (dataset.data as any)[existingIndex].c,
          newPrice: candleData.c
        });
        (dataset.data as any)[existingIndex] = candleData;
      } else {
        // Agregar nueva vela (mutación in-situ)
        logTidalFlow('UPDATE_CHART_MUTATE_ADD_NEW', {
          newPrice: candleData.c,
          totalCandles: dataset.data.length + 1
        });
        (dataset.data as any[]).push(candleData);
      }

      // Mantener límite de velas (mutación in-situ)
      const maxCandles = 900;
      if (dataset.data.length > maxCandles) {
        const removedCount = dataset.data.length - maxCandles;
        logTidalFlow('UPDATE_CHART_MUTATE_TRIM', {
          removedCount,
          finalCount: maxCandles
        });
        (dataset.data as any[]).splice(0, removedCount);
      }
    }

    // C) COMPUTAR "viewport objetivo" según la marea tidal (SIN setState)
    const lastCandleTime = newCandle.x;
    const desiredViewport = simpleCamera.computeTidalViewport({
      snap,
      lastCandleTime
    });
    
    logTidalFlow('UPDATE_CHART_TIDAL_COMPUTE', {
      lastCandleTime: new Date(lastCandleTime).toLocaleTimeString(),
      snapViewport: snap,
      desiredViewport,
      tideShift: {
        deltaMin: desiredViewport.min - snap.min,
        deltaMax: desiredViewport.max - snap.max
      }
    });

    // D) APLICAR viewport objetivo (no preguntar al chart) - SIN setState
    // CRÍTICO: Marcar que estamos aplicando viewport automático para evitar eventos de user
    isApplyingAutomaticViewport.current = true;
    
    try {
      // CRÍTICO: Log detallado antes de aplicar viewport
      logTidalFlow('APPLYING_VIEWPORT_TO_CHART', {
        updateSequence: updateSequence.current,
        desiredViewport,
        currentChartViewport: preUpdateViewport,
        viewportChange: preUpdateViewport ? {
          deltaMin: desiredViewport.min - preUpdateViewport.min,
          deltaMax: desiredViewport.max - preUpdateViewport.max
        } : 'no_previous_viewport',
        cameraState: preUpdateCameraState.mode,
        cameraLocked: preUpdateCameraState.isLocked
      });
      
      simpleCamera.applyViewportToChart(chart, desiredViewport);
      
      // CRÍTICO: Verificar si el viewport se aplicó correctamente
      const postApplyViewport = chart.scales?.x ? {
        min: chart.scales.x.min,
        max: chart.scales.x.max
      } : null;
      
      const viewportAppliedCorrectly = postApplyViewport && 
        Math.abs(postApplyViewport.min - desiredViewport.min) < 1 &&
        Math.abs(postApplyViewport.max - desiredViewport.max) < 1;
      
      if (!viewportAppliedCorrectly) {
        unexpectedViewportChanges.current++;
        logError('Viewport not applied correctly', {
          updateSequence: updateSequence.current,
          desired: desiredViewport,
          actual: postApplyViewport,
          difference: postApplyViewport ? {
            minDiff: Math.abs(postApplyViewport.min - desiredViewport.min),
            maxDiff: Math.abs(postApplyViewport.max - desiredViewport.max)
          } : 'no_scales',
          unexpectedChanges: unexpectedViewportChanges.current
        });
      }
      
      // E) chart.update('none') - sin animación para evitar saltos
      logTidalFlow('UPDATE_CHART_EXECUTE_UPDATE', {
        updateSequence: updateSequence.current,
        updateMode: 'none',
        chartUpdateStart: Date.now(),
        viewportCorrectlyApplied: viewportAppliedCorrectly
      });
      
      const updateStartTime = Date.now();
      chart.update('none');
      const updateDuration = Date.now() - updateStartTime;
      
      logTidalFlow('CHART_UPDATE_COMPLETED', {
        updateSequence: updateSequence.current,
        updateDuration,
        finalViewport: chart.scales?.x ? {
          min: chart.scales.x.min,
          max: chart.scales.x.max
        } : null
      });
      
    } finally {
      // Limpiar flag después de aplicar, con delay para capturar eventos tardíos
      setTimeout(() => {
        isApplyingAutomaticViewport.current = false;
        
        // CRÍTICO: Verificar estado final después de la actualización
        const finalCameraState = simpleCamera.getCurrentState();
        const finalChartViewport = chart.scales?.x ? {
          min: chart.scales.x.min,
          max: chart.scales.x.max
        } : null;
        
        // Detectar cambios inesperados en el estado de la cámara
        if (finalCameraState.mode !== preUpdateCameraState.mode || 
            finalCameraState.isLocked !== preUpdateCameraState.isLocked) {
          
          unexpectedViewportChanges.current++;
          
          logError('UNEXPECTED CAMERA STATE CHANGE during chart update', {
            updateSequence: updateSequence.current,
            before: {
              mode: preUpdateCameraState.mode,
              isLocked: preUpdateCameraState.isLocked,
              viewport: preUpdateCameraState.viewport
            },
            after: {
              mode: finalCameraState.mode,
              isLocked: finalCameraState.isLocked,
              viewport: finalCameraState.viewport
            },
            chartViewportBefore: preUpdateViewport,
            chartViewportAfter: finalChartViewport,
            unexpectedChanges: unexpectedViewportChanges.current,
            possibleCause: 'chart_update_triggered_camera_reset'
          });
        }
        
        logTidalFlow('UPDATE_CHART_FINALIZATION_COMPLETE', {
          updateSequence: updateSequence.current,
          flagCleared: true,
          finalCameraMode: finalCameraState.mode,
          finalViewport: finalChartViewport
        });
      }, 50);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logTiming('UPDATE_CHART_COMPLETE', duration, {
      isFinal,
      candlePrice: newCandle.c,
      finalViewport: desiredViewport
    });
  }, [currentInterval, simpleCamera, persistentViewport, lastUpdateTime, updateThrottleMs]);

  const changeTimeInterval = useCallback(async (newInterval: TimeInterval) => {
    const intervalChangeStart = Date.now();
    
    // CRÍTICO: Capturar estado de cámara ANTES del cambio de intervalo
    const preChangeState = {
      currentInterval,
      newInterval,
      isStreaming,
      candleDataLength: candleData.length,
      cameraState: simpleCamera ? {
        viewport: simpleCamera.getViewportFromCamera(),
        currentState: simpleCamera.getCurrentState(),
        isLocked: simpleCamera.isLocked(),
        isActivelyInteracting: simpleCamera.isActivelyInteracting(),
        shouldForceViewport: simpleCamera.shouldForceViewport(),
        forcedViewport: simpleCamera.getForcedViewport()
      } : null,
      chartExists: !!chartRef.current,
      chartId: chartRef.current?.id || null
    };

    logLifecycle('INTERVAL_CHANGE_START', 'MinimalistChart', preChangeState);

    setCurrentInterval(newInterval);
    setStatus('Cambiando intervalo...');

    try {
      // Desuscribirse del intervalo anterior
      if (isStreaming) {
        logLifecycle('UNSUBSCRIBING_FROM_STREAM', 'MinimalistChart', {
          symbol: currentSymbol,
          oldInterval: currentInterval,
          newInterval
        });
        liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
      }

      // Cargar datos históricos para el nuevo intervalo
      logLifecycle('LOADING_HISTORICAL_DATA', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: newInterval,
        candleCount: 900
      });
      
      const historicalStart = Date.now();
      const historicalData = await liveStreamingService.loadHistoricalData(currentSymbol, newInterval, 900);
      const historicalDuration = Date.now() - historicalStart;
      
      logTiming('Historical data loaded for interval change', historicalDuration, {
        symbol: currentSymbol,
        interval: newInterval,
        candlesReceived: historicalData.length,
        oldCandleCount: candleData.length,
        newCandleCount: historicalData.length
      });

      setCandleData(historicalData);

      // CRÍTICO: Verificar si el cambio de datos afectó la cámara
      setTimeout(() => {
        const postDataChangeState = {
          cameraState: simpleCamera ? {
            viewport: simpleCamera.getViewportFromCamera(),
            currentState: simpleCamera.getCurrentState(),
            isLocked: simpleCamera.isLocked(),
            isActivelyInteracting: simpleCamera.isActivelyInteracting(),
            shouldForceViewport: simpleCamera.shouldForceViewport(),
            forcedViewport: simpleCamera.getForcedViewport()
          } : null,
          chartExists: !!chartRef.current,
          chartId: chartRef.current?.id || null
        };

        logLifecycle('POST_DATA_CHANGE_CAMERA_STATE', 'MinimalistChart', {
          preChangeState: preChangeState.cameraState,
          postChangeState: postDataChangeState.cameraState,
          cameraStateChanged: JSON.stringify(preChangeState.cameraState) !== JSON.stringify(postDataChangeState.cameraState)
        });
      }, 100);

      // Suscribirse al nuevo intervalo
      if (isStreaming) {
        logLifecycle('SUBSCRIBING_TO_NEW_STREAM', 'MinimalistChart', {
          symbol: currentSymbol,
          interval: newInterval
        });
        await liveStreamingService.subscribeToStream(currentSymbol, newInterval);
      }

      const totalChangeDuration = Date.now() - intervalChangeStart;
      logTiming('Interval change completed', totalChangeDuration, {
        oldInterval: preChangeState.currentInterval,
        newInterval,
        success: true,
        historicalDataDuration: historicalDuration,
        newCandleCount: historicalData.length
      });

    } catch (error: any) {
      const changeDuration = Date.now() - intervalChangeStart;
      logError('Interval change failed', {
        error: error instanceof Error ? error.message : String(error),
        oldInterval: preChangeState.currentInterval,
        newInterval,
        changeDuration,
        stackTrace: error.stack
      });
      console.error('Error cambiando intervalo:', error);
    }
  }, [currentSymbol, currentInterval, isStreaming, candleData.length, simpleCamera]);

  const startStreaming = useCallback(async () => {
    const streamingStart = Date.now();

    if (isStreaming) {
      logLifecycle('STREAMING_ALREADY_ACTIVE', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval
      });
      console.log('📊 Streaming ya está activo');
      return;
    }

    // Capturar estado antes de iniciar streaming
    const preStreamingState = {
      symbol: currentSymbol,
      interval: currentInterval,
      candleDataLength: candleData.length,
      cameraState: simpleCamera ? {
        viewport: simpleCamera.getViewportFromCamera(),
        currentState: simpleCamera.getCurrentState(),
        isLocked: simpleCamera.isLocked()
      } : null,
      chartExists: !!chartRef.current
    };

    logLifecycle('STREAMING_START_ATTEMPT', 'MinimalistChart', preStreamingState);

    try {
      setStatus('Conectando streaming...');

      logLifecycle('SUBSCRIBING_TO_STREAM', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval
      });

      const subscriptionStart = Date.now();
      await liveStreamingService.subscribeToStream(currentSymbol, currentInterval);
      const subscriptionDuration = Date.now() - subscriptionStart;

      logTiming('Stream subscription completed', subscriptionDuration, {
        symbol: currentSymbol,
        interval: currentInterval,
        success: true
      });
      
      setIsStreaming(true);
      setStatus('✅ Streaming conectado');

      const totalStartDuration = Date.now() - streamingStart;
      logLifecycle('STREAMING_START_SUCCESS', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval,
        totalStartDuration,
        subscriptionDuration
      });

    } catch (error: any) {
      const startDuration = Date.now() - streamingStart;
      
      logError('Streaming start failed, falling back to polling', {
        error: error instanceof Error ? error.message : String(error),
        symbol: currentSymbol,
        interval: currentInterval,
        startDuration,
        stackTrace: error.stack
      });

      console.error('Error iniciando streaming:', error);
      setStatus(`⚠️ Streaming en modo polling (WebSocket falló)`);
      setIsStreaming(true); // Aún funciona con polling

      logLifecycle('STREAMING_FALLBACK_TO_POLLING', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval,
        error: error.message,
        startDuration
      });
    }
  }, [currentSymbol, currentInterval, isStreaming, candleData.length, simpleCamera]);

  const stopStreaming = useCallback(() => {
    logLifecycle('STREAMING_STOP_ATTEMPT', 'MinimalistChart', {
      symbol: currentSymbol,
      interval: currentInterval,
      wasStreaming: isStreaming
    });

    if (!isStreaming) {
      logLifecycle('STREAMING_ALREADY_STOPPED', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval
      });
      return;
    }

    const stopStart = Date.now();
    
    try {
      liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
      setIsStreaming(false);
      
      const stopDuration = Date.now() - stopStart;
      logTiming('Streaming stopped', stopDuration, {
        symbol: currentSymbol,
        interval: currentInterval,
        success: true
      });

      logLifecycle('STREAMING_STOP_SUCCESS', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval,
        stopDuration
      });

    } catch (error: any) {
      const stopDuration = Date.now() - stopStart;
      logError('Error stopping streaming', {
        error: error instanceof Error ? error.message : String(error),
        symbol: currentSymbol,
        interval: currentInterval,
        stopDuration,
        stackTrace: error.stack
      });
    }
  }, [currentSymbol, currentInterval, isStreaming]);

  // ===== FUNCIONES DE DEBUGGING AVANZADAS =====
  
  const getSystemStateSnapshot = useCallback(() => {
    const snapshot = {
      timestamp: Date.now(),
      dateTime: new Date().toISOString(),
      
      // Estado del componente
      component: {
        currentSymbol,
        currentInterval,
        isStreaming,
        status,
        candleDataLength: candleData.length,
        activeIndicators: Array.from(activeIndicators),
        updateSequence: updateSequence.current,
        chartInitializationCount: chartInitializationCount.current
      },

      // Estado del gráfico
      chart: {
        exists: !!chartRef.current,
        id: chartRef.current?.id || null,
        canvas: {
          exists: !!canvasRef.current,
          width: canvasRef.current?.width || null,
          height: canvasRef.current?.height || null
        },
        scales: chartRef.current?.scales ? {
          x: {
            min: chartRef.current.scales.x?.min || null,
            max: chartRef.current.scales.x?.max || null
          },
          y: {
            min: chartRef.current.scales.y?.min || null,
            max: chartRef.current.scales.y?.max || null
          }
        } : null
      },

      // Estado de la cámara
      camera: simpleCamera ? {
        viewport: simpleCamera.getViewportFromCamera(),
        currentState: simpleCamera.getCurrentState(),
        isLocked: simpleCamera.isLocked(),
        isActivelyInteracting: simpleCamera.isActivelyInteracting(),
        shouldForceViewport: simpleCamera.shouldForceViewport(),
        shouldAutoAdjust: simpleCamera.shouldAutoAdjust(),
        forcedViewport: simpleCamera.getForcedViewport(),
        recommendedViewport: simpleCamera.getRecommendedViewport(candleData.length, candleData)
      } : null,

      // Estado del viewport persistente
      persistentViewport: persistentViewport ? {
        hasSnapshot: persistentViewport.hasSnapshot(),
        currentViewport: persistentViewport.getCurrentViewport()
      } : null,

      // Estado de los datos
      data: {
        candleDataLength: candleData.length,
        firstCandle: candleData.length > 0 ? {
          timestamp: candleData[0].x,
          date: new Date(candleData[0].x).toISOString()
        } : null,
        lastCandle: candleData.length > 0 ? {
          timestamp: candleData[candleData.length - 1].x,
          date: new Date(candleData[candleData.length - 1].x).toISOString()
        } : null
      },

      // Rendimiento
      performance: {
        lastUpdateTime,
        updateThrottleMs,
        memoryUsage: (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null
      }
    };

    return snapshot;
  }, [
    currentSymbol, currentInterval, isStreaming, status, candleData, activeIndicators,
    simpleCamera, persistentViewport, updateThrottleMs
  ]);

  const logSystemStateSnapshot = useCallback(() => {
    const snapshot = getSystemStateSnapshot();
    logLifecycle('SYSTEM_STATE_SNAPSHOT', 'MinimalistChart', snapshot);
    return snapshot;
  }, [getSystemStateSnapshot]);

  const startSystemMonitoring = useCallback((intervalMs: number = 5000) => {
    logLifecycle('SYSTEM_MONITORING_START', 'MinimalistChart', {
      intervalMs,
      timestamp: Date.now()
    });

    const monitoringInterval = setInterval(() => {
      const snapshot = getSystemStateSnapshot();
      
      // Detectar cambios críticos
      const criticalChanges = [];
      
      if (snapshot.camera?.viewport && snapshot.chart?.scales?.x) {
        const chartViewport = {
          min: snapshot.chart.scales.x.min,
          max: snapshot.chart.scales.x.max
        };
        const cameraViewport = snapshot.camera.viewport;
        
        if (Math.abs((chartViewport.min || 0) - (cameraViewport.min || 0)) > 1 ||
            Math.abs((chartViewport.max || 0) - (cameraViewport.max || 0)) > 1) {
          criticalChanges.push('CAMERA_CHART_VIEWPORT_MISMATCH');
        }
      }

      if (!snapshot.chart.exists && snapshot.component.candleDataLength > 0) {
        criticalChanges.push('CHART_MISSING_WITH_DATA');
      }

      if (snapshot.camera?.shouldForceViewport && !snapshot.camera?.isLocked) {
        criticalChanges.push('FORCE_VIEWPORT_WITHOUT_LOCK');
      }

      logLifecycle('SYSTEM_MONITORING_SNAPSHOT', 'MinimalistChart', {
        ...snapshot,
        criticalChanges,
        hasCriticalIssues: criticalChanges.length > 0
      });

      if (criticalChanges.length > 0) {
        logError('Critical system state issues detected', {
          issues: criticalChanges,
          snapshot
        });
      }
    }, intervalMs);

    // Retornar función de cleanup
    return () => {
      clearInterval(monitoringInterval);
      logLifecycle('SYSTEM_MONITORING_STOP', 'MinimalistChart', {
        timestamp: Date.now()
      });
    };
  }, [getSystemStateSnapshot]);

  const diagnoseCameraReset = useCallback(() => {
    const snapshot = getSystemStateSnapshot();
    
    const diagnosis = {
      timestamp: Date.now(),
      potentialCauses: [] as string[],
      recommendations: [] as string[],
      snapshot
    };

    // Analizar posibles causas del reset de cámara
    if (!snapshot.camera?.isLocked && snapshot.camera?.shouldAutoAdjust) {
      diagnosis.potentialCauses.push('CAMERA_NOT_LOCKED_AUTO_ADJUST_ACTIVE');
      diagnosis.recommendations.push('Lock camera during user interactions');
    }

    if (snapshot.chart?.scales?.x?.min !== snapshot.camera?.viewport?.min ||
        snapshot.chart?.scales?.x?.max !== snapshot.camera?.viewport?.max) {
      diagnosis.potentialCauses.push('CHART_CAMERA_VIEWPORT_MISMATCH');
      diagnosis.recommendations.push('Sync chart viewport with camera state');
    }

    if (snapshot.component.updateSequence > 100 && snapshot.performance.lastUpdateTime > 0) {
      const timeSinceLastUpdate = Date.now() - snapshot.performance.lastUpdateTime;
      if (timeSinceLastUpdate < 100) {
        diagnosis.potentialCauses.push('HIGH_FREQUENCY_UPDATES');
        diagnosis.recommendations.push('Increase update throttling');
      }
    }

    if (!snapshot.persistentViewport?.hasSnapshot && snapshot.camera?.currentState?.mode === 'USER_LOCKED') {
      diagnosis.potentialCauses.push('NO_VIEWPORT_PERSISTENCE');
      diagnosis.recommendations.push('Ensure viewport persistence is working');
    }

    logLifecycle('CAMERA_RESET_DIAGNOSIS', 'MinimalistChart', diagnosis);
    
    return diagnosis;
  }, [getSystemStateSnapshot]);

  // Exponer funciones de debugging globalmente para uso en consola
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).houndTradeDebug = {
        getSystemStateSnapshot,
        logSystemStateSnapshot,
        startSystemMonitoring,
        diagnoseCameraReset,
        chart: chartRef.current,
        camera: simpleCamera,
        persistentViewport
      };
    }
  }, [getSystemStateSnapshot, logSystemStateSnapshot, startSystemMonitoring, diagnoseCameraReset, simpleCamera, persistentViewport]);

  const toggleIndicator = useCallback((indicator: string) => {
    setActiveIndicators(prev => {
      const newSet = new Set(prev);
      if (newSet.has(indicator)) {
        newSet.delete(indicator);
      } else {
        newSet.add(indicator);
      }
      return newSet;
    });
  }, []);

  // Efectos
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Marcar que necesitamos reinicializar debido a cambio de símbolo/intervalo
        chartNeedsReinitializationRef.current = true;
        
        const historicalData = await liveStreamingService.loadHistoricalData(currentSymbol, currentInterval, 900);
        setCandleData(historicalData);
      } catch (error) {
        console.error('Error cargando datos iniciales:', error);
      }
    };

    loadInitialData();
  }, [currentSymbol, currentInterval]);

  // NUEVO: Solo reinicializar el gráfico cuando realmente sea necesario
  const lastCandleCountRef = useRef<number>(0);
  const chartNeedsReinitializationRef = useRef<boolean>(false);
  
  useEffect(() => {
    // Solo inicializar si:
    // 1. Tenemos datos de velas
    // 2. No existe un gráfico actualmente
    // 3. El número de velas cambió significativamente (nuevo símbolo/intervalo)
    // 4. Se marcó explícitamente para reinicialización
    
    const shouldInitialize = candleData.length > 0 && (
      !chartRef.current || 
      Math.abs(candleData.length - lastCandleCountRef.current) > 50 ||
      chartNeedsReinitializationRef.current
    );
    
    if (shouldInitialize) {
      logLifecycle('CHART_REINITIALIZE_DECISION', 'MinimalistChart', {
        candleDataLength: candleData.length,
        lastCandleCount: lastCandleCountRef.current,
        chartExists: !!chartRef.current,
        forceReinit: chartNeedsReinitializationRef.current,
        sizeDelta: Math.abs(candleData.length - lastCandleCountRef.current)
      });
      
      lastCandleCountRef.current = candleData.length;
      chartNeedsReinitializationRef.current = false;
      initializeChart();
    } else {
      logLifecycle('CHART_REINITIALIZE_SKIPPED', 'MinimalistChart', {
        candleDataLength: candleData.length,
        lastCandleCount: lastCandleCountRef.current,
        chartExists: !!chartRef.current,
        sizeDelta: Math.abs(candleData.length - lastCandleCountRef.current)
      });
    }
  }, [candleData.length, currentSymbol, currentInterval, initializeChart]); // Solo depender de longitud, no de los datos completos

  // ❌ HOOK ELIMINADO: Este hook causaba loops de viewport forzado redundante
  // Ya no necesitamos forzar el viewport aquí porque updateChart ya lo maneja correctamente
  // El hook se ejecutaba en cada cambio de candleData creando interferencias

  useEffect(() => {
    // Handler estable que usa referencias para evitar dependencias circulares
    const handleCandleUpdate = (update: StreamUpdate) => {
      logChart('STREAM_UPDATE_RECEIVED', {
        symbol: update.symbol,
        interval: update.interval,
        isFinal: update.isFinal,
        price: update.candle.c,
        timestamp: new Date().toLocaleTimeString(),
        matchesCurrentChart: update.symbol === currentSymbol && update.interval === currentInterval
      });
      
      if (update.symbol === currentSymbol && update.interval === currentInterval) {
        logChart('STREAM_UPDATE_PROCESSING', {
          symbol: update.symbol,
          interval: update.interval,
          isFinal: update.isFinal,
          price: update.candle.c
        });
        
        // CRÍTICO: updateChart NO debe hacer setState ni lockCamera durante ticks
        updateChart(update.candle, update.isFinal);
        
        logChart('STREAM_UPDATE_CHART_COMPLETE', { 
          symbol: update.symbol, 
          price: update.candle.c 
        });
        
        setCandleData(prev => {
          const newData = [...prev];
          
          // Buscar vela existente considerando ventana de tiempo en lugar de timestamp exacto
          let existingIndex = -1;
          const updateTimestamp = update.candle.x;
          
          // Para la última vela (más común en streaming), verificar primero el final del array
          if (newData.length > 0) {
            const lastCandle = newData[newData.length - 1];
            const intervalMs = getIntervalInMs(currentInterval);
            const timeDiff = Math.abs(lastCandle.x - updateTimestamp);
            
            // Si la diferencia de tiempo es menor que el intervalo, es la misma vela
            if (timeDiff < intervalMs) {
              existingIndex = newData.length - 1;
            } else {
              // Buscar en las últimas 5 velas por si acaso
              for (let i = Math.max(0, newData.length - 5); i < newData.length - 1; i++) {
                const candleTimeDiff = Math.abs(newData[i].x - updateTimestamp);
                if (candleTimeDiff < intervalMs) {
                  existingIndex = i;
                  break;
                }
              }
            }
          }
          
          if (existingIndex >= 0) {
            // Actualizar vela existente
            const oldPrice = newData[existingIndex].c;
            newData[existingIndex] = update.candle;
            logChart('STREAM_STATE_UPDATE_EXISTING', {
              index: existingIndex,
              oldPrice: oldPrice.toFixed(4),
              newPrice: update.candle.c.toFixed(4),
              isFinal: update.isFinal
            });
          } else {
            // Agregar nueva vela
            newData.push(update.candle);
            logChart('STREAM_STATE_ADD_NEW', {
              price: update.candle.c.toFixed(4),
              timestamp: new Date(update.candle.x).toLocaleTimeString(),
              totalCandles: newData.length,
              isFinal: update.isFinal
            });
            
            // Mantener solo las últimas velas según configuración de cámara
            const maxCandles = simpleCamera.isLocked() ? 200 : 100;
            if (newData.length > maxCandles) {
              const removedCount = newData.length - maxCandles;
              newData.splice(0, removedCount);
              logChart('STREAM_STATE_TRIM', {
                removedCount,
                finalCount: newData.length
              });
            }
          }
          
          // Ordenar por timestamp para asegurar orden correcto
          newData.sort((a, b) => a.x - b.x);
          
          return newData;
        });
      }
    };

    // Función auxiliar para obtener intervalos en milisegundos
    const getIntervalInMs = (interval: string): number => {
      const intervals: { [key: string]: number } = {
        '1m': 60 * 1000,
        '3m': 3 * 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '2h': 2 * 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '8h': 8 * 60 * 60 * 1000,
        '12h': 12 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '3d': 3 * 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000,
        '1M': 30 * 24 * 60 * 60 * 1000,
      };
      return intervals[interval] || 60 * 1000;
    };

    liveStreamingService.on('candleUpdate', handleCandleUpdate);

    return () => {
      liveStreamingService.off('candleUpdate', handleCandleUpdate);
    };
  }, [currentSymbol, currentInterval, updateChart]); // Dependencias estables, NO incluir simpleCamera

  // Cleanup al desmontar
  useEffect(() => {
    // Listeners para estado de conexión
    const handleConnected = () => {
      setStatus('✅ WebSocket conectado');
    };

    const handleDisconnected = () => {
      setStatus('🔄 Reconectando...');
    };

    const handleMaxReconnectReached = () => {
      setStatus('⚠️ Usando modo polling (WebSocket no disponible)');
    };

    liveStreamingService.on('connected', handleConnected);
    liveStreamingService.on('disconnected', handleDisconnected);
    liveStreamingService.on('maxReconnectAttemptsReached', handleMaxReconnectReached);

    return () => {
      if (isStreaming) {
        liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
      }
      if (chartRef.current) {
        chartRef.current.destroy();
      }
      
      // Limpiar listeners
      liveStreamingService.off('connected', handleConnected);
      liveStreamingService.off('disconnected', handleDisconnected);
      liveStreamingService.off('maxReconnectAttemptsReached', handleMaxReconnectReached);
    };
  }, []);

  // Auto-iniciar streaming
  useEffect(() => {
    if (candleData.length > 0 && !isStreaming) {
      startStreaming();
    }
  }, [candleData, startStreaming, isStreaming]);

  // Configuración inicial del viewport SOLO al cargar por primera vez
  useEffect(() => {
    logLifecycle('VIEWPORT_INITIAL_SETUP_CHECK', 'MinimalistChart', {
      hasChart: !!chartRef.current,
      candleCount: candleData.length,
      initialViewportSet: initialViewportSet.current,
      shouldAutoAdjust: simpleCamera.shouldAutoAdjust(),
      isLocked: simpleCamera.isLocked()
    });
    
    if (!chartRef.current || candleData.length === 0 || initialViewportSet.current) {
      logLifecycle('VIEWPORT_INITIAL_SETUP_SKIP', 'MinimalistChart', {
        reason: !chartRef.current ? 'no_chart' : 
                candleData.length === 0 ? 'no_data' : 'already_set'
      });
      return;
    }
    
    const chart = chartRef.current;
    
    // Verificar si hay configuración guardada del usuario
    if (simpleCamera.isLocked()) {
      const userState = simpleCamera.state.chartJsState;
      logViewportState(userState, 'CHECKING_USER_SAVED_CONFIG');
      
      if (chart.scales.x && userState.min !== null && userState.max !== null) {
        logLifecycle('VIEWPORT_APPLYING_USER_CONFIG', 'MinimalistChart', {
          viewport: { min: userState.min, max: userState.max }
        });
        
        // Marcar como aplicación automática para evitar eventos de usuario
        isApplyingAutomaticViewport.current = true;
        
        try {
          chart.scales.x.min = userState.min;
          chart.scales.x.max = userState.max;
          chart.update('none');
          initialViewportSet.current = true;
          
          logViewportState({ min: userState.min, max: userState.max }, 'USER_CONFIG_APPLIED');
        } finally {
          setTimeout(() => {
            isApplyingAutomaticViewport.current = false;
          }, 50);
        }
        return;
      }
    }
    
    // En modo auto-ajuste: configurar vista inicial de últimas 100 velas
    if (simpleCamera.shouldAutoAdjust()) {
      logLifecycle('VIEWPORT_APPLYING_AUTO_CONFIG', 'MinimalistChart');
      
      const viewport = simpleCamera.getRecommendedViewport(candleData.length, candleData);
      logViewportState(viewport, 'RECOMMENDED_VIEWPORT');
      
      if (chart.scales.x && viewport.min && viewport.max) {
        logLifecycle('VIEWPORT_SETTING_INITIAL_VIEW', 'MinimalistChart', {
          viewport
        });
        
        // Marcar como aplicación automática para evitar eventos de usuario
        isApplyingAutomaticViewport.current = true;
        
        try {
          chart.scales.x.min = viewport.min;
          chart.scales.x.max = viewport.max;
          chart.update('none');
          initialViewportSet.current = true;
          
          logViewportState(viewport, 'INITIAL_VIEW_APPLIED');
        } finally {
          setTimeout(() => {
            isApplyingAutomaticViewport.current = false;
          }, 50);
        }
      } else {
        logLifecycle('VIEWPORT_INITIAL_SETUP_FAILED', 'MinimalistChart', {
          reason: 'invalid_viewport_data',
          viewport
        });
      }
    }
  }, [candleData.length === 0 ? 0 : 1]); // Solo se ejecuta UNA VEZ cuando candleData pasa de vacío a tener datos

  // Auto-iniciar streaming
  useEffect(() => {
    if (candleData.length > 0 && !isStreaming) {
      startStreaming();
    }
  }, [candleData, startStreaming, isStreaming]);

  // Función global para debugging (disponible en consola del navegador)
  useEffect(() => {
    // Crear función global para debugging
    if (typeof window !== 'undefined') {
      (window as any).debugCameraSystem = () => {
        const cameraState = simpleCamera.getCurrentState();
        const chartScales = chartRef.current?.scales?.x;
        const persistentState = persistentViewport.getCurrentViewport();
        
        logSystemSnapshot('MANUAL_DEBUG_REQUEST', cameraState, {
          scalesMin: chartScales?.min,
          scalesMax: chartScales?.max,
          chartExists: !!chartRef.current
        }, persistentState);
        
        console.log('📋 [DEBUG] Sistema de cámara - Estado completo:');
        console.log('📷 Cámara:', cameraState);
        console.log('📊 Chart Scales:', { min: chartScales?.min, max: chartScales?.max });
        console.log('💾 Persistent:', persistentState);
        console.log('🎭 Flags:', { 
          initialViewportSet: initialViewportSet.current,
          isUserInteracting,
          isStreaming 
        });
        
        return {
          camera: cameraState,
          chartScales: { min: chartScales?.min, max: chartScales?.max },
          persistent: persistentState,
          flags: { initialViewportSet: initialViewportSet.current, isUserInteracting, isStreaming }
        };
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).debugCameraSystem;
      }
    };
  }, [simpleCamera, persistentViewport, isUserInteracting, isStreaming]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Este componente solo funciona en la plataforma web
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Gráfico con controles pegados arriba */}
      <View style={styles.chartContainer}>
        {/* Controles directamente arriba del gráfico */}
        <View style={styles.controlsAboveChart}>
          {/* Temporalidades */}
          <View style={styles.timeframeRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.intervalContainer}>
              {timeIntervals.map((interval) => (
                <TouchableOpacity
                  key={interval.value}
                  style={[
                    styles.intervalButton,
                    currentInterval === interval.value && styles.intervalButtonActive
                  ]}
                  onPress={() => changeTimeInterval(interval.value)}
                >
                  <Text style={[
                    styles.intervalButtonText,
                    currentInterval === interval.value && styles.intervalButtonTextActive
                  ]}>
                    {interval.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Indicadores en la misma fila */}
            <View style={styles.indicatorsRow}>
              <TouchableOpacity
                style={[styles.indicatorButton, activeIndicators.has('sma20') && styles.indicatorButtonActive]}
                onPress={() => toggleIndicator('sma20')}
              >
                <Text style={styles.indicatorButtonText}>SMA20</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.indicatorButton, activeIndicators.has('sma50') && styles.indicatorButtonActive]}
                onPress={() => toggleIndicator('sma50')}
              >
                <Text style={styles.indicatorButtonText}>SMA50</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.indicatorButton, activeIndicators.has('ema20') && styles.indicatorButtonActive]}
                onPress={() => toggleIndicator('ema20')}
              >
                <Text style={styles.indicatorButtonText}>EMA20</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.indicatorButton, activeIndicators.has('bollinger') && styles.indicatorButtonActive]}
                onPress={() => toggleIndicator('bollinger')}
              >
                <Text style={styles.indicatorButtonText}>BB</Text>
              </TouchableOpacity>

              {/* Botón de reset de cámara con estado visual */}
              <TouchableOpacity
                style={[
                  styles.indicatorButton, 
                  simpleCamera.isLocked() ? styles.cameraManualButton : styles.cameraResetButton
                ]}
                onPress={() => {
                  logUserInteractionDetailed('CAMERA_RESET_BUTTON_PRESSED', {
                    currentMode: simpleCamera.getCurrentState().mode,
                    wasLocked: simpleCamera.isLocked(),
                    userAction: 'manual_reset_request'
                  });
                  
                  const preResetState = simpleCamera.getCurrentState();
                  logViewportState(preResetState, 'PRE_RESET');
                  
                  initialViewportSet.current = false; // Reset flag para permitir nuevo viewport inicial
                  simpleCamera.resetToLatest(); // Limpia estado persistido
                  persistentViewport.resetZoom('none'); // Reset usando Chart.js oficial
                  persistentViewport.clearSnapshot(); // Limpia snapshot guardado
                  
                  logLifecycle('CAMERA_RESET_COMPLETE', 'MinimalistChart', {
                    flagReset: true,
                    stateCleared: true,
                    snapshotCleared: true
                  });
                  
                  // El gráfico se reiniciará automáticamente con el próximo useEffect
                }}
              >
                <Text style={styles.indicatorButtonText}>
                  {simpleCamera.isLocked() ? '📷 Reset' : '📷 Auto'}
                </Text>
              </TouchableOpacity>

              {/* Estado LIVE al final */}
              <View style={styles.liveIndicatorInline}>
                <View style={[
                  styles.liveDot,
                  { backgroundColor: isStreaming ? '#00ff88' : '#666' }
                ]} />
                <Text style={styles.liveText}>
                  {isStreaming ? 'LIVE' : 'PAUSED'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Canvas del gráfico pegado directamente */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            backgroundColor: '#000',
            maxWidth: '100%',
            display: 'block'
          }}
        />

        {/* Estado del gráfico en una línea minimalista debajo */}
        <View style={styles.statusBelow}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  chartContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  controlsAboveChart: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  timeframeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intervalContainer: {
    flexDirection: 'row',
    flex: 1,
  },
  intervalButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 6,
  },
  intervalButtonActive: {
    backgroundColor: '#00ff88',
  },
  intervalButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  intervalButtonTextActive: {
    color: '#000',
  },
  indicatorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorButton: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    marginLeft: 4,
  },
  indicatorButtonActive: {
    backgroundColor: '#ff6600',
  },
  cameraResetButton: {
    backgroundColor: '#0088ff',
  },
  cameraManualButton: {
    backgroundColor: '#ff6600',
  },
  indicatorButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  liveIndicatorInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#222',
    borderRadius: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  liveText: {
    color: '#ccc',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBelow: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#666',
    fontSize: 10,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});

export default MinimalistChart;
