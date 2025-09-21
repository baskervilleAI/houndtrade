#!/usr/bin/env node

/**
 * Monitor en tiempo real del live streaming de HoundTrade
 * Simula y monitorea las peticiones reales de la aplicación
 */

const https = require('https');
const WebSocket = require('ws');

class LiveStreamingMonitor {
  constructor() {
    this.stats = {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      wsConnections: 0,
      wsMessages: 0,
      priceUpdates: 0,
      candleUpdates: 0,
      avgResponseTime: 0,
    };

    this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'];
    this.startTime = Date.now();
    this.responseTimes = [];
    this.activeConnections = new Map();
  }

  // Realizar petición de precio
  async fetchPrice(symbol) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
      
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const responseTime = Date.now() - startTime;
            const result = JSON.parse(data);
            
            this.stats.totalRequests++;
            this.stats.successRequests++;
            this.responseTimes.push(responseTime);
            
            if (this.responseTimes.length > 50) {
              this.responseTimes.shift();
            }
            
            this.stats.avgResponseTime = Math.round(
              this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
            );
            
            resolve({
              symbol,
              price: parseFloat(result.price),
              responseTime,
            });
          } catch (error) {
            this.stats.errorRequests++;
            reject(error);
          }
        });
      }).on('error', (error) => {
        this.stats.totalRequests++;
        this.stats.errorRequests++;
        reject(error);
      });
    });
  }

  // Realizar petición de velas (simulando ultra-fast streaming)
  async fetchCandles(symbol, interval) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1`;
      
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const responseTime = Date.now() - startTime;
            const result = JSON.parse(data);
            
            this.stats.totalRequests++;
            this.stats.successRequests++;
            this.responseTimes.push(responseTime);
            
            if (this.responseTimes.length > 50) {
              this.responseTimes.shift();
            }
            
            this.stats.avgResponseTime = Math.round(
              this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
            );
            
            if (result.length > 0) {
              const kline = result[0];
              resolve({
                symbol,
                interval,
                candle: {
                  timestamp: new Date(kline[0]).toISOString(),
                  open: parseFloat(kline[1]),
                  high: parseFloat(kline[2]),
                  low: parseFloat(kline[3]),
                  close: parseFloat(kline[4]),
                  volume: parseFloat(kline[5]),
                },
                responseTime,
              });
            } else {
              resolve(null);
            }
          } catch (error) {
            this.stats.errorRequests++;
            reject(error);
          }
        });
      }).on('error', (error) => {
        this.stats.totalRequests++;
        this.stats.errorRequests++;
        reject(error);
      });
    });
  }

  // Conectar WebSocket de ticker
  connectTickerWebSocket(symbol) {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;
    
    if (this.activeConnections.has(streamName)) {
      return; // Ya conectado
    }
    
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;
    
    ws.on('open', () => {
      this.stats.wsConnections++;
      console.log(`🟢 WS Connected: ${streamName}`);
      this.activeConnections.set(streamName, { ws, messageCount: 0 });
    });
    
    ws.on('message', (data) => {
      try {
        const ticker = JSON.parse(data);
        messageCount++;
        this.stats.wsMessages++;
        this.stats.priceUpdates++;
        
        // Actualizar contador en el mapa
        const connection = this.activeConnections.get(streamName);
        if (connection) {
          connection.messageCount = messageCount;
        }
        
        // Log periódico para no saturar
        if (messageCount % 20 === 0) {
          console.log(`📈 ${symbol}: $${ticker.c} (msg #${messageCount})`);
        }
      } catch (error) {
        console.error(`❌ WS Message Error ${symbol}:`, error.message);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`❌ WS Error ${symbol}:`, error.message);
    });
    
    ws.on('close', () => {
      console.log(`🔴 WS Closed: ${streamName}`);
      this.activeConnections.delete(streamName);
    });
    
    return ws;
  }

  // Ciclo de simulación ultra-rápida
  async startUltraFastSimulation(symbol, interval) {
    console.log(`⚡ Starting ultra-fast simulation: ${symbol} ${interval}`);
    
    let cycleCount = 0;
    const maxCycles = 200; // Simular 200 ciclos
    const cycleDelay = 50; // 50ms entre ciclos (ajustable)
    
    const runCycle = async () => {
      if (cycleCount >= maxCycles) {
        console.log(`🏁 Ultra-fast simulation completed: ${symbol} (${cycleCount} cycles)`);
        return;
      }
      
      cycleCount++;
      
      try {
        const result = await this.fetchCandles(symbol, interval);
        
        if (result) {
          this.stats.candleUpdates++;
          
          if (cycleCount % 20 === 0) {
            console.log(`⚡ Cycle #${cycleCount}: ${symbol} $${result.candle.close} (${result.responseTime}ms)`);
          }
        }
      } catch (error) {
        console.error(`❌ Ultra-fast cycle error #${cycleCount}:`, error.message);
      }
      
      // Programar siguiente ciclo
      setTimeout(runCycle, cycleDelay);
    };
    
    runCycle();
  }

  // Monitoreo de precios continuo
  async startPriceMonitoring() {
    console.log('💰 Starting price monitoring...');
    
    const monitorPrices = async () => {
      const promises = this.symbols.map(symbol => 
        this.fetchPrice(symbol).catch(error => {
          console.error(`❌ Price fetch error ${symbol}:`, error.message);
          return null;
        })
      );
      
      const results = await Promise.all(promises);
      const successCount = results.filter(result => result !== null).length;
      
      if (successCount > 0) {
        console.log(`💰 Price update batch: ${successCount}/${this.symbols.length} successful`);
      }
    };
    
    // Monitor inicial
    await monitorPrices();
    
    // Continuar cada 5 segundos
    setInterval(monitorPrices, 5000);
  }

  // Iniciar WebSockets para todos los símbolos
  startWebSocketConnections() {
    console.log('🔌 Starting WebSocket connections...');
    
    this.symbols.forEach(symbol => {
      // Pequeño delay para evitar conexiones simultáneas
      setTimeout(() => {
        this.connectTickerWebSocket(symbol);
      }, Math.random() * 2000);
    });
  }

  // Mostrar estadísticas en tiempo real
  showLiveStats() {
    const runtime = (Date.now() - this.startTime) / 1000;
    const successRate = this.stats.totalRequests > 0 
      ? ((this.stats.successRequests / this.stats.totalRequests) * 100).toFixed(1)
      : '0.0';
    
    console.clear();
    console.log('🔥 === HOUNDTRADE LIVE STREAMING MONITOR ===');
    console.log(`⏱️  Runtime: ${runtime.toFixed(1)}s`);
    console.log(`📊 API Stats:`);
    console.log(`   Total Requests: ${this.stats.totalRequests}`);
    console.log(`   Success: ${this.stats.successRequests}`);
    console.log(`   Errors: ${this.stats.errorRequests}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Avg Response: ${this.stats.avgResponseTime}ms`);
    console.log(`🔌 WebSocket Stats:`);
    console.log(`   Connections: ${this.stats.wsConnections}`);
    console.log(`   Messages: ${this.stats.wsMessages}`);
    console.log(`   Active: ${this.activeConnections.size}`);
    console.log(`📈 Updates:`);
    console.log(`   Price Updates: ${this.stats.priceUpdates}`);
    console.log(`   Candle Updates: ${this.stats.candleUpdates}`);
    
    if (this.activeConnections.size > 0) {
      console.log(`🔗 Active Connections:`);
      this.activeConnections.forEach((connection, streamName) => {
        console.log(`   ${streamName}: ${connection.messageCount} messages`);
      });
    }
    
    console.log('===============================================');
  }

  // Iniciar monitoreo completo
  async startFullMonitoring() {
    console.log('🚀 === INICIANDO MONITOR COMPLETO ===\n');
    
    // 1. Iniciar monitoreo de precios
    this.startPriceMonitoring();
    
    // 2. Iniciar conexiones WebSocket
    this.startWebSocketConnections();
    
    // 3. Iniciar simulación ultra-rápida para BTC
    setTimeout(() => {
      this.startUltraFastSimulation('BTCUSDT', '1m');
    }, 3000);
    
    // 4. Mostrar estadísticas cada 3 segundos
    const statsInterval = setInterval(() => {
      this.showLiveStats();
    }, 3000);
    
    // 5. Finalizar después de 2 minutos
    setTimeout(() => {
      console.log('\n🛑 Stopping monitor...');
      clearInterval(statsInterval);
      
      // Cerrar WebSockets
      this.activeConnections.forEach((connection, streamName) => {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close();
        }
      });
      
      this.showLiveStats();
      console.log('\n✅ Monitor completed!');
      process.exit(0);
    }, 120000); // 2 minutos
  }
}

// Ejecutar monitor
if (require.main === module) {
  const monitor = new LiveStreamingMonitor();
  monitor.startFullMonitoring().catch(error => {
    console.error('❌ Monitor failed:', error);
    process.exit(1);
  });
}

module.exports = LiveStreamingMonitor;
