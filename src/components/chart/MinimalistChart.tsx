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
  logInteractionCycle
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
    logUserInteractionDetailed('START_USER_INTERACTION_CHART', {
      timestamp: new Date(timestamp).toLocaleTimeString(),
      component: 'MinimalistChart'
    });
    
    setIsUserInteracting(true);
    simpleCamera.onUserStartInteraction();
    
    // Limpiar timeout existente
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }
  }, [simpleCamera]);

  const endUserInteraction = useCallback(() => {
    const timestamp = Date.now();
    logUserInteractionDetailed('END_USER_INTERACTION_CHART', {
      timestamp: new Date(timestamp).toLocaleTimeString(),
      component: 'MinimalistChart',
      delay: 300
    });
    
    // Delay para capturar estado final
    userInteractionTimeoutRef.current = setTimeout(() => {
      logUserInteractionDetailed('END_USER_INTERACTION_DELAYED', {
        timestamp: new Date().toLocaleTimeString(),
        component: 'MinimalistChart'
      });
      
      setIsUserInteracting(false);
      simpleCamera.onUserEndInteraction();
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
      timeSinceLastZoom: now - lastZoomProcessedTime.current
    });
    
    // BLOQUEO GLOBAL: Evitar cualquier solapamiento entre zoom y pan
    if (globalInteractionBlocked.current) {
      logChart('ZOOM_EVENT_BLOCKED - global interaction blocked');
      return;
    }
    
    // THROTTLE ESPECÍFICO PARA ZOOM: Solo 1 evento cada 100ms (reducido)
    if (now - lastZoomProcessedTime.current < 100) {
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
    
    // Debounce de 150ms
    zoomDebounceRef.current = setTimeout(() => {
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
          
          // NUEVO: Usar sistema de persistencia mejorado
          simpleCamera.onUserZoom(finalScale.min, finalScale.max, (finalScale.min + finalScale.max) / 2);
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
        
        // CRÍTICO: Liberar bloqueo global después de un delay más corto
        setTimeout(() => {
          globalInteractionBlocked.current = false;
          logChart('ZOOM_GLOBAL_BLOCK_RELEASED');
        }, 50); // Reducido de 100ms a 50ms para mejor respuesta
      }, 50); // Reducido de 100ms a 50ms
    }, 100); // Reducido de 150ms a 100ms
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
      timeSinceLastPan: now - lastPanProcessedTime.current
    });
    
    // BLOQUEO GLOBAL: Evitar cualquier solapamiento entre zoom y pan
    if (globalInteractionBlocked.current) {
      logChart('PAN_EVENT_BLOCKED - global interaction blocked');
      return;
    }
    
    // THROTTLE ESPECÍFICO PARA PAN: Solo 1 evento cada 100ms (reducido)
    if (now - lastPanProcessedTime.current < 100) {
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
    
    // Debounce de 150ms
    panDebounceRef.current = setTimeout(() => {
      const preInteractionState = simpleCamera.getCurrentState();
      logUserInteractionDetailed('PAN_PROCESSING_START', {
        min: xScale.min,
        max: xScale.max,
        center: (xScale.min + xScale.max) / 2
      }, preInteractionState);
      
      // Notificar inicio de interacción inmediatamente
      startUserInteraction();
      
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
          
          // NUEVO: Usar sistema de persistencia mejorado
          simpleCamera.onUserPan(finalScale.min, finalScale.max, (finalScale.min + finalScale.max) / 2);
          simpleCamera.lockCamera(); // Bloquear la cámara en la nueva posición
        }
        endUserInteraction();
        
        // Liberar bloqueos después de completar
        isProcessingPan.current = false;
        
        // CRÍTICO: Liberar bloqueo global después de un delay más corto
        setTimeout(() => {
          globalInteractionBlocked.current = false;
          logChart('PAN_GLOBAL_BLOCK_RELEASED');
        }, 50); // Reducido de 100ms a 50ms para mejor respuesta
      }, 50); // Reducido de 100ms a 50ms
    }, 100); // Reducido de 150ms a 100ms
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
    if (Platform.OS !== 'web') {
      setStatus('Solo disponible en plataforma web');
      return;
    }

    try {
      setStatus('Cargando Chart.js...');

      // Importar Chart.js y plugins
      const ChartJS = await import('chart.js/auto');
      const Chart = ChartJS.default;
      const ChartFinancial = await import('chartjs-chart-financial');
      const zoomPlugin = await import('chartjs-plugin-zoom');

      try {
        await import('chartjs-adapter-date-fns');
      } catch (e) {
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

      if (!canvasRef.current) {
        setStatus('Error: Canvas no disponible');
        return;
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) {
        setStatus('Error: Context 2D no disponible');
        return;
      }

      setStatus('Creando gráfico...');

      // Destruir gráfico anterior si existe
      if (chartRef.current) {
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
      chartRef.current = new Chart(ctx, {
        type: 'candlestick',
        data: { datasets },
        options: chartOptions
      });

      setStatus(`✅ Gráfico listo (${candleData.length} velas)`);

    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      console.error('Error creando gráfico:', error);
    }
  }, [candleData, currentSymbol, currentInterval, isStreaming, activeIndicators, technicalIndicators, chartOptions, debouncedZoomHandler, debouncedPanHandler]);

  const updateChart = useCallback((newCandle: CandleData, isFinal: boolean) => {
    const startTime = Date.now();
    
    logTidalFlow('UPDATE_CHART_START', {
      newCandle: {
        timestamp: new Date(newCandle.x).toLocaleTimeString(),
        price: newCandle.c,
        isFinal
      },
      chartExists: !!chartRef.current
    });
    
    if (!chartRef.current) {
      logChart('UPDATE_CHART_ABORT - no chart reference');
      return;
    }

    // Throttle updates for better performance, except for final candles
    const now = Date.now();
    if (!isFinal && now - lastUpdateTime < updateThrottleMs) {
      logChart('UPDATE_CHART_THROTTLED', { 
        timeSinceLastUpdate: now - lastUpdateTime,
        threshold: updateThrottleMs 
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
    simpleCamera.applyViewportToChart(chart, desiredViewport);

    // E) chart.update('none') - sin animación para evitar saltos
    logTidalFlow('UPDATE_CHART_EXECUTE_UPDATE', {
      updateMode: 'none',
      chartUpdateStart: Date.now()
    });
    chart.update('none');

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logTiming('UPDATE_CHART_COMPLETE', duration, {
      isFinal,
      candlePrice: newCandle.c,
      finalViewport: desiredViewport
    });
  }, [currentInterval, simpleCamera, persistentViewport, lastUpdateTime, updateThrottleMs]);

  const changeTimeInterval = useCallback(async (newInterval: TimeInterval) => {
    setCurrentInterval(newInterval);
    setStatus('Cambiando intervalo...');

    try {
      // Desuscribirse del intervalo anterior
      if (isStreaming) {
        liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
      }

      // Cargar datos históricos para el nuevo intervalo
      const historicalData = await liveStreamingService.loadHistoricalData(currentSymbol, newInterval, 900);
      setCandleData(historicalData);

      // Suscribirse al nuevo intervalo
      if (isStreaming) {
        await liveStreamingService.subscribeToStream(currentSymbol, newInterval);
      }

    } catch (error: any) {
      console.error('Error cambiando intervalo:', error);
    }
  }, [currentSymbol, currentInterval, isStreaming]);

  const startStreaming = useCallback(async () => {
    if (isStreaming) {
      console.log('📊 Streaming ya está activo');
      return;
    }

    try {
      setStatus('Conectando streaming...');

      await liveStreamingService.subscribeToStream(currentSymbol, currentInterval);
      
      setIsStreaming(true);
      setStatus('✅ Streaming conectado');
    } catch (error: any) {
      console.error('Error iniciando streaming:', error);
      setStatus(`⚠️ Streaming en modo polling (WebSocket falló)`);
      setIsStreaming(true); // Aún funciona con polling
    }
  }, [currentSymbol, currentInterval, isStreaming]);

  const stopStreaming = useCallback(() => {
    liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
    setIsStreaming(false);
  }, [currentSymbol, currentInterval]);

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
        const historicalData = await liveStreamingService.loadHistoricalData(currentSymbol, currentInterval, 900);
        setCandleData(historicalData);
      } catch (error) {
        console.error('Error cargando datos iniciales:', error);
      }
    };

    loadInitialData();
  }, [currentSymbol, currentInterval]);

  useEffect(() => {
    if (candleData.length > 0) {
      initializeChart();
    }
  }, [candleData, initializeChart]);

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
        
        chart.scales.x.min = userState.min;
        chart.scales.x.max = userState.max;
        chart.update('none');
        initialViewportSet.current = true;
        
        logViewportState({ min: userState.min, max: userState.max }, 'USER_CONFIG_APPLIED');
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
        
        chart.scales.x.min = viewport.min;
        chart.scales.x.max = viewport.max;
        chart.update('none');
        initialViewportSet.current = true;
        
        logViewportState(viewport, 'INITIAL_VIEW_APPLIED');
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
