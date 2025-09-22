import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// Importaciones dinámicas para Chart.js básico
let Chart: any = null;
let chartJsLoaded = false;

// Solo cargar en web
if (Platform.OS === 'web') {
  try {
    console.log('🔄 Cargando Chart.js básico...');
    const ChartJS = require('chart.js/auto');
    Chart = ChartJS.Chart;
    chartJsLoaded = true;
    console.log('✅ Chart.js básico cargado exitosamente');
  } catch (error) {
    console.error('❌ Error cargando Chart.js básico:', error);
    chartJsLoaded = false;
  }
}

// Datos de prueba simples
const SIMPLE_DATA = [
  { x: '10:00', y: 112 },
  { x: '11:00', y: 115 },
  { x: '12:00', y: 113 },
  { x: '13:00', y: 117 },
  { x: '14:00', y: 119 },
  { x: '15:00', y: 116 },
  { x: '16:00', y: 121 },
  { x: '17:00', y: 118 },
];

interface SimpleChartTestProps {
  height?: number;
  width?: number;
}

export const SimpleChartTest: React.FC<SimpleChartTestProps> = ({ 
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

    if (!chartJsLoaded || !Chart) {
      setStatus('❌ Chart.js no cargado');
      addDebugInfo('Chart.js no disponible');
      return;
    }

    if (!canvasRef.current) {
      setStatus('❌ Canvas no disponible');
      addDebugInfo('Canvas ref no está disponible');
      return;
    }

    try {
      setStatus('📊 Creando gráfico simple...');
      addDebugInfo('Inicializando gráfico de línea básico');

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

      addDebugInfo(`Creando gráfico con ${SIMPLE_DATA.length} puntos`);

      // Configuración simple de gráfico de línea
      const config = {
        type: 'line',
        data: {
          labels: SIMPLE_DATA.map(d => d.x),
          datasets: [{
            label: 'Precio Simple',
            data: SIMPLE_DATA.map(d => d.y),
            borderColor: '#00ff88',
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: '📈 Test Chart.js Básico',
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
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Tiempo',
                color: '#ffffff'
              },
              grid: {
                color: 'rgba(255, 255, 255, 0.1)',
              },
              ticks: {
                color: '#ffffff'
              }
            },
            y: {
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
                  return '$' + value + 'k';
                }
              }
            }
          },
          animation: {
            duration: 1000,
            onComplete: () => {
              addDebugInfo('Animación completada');
            }
          }
        }
      };

      addDebugInfo('Creando instancia Chart básica');
      chartRef.current = new Chart(ctx, config);

      setStatus('✅ Gráfico simple creado');
      addDebugInfo('Chart.js básico inicializado correctamente');

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
  }, []);

  // Renderizar fallback para plataformas no web
  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, { height, width }]}>
        <Text style={styles.fallbackText}>
          📱 Chart.js no disponible en React Native móvil
        </Text>
      </View>
    );
  }

  if (!chartJsLoaded || !Chart) {
    return (
      <View style={[styles.container, { height, width }]}>
        <Text style={styles.fallbackText}>
          ❌ Chart.js básico no cargado
        </Text>
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Chart: {Chart ? '✅' : '❌'} | Loaded: {chartJsLoaded ? '✅' : '❌'}
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
          📊 Chart.js básico | 📈 {SIMPLE_DATA.length} puntos | 🎯 Línea simple
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
});

export default SimpleChartTest;
