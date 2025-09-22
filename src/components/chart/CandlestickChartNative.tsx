import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';

// Datos de prueba para velas japonesas
const SAMPLE_CANDLE_DATA = [
  { x: Date.now() - 7 * 60 * 60 * 1000, o: 112000, h: 112500, l: 111800, c: 112300 },
  { x: Date.now() - 6 * 60 * 60 * 1000, o: 112300, h: 112800, l: 112100, c: 112600 },
  { x: Date.now() - 5 * 60 * 60 * 1000, o: 112600, h: 112900, l: 112400, c: 112200 },
  { x: Date.now() - 4 * 60 * 60 * 1000, o: 112200, h: 112700, l: 111900, c: 112500 },
  { x: Date.now() - 3 * 60 * 60 * 1000, o: 112500, h: 113000, l: 112300, c: 112800 },
  { x: Date.now() - 2 * 60 * 60 * 1000, o: 112800, h: 113200, l: 112600, c: 112900 },
  { x: Date.now() - 1 * 60 * 60 * 1000, o: 112900, h: 113100, l: 112500, c: 112700 },
  { x: Date.now(), o: 112700, h: 113000, l: 112400, c: 112850 }
];

interface CandlestickChartNativeProps {
  data?: any[];
  height?: number;
  width?: number;
}

const CandlestickChartNative: React.FC<CandlestickChartNativeProps> = ({
  data = SAMPLE_CANDLE_DATA,
  height = 400,
  width = 600
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);
  const [status, setStatus] = useState<string>('Inicializando...');
  const [debugLog, setDebugLog] = useState<string[]>(['🚀 Componente iniciado']);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setDebugLog(prev => [...prev.slice(-10), logMessage]);
    console.log(logMessage);
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

        addLog('🎨 Creando gráfico de velas...');
        setStatus('Creando gráfico...');

        // Limpiar canvas
        ctx.clearRect(0, 0, width, height);

        // Crear gráfico
        chartRef.current = new Chart(ctx, {
          type: 'candlestick',
          data: {
            datasets: [{
              label: 'BTC/USDT',
              data: data.map(candle => ({
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
                text: '🕯️ Velas Japonesas - React Native',
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

        addLog(`✅ ¡Gráfico creado! ${data.length} velas renderizadas`);
        setStatus(`✅ Gráfico activo (${data.length} velas)`);

        // Verificar que el canvas tenga contenido
        setTimeout(() => {
          if (canvasRef.current) {
            const imageData = ctx.getImageData(0, 0, width, height);
            const hasContent = imageData.data.some((pixel, index) => {
              // Verificar canales RGB (ignorar alpha)
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
  }, [data, height, width]);

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
            borderRadius: 8
          }}
        />
      </View>

      <View style={styles.debugContainer}>
        <Text style={styles.debugTitle}>🔍 Debug Log:</Text>
        {debugLog.slice(-5).map((log, index) => (
          <Text key={index} style={styles.debugText}>{log}</Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#111',
  },
  statusBar: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  debugContainer: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    maxHeight: 120,
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

export default CandlestickChartNative;
