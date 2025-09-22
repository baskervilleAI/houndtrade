import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useMarketData } from '../../hooks/useMarketData';
import { useMarket } from '../../context/AppContext';

interface CandlestickChartMainProps {
  height?: number;
  width?: number;
  symbol?: string;
}

const CandlestickChartMain: React.FC<CandlestickChartMainProps> = ({
  height = 400,
  width = 600,
  symbol = 'BTCUSDT'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);
  const [status, setStatus] = useState<string>('Inicializando...');
  const [debugLog, setDebugLog] = useState<string[]>(['🚀 Componente principal iniciado']);

  // Usar datos reales del mercado
  const marketDataHook = useMarketData({
    autoStart: true,
    symbols: [symbol],
    refreshInterval: 30000,
  });
  
  const { selectedPair } = useMarket();

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setDebugLog(prev => [...prev.slice(-10), logMessage]);
    console.log(logMessage);
  };

  // Generar datos de velas de muestra si no hay datos reales
  const generateSampleData = () => {
    const now = Date.now();
    const data = [];
    for (let i = 7; i >= 0; i--) {
      const time = now - (i * 60 * 60 * 1000); // Cada hora
      const basePrice = 112000 + (Math.random() - 0.5) * 2000;
      const high = basePrice + Math.random() * 500;
      const low = basePrice - Math.random() * 500;
      const close = low + Math.random() * (high - low);
      
      data.push({
        x: time,
        o: basePrice,
        h: high,
        l: low,
        c: close
      });
    }
    return data;
  };

  useEffect(() => {
    if (Platform.OS !== 'web') {
      addLog('❌ Solo disponible en web');
      setStatus('Solo disponible en plataforma web');
      return;
    }

    const loadChart = async () => {
      try {
        addLog('📦 Cargando Chart.js...');
        setStatus('Cargando librerías...');

        // Importar Chart.js dinámicamente
        const ChartJS = await import('chart.js/auto');
        const Chart = ChartJS.default;

        addLog('📈 Cargando Chart.js Financial...');
        const ChartFinancial = await import('chartjs-chart-financial');

        addLog('📅 Cargando adaptador de fechas...');
        try {
          await import('chartjs-adapter-date-fns');
        } catch (e) {
          addLog('⚠️ Adaptador de fechas no disponible, usando configuración básica');
        }

        // Registrar componentes
        Chart.register(
          ChartFinancial.CandlestickController,
          ChartFinancial.CandlestickElement,
          ChartFinancial.OhlcController,
          ChartFinancial.OhlcElement
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

        // Usar datos de muestra por ahora
        const chartData = generateSampleData();

        addLog(`🎨 Creando gráfico con ${chartData.length} velas...`);
        setStatus('Creando gráfico...');

        // Limpiar canvas
        ctx.clearRect(0, 0, width, height);

        // Destruir gráfico anterior si existe
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }

        // Crear gráfico
        chartRef.current = new Chart(ctx, {
          type: 'candlestick',
          data: {
            datasets: [{
              label: symbol,
              data: chartData.map(candle => ({
                x: candle.x,
                o: candle.o,
                h: candle.h,
                l: candle.l,
                c: candle.c
              })),
              borderColor: '#00ff88',
              backgroundColor: 'rgba(0, 255, 136, 0.1)',
              borderWidth: 2,
            }]
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            animation: {
              duration: 300
            },
            scales: {
              x: {
                type: 'time',
                time: {
                  unit: 'hour',
                  displayFormats: {
                    hour: 'HH:mm'
                  }
                },
                ticks: {
                  color: '#ffffff',
                  maxTicksLimit: 8
                },
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              },
              y: {
                position: 'right',
                ticks: {
                  color: '#ffffff',
                  callback: function(value: any) {
                    return '$' + (value / 1000).toFixed(1) + 'k';
                  }
                },
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              }
            },
            plugins: {
              title: {
                display: true,
                text: `🕯️ ${symbol} - Velas Japonesas`,
                color: '#ffffff',
                font: {
                  size: 16
                }
              },
              legend: {
                labels: {
                  color: '#ffffff'
                }
              }
            }
          }
        });

        addLog(`✅ ¡Gráfico principal creado! ${chartData.length} velas renderizadas`);
        setStatus(`✅ Gráfico activo (${chartData.length} velas) - ${symbol}`);

        // Verificar que el canvas tenga contenido
        setTimeout(() => {
          if (canvasRef.current) {
            const imageData = ctx.getImageData(0, 0, width, height);
            const hasContent = imageData.data.some((pixel, index) => {
              return index % 4 !== 3 && pixel !== 0;
            });
            
            if (hasContent) {
              addLog('🎨 Canvas contiene datos visuales');
            } else {
              addLog('⚠️ Canvas está vacío - verificar configuración');
            }
          }
        }, 1000);

      } catch (error: any) {
        addLog(`❌ Error: ${error.message}`);
        setStatus(`Error: ${error.message}`);
        console.error('Error cargando Chart.js:', error);
      }
    };

    loadChart();

    // Cleanup
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
        addLog('🗑️ Gráfico destruido');
      }
    };
  }, [symbol, height, width]);

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
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>Estado: {status}</Text>
      </View>
      
      <View style={styles.chartContainer}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            border: '2px solid #333',
            backgroundColor: '#000',
            borderRadius: 8,
            maxWidth: '100%'
          }}
        />
      </View>

      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>🔍 Debug Log:</Text>
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
    padding: 16,
    backgroundColor: '#111',
    flex: 1,
  },
  statusBar: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingText: {
    color: '#00ff88',
    fontSize: 12,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
    flex: 1,
  },
  debugContainer: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    maxHeight: 100,
  },
  debugTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});

export default CandlestickChartMain;
