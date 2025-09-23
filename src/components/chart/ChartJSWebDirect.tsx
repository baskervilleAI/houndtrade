import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { CandleData } from '../../services/binanceService';

const { width: screenWidth } = Dimensions.get('window');

interface ChartJSWebDirectProps {
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

declare global {
  interface Window {
    Chart: any;
    chartjs?: any;
  }
}

export const ChartJSWebDirect: React.FC<ChartJSWebDirectProps> = ({
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
  const chartRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const volumeCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isChartLoaded, setIsChartLoaded] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  console.log('🌐 ChartJSWebDirect: Component mounted for web');

  // Cargar scripts de Chart.js
  useEffect(() => {
    const loadScripts = async () => {
      if (typeof window === 'undefined') return;
      
      // Check if Chart.js is already loaded
      if (window.Chart) {
        setScriptsLoaded(true);
        return;
      }

      const scripts = [
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.min.js',
        'https://cdn.jsdelivr.net/npm/chartjs-chart-financial@0.2.1/dist/chartjs-chart-financial.min.js',
        'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js',
        'https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js',
        'https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js',
      ];

      try {
        for (const src of scripts) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        
        // Wait a bit for plugins to register
        setTimeout(() => {
          setScriptsLoaded(true);
          console.log('📊 ChartJSWebDirect: All scripts loaded');
        }, 100);
      } catch (error) {
        console.error('❌ Error loading Chart.js scripts:', error);
      }
    };

    loadScripts();
  }, []);

  // Preparar datos para Chart.js
  const chartData = useMemo(() => {
    console.log(`📈 ChartJSWebDirect: Processing ${candles.length} candles for ${symbol}`);
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

  // Inicializar Chart.js
  useEffect(() => {
    if (!scriptsLoaded || !canvasRef.current || !window.Chart) return;

    try {
      // Register required components
      const Chart = window.Chart;
      Chart.register(
        Chart.CategoryScale,
        Chart.LinearScale,
        Chart.TimeScale,
        Chart.Title,
        Chart.Tooltip,
        Chart.Legend,
        Chart.controllers.candlestick,
        Chart.elements.CandlestickElement,
        Chart.controllers.ohlc,
        Chart.elements.OhlcElement
      );

      // Destroy existing chart
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      // Chart configuration
      const config = {
        type: 'candlestick',
        data: {
          datasets: [{
            label: symbol,
            data: chartData.candleData,
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
                callback: function(value: any) {
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
                title: function(context: any) {
                  const date = new Date(context[0].parsed.x);
                  return date.toLocaleString();
                },
                label: function(context: any) {
                  const data = context.raw;
                  return [
                    `Open: $${data.o.toLocaleString()}`,
                    `High: $${data.h.toLocaleString()}`,
                    `Low: $${data.l.toLocaleString()}`,
                    `Close: $${data.c.toLocaleString()}`
                  ];
                }
              }
            },
            annotation: {
              annotations: {}
            }
          },
          animation: {
            duration: 0 // Sin animación para mejor performance
          },
          elements: {
            point: {
              radius: 0
            }
          }
        }
      };

      chartRef.current = new Chart(ctx, config);
      setIsChartLoaded(true);
      console.log('📊 ChartJSWebDirect: Chart initialized');

      // Notificar que está listo
      if (onWebViewReady) {
        const mockWebViewRef = {
          postMessage: (message: string) => {
            const data = JSON.parse(message);
            console.log('📨 ChartJSWebDirect: Received message:', data);
            
            switch (data.type) {
              case 'RESET_ZOOM':
                chartRef.current?.resetZoom?.();
                break;
              case 'ZOOM_IN':
                if (chartRef.current) {
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
                if (chartRef.current) {
                  const xScale = chartRef.current.scales.x;
                  const center = (xScale.min + xScale.max) / 2;
                  const currentRange = xScale.max - xScale.min;
                  const newRange = currentRange * 1.33;
                  
                  chartRef.current.options.scales.x.min = center - newRange / 2;
                  chartRef.current.options.scales.x.max = center + newRange / 2;
                  chartRef.current.update('none');
                }
                break;
              case 'ZOOM':
                chartRef.current?.zoom?.(data.factor);
                break;
              case 'PAN_LEFT':
                if (chartRef.current && chartData.candleData.length > 0) {
                  const xScale = chartRef.current.scales.x;
                  const currentRange = xScale.max - xScale.min;
                  const panAmount = currentRange * 0.2;
                  
                  chartRef.current.options.scales.x.min = xScale.min - panAmount;
                  chartRef.current.options.scales.x.max = xScale.max - panAmount;
                  chartRef.current.update('none');
                }
                break;
              case 'PAN_RIGHT':
                if (chartRef.current && chartData.candleData.length > 0) {
                  const xScale = chartRef.current.scales.x;
                  const currentRange = xScale.max - xScale.min;
                  const panAmount = currentRange * 0.2;
                  
                  chartRef.current.options.scales.x.min = xScale.min + panAmount;
                  chartRef.current.options.scales.x.max = xScale.max + panAmount;
                  chartRef.current.update('none');
                }
                break;
              case 'GO_TO_LATEST':
                if (chartRef.current && chartData.candleData.length > 0) {
                  const lastIndex = chartData.candleData.length - 1;
                  const lastTime = Number(chartData.candleData[lastIndex].x);
                  const timeRange = 50 * 60 * 1000; // 50 minutos
                  
                  chartRef.current.options.scales.x.min = lastTime - timeRange;
                  chartRef.current.options.scales.x.max = lastTime + (timeRange * 0.1);
                  chartRef.current.update('none');
                }
                break;
            }
          }
        };
        onWebViewReady(mockWebViewRef);
      }

    } catch (error) {
      console.error('❌ Error initializing Chart.js:', error);
    }
  }, [scriptsLoaded, chartData, symbol, onWebViewReady]);

  // Actualizar línea de precio actual
  useEffect(() => {
    if (!chartRef.current || !chartData.lastPrice || !isChartLoaded) return;

    try {
      // Remover línea anterior
      if (chartRef.current.options.plugins.annotation.annotations.lastPrice) {
        delete chartRef.current.options.plugins.annotation.annotations.lastPrice;
      }
      
      // Agregar nueva línea punteada
      chartRef.current.options.plugins.annotation.annotations.lastPrice = {
        type: 'line',
        yMin: chartData.lastPrice,
        yMax: chartData.lastPrice,
        borderColor: '#888888',
        borderWidth: 1,
        borderDash: [5, 5],
        label: {
          content: `$${chartData.lastPrice.toLocaleString()}`,
          enabled: true,
          position: 'end',
          backgroundColor: 'rgba(136, 136, 136, 0.8)',
          color: '#fff',
          font: {
            size: 10
          }
        }
      };
      
      chartRef.current.update('none');
    } catch (error) {
      console.error('❌ Error updating price line:', error);
    }
  }, [chartData.lastPrice, isChartLoaded]);

  // Actualizar datos del gráfico
  useEffect(() => {
    if (!chartRef.current || !isChartLoaded) return;

    try {
      chartRef.current.data.datasets[0].data = chartData.candleData;
      chartRef.current.update('none');
      console.log(`📊 ChartJSWebDirect: Chart updated with ${chartData.candleData.length} candles`);
    } catch (error) {
      console.error('❌ Error updating chart data:', error);
    }
  }, [chartData.candleData, isChartLoaded]);

  return (
    <View style={[styles.container, { height }]}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#0f0f0f' }}>
        {!scriptsLoaded ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: '#888',
            fontSize: '14px'
          }}>
            Cargando Chart.js Financial...
          </div>
        ) : (
          <canvas 
            ref={canvasRef}
            style={{ 
              width: '100%', 
              height: '100%',
              backgroundColor: '#0f0f0f'
            }}
          />
        )}
      </div>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    overflow: 'hidden',
  },
});

export default ChartJSWebDirect;
