import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { CandleData } from '../../services/binanceService';

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
    if (webViewRef.current && onWebViewReady) {
      onWebViewReady(webViewRef.current);
    }
  }, [onWebViewReady]);

  // Preparar datos para Chart.js
  const chartData = useMemo(() => {
    const candleData = candles.map(candle => ({
      x: candle.timestamp,
      o: candle.open,
      h: candle.high,
      l: candle.low,
      c: candle.close,
    }));

    const volumeData = showVolume ? candles.map(candle => ({
      x: candle.timestamp,
      y: candle.volume,
    })) : [];

    return {
      candleData,
      volumeData,
      lastPrice: lastCandle?.close || (candles.length > 0 ? candles[candles.length - 1].close : 0),
      symbol,
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
                <button class="control-btn" onclick="zoomIn()">🔍+</button>
                <button class="control-btn" onclick="zoomOut()">🔍-</button>
                <button class="control-btn" onclick="goToLatest()">⏭️ Último</button>
                <button class="control-btn" onclick="toggleVolume()">📊 Vol</button>
            </div>
            
            <canvas id="mainChart"></canvas>
            <canvas id="volumeChart"></canvas>
        </div>

        <script>
            Chart.register(
                Chart.controllers.candlestick,
                Chart.elements.CandlestickElement,
                Chart.controllers.ohlc,
                Chart.elements.OhlcElement,
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
                        label: 'Price',
                        data: [],
                        borderColor: {
                            up: '#00ff88',
                            down: '#ff4444',
                            unchanged: '#999999',
                        },
                        backgroundColor: {
                            up: 'rgba(0, 255, 136, 0.1)',
                            down: 'rgba(255, 68, 68, 0.1)',
                            unchanged: 'rgba(153, 153, 153, 0.1)',
                        },
                        borderWidth: 1,
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
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)',
                                lineWidth: 0.5
                            },
                            ticks: {
                                color: '#888',
                                maxTicksLimit: 10
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
                                    return '$' + value.toLocaleString();
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
                                onPanComplete: function(context) {
                                    const chart = context.chart;
                                    const xScale = chart.scales.x;
                                    const panX = (xScale.min + xScale.max) / 2;
                                    sendMessageToRN({ type: 'PAN', panX: panX });
                                }
                            },
                            zoom: {
                                wheel: {
                                    enabled: enableControlsFlag,
                                },
                                pinch: {
                                    enabled: enableControlsFlag
                                },
                                mode: 'x',
                                onZoomComplete: function(context) {
                                    const chart = context.chart;
                                    const xScale = chart.scales.x;
                                    const zoomLevel = (xScale.max - xScale.min) / (chart.data.datasets[0].data.length || 1);
                                    sendMessageToRN({ type: 'ZOOM', zoomLevel: zoomLevel });
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
            function resetZoom() {
                if (mainChart) {
                    mainChart.resetZoom();
                }
                if (volumeChart) {
                    volumeChart.resetZoom();
                }
                sendMessageToRN({ type: 'RESET_ZOOM' });
            }

            function zoomIn() {
                if (mainChart) {
                    mainChart.zoom(1.2);
                }
                if (volumeChart) {
                    volumeChart.zoom(1.2);
                }
            }

            function zoomOut() {
                if (mainChart) {
                    mainChart.zoom(0.8);
                }
                if (volumeChart) {
                    volumeChart.zoom(0.8);
                }
            }

            function goToLatest() {
                if (mainChart && currentData.candleData.length > 0) {
                    const lastIndex = currentData.candleData.length - 1;
                    const lastTime = currentData.candleData[lastIndex].x;
                    const timeRange = 50 * 60 * 1000; // 50 minutos
                    
                    mainChart.options.scales.x.min = lastTime - timeRange;
                    mainChart.options.scales.x.max = lastTime + (timeRange * 0.1);
                    mainChart.update('none');
                    
                    if (volumeChart) {
                        volumeChart.options.scales.x.min = lastTime - timeRange;
                        volumeChart.options.scales.x.max = lastTime + (timeRange * 0.1);
                        volumeChart.update('none');
                    }
                }
                sendMessageToRN({ type: 'GO_TO_LATEST' });
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
                
                if (mainChart) {
                    mainChart.data.datasets[0].data = data.candleData;
                    mainChart.update('none');
                    
                    // Actualizar línea de precio actual
                    updateLastPriceLine(data.lastPrice);
                }
                
                if (volumeChart && showVolumeChart) {
                    volumeChart.data.datasets[0].data = data.volumeData;
                    volumeChart.update('none');
                }
                
                // Actualizar estado de streaming
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = \`\${data.symbol} - En vivo\`;
                    statusElement.className = '${isStreaming ? 'streaming' : 'paused'}';
                }
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
                            break;
                        case 'ZOOM':
                            if (mainChart) {
                                mainChart.zoom(data.factor);
                            }
                            if (volumeChart) {
                                volumeChart.zoom(data.factor);
                            }
                            break;
                        case 'RESET_ZOOM':
                            resetZoom();
                            break;
                        case 'GO_TO_LATEST':
                            goToLatest();
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
      const message = {
        type: 'UPDATE_DATA',
        payload: chartData
      };
      
      webViewRef.current.postMessage(JSON.stringify(message));
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
          onZoom?.(message.zoomLevel);
          break;
        case 'PAN':
          onPan?.(message.panX, 0);
          break;
        case 'RESET_ZOOM':
        case 'GO_TO_LATEST':
        case 'TOGGLE_VOLUME':
          // Estos eventos se manejan internamente en el WebView
          break;
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  }, [onZoom, onPan, sendDataToChart]);

  // Métodos públicos para controlar el chart desde fuera
  const chartControls = useMemo(() => ({
    zoomIn: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'ZOOM', factor: 1.2 }));
    },
    zoomOut: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'ZOOM', factor: 0.8 }));
    },
    resetZoom: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'RESET_ZOOM' }));
    },
    goToLatest: () => {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'GO_TO_LATEST' }));
    },
  }), []);

  return (
    <View style={[styles.container, { height }]}>
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
