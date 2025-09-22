/**
 * Script de prueba para verificar que los datos de velas japonesas lleguen correctamente
 * desde la API de Binance y se procesen apropiadamente.
 */

const https = require('https');

// Función para realizar request a la API de Binance
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Función para validar datos de vela
function validateCandle(candle) {
  const [openTime, open, high, low, close, volume] = candle;
  
  const ohlc = [parseFloat(open), parseFloat(high), parseFloat(low), parseFloat(close)];
  const vol = parseFloat(volume);
  
  // Verificar que todos los valores sean números válidos
  for (const value of ohlc) {
    if (isNaN(value) || value <= 0) {
      return false;
    }
  }
  
  if (isNaN(vol) || vol < 0) {
    return false;
  }
  
  // Verificar relaciones OHLC
  const [o, h, l, c] = ohlc;
  if (h < Math.max(o, c) || h < l || l > Math.min(o, c)) {
    return false;
  }
  
  return true;
}

// Función principal de prueba
async function testCandleData() {
  console.log('🧪 Iniciando test de datos de velas japonesas...\n');
  
  const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
  const intervals = ['1m', '5m', '1h'];
  
  for (const symbol of symbols) {
    for (const interval of intervals) {
      try {
        console.log(`📊 Probando ${symbol} ${interval}...`);
        
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=10`;
        const response = await makeRequest(url);
        
        if (!Array.isArray(response)) {
          console.error(`❌ ${symbol} ${interval}: Respuesta no es un array`);
          continue;
        }
        
        console.log(`✅ ${symbol} ${interval}: Recibidas ${response.length} velas`);
        
        // Validar cada vela
        let validCandles = 0;
        for (let i = 0; i < response.length; i++) {
          const candle = response[i];
          if (validateCandle(candle)) {
            validCandles++;
          } else {
            console.warn(`⚠️ ${symbol} ${interval}: Vela ${i} inválida:`, candle.slice(0, 6));
          }
        }
        
        console.log(`📈 ${symbol} ${interval}: ${validCandles}/${response.length} velas válidas`);
        
        // Mostrar muestra de datos
        if (response.length > 0) {
          const lastCandle = response[response.length - 1];
          const [openTime, open, high, low, close, volume] = lastCandle;
          
          console.log(`📊 Última vela ${symbol} ${interval}:`);
          console.log(`   Tiempo: ${new Date(openTime).toISOString()}`);
          console.log(`   OHLC: ${open} | ${high} | ${low} | ${close}`);
          console.log(`   Volumen: ${volume}`);
        }
        
        console.log('');
        
      } catch (error) {
        console.error(`❌ Error probando ${symbol} ${interval}:`, error.message);
      }
    }
  }
  
  console.log('🎯 Test completado!\n');
  
  // Test de transformación de datos
  console.log('🔄 Probando transformación a formato Chart.js...');
  
  try {
    const url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=5';
    const response = await makeRequest(url);
    
    const transformedData = response.map(kline => {
      const [openTime, open, high, low, close, volume] = kline;
      
      return {
        x: new Date(openTime).getTime(),
        o: parseFloat(open),
        h: parseFloat(high),
        l: parseFloat(low),
        c: parseFloat(close),
      };
    });
    
    console.log('✅ Datos transformados para Chart.js:');
    console.log(JSON.stringify(transformedData.slice(0, 2), null, 2));
    
  } catch (error) {
    console.error('❌ Error en transformación:', error.message);
  }
}

// Ejecutar test
testCandleData().catch(console.error);
