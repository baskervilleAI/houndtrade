import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { CandleData } from '../../services/binanceService';

// Importaciones dinámicas para Chart.js
let Chart: any;
let CandlestickController: any;
let CandlestickElement: any;

// Solo cargar en web
if (Platform.OS === 'web') {
  try {
    Chart = require('chart.js/auto').Chart;
    const chartFinancial = require('chartjs-chart-financial');
    CandlestickController = chartFinancial.CandlestickController;
    CandlestickElement = chartFinancial.CandlestickElement;
    
    // Registrar el adaptador de fecha
    require('chartjs-adapter-date-fns');
  } catch (error) {
    console.error('Error cargando Chart.js:', error);
  }
}

interface ChartJSFinancialDirectProps {
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

export const ChartJSFinancialDirect: React.FC<ChartJSFinancialDirectProps> = ({
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Función para actualizar el gráfico
  const updateChart = (newCandles: CandleData[]) => {
    if (!chartRef.current || !newCandles || newCandles.length === 0) {
      console.log('⚠️ No se puede actualizar: chart no disponible o datos vacíos');
      return;
    }

    try {
      console.log('📊 Actualizando gráfico con', newCandles.length, 'velas para', symbol);
      
      // Convertir datos al formato Chart.js Financial
      const chartData = newCandles.map(candle => ({
        x: new Date(candle.timestamp).getTime(),
        o: candle.open,
        h: candle.high,
        l: candle.low,
        c: candle.close
      }));

      // Actualizar datos
      chartRef.current.data.datasets[0].data = chartData;

      // Auto-fit: calcular rangos de precio y tiempo
      if (chartData.length > 0) {
        const prices = chartData.flatMap(d => [d.h, d.l]);
        const times = chartData.map(d => d.x);
        
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        
        const priceRange = maxPrice - minPrice;
        const timeRange = maxTime - minTime;
        
        // Aplicar márgenes del 10%
        chartRef.current.options.scales.y.min = minPrice - (priceRange * 0.1);
        chartRef.current.options.scales.y.max = maxPrice + (priceRange * 0.1);
        chartRef.current.options.scales.x.min = minTime - (timeRange * 0.05);
        chartRef.current.options.scales.x.max = maxTime + (timeRange * 0.05);
      }

      chartRef.current.update('none'); // Sin animación para mejor rendimiento
      
    } catch (error) {
      console.error('❌ Error actualizando gráfico:', error);
    }
  };

  // Inicializar gráfico
  useEffect(() => {
    if (Platform.OS !== 'web' || !Chart || !CandlestickController || !canvasRef.current) {
      console.log('Chart.js no disponible en esta plataforma o canvas no listo');
      return;
    }

    try {
      console.log('🚀 Inicializando Chart.js Financial directo para', symbol);

      // Registrar componentes
      Chart.register(CandlestickController, CandlestickElement);

      // Destruir gráfico existente
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) {
        console.error('No se pudo obtener contexto 2D');
        return;
      }

      // Configuración del gráfico
      const config = {
        type: 'candlestick',
        data: {
          datasets: [{
            label: symbol,
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
            borderWidth: 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          animation: {
            duration: 0 // Sin animación por defecto para mejor rendimiento
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'minute',
                displayFormats: {
                  minute: 'HH:mm',
                  hour: 'HH:mm'
                }
              },
              title: {
                display: true,
                text: 'Tiempo',
                color: '#ffffff'
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              },
              ticks: {
                color: '#ffffff',
                maxTicksLimit: 10
              }
            },
            y: {
              type: 'linear',
              position: 'right',
              title: {
                display: true,
                text: 'Precio (USDT)',
                color: '#ffffff'
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              },
              ticks: {
                color: '#ffffff',
                callback: function(value: any) {
                  if (value >= 1000) {
                    return '$' + (value / 1000).toFixed(1) + 'k';
                  }
                  return '$' + value.toFixed(2);
                }
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: `📊 ${symbol} - Velas Japonesas`,
              color: '#ffffff',
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            legend: {
              display: true,
              labels: {
                color: '#ffffff'
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              titleColor: '#ffffff',
              bodyColor: '#ffffff',
              borderColor: '#333333',
              borderWidth: 1,
              callbacks: {
                title: function(context: any) {
                  return new Date(context[0].parsed.x).toLocaleString();
                },
                label: function(context: any) {
                  const dataPoint = context.raw;
                  const formatPrice = (price: number) => {
                    if (price >= 1000) {
                      return '$' + (price / 1000).toFixed(2) + 'k';
                    }
                    return '$' + price.toFixed(2);
                  };
                  
                  return [
                    `Open: ${formatPrice(dataPoint.o)}`,
                    `High: ${formatPrice(dataPoint.h)}`,
                    `Low: ${formatPrice(dataPoint.l)}`,
                    `Close: ${formatPrice(dataPoint.c)}`
                  ];
                }
              }
            }
          }
        }
      };

      chartRef.current = new Chart(ctx, config);
      setIsInitialized(true);
      
      // Notificar que el chart está listo
      if (onWebViewReady) {
        onWebViewReady({
          current: {
            updateCharts: updateChart,
            autoFit: () => {
              // Auto-fit implementation
              if (chartRef.current && candles.length > 0) {
                updateChart(candles);
              }
            },
            resetZoom: () => {
              if (chartRef.current) {
                chartRef.current.resetZoom();
              }
            }
          }
        });
      }
      
      console.log('✅ Chart.js Financial directo creado exitosamente para', symbol);

    } catch (error) {
      console.error('❌ Error inicializando gráfico directo:', error);
      setIsInitialized(false);
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      setIsInitialized(false);
    };
  }, [symbol]);

  // Actualizar datos cuando cambien
  useEffect(() => {
    if (isInitialized && candles && candles.length > 0) {
      updateChart(candles);
    }
  }, [candles, isInitialized]);

  // Actualizar última vela si está en streaming
  useEffect(() => {
    if (isInitialized && isStreaming && lastCandle) {
      // En lugar de actualizar toda la lista, podrías optimizar actualizando solo la última vela
      // Por ahora, vamos a usar la lista completa
      if (candles && candles.length > 0) {
        updateChart(candles);
      }
    }
  }, [lastCandle, isStreaming, isInitialized]);

  // Renderizar fallback para plataformas no web
  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackText}>
            📱 Chart.js no disponible en React Native móvil
          </Text>
          <Text style={styles.fallbackSubtext}>
            Use WebView para móvil o pruebe en web
          </Text>
        </View>
      </View>
    );
  }

  if (!Chart || !CandlestickController) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackText}>
            ❌ Chart.js Financial no cargado
          </Text>
          <Text style={styles.fallbackSubtext}>
            Verifique las dependencias npm: chart.js chartjs-chart-financial
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.chartContainer}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#1a1a1a',
          }}
        />
      </View>
      {enableControls && (
        <View style={styles.controlsContainer}>
          <View style={styles.streamingIndicator}>
            <View 
              style={[
                styles.streamingDot,
                { backgroundColor: isStreaming ? '#00ff88' : '#ff4444' }
              ]} 
            />
            <Text style={styles.streamingText}>
              {isStreaming ? 'Streaming' : 'Desconectado'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    overflow: 'hidden',
  },
  chartContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fallbackText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  fallbackSubtext: {
    color: '#888888',
    fontSize: 12,
    textAlign: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 4,
    padding: 8,
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  streamingText: {
    color: '#ffffff',
    fontSize: 12,
  },
});

export default ChartJSFinancialDirect;
