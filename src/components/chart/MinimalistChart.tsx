import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { useMarket } from '../../context/AppContext';
import liveStreamingService, { CandleData, StreamUpdate, TimeInterval } from '../../services/liveStreamingService';
import { useTechnicalIndicators, addIndicatorToChart } from '../../hooks/useTechnicalIndicators';

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
  const [status, setStatus] = useState<string>('Inicializando...');
  const [currentInterval, setCurrentInterval] = useState<TimeInterval>('1h');
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set());

  const { selectedPair } = useMarket();
  const currentSymbol = symbol || selectedPair;

  // Calcular indicadores técnicos
  const technicalIndicators = useTechnicalIndicators(candleData);

  const addLog = (message: string) => {
    console.log(`[MinimalistChart] ${message}`);
  };

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
          responsive: false,
          maintainAspectRatio: false,
          animation: {
            duration: 200
          },
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
              }
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
              },
              pan: {
                enabled: true,
                mode: 'x',
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
    if (!chartRef.current) return;

    const chart = chartRef.current;
    const dataset = chart.data.datasets[0];

    if (dataset && dataset.data) {
      const existingIndex = dataset.data.findIndex((candle: any) => candle.x === newCandle.x);

      if (existingIndex >= 0) {
        // Actualizar vela existente
        dataset.data[existingIndex] = {
          x: newCandle.x,
          o: newCandle.o,
          h: newCandle.h,
          l: newCandle.l,
          c: newCandle.c
        };
      } else if (isFinal) {
        // Agregar nueva vela solo si está cerrada
        dataset.data.push({
          x: newCandle.x,
          o: newCandle.o,
          h: newCandle.h,
          l: newCandle.l,
          c: newCandle.c
        });

        // Mantener solo las últimas 200 velas visibles
        if (dataset.data.length > 200) {
          dataset.data.shift();
        }
      }

      chart.update('none');
    }
  }, []);

  const changeTimeInterval = useCallback(async (newInterval: TimeInterval) => {
    setCurrentInterval(newInterval);
    setStatus('Cambiando intervalo...');

    try {
      // Desuscribirse del intervalo anterior
      if (isStreaming) {
        liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
      }

      // Cargar datos históricos para el nuevo intervalo
      const historicalData = await liveStreamingService.loadHistoricalData(currentSymbol, newInterval, 100);
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
    try {
      setStatus('Conectando streaming...');

      await liveStreamingService.connect();
      await liveStreamingService.subscribeToStream(currentSymbol, currentInterval);
      
      setIsStreaming(true);
    } catch (error: any) {
      console.error('Error iniciando streaming:', error);
    }
  }, [currentSymbol, currentInterval]);

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
        const historicalData = await liveStreamingService.loadHistoricalData(currentSymbol, currentInterval, 100);
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

  useEffect(() => {
    const handleCandleUpdate = (update: StreamUpdate) => {
      if (update.symbol === currentSymbol && update.interval === currentInterval) {
        updateChart(update.candle, update.isFinal);
        
        // Actualizar el estado local
        setCandleData(prev => {
          const newData = [...prev];
          const existingIndex = newData.findIndex(candle => candle.x === update.candle.x);
          
          if (existingIndex >= 0) {
            newData[existingIndex] = update.candle;
          } else if (update.isFinal) {
            newData.push(update.candle);
            if (newData.length > 200) {
              newData.shift();
            }
          }
          
          return newData;
        });
      }
    };

    liveStreamingService.on('candleUpdate', handleCandleUpdate);

    return () => {
      liveStreamingService.off('candleUpdate', handleCandleUpdate);
    };
  }, [currentSymbol, currentInterval, updateChart]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (isStreaming) {
        liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
      }
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  // Auto-iniciar streaming
  useEffect(() => {
    if (candleData.length > 0 && !isStreaming) {
      startStreaming();
    }
  }, [candleData, startStreaming, isStreaming]);

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
