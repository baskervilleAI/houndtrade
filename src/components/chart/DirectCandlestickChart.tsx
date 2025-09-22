import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// Importaciones dinámicas para Chart.js con mejor manejo de errores
let Chart: any = null;
let CandlestickController: any = null;
let CandlestickElement: any = null;
let chartJsLoaded = false;

// Solo cargar en web
if (Platform.OS === 'web') {
  try {
    console.log('🔄 Cargando Chart.js...');
    const ChartJS = require('chart.js/auto');
    Chart = ChartJS.Chart;
    
    console.log('🔄 Cargando Chart.js Financial...');
    const chartFinancial = require('chartjs-chart-financial');
    CandlestickController = chartFinancial.CandlestickController;
    CandlestickElement = chartFinancial.CandlestickElement;
    
    console.log('🔄 Cargando adaptador de fecha...');
    require('chartjs-adapter-date-fns');
    
    chartJsLoaded = true;
    console.log('✅ Todas las librerías Chart.js cargadas exitosamente');
  } catch (error) {
    console.error('❌ Error cargando Chart.js:', error);
    chartJsLoaded = false;
  }
}

// Datos estáticos de prueba
const STATIC_CANDLE_DATA = [
  { x: new Date('2025-09-22T10:00:00Z').getTime(), o: 112000, h: 112500, l: 111800, c: 112300 },
  { x: new Date('2025-09-22T11:00:00Z').getTime(), o: 112300, h: 112800, l: 112100, c: 112600 },
  { x: new Date('2025-09-22T12:00:00Z').getTime(), o: 112600, h: 112900, l: 112400, c: 112200 },
  { x: new Date('2025-09-22T13:00:00Z').getTime(), o: 112200, h: 112700, l: 111900, c: 112500 },
  { x: new Date('2025-09-22T14:00:00Z').getTime(), o: 112500, h: 113000, l: 112300, c: 112800 },
  { x: new Date('2025-09-22T15:00:00Z').getTime(), o: 112800, h: 113200, l: 112600, c: 112900 },
  { x: new Date('2025-09-22T16:00:00Z').getTime(), o: 112900, h: 113100, l: 112500, c: 112700 },
  { x: new Date('2025-09-22T17:00:00Z').getTime(), o: 112700, h: 113000, l: 112400, c: 112850 },
];

interface DirectCandlestickChartProps {
  data?: any[];
  height?: number;
  width?: number;
}

