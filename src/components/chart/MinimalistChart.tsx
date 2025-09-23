import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { useMarket } from '../../context/AppContext';
import liveStreamingService, { CandleData, StreamUpdate, TimeInterval } from '../../services/liveStreamingService';
import { useTechnicalIndicators, addIndicatorToChart } from '../../hooks/useTechnicalIndicators';
import { useSimpleCamera } from '../../hooks/useSimpleCamera';

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

  const { selectedPair } = useMarket();
  const currentSymbol = symbol || selectedPair;

  // Callback estable para cambios de estado de cámara
  const onCameraStateChange = useCallback((cameraState: any) => {
    console.log('📷 [MinimalistChart] Simple camera state changed:', cameraState);
  }, []);

  // Sistema de cámara simple y predecible
  const simpleCamera = useSimpleCamera({
    defaultVisibleCandles: 100,
    // autoResetTimeMs eliminado - la cámara mantiene posición del usuario permanentemente
    onStateChange: onCameraStateChange,
  });

  // Calcular indicadores técnicos
  const technicalIndicators = useTechnicalIndicators(candleData);

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

      // Crear gráfico
      chartRef.current = new Chart(ctx, {
        type: 'candlestick',
        data: { datasets },
        options: {
          animation: {
            duration: 0  // Desactivar animaciones para mejor rendimiento en live
          },
          responsive: false,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: currentInterval.includes('m') ? 'minute' : 
                      currentInterval.includes('h') ? 'hour' : 'day',
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
                display: false  // Eliminar líneas de grid horizontales
              },
              border: {
                display: false  // Eliminar borde del eje
              },
              // CRÍTICO: Evitar reconfiguración automática del viewport
              bounds: 'data',
              // No auto-ajustar min/max cuando se agregan datos
              suggestedMin: undefined,
              suggestedMax: undefined,
              // Configuraciones adicionales para preservar viewport
              adapters: {
                date: {}
              },
              // Evitar que Chart.js haga auto-fitting
              offset: false
            },
            y: {
              type: 'linear',
              position: 'right',
              ticks: {
                color: '#ffffff',
                callback: function(value: any) {
                  return '$' + (value / 1000).toFixed(2) + 'k';
                }
              },
              grid: {
                display: false  // Eliminar líneas de grid verticales
              },
              border: {
                display: false  // Eliminar borde del eje
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
                mode: 'x',
                onZoom: function(context: any) {
                  // Callback cuando el usuario hace zoom - con nueva cámara simple
                  const chart = context.chart;
                  const xScale = chart.scales.x;
                  
                  if (!xScale || !chart.data.datasets[0]?.data) return;
                  
                  const now = Date.now();
                  if (now - lastUpdateTime < 200) return; // Throttle zoom events
                  setLastUpdateTime(now);
                  
                  console.log('� [ZOOM] Usuario inicia ZOOM - Datos del evento:', {
                    min: xScale.min,
                    max: xScale.max,
                    center: (xScale.min + xScale.max) / 2,
                    timestamp: new Date().toLocaleTimeString()
                  });
                  
                  // Notificar inicio de interacción
                  simpleCamera.onUserStartInteraction();
                  
                  // Timeout para evitar loops y capturar estado final
                  setTimeout(() => {
                    const finalScale = chart.scales.x;
                    if (finalScale) {
                      console.log('🔍 [ZOOM] Guardando estado final del zoom:', {
                        finalMin: finalScale.min,
                        finalMax: finalScale.max,
                        finalCenter: (finalScale.min + finalScale.max) / 2
                      });
                      simpleCamera.onUserZoom(finalScale.min, finalScale.max, (finalScale.min + finalScale.max) / 2);
                    }
                    simpleCamera.onUserEndInteraction();
                  }, 100);
                }
              },
              pan: {
                enabled: true,
                mode: 'x',
                onPan: function(context: any) {
                  // Callback cuando el usuario hace pan - con nueva cámara simple
                  const chart = context.chart;
                  const xScale = chart.scales.x;
                  
                  if (!xScale || !chart.data.datasets[0]?.data) return;
                  
                  const now = Date.now();
                  if (now - lastUpdateTime < 200) return; // Throttle pan events
                  setLastUpdateTime(now);
                  
                  console.log('� [PAN] Usuario inicia PAN - Datos del evento:', {
                    min: xScale.min,
                    max: xScale.max,
                    center: (xScale.min + xScale.max) / 2,
                    timestamp: new Date().toLocaleTimeString()
                  });
                  
                  // Notificar inicio de interacción
                  simpleCamera.onUserStartInteraction();
                  
                  // Timeout para evitar loops y capturar estado final
                  setTimeout(() => {
                    const finalScale = chart.scales.x;
                    if (finalScale) {
                      console.log('👆 [PAN] Guardando estado final del pan:', {
                        finalMin: finalScale.min,
                        finalMax: finalScale.max,
                        finalCenter: (finalScale.min + finalScale.max) / 2
                      });
                      simpleCamera.onUserPan(finalScale.min, finalScale.max, (finalScale.min + finalScale.max) / 2);
                    }
                    simpleCamera.onUserEndInteraction();
                  }, 100);
                }
              }
            }
          }
        }
      });

      setStatus(`✅ Gráfico listo (${candleData.length} velas)`);

    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      console.error('Error creando gráfico:', error);
    }
  }, [candleData, currentSymbol, currentInterval, isStreaming, activeIndicators, technicalIndicators]);

  const updateChart = useCallback((newCandle: CandleData, isFinal: boolean) => {
    // Obtener estado actual de la cámara al momento de la ejecución
    const currentCameraState = simpleCamera.getCurrentState();
    const shouldForceViewport = simpleCamera.shouldForceViewport();
    const forcedViewport = simpleCamera.getForcedViewport();
    
    console.log('🚀 [updateChart] INICIO - Nueva vela recibida:', { 
      timestamp: new Date().toLocaleTimeString(),
      price: newCandle.c,
      isFinal,
      shouldForceViewport,
      forcedViewport,
      cameraStateIsLocked: currentCameraState.isLocked,
      hasUserViewport: currentCameraState.chartJsState.min !== null && currentCameraState.chartJsState.max !== null
    });
    
    if (!chartRef.current) {
      console.log('❌ [updateChart] No hay chartRef disponible');
      return;
    }

    // Throttle updates for better performance, except for final candles
    const now = Date.now();
    if (!isFinal && now - lastUpdateTime < updateThrottleMs) {
      console.log('⏭️ [updateChart] Throttled - saltando update');
      return;
    }
    setLastUpdateTime(now);

    const chart = chartRef.current;
    const dataset = chart.data.datasets[0];

    if (dataset && dataset.data) {
      // CRÍTICO: Si debemos forzar el viewport, aplicarlo ANTES y DESPUÉS de cualquier manipulación
      if (shouldForceViewport && forcedViewport) {
        console.log('🔒 [updateChart] FORZANDO viewport del usuario ANTES de manipulación:', forcedViewport);
        
        // INTERCEPTAR: Bloquear Chart.js de cambiar el viewport modificando las opciones
        chart.options.scales!.x!.min = forcedViewport.min;
        chart.options.scales!.x!.max = forcedViewport.max;
        
        // BLOQUEAR autoscale y otros comportamientos automáticos
        if (chart.options.scales?.x) {
          chart.options.scales.x.type = 'linear';
          chart.options.scales.x.beginAtZero = false;
          chart.options.scales.x.suggestedMin = forcedViewport.min;
          chart.options.scales.x.suggestedMax = forcedViewport.max;
        }
        
        // Forzar en las escalas actuales también
        
        console.log('✅ [updateChart] Viewport bloqueado en opciones Y escalas');
        chart.scales.x.min = forcedViewport.min;
        chart.scales.x.max = forcedViewport.max;
      }
      
      // Buscar vela existente usando ventana de tiempo en lugar de timestamp exacto
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
        } else {
          // Buscar en las últimas 5 velas
          for (let i = Math.max(0, dataset.data.length - 5); i < dataset.data.length; i++) {
            const candle = dataset.data[i] as any;
            if (candle && Math.abs(candle.x - updateTimestamp) < intervalMs) {
              existingIndex = i;
              break;
            }
          }
        }
      }

      if (existingIndex >= 0) {
        // Actualizar vela existente
        const oldCandle = dataset.data[existingIndex] as any;
        dataset.data[existingIndex] = {
          x: newCandle.x,
          o: newCandle.o,
          h: newCandle.h,
          l: newCandle.l,
          c: newCandle.c
        };
        console.log(`[Chart] Updated candle at index ${existingIndex}: $${oldCandle?.c?.toFixed(4) || '?'} → $${newCandle.c.toFixed(4)} (${isFinal ? 'final' : 'live'})`);
      } else {
        // Agregar nueva vela
        dataset.data.push({
          x: newCandle.x,
          o: newCandle.o,
          h: newCandle.h,
          l: newCandle.l,
          c: newCandle.c
        });
        console.log(`[Chart] Added new candle: $${newCandle.c.toFixed(4)} at ${new Date(newCandle.x).toLocaleTimeString()}, total: ${dataset.data.length} (${isFinal ? 'final' : 'live'})`);

        // NO eliminar velas antiguas - mantener todo el historial para que el usuario pueda navegar
      }

      // Actualizar indicadores técnicos si están activos
      if (activeIndicators.size > 0) {
        updateTechnicalIndicators(chart);
      }

      // CRÍTICO: FORZAR VIEWPORT ANTES DEL CHART.UPDATE
      console.log('🔍 [updateChart] ANTES del chart.update:', {
        shouldForceViewport,
        forcedViewport,
        currentMin: chart.scales.x?.min,
        currentMax: chart.scales.x?.max
      });
      
      // BLOQUEO TOTAL: Deshabilitar zoom automático y pan durante update
      let originalZoomEnabled = false;
      let originalPanEnabled = false;
      if (shouldForceViewport && forcedViewport && chart.options.plugins?.zoom) {
        originalZoomEnabled = chart.options.plugins.zoom.zoom?.enabled || false;
        originalPanEnabled = chart.options.plugins.zoom.pan?.enabled || false;
        chart.options.plugins.zoom.zoom = { ...chart.options.plugins.zoom.zoom, enabled: false };
        chart.options.plugins.zoom.pan = { ...chart.options.plugins.zoom.pan, enabled: false };
        console.log('🚫 [updateChart] Zoom/Pan DESHABILITADO temporalmente');
      }
      
      // Chart.js update
      console.log('⚙️ [updateChart] Ejecutando chart.update("none")...');
      chart.update('none');
      console.log('✅ [updateChart] chart.update() completado');
      
      // RESTAURAR zoom/pan settings
      if (shouldForceViewport && forcedViewport && chart.options.plugins?.zoom) {
        chart.options.plugins.zoom.zoom = { ...chart.options.plugins.zoom.zoom, enabled: originalZoomEnabled };
        chart.options.plugins.zoom.pan = { ...chart.options.plugins.zoom.pan, enabled: originalPanEnabled };
        console.log('✅ [updateChart] Zoom/Pan RESTAURADO');
      }
      
      // CRÍTICO: FORZAR VIEWPORT DESPUÉS DEL CHART.UPDATE (SIEMPRE) + SEGUNDO UPDATE
      if (shouldForceViewport && forcedViewport) {
        const currentMin = chart.scales.x.min;
        const currentMax = chart.scales.x.max;
        
        // Verificar si Chart.js cambió el viewport
        const tolerance = 100; // Tolerancia en ms
        const minChanged = Math.abs(currentMin - forcedViewport.min) > tolerance;
        const maxChanged = Math.abs(currentMax - forcedViewport.max) > tolerance;
        
        if (minChanged || maxChanged) {
          console.log('⚠️ [MinimalistChart] Chart.js cambió viewport sin permiso - RESTAURANDO INMEDIATAMENTE');
          console.log('   Viewport forzado:', forcedViewport);
          console.log('   Viewport actual:', { currentMin, currentMax });
          console.log('   Diferencias:', { 
            minDiff: Math.abs(currentMin - forcedViewport.min), 
            maxDiff: Math.abs(currentMax - forcedViewport.max) 
          });
        }
        
        // FORZAR VIEWPORT Y HACER SEGUNDO UPDATE INMEDIATAMENTE
        chart.scales.x.min = forcedViewport.min;
        chart.scales.x.max = forcedViewport.max;
        
        // Deshabilitar zoom/pan para segundo update también
        if (chart.options.plugins?.zoom) {
          chart.options.plugins.zoom.zoom = { ...chart.options.plugins.zoom.zoom, enabled: false };
          chart.options.plugins.zoom.pan = { ...chart.options.plugins.zoom.pan, enabled: false };
        }
        
        console.log('🔄 [updateChart] Ejecutando SEGUNDO chart.update() para confirmar viewport...');
        chart.update('none');
        
        // Restaurar después del segundo update
        if (chart.options.plugins?.zoom) {
          chart.options.plugins.zoom.zoom = { ...chart.options.plugins.zoom.zoom, enabled: originalZoomEnabled };
          chart.options.plugins.zoom.pan = { ...chart.options.plugins.zoom.pan, enabled: originalPanEnabled };
        }
        
        console.log('🔒 [updateChart] Viewport DEFINITIVAMENTE FORZADO después de segundo update:', {
          finalMin: chart.scales.x.min,
          finalMax: chart.scales.x.max
        });
      } else {
        console.log('ℹ️ [updateChart] Usuario no ha interactuado - permitiendo comportamiento automático');
      }
      
      console.log('🏁 [updateChart] FIN - Proceso completado');
    }
  }, [activeIndicators.size, currentInterval]); // Removed simpleCamera dependency as we use getCurrentState()

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

  // HOOK CRÍTICO: Preservar viewport del usuario durante cualquier cambio en candleData
  useEffect(() => {
    console.log('🔄 [candleData Hook] Ejecutándose por cambio en candleData:', {
      candleCount: candleData.length,
      isLocked: simpleCamera.isLocked(),
      userState: simpleCamera.state.chartJsState
    });
    
    const currentCameraState = simpleCamera.getCurrentState();
    const isUserLocked = currentCameraState.isLocked && 
                        currentCameraState.chartJsState.min !== null && 
                        currentCameraState.chartJsState.max !== null;
    
    if (!chartRef.current || !isUserLocked) {
      console.log('⏭️ [candleData Hook] Saltando - sin chart o usuario no ha interactuado');
      return;
    }
    
    const chart = chartRef.current;
    const userState = currentCameraState.chartJsState;
    
    // Si el usuario tiene un viewport configurado, asegurarse de que se mantenga
    if (userState.min !== null && userState.max !== null) {
      const currentMin = chart.scales.x?.min;
      const currentMax = chart.scales.x?.max;
      
      console.log('🔍 [candleData Hook] Comparando viewports:', {
        userMin: userState.min,
        userMax: userState.max,
        currentMin,
        currentMax,
        needsUpdate: Math.abs(currentMin - userState.min) > 100 || Math.abs(currentMax - userState.max) > 100
      });
      
      // Solo actualizar si hay diferencia significativa para evitar loops
      const minDiff = Math.abs(currentMin - userState.min);
      const maxDiff = Math.abs(currentMax - userState.max);
      const tolerance = 100; // Tolerancia en ms
      
      if (minDiff > tolerance || maxDiff > tolerance) {
        console.log('🔒 [MinimalistChart] Forzando viewport del usuario durante cambio de candleData');
        console.log('   Diferencias:', { minDiff, maxDiff, tolerance });
        chart.scales.x.min = userState.min;
        chart.scales.x.max = userState.max;
        chart.update('none');
        console.log('✅ [candleData Hook] Viewport forzado aplicado:', { min: userState.min, max: userState.max });
      } else {
        console.log('✅ [candleData Hook] Viewport ya está correcto');
      }
    } else {
      console.log('ℹ️ [candleData Hook] Usuario no tiene viewport configurado');
    }
  }, [candleData.length, simpleCamera.state.chartJsState.min, simpleCamera.state.chartJsState.max]);

  useEffect(() => {
    const handleCandleUpdate = (update: StreamUpdate) => {
      console.log('📈 [handleCandleUpdate] NUEVA ACTUALIZACIÓN RECIBIDA:', {
        symbol: update.symbol,
        interval: update.interval,
        isFinal: update.isFinal,
        price: update.candle.c,
        timestamp: new Date().toLocaleTimeString(),
        matchesCurrentChart: update.symbol === currentSymbol && update.interval === currentInterval
      });
      
      if (update.symbol === currentSymbol && update.interval === currentInterval) {
        console.log(`[MinimalistChart] Candle update: ${update.symbol} ${update.interval} final:${update.isFinal} price:${update.candle.c}`);
        
        console.log('🎯 [handleCandleUpdate] Llamando updateChart...');
        updateChart(update.candle, update.isFinal);
        
        // NO desbloquear la cámara después de nuevas velas
        // La cámara debe quedarse EXACTAMENTE donde el usuario la dejó
        const currentCameraState = simpleCamera.getCurrentState();
        if (currentCameraState.isLocked) {
          console.log(`[MinimalistChart] Nueva vela - cámara BLOQUEADA por usuario, manteniendo posición fija`);
          console.log(`[MinimalistChart] Estado de cámara actual:`, {
            isLocked: currentCameraState.isLocked,
            lastUserAction: currentCameraState.lastUserAction,
            chartJsState: currentCameraState.chartJsState
          });
        } else {
          console.log(`[MinimalistChart] Nueva vela - modo automático (solo al inicio)`);
        }
        
        console.log('📊 [handleCandleUpdate] Actualizando candleData state...');
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
            console.log(`[MinimalistChart] Updated existing candle at index ${existingIndex}: $${oldPrice.toFixed(4)} → $${update.candle.c.toFixed(4)} (${update.isFinal ? 'final' : 'live'})`);
          } else {
            // Agregar nueva vela
            newData.push(update.candle);
            console.log(`[MinimalistChart] Added new candle: $${update.candle.c.toFixed(4)} at ${new Date(update.candle.x).toLocaleTimeString()}, total: ${newData.length} (${update.isFinal ? 'final' : 'live'})`);
            
            // Mantener solo las últimas velas según configuración de cámara
            const maxCandles = simpleCamera.isLocked() ? 200 : 100;
            if (newData.length > maxCandles) {
              newData.shift();
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
  }, [currentSymbol, currentInterval]); // Solo dependencias que realmente importan

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

  // Configuración inicial del viewport SOLO al cargar por primera vez (reload)
  useEffect(() => {
    console.log('🎬 [Viewport Inicial] Hook ejecutándose:', {
      hasChart: !!chartRef.current,
      candleCount: candleData.length,
      initialViewportSet: initialViewportSet.current,
      isLocked: simpleCamera.isLocked()
    });
    
    if (!chartRef.current || candleData.length === 0 || initialViewportSet.current) {
      console.log('⏭️ [Viewport Inicial] Saltando configuración inicial');
      return;
    }
    
    const chart = chartRef.current;
    
    // Verificar si hay configuración guardada del usuario
    if (simpleCamera.isLocked()) {
      const userState = simpleCamera.state.chartJsState;
      console.log('👤 [Viewport Inicial] Usuario tiene configuración guardada:', userState);
      
      if (chart.scales.x && userState.min !== null && userState.max !== null) {
        console.log('🔧 [Viewport Inicial] Aplicando configuración del usuario...');
        chart.scales.x.min = userState.min;
        chart.scales.x.max = userState.max;
        chart.update('none');
        initialViewportSet.current = true;
        console.log('✅ [Viewport Inicial] Configuración del usuario aplicada:', userState);
        return;
      }
    }
    
    // Solo si NO hay configuración del usuario, aplicar vista inicial de últimas 100 velas
    console.log('🏠 [Viewport Inicial] Aplicando vista automática inicial...');
    const viewport = simpleCamera.getRecommendedViewport(candleData.length, candleData);
    console.log('📊 [Viewport Inicial] Viewport recomendado:', viewport);
    
    if (chart.scales.x && viewport.min && viewport.max) {
      // PRIMERA configuración inicial - esto debe quedar fijo hasta que el usuario interactúe
      console.log('⚙️ [Viewport Inicial] Configurando scales...');
      chart.scales.x.min = viewport.min;
      chart.scales.x.max = viewport.max;
      chart.update('none');
      initialViewportSet.current = true;
      console.log(`✅ [Viewport Inicial] Vista inicial aplicada:`, { min: viewport.min, max: viewport.max });
    } else {
      console.log('❌ [Viewport Inicial] No se pudo aplicar viewport - datos faltantes');
    }
  }, [candleData.length === 0 ? 0 : 1]); // Solo se ejecuta UNA VEZ cuando candleData pasa de vacío a tener datos

  // Ref para rastrear la última configuración aplicada y evitar repeticiones
  const lastAppliedConfigRef = useRef<{min: number | null, max: number | null}>({min: null, max: null});

  // DESHABILITADO: Gestionar configuración de cámara automática
  // Chart.js mantiene automáticamente el viewport del usuario sin nuestra intervención
  /*
  useEffect(() => {
    if (!chartRef.current || candleData.length === 0) return;
    
    const chart = chartRef.current;
    
    // SOLO aplicar si el usuario ha interactuado y tenemos configuración guardada
    if (simpleCamera.isLocked()) {
      const userState = simpleCamera.state.chartJsState;
      if (chart.scales.x && userState.min !== null && userState.max !== null) {
        const currentMin = chart.scales.x.min || 0;
        const currentMax = chart.scales.x.max || 0;
        
        // Verificar si ya aplicamos esta configuración recientemente
        const lastApplied = lastAppliedConfigRef.current;
        const sameAsLast = lastApplied.min === userState.min && lastApplied.max === userState.max;
        
        if (sameAsLast) {
          // Ya aplicamos esta configuración, no hacerlo de nuevo
          return;
        }
        
        // Solo actualizar si hay diferencia significativa para evitar loops
        const minDiff = Math.abs(currentMin - userState.min);
        const maxDiff = Math.abs(currentMax - userState.max);
        
        if (minDiff > 1000 || maxDiff > 1000) {
          // Debounce para evitar aplicaciones repetitivas
          const timeoutId = setTimeout(() => {
            if (chartRef.current && chartRef.current.scales.x) {
              chartRef.current.scales.x.min = userState.min;
              chartRef.current.scales.x.max = userState.max;
              chartRef.current.update('none');
              
              // Recordar la última configuración aplicada
              lastAppliedConfigRef.current = {min: userState.min, max: userState.max};
              
              console.log('📷 [MinimalistChart] Aplicando configuración del usuario (debounced):', userState);
            }
          }, 50);
          
          return () => clearTimeout(timeoutId);
        }
      }
    }
    // NO hacer nada si el usuario no ha interactuado - dejar que Chart.js mantenga su vista actual
  }, [simpleCamera.state.lastUserAction, simpleCamera.state.chartJsState.min, simpleCamera.state.chartJsState.max]); // Reducir dependencias
  */

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
                  initialViewportSet.current = false; // Reset flag para permitir nuevo viewport inicial
                  simpleCamera.resetToLatest();
                  // El gráfico se reiniciará automáticamente con el próximo useEffect
                }}
              >
                <Text style={styles.indicatorButtonText}>
                  {simpleCamera.isLocked() ? '📷 Reset' : '📷 100'}
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
