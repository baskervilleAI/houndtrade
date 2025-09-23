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
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const updateThrottleMs = 100; // Throttle updates to max 10fps for better performance

  const { selectedPair } = useMarket();
  const currentSymbol = symbol || selectedPair;

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

    // Throttle updates for better performance, except for final candles
    const now = Date.now();
    if (!isFinal && now - lastUpdateTime < updateThrottleMs) {
      return;
    }
    setLastUpdateTime(now);

    const chart = chartRef.current;
    const dataset = chart.data.datasets[0];

    if (dataset && dataset.data) {
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

        // Mantener solo las últimas 200 velas visibles
        if (dataset.data.length > 200) {
          dataset.data.shift();
        }
      }

      // Actualizar indicadores técnicos si están activos
      if (activeIndicators.size > 0) {
        updateTechnicalIndicators(chart);
      }

      // Usar 'none' para evitar animaciones en actualizaciones frecuentes
      chart.update('none');
    }
  }, [activeIndicators, lastUpdateTime, updateThrottleMs, currentInterval]);

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

  useEffect(() => {
    const handleCandleUpdate = (update: StreamUpdate) => {
      if (update.symbol === currentSymbol && update.interval === currentInterval) {
        console.log(`[MinimalistChart] Candle update: ${update.symbol} ${update.interval} final:${update.isFinal} price:${update.candle.c}`);
        
        updateChart(update.candle, update.isFinal);
        
        // Actualizar el estado local de manera sincronizada
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
            
            // Mantener solo las últimas 200 velas
            if (newData.length > 200) {
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
  }, [currentSymbol, currentInterval, updateChart]);

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