export const DirectCandlestickChart: React.FC<DirectCandlestickChartProps> = ({ 
  data = STATIC_CANDLE_DATA,
  height = 300,
  width = 500 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);
  const [status, setStatus] = useState<string>('⏳ Inicializando...');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (info: string) => {
    console.log(info);
    setDebugInfo(prev => [...prev.slice(-4), info]);
  };

  useEffect(() => {
    // Solo ejecutar en web
    if (Platform.OS !== 'web') {
      setStatus('📱 Solo disponible en web');
      return;
    }

    if (!chartJsLoaded || !Chart || !CandlestickController) {
      setStatus('❌ Chart.js no cargado');
      addDebugInfo('Chart.js no disponible: ' + (!Chart ? 'Chart' : !CandlestickController ? 'CandlestickController' : 'Desconocido'));
      return;
    }

    if (!canvasRef.current) {
      setStatus('❌ Canvas no disponible');
      addDebugInfo('Canvas ref no está disponible');
      return;
    }

    try {
      setStatus('🔧 Registrando componentes...');
      addDebugInfo('Registrando CandlestickController y CandlestickElement');

      // Registrar componentes necesarios
      Chart.register(CandlestickController, CandlestickElement);

      // Destruir gráfico existente
      if (chartRef.current) {
        addDebugInfo('Destruyendo gráfico existente');
        chartRef.current.destroy();
        chartRef.current = null;
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) {
        setStatus('❌ Contexto 2D no disponible');
        addDebugInfo('No se pudo obtener contexto 2D del canvas');
        return;
      }

      setStatus('📊 Creando gráfico...');
      addDebugInfo(`Creando gráfico con ${data.length} velas`);

      // Validar datos
      if (!data || data.length === 0) {
        setStatus('❌ Sin datos para mostrar');
        addDebugInfo('No hay datos válidos para el gráfico');
        return;
      }

      // Configuración del gráfico con debugging mejorado
      const config = {
        type: 'candlestick',
        data: {
          datasets: [{
            label: 'Test Data',
            data: data,
            borderColor: {
              up: '#00ff88',
              down: '#ff4444',
              unchanged: '#999999',
            },
            backgroundColor: {
              up: 'rgba(0, 255, 136, 0.2)',
              down: 'rgba(255, 68, 68, 0.2)',
              unchanged: 'rgba(153, 153, 153, 0.2)',
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
          onHover: (event: any, elements: any) => {
            addDebugInfo(`Hover: ${elements.length} elementos`);
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
                maxTicksLimit: 8
              }
            },
            y: {
              type: 'linear',
              position: 'right',
              title: {
                display: true,
                text: 'Precio',
                color: '#ffffff'
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              },
              ticks: {
                color: '#ffffff',
                callback: function(value: any) {
                  return '$' + (value / 1000).toFixed(1) + 'k';
                }
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: '📊 Test Chart.js Financial Directo',
              color: '#ffffff',
              font: {
                size: 14,
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
                  return [
                    `Open: $${(dataPoint.o / 1000).toFixed(1)}k`,
                    `High: $${(dataPoint.h / 1000).toFixed(1)}k`,
                    `Low: $${(dataPoint.l / 1000).toFixed(1)}k`,
                    `Close: $${(dataPoint.c / 1000).toFixed(1)}k`
                  ];
                }
              }
            }
          },
          animation: {
            duration: 1000,
            onComplete: () => {
              addDebugInfo('Animación de gráfico completada');
            }
          }
        }
      };

      addDebugInfo('Creando instancia Chart con config');
      chartRef.current = new Chart(ctx, config);

      // Auto-fit después de crear el gráfico
      setTimeout(() => {
        if (chartRef.current && data.length > 0) {
          const prices = data.flatMap(d => [d.h, d.l]);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const priceRange = maxPrice - minPrice;
          
          chartRef.current.options.scales.y.min = minPrice - (priceRange * 0.1);
          chartRef.current.options.scales.y.max = maxPrice + (priceRange * 0.1);
          chartRef.current.update();
          
          addDebugInfo(`Auto-fit aplicado: ${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)}`);
        }
      }, 500);

      setStatus('✅ Gráfico creado exitosamente');
      addDebugInfo('Chart.js Financial inicializado correctamente');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setStatus('❌ Error: ' + errorMsg);
      addDebugInfo('Error en inicialización: ' + errorMsg);
      console.error('Error completo:', error);
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data]);

  // Renderizar fallback para plataformas no web
  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, { height, width }]}>
        <Text style={styles.fallbackText}>
          📱 Chart.js no disponible en React Native móvil
        </Text>
        <Text style={styles.fallbackSubtext}>
          Use WebView para móvil o pruebe en web
        </Text>
      </View>
    );
  }

  if (!chartJsLoaded || !Chart || !CandlestickController) {
    return (
      <View style={[styles.container, { height, width }]}>
        <Text style={styles.fallbackText}>
          ❌ Chart.js Financial no cargado
        </Text>
        <Text style={styles.fallbackSubtext}>
          Verifique las dependencias
        </Text>
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Chart: {Chart ? '✅' : '❌'} | 
            Controller: {CandlestickController ? '✅' : '❌'} | 
            Loaded: {chartJsLoaded ? '✅' : '❌'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height, width }]}>
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{status}</Text>
      </View>
      <View style={styles.chartContainer}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
          }}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.infoText}>
          📊 Chart.js directo | 📈 {data.length} velas | 🎯 Financial v0.2.1
        </Text>
      </View>
      <View style={styles.debugContainer}>
        {debugInfo.map((info, index) => (
          <Text key={index} style={styles.debugText}>
            {info}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 12,
    margin: 8,
  },
  statusContainer: {
    padding: 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    marginBottom: 4,
  },
  statusText: {
    color: '#00ff88',
    fontSize: 10,
    textAlign: 'center',
  },
  chartContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  info: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  infoText: {
    color: '#888888',
    fontSize: 10,
    textAlign: 'center',
  },
  debugContainer: {
    marginTop: 4,
    padding: 4,
    backgroundColor: '#222222',
    borderRadius: 2,
    maxHeight: 60,
  },
  debugText: {
    color: '#666666',
    fontSize: 8,
    textAlign: 'left',
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
});

export default DirectCandlestickChart;
