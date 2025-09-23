export interface WebSocketConfig {
  binanceUrls: string[];
  retryConfig: {
    maxAttempts: number;
    baseDelay: number;
    backoffMultiplier: number;
    connectionTimeout: number;
  };
  pollingConfig: {
    interval: number;
    candlesLimit: number;
  };
}

export const webSocketConfig: WebSocketConfig = {
  binanceUrls: [
    'wss://stream.binance.com:9443/ws/',
    'wss://stream.binance.com/ws/',
    'wss://data-stream.binance.vision/ws/',
    'wss://dstream.binance.com/ws/'
  ],
  retryConfig: {
    maxAttempts: 8,
    baseDelay: 2000,
    backoffMultiplier: 1.5,
    connectionTimeout: 10000
  },
  pollingConfig: {
    interval: 5000, // 5 segundos
    candlesLimit: 2 // Solo últimas 2 velas
  }
};

// Para desarrollo local con proxy CORS
export const devProxyConfig = {
  useProxy: false, // Cambiar a true si usas proxy local
  proxyUrl: 'ws://localhost:8080/ws', // URL del proxy local
  corsProxyHttp: 'http://localhost:8080/api' // Para requests HTTP
};

export default webSocketConfig;
