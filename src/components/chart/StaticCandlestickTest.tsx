import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

// Datos estáticos de prueba para velas japonesas
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

interface StaticCandlestickTestProps {
  height?: number;
  width?: number;
}

export const StaticCandlestickTest: React.FC<StaticCandlestickTestProps> = ({ 
  height = 300, 
  width = 500 
}) => {
  // Crear HTML embebido con Chart.js
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Static Candlestick Test</title>
        <style>
            body {
                margin: 0;
                padding: 8px;
                background: #0f0f0f;
                color: #ffffff;
                font-family: Arial, sans-serif;
            }
            .container {
                width: 100%;
                height: 100vh;
                display: flex;
                flex-direction: column;
            }
            .header {
                text-align: center;
                padding: 5px;
                font-size: 12px;
                font-weight: bold;
                background: #1a1a1a;
                border-radius: 4px;
                margin-bottom: 8px;
            }
            .chart-container {
                flex: 1;
                background: #1a1a1a;
                border-radius: 4px;
                padding: 4px;
                min-height: 200px;
            }
            .footer {
                text-align: center;
                padding: 4px;
                font-size: 9px;
                color: #888;
                background: #1a1a1a;
                border-radius: 4px;
                margin-top: 4px;
            }
            #status {
                color: #00ff88;
                padding: 10px;
                text-align: center;
                font-size: 11px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                📊 Test Estático Chart.js Financial
            </div>
            <div class="chart-container">
                <canvas id="candlestickChart" style="width: 100%; height: 100%;"></canvas>
                <div id="status">⏳ Inicializando gráfico...</div>
            </div>
            <div class="footer">
                📈 ${STATIC_CANDLE_DATA.length} velas | 💰 $111,800 - $113,200 | 🎯 Chart.js Financial
            </div>
        </div>

        <!-- Chart.js y Chart.js Financial desde CDN -->
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-chart-financial@0.2.1/dist/chartjs-chart-financial.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>

        <script>
            const candleData = ${JSON.stringify(STATIC_CANDLE_DATA)};
            let chart = null;
            
            function updateStatus(message, color = '#00ff88') {
                const statusEl = document.getElementById('status');
                if (statusEl) {
                    statusEl.innerHTML = message;
                    statusEl.style.color = color;
                }
                console.log(message);
            }
            
            function initChart() {
                updateStatus('🔍 Verificando librerías...');
                
                if (typeof Chart === 'undefined') {
                    updateStatus('❌ Chart.js no disponible', '#ff4444');
                    return;
                }
                
                if (typeof ChartFinancial === 'undefined') {
                    updateStatus('❌ Chart.js Financial no disponible', '#ff4444');
                    return;
                }
                
                try {
                    updateStatus('📊 Creando gráfico...');
                    
                    // Registrar componentes
                    Chart.register(
                        ChartFinancial.CandlestickController,
                        ChartFinancial.CandlestickElement,
                        ChartFinancial.OhlcController,
                        ChartFinancial.OhlcElement
                    );
                    
                    const canvas = document.getElementById('candlestickChart');
                    const ctx = canvas.getContext('2d');
                    
                    const config = {
                        type: 'candlestick',
                        data: {
                            datasets: [{
                                label: 'BTC/USDT Test',
                                data: candleData,
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
                                borderWidth: 1.5,
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
                                        unit: 'hour',
                                        displayFormats: {
                                            hour: 'HH:mm'
                                        }
                                    },
                                    grid: {
                                        color: 'rgba(255, 255, 255, 0.1)',
                                    },
                                    ticks: {
                                        color: '#ffffff',
                                        maxTicksLimit: 6,
                                        font: {
                                            size: 9
                                        }
                                    }
                                },
                                y: {
                                    type: 'linear',
                                    position: 'right',
                                    grid: {
                                        color: 'rgba(255, 255, 255, 0.1)',
                                    },
                                    ticks: {
                                        color: '#ffffff',
                                        font: {
                                            size: 9
                                        },
                                        callback: function(value) {
                                            return '$' + (value/1000).toFixed(0) + 'k';
                                        }
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
                                    titleColor: '#ffffff',
                                    bodyColor: '#ffffff',
                                    titleFont: {
                                        size: 10
                                    },
                                    bodyFont: {
                                        size: 9
                                    },
                                    callbacks: {
                                        title: function(context) {
                                            return new Date(context[0].parsed.x).toLocaleTimeString();
                                        },
                                        label: function(context) {
                                            const data = context.raw;
                                            return [
                                                'O: $' + (data.o/1000).toFixed(1) + 'k',
                                                'H: $' + (data.h/1000).toFixed(1) + 'k',
                                                'L: $' + (data.l/1000).toFixed(1) + 'k',
                                                'C: $' + (data.c/1000).toFixed(1) + 'k'
                                            ];
                                        }
                                    }
                                }
                            },
                            animation: {
                                duration: 800
                            }
                        }
                    };
                    
                    chart = new Chart(ctx, config);
                    
                    // Auto-fit después de crear el gráfico
                    setTimeout(() => {
                        if (chart && candleData.length > 0) {
                            const prices = candleData.flatMap(d => [d.h, d.l]);
                            const minPrice = Math.min(...prices);
                            const maxPrice = Math.max(...prices);
                            const priceRange = maxPrice - minPrice;
                            
                            chart.options.scales.y.min = minPrice - (priceRange * 0.1);
                            chart.options.scales.y.max = maxPrice + (priceRange * 0.1);
                            chart.update();
                            
                            updateStatus('✅ Gráfico creado con ' + candleData.length + ' velas');
                        }
                    }, 500);
                    
                } catch (error) {
                    updateStatus('❌ Error: ' + error.message, '#ff4444');
                    console.error('Error completo:', error);
                }
            }
            
            // Múltiples intentos de inicialización
            function attemptInit() {
                setTimeout(initChart, 200);
            }
            
            // Inicializar
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', attemptInit);
            } else {
                attemptInit();
            }
            
            // Backup
            window.addEventListener('load', () => {
                if (!chart) {
                    setTimeout(initChart, 1000);
                }
            });
        </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, { height, width }]}>
      <WebView
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
        }}
        onLoad={() => {
          console.log('✅ WebView cargado para test estático');
        }}
        onMessage={(event) => {
          console.log('WebView message:', event.nativeEvent.data);
        }}
      />
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
    margin: 8,
  },
  webview: {
    backgroundColor: '#0f0f0f',
  },
});

export default StaticCandlestickTest;
