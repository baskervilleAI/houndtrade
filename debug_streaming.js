#!/usr/bin/env node

/**
 * Script de debugging para monitorear el live streaming de HoundTrade
 * Simula las peticiones que hace la aplicación para identificar problemas
 */

const https = require('https');
const WebSocket = require('ws');

class StreamingDebugger {
  constructor() {
    this.stats = {
      apiRequests: 0,
      apiErrors: 0,
      wsConnections: 0,
      wsErrors: 0,
      priceUpdates: 0,
      candleUpdates: 0
    };
    
    this.symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'];
    this.intervals = ['1m', '5m', '15m', '1h'];
    
    this.startTime = Date.now();
  }

  // Test API de precios
  async testPriceAPI(symbol) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
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
            this.stats.apiRequests++;
            
            console.log(`✅ API Price ${symbol}: $${result.price} (${responseTime}ms)`);
            resolve({ symbol, price: result.price, responseTime });
          } catch (error) {
            this.stats.apiErrors++;
            console.error(`❌ API Error ${symbol}:`, error.message);
            reject(error);
          }
        });
      }).on('error', (error) => {
        this.stats.apiErrors++;
        console.error(`❌ API Request Error ${symbol}:`, error.message);
        reject(error);
      });
    });
  }

  // Test API de velas
  async testKlinesAPI(symbol, interval) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
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
            this.stats.apiRequests++;
            
            if (result.length > 0) {
              const kline = result[0];
              console.log(`📊 API Kline ${symbol} ${interval}: OHLC=${kline[1]}/${kline[2]}/${kline[3]}/${kline[4]} (${responseTime}ms)`);
              resolve({ symbol, interval, kline, responseTime });
            } else {
              console.warn(`⚠️ No klines for ${symbol} ${interval}`);
              resolve(null);
            }
          } catch (error) {
            this.stats.apiErrors++;
            console.error(`❌ Klines Error ${symbol}:`, error.message);
            reject(error);
          }
        });
      }).on('error', (error) => {
        this.stats.apiErrors++;
        console.error(`❌ Klines Request Error ${symbol}:`, error.message);
        reject(error);
      });
    });
  }

  // Test WebSocket de ticker
  testTickerWebSocket(symbol) {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;
    
    console.log(`🔌 Connecting to ${streamName}...`);
    
    const ws = new WebSocket(wsUrl);
    let messageCount = 0;
    
    ws.on('open', () => {
      this.stats.wsConnections++;
      console.log(`✅ WebSocket connected: ${streamName}`);
    });
    
    ws.on('message', (data) => {
      try {
        const ticker = JSON.parse(data);
        messageCount++;
        this.stats.priceUpdates++;
        
        if (messageCount % 10 === 0) {
          console.log(`📈 WS Ticker ${symbol}: $${ticker.c} (msg #${messageCount})`);
        }
      } catch (error) {
        console.error(`❌ WS Message Error ${symbol}:`, error.message);
      }
    });
    
    ws.on('error', (error) => {
      this.stats.wsErrors++;
      console.error(`❌ WS Error ${symbol}:`, error.message);
    });
    
    ws.on('close', (code) => {
      console.log(`🔌 WS Closed ${symbol}: code ${code}`);
    });
    
    return ws;
  }

  // Test WebSocket de velas
  testKlineWebSocket(symbol, interval) {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;
    
    console.log(`🔌 Connecting to ${streamName}...`);
    
    const ws = new WebSocket(wsUrl);
    let candleCount = 0;
    
    ws.on('open', () => {
      this.stats.wsConnections++;
      console.log(`✅ WebSocket connected: ${streamName}`);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        const kline = message.k;
        
        if (kline) {
          candleCount++;
          this.stats.candleUpdates++;
          
          console.log(`🕯️ WS Kline ${symbol} ${interval}: ${kline.c} (${kline.x ? 'CLOSED' : 'LIVE'}) #${candleCount}`);
        }
      } catch (error) {
        console.error(`❌ WS Kline Error ${symbol}:`, error.message);
      }
    });
    
    ws.on('error', (error) => {
      this.stats.wsErrors++;
      console.error(`❌ WS Kline Error ${symbol}:`, error.message);
    });
    
    ws.on('close', (code) => {
      console.log(`🔌 WS Kline Closed ${symbol}: code ${code}`);
    });
    
    return ws;
  }

  // Simulación del ciclo ultra-rápido
  async startUltraFastCycle(symbol, interval) {
    console.log(`🚀 Starting ultra-fast cycle: ${symbol} ${interval} (10ms interval)`);
    
    let cycleCount = 0;
    const maxCycles = 100; // Limitar para el test
    
    const runCycle = async () => {
      if (cycleCount >= maxCycles) {
        console.log(`🏁 Ultra-fast cycle completed: ${symbol} ${interval} (${cycleCount} cycles)`);
        return;
      }
      
      cycleCount++;
      
      try {
        const startTime = Date.now();
        await this.testKlinesAPI(symbol, interval);
        const responseTime = Date.now() - startTime;
        
        if (cycleCount % 10 === 0) {
          console.log(`⚡ Ultra-fast cycle #${cycleCount}: ${responseTime}ms`);
        }
      } catch (error) {
        console.error(`❌ Ultra-fast cycle error #${cycleCount}:`, error.message);
      }
      
      // Programar siguiente ciclo en 10ms
      setTimeout(runCycle, 10);
    };
    
    runCycle();
  }

  // Mostrar estadísticas
  showStats() {
    const runtime = (Date.now() - this.startTime) / 1000;
    
    console.log('\n🔍 === DEBUGGING STATS ===');
    console.log(`Runtime: ${runtime.toFixed(1)}s`);
    console.log(`API Requests: ${this.stats.apiRequests} (${this.stats.apiErrors} errors)`);
    console.log(`WS Connections: ${this.stats.wsConnections} (${this.stats.wsErrors} errors)`);
    console.log(`Price Updates: ${this.stats.priceUpdates}`);
    console.log(`Candle Updates: ${this.stats.candleUpdates}`);
    console.log(`Success Rate: ${((this.stats.apiRequests - this.stats.apiErrors) / Math.max(this.stats.apiRequests, 1) * 100).toFixed(1)}%`);
    console.log('=========================\n');
  }

  // Ejecutar todas las pruebas
  async runFullTest() {
    console.log('🔍 === HOUNDTRADE STREAMING DEBUGGER ===\n');
    
    // 1. Test básico de API de precios
    console.log('📊 Testing Price API...');
    for (const symbol of this.symbols) {
      try {
        await this.testPriceAPI(symbol);
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
      } catch (error) {
        // Error ya loggeado
      }
    }
    
    // 2. Test de API de velas
    console.log('\n🕯️ Testing Klines API...');
    for (const symbol of this.symbols.slice(0, 2)) { // Solo 2 symbols para el test
      for (const interval of this.intervals.slice(0, 2)) { // Solo 2 intervals
        try {
          await this.testKlinesAPI(symbol, interval);
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          // Error ya loggeado
        }
      }
    }
    
    // 3. Test de WebSockets de ticker
    console.log('\n📈 Testing Ticker WebSockets...');
    const tickerWebSockets = [];
    for (const symbol of this.symbols.slice(0, 2)) {
      const ws = this.testTickerWebSocket(symbol);
      tickerWebSockets.push(ws);
    }
    
    // 4. Test de WebSockets de velas
    console.log('\n🕯️ Testing Kline WebSockets...');
    const klineWebSockets = [];
    const testSymbol = 'BTCUSDT';
    const testInterval = '1m';
    const ws = this.testKlineWebSocket(testSymbol, testInterval);
    klineWebSockets.push(ws);
    
    // 5. Simulación del ciclo ultra-rápido
    console.log('\n⚡ Testing Ultra-Fast Cycle...');
    this.startUltraFastCycle(testSymbol, testInterval);
    
    // Mostrar stats cada 10 segundos
    const statsInterval = setInterval(() => {
      this.showStats();
    }, 10000);
    
    // Cleanup después de 30 segundos
    setTimeout(() => {
      console.log('\n🛑 Stopping all tests...');
      
      clearInterval(statsInterval);
      
      [...tickerWebSockets, ...klineWebSockets].forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      
      this.showStats();
      console.log('✅ Debugging completed!');
      process.exit(0);
    }, 30000);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  const streamDebugger = new StreamingDebugger();
  streamDebugger.runFullTest().catch(error => {
    console.error('❌ Debugging failed:', error);
    process.exit(1);
  });
}

module.exports = StreamingDebugger;
