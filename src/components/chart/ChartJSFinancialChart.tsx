import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { CandleData } from '../../services/binanceService';
import ChartJSWebDirect from './ChartJSWebDirect';

const { width: screenWidth } = Dimensions.get('window');

interface ChartJSFinancialChartProps {
  candles: CandleData[];
  symbol: string;
  isStreaming: boolean;
  lastCandle?: CandleData;
  onZoom?: (zoomLevel: number) => void;
  onPan?: (panX: number, panY: number) => void;
  onWebViewReady?: (webViewRef: any) => void;
  height?: number;
  showVolume?: boolean;
  enableControls?: boolean;
}

export const ChartJSFinancialChart: React.FC<ChartJSFinancialChartProps> = ({
  candles,
  symbol,
  isStreaming,
  lastCandle,
  onZoom,
  onPan,
  onWebViewReady,
  height = 500,
  showVolume = true,
  enableControls = true,
}) => {
  const webViewRef = useRef<WebView>(null);

  // Notificar cuando el WebView esté listo
  useEffect(() => {
    console.log('🚀 ChartJSFinancialChart: Component mounted');
    if (webViewRef.current && onWebViewReady) {
      onWebViewReady(webViewRef.current);
      console.log('📊 ChartJSFinancialChart: WebView ready');
    }
  }, [onWebViewReady]);

  // Preparar datos para Chart.js Financial
  const chartData = useMemo(() => {
    console.log(`📈 ChartJSFinancialChart: Processing ${candles.length} candles for ${symbol}`);
    
    if (!candles || candles.length === 0) {
      console.warn('⚠️ No candles data available for chart');
      return {
        candleData: [],
        volumeData: [],
        lastPrice: 0,
        symbol,
      };
    }

    // ✅ FORZAR LÍMITE DE 900 VELAS - Siempre mostrar las últimas 900
    const maxCandles = 900;
    const limitedCandles = candles.length > maxCandles ? candles.slice(-maxCandles) : candles;
    
    console.log(`📊 Chart data limited: ${candles.length} → ${limitedCandles.length} candles (max: ${maxCandles})`);

    const candleData = limitedCandles.map((candle, index) => {
      // Validate candle data
      if (!candle || typeof candle.open !== 'number' || typeof candle.close !== 'number') {
        console.warn(`⚠️ Invalid candle at index ${index}:`, candle);
        return null;
      }

      // Ensure OHLC values are valid numbers
      const open = Number(candle.open);
      const high = Number(candle.high);
      const low = Number(candle.low);
      const close = Number(candle.close);

      if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
        console.warn(`⚠️ NaN values in candle at index ${index}:`, { open, high, low, close });
        return null;
      }

      // Ensure proper OHLC relationships
      const correctedHigh = Math.max(open, high, low, close);
      const correctedLow = Math.min(open, high, low, close);

      return {
        x: new Date(candle.timestamp).getTime(), // Use timestamp as number for better performance
        o: open,
        h: correctedHigh,
        l: correctedLow,
        c: close,
      };
    }).filter(Boolean); // Remove null entries

    const volumeData = showVolume ? limitedCandles.map((candle, index) => {
      if (!candle) return null;
      const volume = Number(candle.volume);
      if (isNaN(volume)) return null;

      return {
        x: new Date(candle.timestamp).getTime(),
        y: Math.max(0, volume), // Ensure volume is not negative
      };
    }).filter(Boolean) : [];

    const lastPrice = lastCandle?.close || (limitedCandles.length > 0 ? limitedCandles[limitedCandles.length - 1].close : 0);

    console.log(`✅ ChartJSFinancialChart: Processed ${candleData.length} valid candles (limited to ${maxCandles})`);
    
    return {
      candleData,
      volumeData,
      lastPrice: Number(lastPrice),
      symbol,
      totalCandles: candles.length, // Original count for reference
      displayedCandles: candleData.length, // Actually displayed
    };
  }, [candles, showVolume, lastCandle, symbol]);

  // HTML con Chart.js Financial completo
  const chartHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-chart-financial@0.2.1/dist/chartjs-chart-financial.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
        <style>
            body {
                margin: 0;
                padding: 0;
                background: #0f0f0f;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            }
            #chartContainer {
                width: 100vw;
                height: 100vh;
                position: relative;
                background: #0f0f0f;
            }
            #mainChart {
                height: ${showVolume ? '70%' : '100%'};
            }
            #volumeChart {
                height: 30%;
                display: ${showVolume ? 'block' : 'none'};
            }
            .chart-controls {
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                padding: 8px;
                border-radius: 4px;
                display: ${enableControls ? 'flex' : 'none'};
                gap: 5px;
                z-index: 1000;
            }
            .control-btn {
                background: #333;
                border: none;
                color: #fff;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
            }
            .control-btn:hover {
                background: #555;
            }
            .status-indicator {
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.8);
                padding: 5px 10px;
                border-radius: 4px;
                color: #fff;
                font-size: 12px;
                z-index: 1000;
            }
            .streaming {
                color: #00ff88;
            }
            .paused {
                color: #ff4444;
            }
        </style>
    </head>
    <body>
        <div id="chartContainer">
            <div class="status-indicator">
                <span id="statusText">Cargando...</span>
            </div>
            
            <div class="chart-controls">
                <button class="control-btn" onclick="resetZoom()">🔄 Reset</button>
                <button class="control-btn" onclick="resetCamera()">📷 Camera</button>
                <button class="control-btn" onclick="lockCamera()">🔒 Lock</button>
                <button class="control-btn" onclick="autoFitChart()">📏 Auto</button>
                <button class="control-btn" onclick="zoomIn()">🔍+</button>
                <button class="control-btn" onclick="zoomOut()">🔍-</button>
                <button class="control-btn" onclick="panLeft()">⬅️</button>
                <button class="control-btn" onclick="panRight()">➡️</button>
                <button class="control-btn" onclick="goToLatest()">⏭️ Último</button>
                <button class="control-btn" onclick="toggleVolume()">📊 Vol</button>
            </div>
            
            <canvas id="mainChart"></canvas>
            <canvas id="volumeChart"></canvas>
        </div>

        <script>
            // Register Chart.js Financial components
            Chart.register(
                ChartFinancial.CandlestickController,
                ChartFinancial.CandlestickElement,
                ChartFinancial.OhlcController,
                ChartFinancial.OhlcElement,
                ChartAnnotation,
                ChartZoom
            );

            let mainChart, volumeChart;
            let currentData = { candleData: [], volumeData: [], lastPrice: 0, symbol: '' };
            let showVolumeChart = ${showVolume};
            let enableControlsFlag = ${enableControls};

            // Configuración base del gráfico principal
            const mainConfig = {
                type: 'candlestick',
                data: {
                    datasets: [{
                        label: \`\${currentData.symbol} Price\`,
                        data: [],
                        borderColor: {
                            up: '#00ff88',
                            down: '#ff4444',
                            unchanged: '#888888',
                        },
                        backgroundColor: {
                            up: 'rgba(0, 255, 136, 0.2)',
                            down: 'rgba(255, 68, 68, 0.2)',
                            unchanged: 'rgba(136, 136, 136, 0.2)',
                        },
                        borderWidth: 2,
                        barThickness: 'flex',
                        maxBarThickness: 16,
                        minBarLength: 1,
                        borderSkipped: false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'minute',
                                displayFormats: {
                                    minute: 'HH:mm',
                                    hour: 'HH:mm',
                                    day: 'MMM dd'
                                }
                            },
                            adapters: {
                                date: {
                                    zone: 'UTC'
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                lineWidth: 0.5
                            },
                            ticks: {
                                color: '#e0e0e0',
                                maxTicksLimit: 12,
                                autoSkip: true,
                                source: 'data',
                                font: {
                                    size: 11,
                                    family: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
                                },
                                padding: 8
                            },
                            border: {
                                color: '#333'
                            }
                        },
                        y: {
                            type: 'linear',
                            position: 'right',
                            beginAtZero: false,
                            grace: '5%', // Añade 5% de margen arriba y abajo
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                lineWidth: 0.5
                            },
                            ticks: {
                                color: '#e0e0e0',
                                maxTicksLimit: 10,
                                font: {
                                    size: 11,
                                    family: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                                    weight: '500'
                                },
                                padding: 12,
                                callback: function(value) {
                                    const num = Number(value);
                                    if (num >= 1000000) {
                                        return '$' + (num / 1000000).toFixed(2) + 'M';
                                    } else if (num >= 100000) {
                                        return '$' + (num / 1000).toFixed(0) + 'K';
                                    } else if (num >= 10000) {
                                        return '$' + (num / 1000).toFixed(1) + 'K';
                                    } else if (num >= 1000) {
                                        return '$' + (num / 1000).toFixed(2) + 'K';
                                    } else if (num >= 100) {
                                        return '$' + num.toFixed(0);
                                    } else if (num >= 10) {
                                        return '$' + num.toFixed(1);
                                    } else {
                                        return '$' + num.toFixed(2);
                                    }
                                }
                            },
                            border: {
                                color: '#333'
                            },
                            // Configuración automática de rango basada en datos
                            afterDataLimits: function(scale) {
                                if (currentData.candleData && currentData.candleData.length > 0) {
                                    const prices = currentData.candleData.flatMap(candle => [candle.h, candle.l]);
                                    const minPrice = Math.min(...prices);
                                    const maxPrice = Math.max(...prices);
                                    const range = maxPrice - minPrice;
                                    const padding = range * 0.1; // 10% padding
                                    
                                    scale.min = Math.max(0, minPrice - padding);
                                    scale.max = maxPrice + padding;
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#333',
                            borderWidth: 1,
                            displayColors: false,
                            callbacks: {
                                title: function(context) {
                                    const date = new Date(context[0].parsed.x);
                                    return date.toLocaleString();
                                },
                                label: function(context) {
                                    const data = context.raw;
                                    return [
                                        \`Open: $\${data.o.toLocaleString()}\`,
                                        \`High: $\${data.h.toLocaleString()}\`,
                                        \`Low: $\${data.l.toLocaleString()}\`,
                                        \`Close: $\${data.c.toLocaleString()}\`
                                    ];
                                }
                            }
                        },
                        annotation: {
                            annotations: {}
                        },
                        zoom: {
                            pan: {
                                enabled: enableControlsFlag,
                                mode: 'x',
                                threshold: 10,
                                speed: 20,
                                onPanStart: function(context) {
                                    console.log('🔄 Paneo iniciado');
                                },
                                onPan: function(context) {
                                    const chart = context.chart;
                                    const xScale = chart.scales.x;
                                    console.log('🔄 Paneo en progreso:', {
                                        center: new Date((xScale.min + xScale.max) / 2).toLocaleTimeString()
                                    });
                                },
                                onPanComplete: function(context) {
                                    const chart = context.chart;
                                    const xScale = chart.scales.x;
                                    const panX = (xScale.min + xScale.max) / 2;
                                    const totalRange = currentData.candleData.length > 0 ? 
                                        (currentData.candleData[currentData.candleData.length - 1].x - currentData.candleData[0].x) : 1;
                                    const position = (panX - (currentData.candleData[0]?.x || 0)) / totalRange;
                                    
                                    console.log('🔄 Paneo completado:', {
                                        center: new Date(panX).toLocaleTimeString(),
                                        position: (position * 100).toFixed(1) + '%'
                                    });
                                    
                                    sendMessageToRN({ 
                                        type: 'PAN', 
                                        panX: panX,
                                        position: position,
                                        center: panX
                                    });
                                }
                            },
                            zoom: {
                                wheel: {
                                    enabled: enableControlsFlag,
                                    speed: 0.1,
                                    modifierKey: null,
                                },
                                pinch: {
                                    enabled: enableControlsFlag
                                },
                                mode: 'x',
                                limits: {
                                    x: {
                                        min: 'original',
                                        max: 'original'
                                    }
                                },
                                onZoomStart: function(context) {
                                    console.log('🔍 Zoom iniciado');
                                },
                                onZoom: function(context) {
                                    const chart = context.chart;
                                    const xScale = chart.scales.x;
                                    console.log('🔍 Zoom en progreso:', {
                                        min: new Date(xScale.min).toLocaleTimeString(),
                                        max: new Date(xScale.max).toLocaleTimeString()
                                    });
                                },
                                onZoomComplete: function(context) {
                                    const chart = context.chart;
                                    const xScale = chart.scales.x;
                                    const totalRange = currentData.candleData.length > 0 ? 
                                        (currentData.candleData[currentData.candleData.length - 1].x - currentData.candleData[0].x) : 1;
                                    const visibleRange = xScale.max - xScale.min;
                                    const zoomLevel = totalRange / visibleRange;
                                    
                                    console.log('🔍 Zoom completado:', {
                                        zoomLevel: zoomLevel.toFixed(2),
                                        visibleCandles: Math.floor(visibleRange / (1000 * 60)), // Aproximado en minutos
                                        totalCandles: currentData.candleData.length
                                    });
                                    
                                    sendMessageToRN({ 
                                        type: 'ZOOM', 
                                        zoomLevel: zoomLevel,
                                        visibleRange: visibleRange,
                                        totalRange: totalRange
                                    });
                                }
                            }
                            }
                        }
                    },
                    animation: {
                        duration: 0 // Sin animación para mejor performance en streaming
                    },
                    elements: {
                        point: {
                            radius: 0
                        }
                    }
                }
            };

            // Configuración del gráfico de volumen
            const volumeConfig = {
                type: 'bar',
                data: {
                    datasets: [{
                        label: 'Volume',
                        data: [],
                        backgroundColor: function(context) {
                            const index = context.dataIndex;
                            const candleData = currentData.candleData[index];
                            if (!candleData) return 'rgba(153, 153, 153, 0.3)';
                            return candleData.c >= candleData.o ? 
                                'rgba(0, 255, 136, 0.3)' : 'rgba(255, 68, 68, 0.3)';
                        },
                        borderColor: function(context) {
                            const index = context.dataIndex;
                            const candleData = currentData.candleData[index];
                            if (!candleData) return '#999';
                            return candleData.c >= candleData.o ? '#00ff88' : '#ff4444';
                        },
                        borderWidth: 0.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'minute'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                lineWidth: 0.5
                            },
                            ticks: {
                                display: false
                            },
                            border: {
                                color: '#333'
                            }
                        },
                        y: {
                            type: 'linear',
                            position: 'right',
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                lineWidth: 0.5
                            },
                            ticks: {
                                color: '#888',
                                callback: function(value) {
                                    if (value >= 1000000) {
                                        return (value / 1000000).toFixed(1) + 'M';
                                    } else if (value >= 1000) {
                                        return (value / 1000).toFixed(1) + 'K';
                                    }
                                    return value.toFixed(0);
                                }
                            },
                            border: {
                                color: '#333'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#333',
                            borderWidth: 1,
                            displayColors: false,
                            callbacks: {
                                title: function(context) {
                                    const date = new Date(context[0].parsed.x);
                                    return date.toLocaleString();
                                },
                                label: function(context) {
                                    return \`Volume: \${context.parsed.y.toLocaleString()}\`;
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 0
                    }
                }
            };

            // Funciones de control
            // Variables de estado de cámara
            let cameraState = {
                isLocked: false,
                followLatest: true,
                userZoomLevel: 1.0,
                userCenterX: null,
                lastManualAdjustment: null,
                isUserInteracting: false,  // Nuevo: indica si el usuario está interactuando
                temporaryPosition: null    // Nuevo: posición temporal durante interacción
            };

            function resetCamera() {
                console.log('📷 Reset Camera - volviendo a las últimas velas');
                cameraState.followLatest = true;
                cameraState.isLocked = false;
                cameraState.userZoomLevel = 1.0;
                cameraState.userCenterX = null;
                cameraState.lastManualAdjustment = null;
                
                goToLatest();
                
                sendMessageToRN({ 
                    type: 'CAMERA_RESET',
                    followLatest: true
                });
            }

            function lockCamera() {
                console.log('📷 Bloqueando cámara en posición actual');
                cameraState.isLocked = true;
                cameraState.followLatest = false;
                
                if (mainChart) {
                    const xScale = mainChart.scales.x;
                    cameraState.userCenterX = (xScale.min + xScale.max) / 2;
                    const totalRange = currentData.candleData.length > 0 ? 
                        (currentData.candleData[currentData.candleData.length - 1].x - currentData.candleData[0].x) : 1;
                    const visibleRange = xScale.max - xScale.min;
                    cameraState.userZoomLevel = totalRange / visibleRange;
                }
                
                sendMessageToRN({ 
                    type: 'CAMERA_LOCKED',
                    isLocked: true,
                    centerX: cameraState.userCenterX,
                    zoomLevel: cameraState.userZoomLevel
                });
            }

            function startUserInteraction() {
                console.log('👆 User interaction started in Chart.js');
                cameraState.isUserInteracting = true;
                cameraState.followLatest = false; // Parar auto-follow durante interacción
                
                // Guardar la posición actual como base
                if (mainChart) {
                    const xScale = mainChart.scales.x;
                    cameraState.temporaryPosition = {
                        centerX: (xScale.min + xScale.max) / 2,
                        zoomLevel: cameraState.userZoomLevel,
                        min: xScale.min,
                        max: xScale.max
                    };
                }
                
                sendMessageToRN({ 
                    type: 'USER_INTERACTION_STARTED',
                    isInteracting: true
                });
            }

            function endUserInteraction() {
                console.log('✋ User interaction ended in Chart.js - fixing position');
                cameraState.isUserInteracting = false;
                
                // Fijar la posición temporal como permanente
                if (cameraState.temporaryPosition) {
                    cameraState.userCenterX = cameraState.temporaryPosition.centerX;
                    cameraState.userZoomLevel = cameraState.temporaryPosition.zoomLevel;
                    cameraState.isLocked = true; // Bloquear en la posición final
                    cameraState.followLatest = false;
                }
                
                cameraState.temporaryPosition = null;
                
                sendMessageToRN({ 
                    type: 'USER_INTERACTION_ENDED',
                    isInteracting: false,
                    isLocked: true,
                    centerX: cameraState.userCenterX,
                    zoomLevel: cameraState.userZoomLevel
                });
            }

            function setTemporaryPosition(centerX, zoomLevel) {
                if (!cameraState.isUserInteracting) return;
                
                console.log('📷 Setting temporary position during interaction:', { centerX, zoomLevel });
                
                cameraState.temporaryPosition = {
                    centerX,
                    zoomLevel,
                    timestamp: Date.now()
                };
                
                // Aplicar la posición temporal inmediatamente para retroalimentación visual
                if (mainChart && currentData.candleData.length > 0) {
                    const totalRange = currentData.candleData[currentData.candleData.length - 1].x - currentData.candleData[0].x;
                    const visibleRange = totalRange / zoomLevel;
                    const newMin = centerX - visibleRange / 2;
                    const newMax = centerX + visibleRange / 2;
                    
                    mainChart.options.scales.x.min = newMin;
                    mainChart.options.scales.x.max = newMax;
                    mainChart.update('none'); // Update sin animación para fluidez
                    
                    if (volumeChart) {
                        volumeChart.options.scales.x.min = newMin;
                        volumeChart.options.scales.x.max = newMax;
                        volumeChart.update('none');
                    }
                }
                
                sendMessageToRN({ 
                    type: 'TEMPORARY_POSITION_SET',
                    centerX,
                    zoomLevel
                });
            }

            function setCameraToLatest() {
                console.log('📷 Configurando cámara para seguir últimas velas');
                if (cameraState.isLocked) {
                    console.log('📷 Cámara bloqueada - ignorando comando');
                    return;
                }
                
                cameraState.followLatest = true;
                
                if (mainChart && currentData.candleData.length > 0) {
                    // Configurar para mostrar las últimas velas respetando el zoom del usuario
                    const candles = currentData.candleData;
                    const candleCount = candles.length;
                    const visibleCandleCount = Math.min(50, Math.floor(candleCount / cameraState.userZoomLevel));
                    
                    const endIndex = candleCount;
                    const startIndex = Math.max(0, endIndex - visibleCandleCount);
                    
                    const startTime = candles[startIndex].x;
                    const endTime = candles[endIndex - 1].x;
                    const padding = (endTime - startTime) * 0.02;
                    
                    mainChart.options.scales.x.min = startTime - padding;
                    mainChart.options.scales.x.max = endTime + padding;
                    mainChart.update('none');
                    
                    if (volumeChart) {
                        volumeChart.options.scales.x.min = mainChart.options.scales.x.min;
                        volumeChart.options.scales.x.max = mainChart.options.scales.x.max;
                        volumeChart.update('none');
                    }
                }
                
                sendMessageToRN({ 
                    type: 'CAMERA_FOLLOWING_LATEST',
                    followLatest: true
                });
            }

            function adjustCameraAfterUpdate() {
                console.log('📷 Ajustando cámara después de actualización de vela');
                
                // Si la cámara está bloqueada, no hacer nada
                if (cameraState.isLocked) {
                    console.log('📷 Cámara bloqueada - manteniendo posición');
                    return;
                }
                
                // Si debe seguir las últimas velas
                if (cameraState.followLatest) {
                    setCameraToLatest();
                } else if (cameraState.userCenterX) {
                    // Mantener la posición del usuario pero actualizar los datos
                    const currentRange = mainChart.scales.x.max - mainChart.scales.x.min;
                    const newMin = cameraState.userCenterX - currentRange / 2;
                    const newMax = cameraState.userCenterX + currentRange / 2;
                    
                    mainChart.options.scales.x.min = newMin;
                    mainChart.options.scales.x.max = newMax;
                    mainChart.update('none');
                    
                    if (volumeChart) {
                        volumeChart.options.scales.x.min = newMin;
                        volumeChart.options.scales.x.max = newMax;
                        volumeChart.update('none');
                    }
                }
            }
                if (mainChart) {
                    mainChart.resetZoom();
                }
                if (volumeChart) {
                    volumeChart.resetZoom();
                }
                sendMessageToRN({ type: 'RESET_ZOOM' });
            }

            function zoomIn() {
                console.log('🔍+ Zoom In iniciado');
                if (mainChart) {
                    const xScale = mainChart.scales.x;
                    const center = (xScale.min + xScale.max) / 2;
                    const currentRange = xScale.max - xScale.min;
                    const newRange = currentRange * 0.75; // Zoom más preciso
                    
                    const newMin = center - newRange / 2;
                    const newMax = center + newRange / 2;
                    
                    // Asegurar que no excedamos los límites de datos
                    if (currentData.candleData.length > 0) {
                        const dataMin = currentData.candleData[0].x;
                        const dataMax = currentData.candleData[currentData.candleData.length - 1].x;
                        
                        mainChart.options.scales.x.min = Math.max(newMin, dataMin);
                        mainChart.options.scales.x.max = Math.min(newMax, dataMax);
                    } else {
                        mainChart.options.scales.x.min = newMin;
                        mainChart.options.scales.x.max = newMax;
                    }
                    
                    mainChart.update('none');
                    console.log('🔍+ Zoom In completado - nuevo rango:', {
                        min: new Date(mainChart.options.scales.x.min).toLocaleTimeString(),
                        max: new Date(mainChart.options.scales.x.max).toLocaleTimeString()
                    });
                }
                if (volumeChart) {
                    volumeChart.options.scales.x.min = mainChart.options.scales.x.min;
                    volumeChart.options.scales.x.max = mainChart.options.scales.x.max;
                    volumeChart.update('none');
                }
                
                sendMessageToRN({ 
                    type: 'ZOOM_IN', 
                    newRange: mainChart?.options.scales.x.max - mainChart?.options.scales.x.min 
                });
            }

            function zoomOut() {
                console.log('🔍- Zoom Out iniciado');
                if (mainChart) {
                    const xScale = mainChart.scales.x;
                    const center = (xScale.min + xScale.max) / 2;
                    const currentRange = xScale.max - xScale.min;
                    const newRange = currentRange * 1.33; // Zoom más preciso
                    
                    const newMin = center - newRange / 2;
                    const newMax = center + newRange / 2;
                    
                    // Asegurar que no excedamos los límites de datos
                    if (currentData.candleData.length > 0) {
                        const dataMin = currentData.candleData[0].x;
                        const dataMax = currentData.candleData[currentData.candleData.length - 1].x;
                        
                        mainChart.options.scales.x.min = Math.max(newMin, dataMin - (dataMax - dataMin) * 0.05);
                        mainChart.options.scales.x.max = Math.min(newMax, dataMax + (dataMax - dataMin) * 0.05);
                    } else {
                        mainChart.options.scales.x.min = newMin;
                        mainChart.options.scales.x.max = newMax;
                    }
                    
                    mainChart.update('none');
                    console.log('🔍- Zoom Out completado - nuevo rango:', {
                        min: new Date(mainChart.options.scales.x.min).toLocaleTimeString(),
                        max: new Date(mainChart.options.scales.x.max).toLocaleTimeString()
                    });
                }
                if (volumeChart) {
                    volumeChart.options.scales.x.min = mainChart.options.scales.x.min;
                    volumeChart.options.scales.x.max = mainChart.options.scales.x.max;
                    volumeChart.update('none');
                }
                
                sendMessageToRN({ 
                    type: 'ZOOM_OUT', 
                    newRange: mainChart?.options.scales.x.max - mainChart?.options.scales.x.min 
                });
            }

            function goToLatest() {
                console.log('⏭️ Ir a último iniciado');
                if (mainChart && currentData.candleData.length > 0) {
                    const candles = currentData.candleData;
                    const candleCount = candles.length;
                    
                    if (candleCount > 0) {
                        // Detectar zoom actual para mantener la vista
                        const currentRange = mainChart.scales.x.max - mainChart.scales.x.min;
                        const totalRange = candles[candleCount - 1].x - candles[0].x;
                        const isZoomedIn = currentRange < totalRange * 0.8; // Si está más del 80% zoom
                        
                        let visibleCount, startIndex, endIndex;
                        
                        if (isZoomedIn) {
                            // Mantener nivel de zoom actual pero ir al final
                            const currentCandleSpan = Math.max(10, Math.floor(currentRange / (1000 * 60))); // Minutos aproximados
                            visibleCount = Math.min(currentCandleSpan, candleCount);
                            startIndex = Math.max(0, candleCount - visibleCount);
                            endIndex = candleCount;
                        } else {
                            // Vista completa de las últimas 50 velas
                            visibleCount = Math.min(50, candleCount);
                            startIndex = Math.max(0, candleCount - visibleCount);
                            endIndex = candleCount;
                        }
                        
                        const visibleCandles = candles.slice(startIndex, endIndex);
                        const firstTime = visibleCandles[0].x;
                        const lastTime = visibleCandles[visibleCandles.length - 1].x;
                        const timeRange = lastTime - firstTime;
                        const timePadding = Math.max(timeRange * 0.02, 60000); // Al menos 1 minuto de padding
                        
                        mainChart.options.scales.x.min = firstTime - timePadding;
                        mainChart.options.scales.x.max = lastTime + timePadding;
                        
                        // Ajustar el rango Y para las velas visibles con mejor padding
                        const visiblePrices = visibleCandles.flatMap(candle => [candle.h, candle.l]);
                        if (visiblePrices.length > 0) {
                            const minPrice = Math.min(...visiblePrices);
                            const maxPrice = Math.max(...visiblePrices);
                            const priceRange = maxPrice - minPrice;
                            const pricePadding = Math.max(priceRange * 0.08, maxPrice * 0.001); // 8% o 0.1% del precio
                            
                            mainChart.options.scales.y.min = Math.max(0, minPrice - pricePadding);
                            mainChart.options.scales.y.max = maxPrice + pricePadding;
                        }
                        
                        mainChart.update('none');
                        console.log(\`⏭️ Centrado en últimas \${visibleCount} velas (zoom: \${isZoomedIn ? 'mantenido' : 'ajustado'})\`);
                        
                        if (volumeChart && showVolumeChart) {
                            volumeChart.options.scales.x.min = firstTime - timePadding;
                            volumeChart.options.scales.x.max = lastTime + timePadding;
                            volumeChart.update('none');
                        }
                        
                        sendMessageToRN({ 
                            type: 'GO_TO_LATEST', 
                            candlesShown: visibleCount,
                            zoomLevel: isZoomedIn ? 'maintained' : 'auto'
                        });
                    }
                }
            }

            // Funciones adicionales de navegación
            function panLeft() {
                console.log('⬅️ Pan Left iniciado');
                if (mainChart && currentData.candleData.length > 0) {
                    const xScale = mainChart.scales.x;
                    const currentRange = xScale.max - xScale.min;
                    const panAmount = currentRange * 0.2; // Mover 20% del rango visible
                    
                    const newMin = xScale.min - panAmount;
                    const newMax = xScale.max - panAmount;
                    
                    // Verificar límites
                    const dataMin = currentData.candleData[0].x;
                    const adjustedMin = Math.max(newMin, dataMin - currentRange * 0.1);
                    const adjustedMax = adjustedMin + currentRange;
                    
                    mainChart.options.scales.x.min = adjustedMin;
                    mainChart.options.scales.x.max = adjustedMax;
                    mainChart.update('none');
                    
                    if (volumeChart) {
                        volumeChart.options.scales.x.min = adjustedMin;
                        volumeChart.options.scales.x.max = adjustedMax;
                        volumeChart.update('none');
                    }
                    
                    console.log('⬅️ Pan Left completado');
                    sendMessageToRN({ type: 'PAN_LEFT', newCenter: (adjustedMin + adjustedMax) / 2 });
                }
            }

            function panRight() {
                console.log('➡️ Pan Right iniciado');
                if (mainChart && currentData.candleData.length > 0) {
                    const xScale = mainChart.scales.x;
                    const currentRange = xScale.max - xScale.min;
                    const panAmount = currentRange * 0.2; // Mover 20% del rango visible
                    
                    const newMin = xScale.min + panAmount;
                    const newMax = xScale.max + panAmount;
                    
                    // Verificar límites
                    const dataMax = currentData.candleData[currentData.candleData.length - 1].x;
                    const adjustedMax = Math.min(newMax, dataMax + currentRange * 0.1);
                    const adjustedMin = adjustedMax - currentRange;
                    
                    mainChart.options.scales.x.min = adjustedMin;
                    mainChart.options.scales.x.max = adjustedMax;
                    mainChart.update('none');
                    
                    if (volumeChart) {
                        volumeChart.options.scales.x.min = adjustedMin;
                        volumeChart.options.scales.x.max = adjustedMax;
                        volumeChart.update('none');
                    }
                    
                    console.log('➡️ Pan Right completado');
                    sendMessageToRN({ type: 'PAN_RIGHT', newCenter: (adjustedMin + adjustedMax) / 2 });
                }
            }
                        
                        console.log(\`📍 Centrado en últimas \${visibleCount} velas\`);
                    }
                }
                sendMessageToRN({ type: 'GO_TO_LATEST' });
            }

            function autoFitChart() {
                if (mainChart && currentData.candleData.length > 0) {
                    const candles = currentData.candleData;
                    
                    // Calcular rango completo de datos
                    const times = candles.map(c => c.x);
                    const prices = candles.flatMap(c => [c.h, c.l]);
                    
                    const minTime = Math.min(...times);
                    const maxTime = Math.max(...times);
                    const minPrice = Math.min(...prices);
                    const maxPrice = Math.max(...prices);
                    
                    const timeRange = maxTime - minTime;
                    const priceRange = maxPrice - minPrice;
                    
                    // Agregar padding
                    const timePadding = timeRange * 0.02;
                    const pricePadding = Math.max(priceRange * 0.05, 1);
                    
                    mainChart.options.scales.x.min = minTime - timePadding;
                    mainChart.options.scales.x.max = maxTime + timePadding;
                    mainChart.options.scales.y.min = Math.max(0, minPrice - pricePadding);
                    mainChart.options.scales.y.max = maxPrice + pricePadding;
                    
                    mainChart.update('resize');
                    
                    if (volumeChart && showVolumeChart) {
                        volumeChart.options.scales.x.min = minTime - timePadding;
                        volumeChart.options.scales.x.max = maxTime + timePadding;
                        volumeChart.update('resize');
                    }
                    
                    console.log(\`🎯 Auto-fit aplicado: \${candles.length} velas, rango \${minPrice.toFixed(2)}-\${maxPrice.toFixed(2)}\`);
                }
            }

            function toggleVolume() {
                showVolumeChart = !showVolumeChart;
                const volumeElement = document.getElementById('volumeChart');
                const mainElement = document.getElementById('mainChart');
                
                if (showVolumeChart) {
                    volumeElement.style.display = 'block';
                    mainElement.style.height = '70%';
                } else {
                    volumeElement.style.display = 'none';
                    mainElement.style.height = '100%';
                }
                
                // Recrear charts con nuevas dimensiones
                initializeCharts();
                updateCharts(currentData);
                
                sendMessageToRN({ type: 'TOGGLE_VOLUME', showVolume: showVolumeChart });
            }

            function updateLastPriceLine(price) {
                if (!mainChart || !price) return;
                
                // Remover línea anterior
                if (mainChart.options.plugins.annotation.annotations.lastPrice) {
                    delete mainChart.options.plugins.annotation.annotations.lastPrice;
                }
                
                // Agregar nueva línea punteada
                mainChart.options.plugins.annotation.annotations.lastPrice = {
                    type: 'line',
                    yMin: price,
                    yMax: price,
                    borderColor: '#888888',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    label: {
                        content: \`$\${price.toLocaleString()}\`,
                        enabled: true,
                        position: 'end',
                        backgroundColor: 'rgba(136, 136, 136, 0.8)',
                        color: '#fff',
                        font: {
                            size: 10
                        }
                    }
                };
                
                mainChart.update('none');
            }

            function updateCharts(data) {
                currentData = data;
                
                console.log('📊 Updating charts with data:', {
                    candleCount: data.candleData ? data.candleData.length : 0,
                    volumeCount: data.volumeData ? data.volumeData.length : 0,
                    symbol: data.symbol,
                    lastPrice: data.lastPrice
                });
                
                if (mainChart && data.candleData && data.candleData.length > 0) {
                    // Validate data before updating
                    const validCandles = data.candleData.filter(candle => 
                        candle && 
                        typeof candle.x === 'number' && 
                        typeof candle.o === 'number' && 
                        typeof candle.h === 'number' && 
                        typeof candle.l === 'number' && 
                        typeof candle.c === 'number' &&
                        !isNaN(candle.o) && !isNaN(candle.h) && !isNaN(candle.l) && !isNaN(candle.c) &&
                        candle.h >= candle.l && candle.h >= Math.min(candle.o, candle.c) && candle.l <= Math.max(candle.o, candle.c)
                    );
                    
                    console.log(\`✅ Updating main chart with \${validCandles.length} valid candles\`);
                    
                    if (validCandles.length > 0) {
                        mainChart.data.datasets[0].data = validCandles;
                        mainChart.data.datasets[0].label = \`\${data.symbol} Price\`;
                        
                        // Calcular rango de precios para centrar el gráfico
                        const prices = validCandles.flatMap(candle => [candle.h, candle.l]);
                        const minPrice = Math.min(...prices);
                        const maxPrice = Math.max(...prices);
                        const range = maxPrice - minPrice;
                        const padding = Math.max(range * 0.05, 1); // Al menos 5% de padding o $1
                        
                        // Configurar escalas para centrar datos
                        mainChart.options.scales.y.min = Math.max(0, minPrice - padding);
                        mainChart.options.scales.y.max = maxPrice + padding;
                        
                        // Configurar escala X para mostrar todos los datos
                        if (validCandles.length > 1) {
                            const timeRange = validCandles[validCandles.length - 1].x - validCandles[0].x;
                            const timePadding = timeRange * 0.02; // 2% de padding temporal
                            
                            mainChart.options.scales.x.min = validCandles[0].x - timePadding;
                            mainChart.options.scales.x.max = validCandles[validCandles.length - 1].x + timePadding;
                        }
                        
                        mainChart.update('resize');
                        
                        // Update price line
                        updateLastPriceLine(data.lastPrice);
                        
                        console.log(\`📈 Chart updated successfully. Price range: \${minPrice.toFixed(2)} - \${maxPrice.toFixed(2)}\`);
                    }
                } else {
                    console.warn('⚠️ No valid candle data to update main chart');
                }
                
                if (volumeChart && showVolumeChart && data.volumeData && data.volumeData.length > 0) {
                    const validVolume = data.volumeData.filter(vol => 
                        vol && typeof vol.x === 'number' && typeof vol.y === 'number' && !isNaN(vol.y) && vol.y >= 0
                    );
                    
                    console.log(\`✅ Updating volume chart with \${validVolume.length} valid volume points\`);
                    
                    if (validVolume.length > 0) {
                        volumeChart.data.datasets[0].data = validVolume;
                        
                        // Configurar escala Y para volumen
                        const volumes = validVolume.map(vol => vol.y);
                        const maxVolume = Math.max(...volumes);
                        volumeChart.options.scales.y.max = maxVolume * 1.1; // 10% padding en volumen
                        
                        volumeChart.update('resize');
                    }
                }
                
                // Update streaming status
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = \`\${data.symbol} - \${validCandles ? validCandles.length : 0} velas cargadas\`;
                    statusElement.className = '${isStreaming ? 'streaming' : 'paused'}';
                }
                
                // ✅ AJUSTAR CÁMARA DESPUÉS DE CADA ACTUALIZACIÓN
                adjustCameraAfterUpdate();
            }

            function initializeCharts() {
                // Destruir charts existentes
                if (mainChart) {
                    mainChart.destroy();
                }
                if (volumeChart) {
                    volumeChart.destroy();
                }
                
                // Crear chart principal
                const mainCtx = document.getElementById('mainChart').getContext('2d');
                mainChart = new Chart(mainCtx, mainConfig);
                
                // Crear chart de volumen si está habilitado
                if (showVolumeChart) {
                    const volumeCtx = document.getElementById('volumeChart').getContext('2d');
                    volumeChart = new Chart(volumeCtx, volumeConfig);
                }
            }

            function sendMessageToRN(message) {
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify(message));
                }
            }

            // Inicializar cuando se carga la página
            window.addEventListener('load', function() {
                initializeCharts();
                sendMessageToRN({ type: 'READY' });
            });

            // Listener para mensajes desde React Native
            window.addEventListener('message', function(event) {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch(data.type) {
                        case 'UPDATE_DATA':
                            updateCharts(data.payload);
                            // Auto-fit solo en la primera carga de datos
                            if (data.payload.candleData && data.payload.candleData.length > 0 && !window.chartInitialized) {
                                setTimeout(() => {
                                    autoFitChart();
                                    window.chartInitialized = true;
                                }, 500);
                            }
                            break;
                        case 'ZOOM':
                            if (mainChart) {
                                mainChart.zoom(data.factor);
                            }
                            if (volumeChart) {
                                volumeChart.zoom(data.factor);
                            }
                            break;
                        case 'ZOOM_IN':
                            zoomIn();
                            break;
                        case 'ZOOM_OUT':
                            zoomOut();
                            break;
                        case 'RESET_ZOOM':
                            resetZoom();
                            break;
                        case 'RESET_CAMERA':
                            resetCamera();
                            break;
                        case 'LOCK_CAMERA':
                            lockCamera();
                            break;
                        case 'SET_CAMERA_TO_LATEST':
                            setCameraToLatest();
                            break;
                        case 'ADJUST_CAMERA_AFTER_UPDATE':
                            adjustCameraAfterUpdate();
                            break;
                        case 'AUTO_FIT':
                            autoFitChart();
                            break;
                        case 'GO_TO_LATEST':
                            goToLatest();
                            break;
                        case 'PAN_LEFT':
                            panLeft();
                            break;
                        case 'PAN_RIGHT':
                            panRight();
                            break;
                        case 'START_USER_INTERACTION':
                            startUserInteraction();
                            break;
                        case 'END_USER_INTERACTION':
                            endUserInteraction();
                            break;
                        case 'SET_TEMPORARY_POSITION':
                            if (data.centerX !== undefined && data.zoomLevel !== undefined) {
                                setTemporaryPosition(data.centerX, data.zoomLevel);
                            }
                            break;
                        case 'TOGGLE_VOLUME':
                            toggleVolume();
                            break;
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            });

            // Prevenir comportamientos táctiles no deseados
            document.addEventListener('touchstart', function(e) {
                if (e.touches.length > 1) {
                    e.preventDefault();
                }
            }, { passive: false });

            document.addEventListener('touchmove', function(e) {
                if (e.touches.length > 1) {
                    e.preventDefault();
                }
            }, { passive: false });
        </script>
    </body>
    </html>
  `;

  // Enviar datos actualizados al WebView
  const sendDataToChart = useCallback(() => {
    if (webViewRef.current && chartData.candleData.length > 0) {
      console.log(`📊 Sending ${chartData.candleData.length} candles to Chart.js WebView for ${chartData.symbol}`);
      
      const message = {
        type: 'UPDATE_DATA',
        payload: chartData
      };
      
      webViewRef.current.postMessage(JSON.stringify(message));
      console.log(`✅ Data sent to WebView successfully`);
    } else if (webViewRef.current) {
      console.warn(`⚠️ WebView ready but no candle data to send (${chartData.candleData.length} candles)`);
    } else {
      console.warn(`⚠️ WebView not ready, cannot send data`);
    }
  }, [chartData]);

  // Efecto para enviar datos cuando cambien
  useEffect(() => {
    sendDataToChart();
  }, [sendDataToChart]);

  // Manejar mensajes del WebView
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'READY':
          // Chart está listo, enviar datos iniciales
          sendDataToChart();
          break;
        case 'ZOOM':
        case 'ZOOM_IN':
        case 'ZOOM_OUT':
          onZoom?.(message.zoomLevel || message.newRange);
          break;
        case 'PAN':
        case 'PAN_LEFT':
        case 'PAN_RIGHT':
          onPan?.(message.panX || message.newCenter, message.panY || 0);
          break;
        case 'RESET_ZOOM':
        case 'GO_TO_LATEST':
        case 'TOGGLE_VOLUME':
          // Estos eventos se manejan internamente en el WebView
          console.log(`📊 Chart action: ${message.type}`, message);
          break;
        case 'CAMERA_RESET':
          console.log('📷 Camera reset to latest');
          break;
        case 'CAMERA_LOCKED':
          console.log('📷 Camera locked at position:', message);
          break;
        case 'CAMERA_FOLLOWING_LATEST':
          console.log('📷 Camera following latest candles');
          break;
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  }, [onZoom, onPan, sendDataToChart]);

  // Métodos públicos para controlar el chart desde fuera
  const chartControls = useMemo(() => ({
    zoomIn: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'ZOOM_IN' }));
    },
    zoomOut: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'ZOOM_OUT' }));
    },
    resetZoom: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'RESET_ZOOM' }));
    },
    goToLatest: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LATEST' }));
    },
    panLeft: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'PAN_LEFT' }));
    },
    panRight: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'PAN_RIGHT' }));
    },
    autoFit: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'AUTO_FIT' }));
    },
    toggleVolume: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'TOGGLE_VOLUME' }));
    },
    resetCamera: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'RESET_CAMERA' }));
    },
    lockCamera: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'LOCK_CAMERA' }));
    },
    adjustCameraAfterUpdate: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'ADJUST_CAMERA_AFTER_UPDATE' }));
    },
  }), []);

  return (
    <View style={[styles.container, { height }]}>
      {/* Mostrar indicador de carga o datos vacíos */}
      {chartData.candleData.length === 0 && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>
            {isStreaming ? '📡 Conectando al stream...' : '📊 Cargando datos históricos...'}
          </Text>
          <Text style={styles.loadingSubtext}>
            {symbol} - {chartData.candleData.length} velas disponibles
          </Text>
        </View>
      )}
      
      {Platform.OS === 'web' ? (
        <ChartJSWebDirect
          candles={candles}
          symbol={symbol}
          isStreaming={isStreaming}
          lastCandle={lastCandle}
          onZoom={onZoom}
          onPan={onPan}
          onWebViewReady={onWebViewReady}
          height={height}
          showVolume={showVolume}
          enableControls={enableControls}
        />
      ) : (
        <WebView
          ref={webViewRef}
          source={{ html: chartHTML }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          onMessage={handleMessage}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          androidLayerType="hardware"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    overflow: 'hidden',
  },
  webView: {
    backgroundColor: '#0f0f0f',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 15, 15, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtext: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
  },
});

// Exportar también los controles para uso externo
export const useChartControls = (chartRef: React.RefObject<any>) => {
  return useMemo(() => ({
    zoomIn: () => chartRef.current?.zoomIn?.(),
    zoomOut: () => chartRef.current?.zoomOut?.(),
    resetZoom: () => chartRef.current?.resetZoom?.(),
    goToLatest: () => chartRef.current?.goToLatest?.(),
  }), []);
};

export default ChartJSFinancialChart;
