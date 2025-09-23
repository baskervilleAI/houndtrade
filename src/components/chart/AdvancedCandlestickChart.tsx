import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Text, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { useMarket } from '../../context/AppContext';
import liveStreamingService, { CandleData, StreamUpdate, TimeInterval } from '../../services/liveStreamingService';
import { useTechnicalIndicators, addIndicatorToChart } from '../../hooks/useTechnicalIndicators';

interface AdvancedCandlestickChartProps {
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

const AdvancedCandlestickChart: React.FC<AdvancedCandlestickChartProps> = ({
  height = 400,
  width = 600,
  symbol = 'BTCUSDT'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);
  const [status, setStatus] = useState<string>('Inicializando...');
  const [debugLog, setDebugLog] = useState<string[]>(['🚀 Gráfico avanzado iniciado']);
  const [currentInterval, setCurrentInterval] = useState<TimeInterval>('1m');
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, activeStreams: 0 });
  const [showVolume, setShowVolume] = useState(false);
  const [scaleType, setScaleType] = useState<'linear' | 'logarithmic'>('linear');
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set());

  const { selectedPair } = useMarket();
  const currentSymbol = symbol || selectedPair;

  // Calcular indicadores técnicos
  const technicalIndicators = useTechnicalIndicators(candleData);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setDebugLog(prev => [...prev.slice(-10), logMessage]);
    console.log(logMessage);
  };

  const initializeChart = useCallback(async () => {
    if (Platform.OS !== 'web') {
      addLog('❌ Solo disponible en web');
      setStatus('Solo disponible en plataforma web');
      return;
    }

    try {
      addLog('📦 Cargando Chart.js y plugins...');
      setStatus('Cargando librerías...');

      // Importar Chart.js y plugins
      const ChartJS = await import('chart.js/auto');
      const Chart = ChartJS.default;
      const ChartFinancial = await import('chartjs-chart-financial');
      const zoomPlugin = await import('chartjs-plugin-zoom');

      // Importar adaptador de fechas
      try {
        await import('chartjs-adapter-date-fns');
      } catch (e) {
        addLog('⚠️ Adaptador de fechas no disponible');
      }

      // Registrar componentes y plugins
      Chart.register(
        ChartFinancial.CandlestickController,
        ChartFinancial.CandlestickElement,
        ChartFinancial.OhlcController,
        ChartFinancial.OhlcElement,
        zoomPlugin.default
      );

      addLog('✅ Librerías cargadas correctamente');

      if (!canvasRef.current) {
        addLog('❌ Canvas no encontrado');
        setStatus('Error: Canvas no disponible');
        return;
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) {
        addLog('❌ Context 2D no disponible');
        setStatus('Error: Context 2D no disponible');
        return;
      }

      addLog(`🎨 Creando gráfico para ${currentSymbol} ${currentInterval}...`);
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

      // Agregar volumen si está habilitado
      if (showVolume) {
        datasets.push({
          label: 'Volumen',
          type: 'bar',
          data: candleData.map(candle => ({
            x: candle.x,
            y: candle.v || 0
          })),
          backgroundColor: candleData.map(candle => 
            candle.c >= candle.o ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 68, 68, 0.3)'
          ),
          borderColor: candleData.map(candle => 
            candle.c >= candle.o ? '#00ff88' : '#ff4444'
          ),
          borderWidth: 1,
          yAxisID: 'y1'
        });
      }

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
                color: 'rgba(255, 255, 255, 0.1)'
              }
            },
            y: {
              type: scaleType,
              position: 'right',
              ticks: {
                color: '#ffffff',
                callback: function(value: any) {
                  return '$' + (value / 1000).toFixed(2) + 'k';
                }
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)'
              }
            },
            ...(showVolume && {
              y1: {
                type: 'linear',
                position: 'left',
                max: Math.max(...candleData.map(c => c.v || 0)) * 4,
                ticks: {
                  color: '#888888',
                  callback: function(value: any) {
                    return (value / 1000000).toFixed(1) + 'M';
                  }
                },
                grid: {
                  display: false
                }
              }
            })
          },
          plugins: {
            title: {
              display: true,
              text: `🕯️ ${currentSymbol} - ${currentInterval.toUpperCase()} ${isStreaming ? '🔴 LIVE' : ''}`,
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

      addLog(`✅ Gráfico creado! ${candleData.length} velas renderizadas`);
      setStatus(`✅ Gráfico activo (${candleData.length} velas) - ${currentSymbol} ${currentInterval.toUpperCase()}`);

    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
      setStatus(`Error: ${error.message}`);
      console.error('Error creando gráfico:', error);
    }
  }, [candleData, currentSymbol, currentInterval, showVolume, scaleType, isStreaming, activeIndicators, technicalIndicators]);

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

      // Actualizar volumen si está habilitado
      if (showVolume && chart.data.datasets[1]) {
        const volumeDataset = chart.data.datasets[1];
        if (volumeDataset.data) {
          const volumeIndex = volumeDataset.data.findIndex((vol: any) => vol.x === newCandle.x);
          
          if (volumeIndex >= 0) {
            volumeDataset.data[volumeIndex] = { x: newCandle.x, y: newCandle.v || 0 };
          } else if (isFinal) {
            volumeDataset.data.push({ x: newCandle.x, y: newCandle.v || 0 });
            if (volumeDataset.data.length > 200) {
              volumeDataset.data.shift();
            }
          }
        }
      }

      chart.update('none'); // Actualización sin animación para mejor performance
    }
  }, [showVolume]);

  const changeTimeInterval = useCallback(async (newInterval: TimeInterval) => {
    addLog(`🔄 Cambiando intervalo a ${newInterval}`);
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

      addLog(`✅ Intervalo cambiado a ${newInterval}`);
    } catch (error: any) {
      addLog(`❌ Error cambiando intervalo: ${error.message}`);
    }
  }, [currentSymbol, currentInterval, isStreaming]);

  const startStreaming = useCallback(async () => {
    try {
      addLog('🔴 Iniciando streaming en vivo...');
      setStatus('Conectando al streaming...');

      await liveStreamingService.connect();
      await liveStreamingService.subscribeToStream(currentSymbol, currentInterval);
      
      setIsStreaming(true);
      addLog('✅ Streaming iniciado');
    } catch (error: any) {
      addLog(`❌ Error iniciando streaming: ${error.message}`);
    }
  }, [currentSymbol, currentInterval]);

  const stopStreaming = useCallback(() => {
    addLog('⏹️ Deteniendo streaming...');
    liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
    setIsStreaming(false);
    addLog('✅ Streaming detenido');
  }, [currentSymbol, currentInterval]);

  const resetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
      addLog('🔍 Zoom reiniciado');
    }
  }, []);

  const toggleIndicator = useCallback((indicator: string) => {
    setActiveIndicators(prev => {
      const newSet = new Set(prev);
      if (newSet.has(indicator)) {
        newSet.delete(indicator);
        addLog(`📉 ${indicator} desactivado`);
      } else {
        newSet.add(indicator);
        addLog(`📈 ${indicator} activado`);
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
        addLog(`❌ Error cargando datos iniciales: ${error}`);
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

    const handleConnectionStatus = () => {
      setConnectionStatus(liveStreamingService.getConnectionStatus());
    };

    liveStreamingService.on('candleUpdate', handleCandleUpdate);
    liveStreamingService.on('connected', handleConnectionStatus);
    liveStreamingService.on('disconnected', handleConnectionStatus);

    return () => {
      liveStreamingService.off('candleUpdate', handleCandleUpdate);
      liveStreamingService.off('connected', handleConnectionStatus);
      liveStreamingService.off('disconnected', handleConnectionStatus);
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
      {/* Panel de controles */}
      <View style={styles.controlPanel}>
        {/* Intervalos de tiempo */}
        <View style={styles.controlSection}>
          <Text style={styles.controlLabel}>Temporalidad:</Text>
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
        </View>

        {/* Controles de gráfico */}
        <View style={styles.controlSection}>
          <TouchableOpacity
            style={[styles.controlButton, isStreaming && styles.controlButtonActive]}
            onPress={isStreaming ? stopStreaming : startStreaming}
          >
            <Text style={styles.controlButtonText}>
              {isStreaming ? '🔴 LIVE' : '▶️ Iniciar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={resetZoom}>
            <Text style={styles.controlButtonText}>🔍 Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, showVolume && styles.controlButtonActive]}
            onPress={() => setShowVolume(!showVolume)}
          >
            <Text style={styles.controlButtonText}>📊 Vol</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setScaleType(scaleType === 'linear' ? 'logarithmic' : 'linear')}
          >
            <Text style={styles.controlButtonText}>
              {scaleType === 'linear' ? '📈 Lin' : '📉 Log'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Controles de indicadores */}
        <View style={styles.controlSection}>
          <Text style={styles.controlLabel}>Indicadores:</Text>
          <TouchableOpacity
            style={[styles.controlButton, activeIndicators.has('sma20') && styles.controlButtonActive]}
            onPress={() => toggleIndicator('sma20')}
          >
            <Text style={styles.controlButtonText}>SMA20</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, activeIndicators.has('sma50') && styles.controlButtonActive]}
            onPress={() => toggleIndicator('sma50')}
          >
            <Text style={styles.controlButtonText}>SMA50</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, activeIndicators.has('ema20') && styles.controlButtonActive]}
            onPress={() => toggleIndicator('ema20')}
          >
            <Text style={styles.controlButtonText}>EMA20</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, activeIndicators.has('bollinger') && styles.controlButtonActive]}
            onPress={() => toggleIndicator('bollinger')}
          >
            <Text style={styles.controlButtonText}>BB</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de estado */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{status}</Text>
        <View style={styles.connectionStatus}>
          <View style={[
            styles.connectionDot,
            { backgroundColor: connectionStatus.connected ? '#00ff88' : '#ff4444' }
          ]} />
          <Text style={styles.connectionText}>
            {connectionStatus.connected ? 'Conectado' : 'Desconectado'}
          </Text>
        </View>
      </View>
      
      {/* Gráfico */}
      <View style={styles.chartContainer}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            border: '1px solid #333',
            backgroundColor: '#000',
            borderRadius: 4,
            maxWidth: '100%'
          }}
        />
      </View>

      {/* Debug log (solo en desarrollo) */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>🔍 Debug:</Text>
          {debugLog.slice(-3).map((log, index) => (
            <Text key={index} style={styles.debugText}>{log}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  controlPanel: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  controlSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  controlLabel: {
    color: '#fff',
    fontSize: 12,
    marginRight: 8,
    minWidth: 80,
  },
  intervalContainer: {
    flexDirection: 'row',
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
  controlButton: {
    backgroundColor: '#333',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 6,
    marginTop: 4,
  },
  controlButtonActive: {
    backgroundColor: '#00ff88',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  statusBar: {
    backgroundColor: '#222',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    flex: 1,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    color: '#ccc',
    fontSize: 11,
  },
  chartContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugContainer: {
    backgroundColor: '#222',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
    maxHeight: 80,
  },
  debugTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  debugText: {
    color: '#ccc',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 1,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});

export default AdvancedCandlestickChart;
