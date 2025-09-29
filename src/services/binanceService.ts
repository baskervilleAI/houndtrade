// Binance API returns arrays, not objects
// [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades, takerBuyBaseAssetVolume, takerBuyQuoteAssetVolume, ignore]
import { Platform } from 'react-native';
import { debugLogger } from '../utils/debugLogger';

type BinanceKlineData = [
  number, // openTime
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // closeTime
  string, // quoteAssetVolume
  number, // numberOfTrades
  string, // takerBuyBaseAssetVolume
  string, // takerBuyQuoteAssetVolume
  string  // ignore
];

interface BinanceTicker24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades?: number;
  quoteVolume?: number;
}

export interface TickerData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  trades24h: number;
  timestamp: string;
  openPrice: number;
  prevClosePrice: number;
  weightedAvgPrice: number;
}

class BinanceService {
  private readonly BASE_URL = 'https://api.binance.com/api/v3';  // Direct API for all platforms
  private readonly WS_BASE_URL = 'wss://stream.binance.com:9443/ws';
  private websockets: Map<string, WebSocket> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 3; // Reduced to fail faster
  private readonly RECONNECT_DELAY = 3000;
  private readonly MAX_CONCURRENT_CONNECTIONS = 5; // Reduced to avoid overload
  private connectionQueue: Array<() => void> = [];
  private isProcessingQueue = false;
  
  // Polling fallback system
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private pollingCallbacks: Map<string, Set<(data: any) => void>> = new Map();
  private readonly POLLING_INTERVAL = 1000; // 1 second polling - optimized for faster updates
  
  // Cache for storing candle data to avoid unnecessary requests
  private candleCache: Map<string, { data: CandleData[], lastUpdate: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache
  
  // Fast update optimization
  private lastCandleUpdates: Map<string, CandleData> = new Map();
  private updateCallbacks: Map<string, Set<(candle: CandleData) => void>> = new Map();
  
  // Fallback for invalid data to prevent NaN values
  private lastValidPrice: number = 50000; // Default to reasonable BTC price

  /**
   * Get platform-specific fetch options to avoid CORS issues
   */
  private getFetchOptions(): RequestInit {
    return Platform.OS === 'web' ? {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    } : {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    };
  }

  /**
   * Start polling as fallback when WebSocket fails
   */
  private startPollingFallback(
    symbol: string,
    onUpdate: (ticker: TickerData) => void,
    onError?: (error: Error) => void
  ): () => void {
    const pollKey = `${symbol}_poll`;
    
    if (process.env.NODE_ENV === 'development') {
      debugLogger.log('STREAMING', `Iniciando polling para ${symbol}`);
    }
    
    // Store callback
    if (!this.pollingCallbacks.has(pollKey)) {
      this.pollingCallbacks.set(pollKey, new Set());
    }
    this.pollingCallbacks.get(pollKey)!.add(onUpdate);
    
    // Don't start new polling if already exists
    if (this.pollingIntervals.has(pollKey)) {
      return () => {
        const callbacks = this.pollingCallbacks.get(pollKey);
        if (callbacks) {
          callbacks.delete(onUpdate);
          if (callbacks.size === 0) {
            this.stopPolling(pollKey);
          }
        }
      };
    }
    
    const pollFunction = async () => {
      try {
        const ticker = await this.getTicker24hr(symbol);
        const tickerData = Array.isArray(ticker) ? ticker[0] : ticker;
        
        // Broadcast to all callbacks
        const callbacks = this.pollingCallbacks.get(pollKey);
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              callback(tickerData as TickerData);
            } catch (error) {
              debugLogger.error(`Error in polling callback for ${symbol}:`, error);
            }
          });
        }
      } catch (error) {
        debugLogger.error(`Polling error for ${symbol}:`, error);
        onError?.(error as Error);
      }
    };
    
    // Start immediate poll and then interval
    pollFunction();
    const intervalId = setInterval(pollFunction, this.POLLING_INTERVAL);
    this.pollingIntervals.set(pollKey, intervalId);
    
    // Return cleanup function
    return () => {
      const callbacks = this.pollingCallbacks.get(pollKey);
      if (callbacks) {
        callbacks.delete(onUpdate);
        if (callbacks.size === 0) {
          this.stopPolling(pollKey);
        }
      }
    };
  }

  /**
   * Stop polling for a symbol
   */
  private stopPolling(pollKey: string): void {
    const intervalId = this.pollingIntervals.get(pollKey);
    if (intervalId) {
      clearInterval(intervalId);
      this.pollingIntervals.delete(pollKey);
      this.pollingCallbacks.delete(pollKey);
      // Solo log del polling stop en debug
      if (process.env.NODE_ENV === 'development') {
        debugLogger.log('STREAMING', `Polling detenido: ${pollKey}`);
      }
    }
  }

  /**
   * Process queued WebSocket connections
   */
  private processConnectionQueue(): void {
    if (this.isProcessingQueue || this.connectionQueue.length === 0) {
      return;
    }

    if (this.websockets.size < this.MAX_CONCURRENT_CONNECTIONS) {
      this.isProcessingQueue = true;
      const nextConnection = this.connectionQueue.shift();
      if (nextConnection) {
        setTimeout(() => {
          nextConnection();
          this.isProcessingQueue = false;
          this.processConnectionQueue(); // Process next in queue
        }, 1000); // 1 second delay between connections
      } else {
        this.isProcessingQueue = false;
      }
    }
  }

  /**
   * Get only the latest candles efficiently - minimizes data transfer
   * ULTRA-OPTIMIZED for 10ms cycle requests
   */
  async getLatestKlines(
    symbol: string,
    interval: string,
    limit: number = 1 // Default to 1 for ultra-fast updates
  ): Promise<CandleData[]> {
    // For ultra-fast updates (limit=1), skip cache to ensure freshest data
    const useCache = limit > 1;
    const cacheKey = `${symbol}_${interval}`;
    
    if (useCache) {
      const cached = this.candleCache.get(cacheKey);
      if (cached && (Date.now() - cached.lastUpdate) < this.CACHE_DURATION) {
        return cached.data.slice(-limit);
      }
    }

    try {
      const params = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        interval,
        limit: Math.min(limit, 1000).toString(),
      });

      // Use minimal logging for ultra-fast requests
      if (limit === 1) {
        // Solo log cada 1000 requests para no saturar
        if (!this.logCounters) this.logCounters = new Map();
        const count = (this.logCounters.get(symbol) || 0) + 1;
        this.logCounters.set(symbol, count);
        
        if (count % 1000 === 0) {
          // Eliminar log ultra-verbose
          // console.log(`🚀 Ultra-fast kline ${count} for ${symbol}`);
        }
      }

      const response = await fetch(`${this.BASE_URL}/klines?${params}`, this.getFetchOptions());
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: BinanceKlineData[] = await response.json();
      
      // Ultra-optimized candle mapping with NaN validation
      const candles: CandleData[] = data.map(kline => {
        // Binance API returns arrays: [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades, ...]
        const [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades] = kline;
        
        const timestamp = typeof openTime === 'number' && !isNaN(openTime) 
          ? openTime 
          : Date.now();
        
        // Safe parseFloat with fallback values to prevent NaN
        const parseFloatSafe = (value: any, fallbackPrice?: number): number => {
          if (value === null || value === undefined || value === '') {
            return fallbackPrice || this.lastValidPrice || 50000;
          }
          const parsed = parseFloat(value);
          if (isNaN(parsed) || parsed <= 0) {
            return fallbackPrice || this.lastValidPrice || 50000;
          }
          return parsed;
        };

        const open_val = parseFloatSafe(open);
        const high_val = parseFloatSafe(high, open_val);
        const low_val = parseFloatSafe(low, open_val);
        const close_val = parseFloatSafe(close, open_val);
        const volume_val = parseFloatSafe(volume, 0);
        const quoteVolume_val = parseFloatSafe(quoteAssetVolume, 0);
        
        // Ensure OHLC relationships are valid
        const correctedHigh = Math.max(open_val, high_val, low_val, close_val);
        const correctedLow = Math.min(open_val, high_val, low_val, close_val);
        
        // Validate that we have valid OHLC data
        if (open_val === 0 && close_val === 0) {
          console.warn(`⚠️ Invalid candle data for ${symbol}, using fallback:`, kline);
          const fallbackPrice = this.lastValidPrice || 50000;
          return {
            timestamp: new Date(timestamp).toISOString(),
            open: fallbackPrice,
            high: fallbackPrice,
            low: fallbackPrice,
            close: fallbackPrice,
            volume: volume_val,
            trades: numberOfTrades || 0,
            quoteVolume: quoteVolume_val,
          };
        }

        // Store last valid price for fallback
        this.lastValidPrice = close_val;
        
        return {
          timestamp: new Date(timestamp).toISOString(),
          open: open_val,
          high: correctedHigh,
          low: correctedLow,
          close: close_val,
          volume: Math.max(0, volume_val),
          trades: numberOfTrades || 0,
          quoteVolume: Math.max(0, quoteVolume_val),
        };
      });

      // Only cache if not ultra-fast single requests
      if (useCache && candles.length > 1) {
        this.candleCache.set(cacheKey, {
          data: candles,
          lastUpdate: Date.now()
        });
      }

      return candles;
    } catch (error) {
      // Minimal error logging for ultra-fast requests
      if (limit === 1) {
        console.error(`❌ Ultra-fast error ${symbol}:`, (error as Error).message);
      } else {
        console.error(`❌ Error fetching klines for ${symbol}:`, error);
      }
      throw error;
    }
  }

  // Add log counters for ultra-fast logging
  private logCounters?: Map<string, number>;

  /**
   * Get missing candles efficiently when switching timeframes
   */
  async getMissingKlines(
    symbol: string,
    interval: string,
    lastTimestamp: string,
    limit: number = 50
  ): Promise<CandleData[]> {
    try {
      const startTime = new Date(lastTimestamp).getTime() + 1;
      const params = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        interval,
        startTime: startTime.toString(),
        limit: limit.toString(),
      });

      // Solo log en debug
      if (process.env.NODE_ENV === 'development') {
        // Solo log importante de datos faltantes, no spam
        if (process.env.NODE_ENV === 'development') {
          debugLogger.log('STREAMING', `Buscando klines faltantes para ${symbol}`);
        }
      }

      const response = await fetch(`${this.BASE_URL}/klines?${params}`, this.getFetchOptions());
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data: BinanceKlineData[] = await response.json();
      
      const candles: CandleData[] = data.map(kline => {
        // Binance API returns arrays: [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades, ...]
        const [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades] = kline;
        
        // Ensure timestamp is a valid number with proper validation
        let timestamp: number;
        
        if (typeof openTime === 'number' && !isNaN(openTime)) {
          timestamp = openTime;
        } else if (typeof openTime === 'string' && openTime) {
          timestamp = parseInt(openTime);
        } else {
          // Fallback to current time if invalid
          console.warn('Invalid timestamp in getMissingKlines:', openTime);
          timestamp = Date.now();
        }
        
        // Additional validation
        if (isNaN(timestamp) || timestamp <= 0) {
          console.warn('Invalid timestamp after parsing in getMissingKlines:', timestamp);
          timestamp = Date.now();
        }
        
        return {
          timestamp: new Date(timestamp).toISOString(),
          open: parseFloat(open),
          high: parseFloat(high),
          low: parseFloat(low),
          close: parseFloat(close),
          volume: parseFloat(volume),
          trades: numberOfTrades,
          quoteVolume: parseFloat(quoteAssetVolume),
        };
      });

      // Solo log en debug
      if (process.env.NODE_ENV === 'development') {
        // Solo log importante de carga de datos
        debugLogger.log('STREAMING', `${candles.length} velas cargadas para ${symbol}`);
      }
      return candles;
    } catch (error) {
      console.error(`❌ Error fetching missing klines for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Get historical kline/candlestick data
   */
  async getKlines(
    symbol: string,
    interval: string,
    limit: number = 1000,
    startTime?: number,
    endTime?: number
  ): Promise<CandleData[]> {
    try {
      const params = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        interval,
        limit: limit.toString(),
      });

      if (startTime) params.append('startTime', startTime.toString());
      if (endTime) params.append('endTime', endTime.toString());

      // Log detallado solo en development
      if (process.env.NODE_ENV === 'development') {
        debugLogger.log('STREAMING', `Fetching Binance klines for ${symbol} ${interval}:`, {
          url: `${this.BASE_URL}/klines?${params}`,
          limit,
          startTime: startTime ? new Date(startTime).toISOString() : undefined,
          endTime: endTime ? new Date(endTime).toISOString() : undefined,
        });
      }

      const response = await fetch(`${this.BASE_URL}/klines?${params}`, this.getFetchOptions());
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data: BinanceKlineData[] = await response.json();
      
      const candles: CandleData[] = data.map(kline => {
        // Binance API returns arrays: [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades, ...]
        const [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades] = kline;
        
        // Ensure timestamp is a valid number with proper validation
        let timestamp: number;
        
        if (typeof openTime === 'number' && !isNaN(openTime)) {
          timestamp = openTime;
        } else if (typeof openTime === 'string' && openTime) {
          timestamp = parseInt(openTime);
        } else {
          // Fallback to current time if invalid
          console.warn('Invalid timestamp in getKlines:', openTime);
          timestamp = Date.now();
        }
        
        // Additional validation
        if (isNaN(timestamp) || timestamp <= 0) {
          console.warn('Invalid timestamp after parsing in getKlines:', timestamp);
          timestamp = Date.now();
        }
        
        return {
          timestamp: new Date(timestamp).toISOString(),
          open: parseFloat(open),
          high: parseFloat(high),
          low: parseFloat(low),
          close: parseFloat(close),
          volume: parseFloat(volume),
          trades: numberOfTrades,
          quoteVolume: parseFloat(quoteAssetVolume),
        };
      });

      // Log del resultado solo en desarrollo
      if (process.env.NODE_ENV === 'development') {
        debugLogger.log('STREAMING', `Successfully fetched ${candles.length} candles for ${symbol}:`, {
          firstCandle: candles[0],
          lastCandle: candles[candles.length - 1],
          priceRange: {
            min: Math.min(...candles.map(c => c.low)),
            max: Math.max(...candles.map(c => c.high)),
          }
        });
      }

      return candles;
    } catch (error) {
      debugLogger.error(`Error fetching klines for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get 24hr ticker statistics
   */
  async getTicker24hr(symbol?: string): Promise<TickerData | TickerData[]> {
    try {
      const url = symbol 
        ? `${this.BASE_URL}/ticker/24hr?symbol=${symbol.toUpperCase()}`
        : `${this.BASE_URL}/ticker/24hr`;

      const response = await fetch(url, this.getFetchOptions());
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data: BinanceTicker24hr | BinanceTicker24hr[] = await response.json();
      
      const transformTicker = (ticker: BinanceTicker24hr): TickerData => {
        const price = parseFloat(ticker.lastPrice);
        
        // Validate price ranges to catch API errors (updated for current market conditions)
        const priceValidation = {
          BTCUSDT: { min: 50000, max: 250000 },  // BTC is currently around $115k
          ETHUSDT: { min: 1000, max: 15000 },
          BNBUSDT: { min: 100, max: 2000 },
          SOLUSDT: { min: 10, max: 1000 },
          ADAUSDT: { min: 0.1, max: 5 },
        };
        
        const validation = priceValidation[ticker.symbol as keyof typeof priceValidation];
        if (validation && (price < validation.min || price > validation.max)) {
          console.warn(`⚠️ Suspicious price for ${ticker.symbol}: ${price} (expected ${validation.min}-${validation.max})`);
        }
        
        return {
          symbol: ticker.symbol,
          price: price,
          change24h: parseFloat(ticker.priceChange),
          changePercent24h: parseFloat(ticker.priceChangePercent),
          high24h: parseFloat(ticker.highPrice),
          low24h: parseFloat(ticker.lowPrice),
          volume24h: parseFloat(ticker.volume),
          quoteVolume24h: parseFloat(ticker.quoteVolume),
          trades24h: ticker.count,
          timestamp: new Date().toISOString(),
          openPrice: parseFloat(ticker.openPrice),
          prevClosePrice: parseFloat(ticker.prevClosePrice),
          weightedAvgPrice: parseFloat(ticker.weightedAvgPrice),
        };
      };

      if (Array.isArray(data)) {
        const tickers = data.map(transformTicker);
        return tickers;
      } else {
        const ticker = transformTicker(data);
        return ticker;
      }
    } catch (error) {
      console.error(`❌ Error fetching ticker for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get current price for a symbol
   */
  async getPrice(symbol: string): Promise<number> {
    try {
      const response = await fetch(`${this.BASE_URL}/ticker/price?symbol=${symbol.toUpperCase()}`, this.getFetchOptions());
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      console.error(`❌ Error fetching price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time kline updates via WebSocket - OPTIMIZED for speed
   */
  subscribeToKlines(
    symbol: string,
    interval: string,
    onUpdate: (candle: CandleData) => void,
    onError?: (error: Error) => void
  ): () => void {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const wsUrl = `${this.WS_BASE_URL}/${streamName}`;

    // Store callback for fast updates
    if (!this.updateCallbacks.has(streamName)) {
      this.updateCallbacks.set(streamName, new Set());
    }
    this.updateCallbacks.get(streamName)!.add(onUpdate);

    const connectWebSocket = () => {
      // Reuse existing connection if available
      if (this.websockets.has(streamName)) {
        debugLogger.log('STREAMING', `Reusing existing WebSocket for ${streamName}`);
        return;
      }

      const ws = new WebSocket(wsUrl);
      this.websockets.set(streamName, ws);

      ws.onopen = () => {
        debugLogger.log('STREAMING', `FAST WebSocket connected for ${streamName}`);
        this.reconnectAttempts.set(streamName, 0);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const kline = data.k;
          
          if (kline) {
            // Ensure timestamp is a valid number with proper validation
            let timestamp: number;
            
            if (typeof kline.t === 'number' && !isNaN(kline.t)) {
              timestamp = kline.t;
            } else if (typeof kline.t === 'string' && kline.t) {
              timestamp = parseInt(kline.t);
            } else {
              // Fallback to current time if invalid
              console.warn('Invalid timestamp in WebSocket kline data:', kline.t);
              timestamp = Date.now();
            }
            
            // Additional validation
            if (isNaN(timestamp) || timestamp <= 0) {
              console.warn('Invalid timestamp after parsing:', timestamp);
              timestamp = Date.now();
            }
            
            const candle: CandleData = {
              timestamp: new Date(timestamp).toISOString(),
              open: parseFloat(kline.o),
              high: parseFloat(kline.h),
              low: parseFloat(kline.l),
              close: parseFloat(kline.c),
              volume: parseFloat(kline.v),
              trades: kline.n,
              quoteVolume: parseFloat(kline.q),
            };

            // Cache last candle for instant access
            this.lastCandleUpdates.set(streamName, candle);

            // Fast broadcast to all callbacks
            const callbacks = this.updateCallbacks.get(streamName);
            if (callbacks) {
              callbacks.forEach(callback => {
                try {
                  callback(candle);
                } catch (error) {
                  debugLogger.error(`Error in callback for ${streamName}:`, error);
                }
              });
            }

            // Log only for new closed candles y solo en desarrollo
            if (kline.x && process.env.NODE_ENV === 'development') {
              debugLogger.log('STREAMING', `NEW CANDLE ${symbol}:`, {
                price: candle.close,
                volume: candle.volume,
                time: new Date(candle.timestamp).toLocaleTimeString()
              });
            }
          }
        } catch (error) {
          debugLogger.error(`Error parsing WebSocket message for ${streamName}:`, error);
          onError?.(error as Error);
        }
      };

      ws.onerror = (error) => {
        debugLogger.error(`WebSocket error for ${streamName}:`, error);
        onError?.(new Error(`WebSocket error for ${streamName}`));
      };

      ws.onclose = (event) => {
        debugLogger.log('STREAMING', `WebSocket closed for ${streamName}:`, { code: event.code });
        this.websockets.delete(streamName);
        
        // Only reconnect if it wasn't a clean close and we still have active callbacks
        if (event.code !== 1000 && this.updateCallbacks.has(streamName) && this.updateCallbacks.get(streamName)!.size > 0) {
          const attempts = this.reconnectAttempts.get(streamName) || 0;
          if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts.set(streamName, attempts + 1);
            const delay = Math.min(1000 * Math.pow(2, attempts), 10000); // Exponential backoff, max 10s
            debugLogger.log('STREAMING', `Reconnecting ${streamName} in ${delay}ms (${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(connectWebSocket, delay);
          } else {
            console.error(`❌ Max reconnection attempts reached for ${streamName}`);
            onError?.(new Error(`Max reconnection attempts reached for ${streamName}`));
          }
        }
      };
    };

    connectWebSocket();

    // Return optimized unsubscribe function
    return () => {
      const callbacks = this.updateCallbacks.get(streamName);
      if (callbacks) {
        callbacks.delete(onUpdate);
        
        // Only close WebSocket if no more callbacks
        if (callbacks.size === 0) {
          const ws = this.websockets.get(streamName);
          if (ws) {
            ws.close(1000, 'No more subscribers');
            this.websockets.delete(streamName);
            this.updateCallbacks.delete(streamName);
            this.lastCandleUpdates.delete(streamName);
          }
        }
      }
    };
  }

  /**
   * Subscribe to real-time ticker updates via WebSocket with polling fallback
   */
  subscribeToTicker(
    symbol: string,
    onUpdate: (ticker: TickerData) => void,
    onError?: (error: Error) => void
  ): () => void {
    const streamName = `${symbol.toLowerCase()}@ticker`;

    let wsUnsubscribe: (() => void) | null = null;
    let pollingUnsubscribe: (() => void) | null = null;
    let isUsingWebSocket = true;

    const tryWebSocket = () => {
      const wsUrl = `${this.WS_BASE_URL}/${streamName}`;
      
      // Check if we already have this connection
      if (this.websockets.has(streamName)) {
        return;
      }

      // Check connection limit
      if (this.websockets.size >= this.MAX_CONCURRENT_CONNECTIONS) {
        switchToPolling();
        return;
      }

      try {
        const ws = new WebSocket(wsUrl);
        this.websockets.set(streamName, ws);
        let wsConnected = false;

        ws.onopen = () => {
          this.reconnectAttempts.set(streamName, 0);
          wsConnected = true;
          isUsingWebSocket = true;
          
          // Stop polling if it was running
          if (pollingUnsubscribe) {
            pollingUnsubscribe();
            pollingUnsubscribe = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            const ticker: TickerData = {
              symbol: data.s,
              price: parseFloat(data.c),
              change24h: parseFloat(data.P),
              changePercent24h: parseFloat(data.P),
              high24h: parseFloat(data.h),
              low24h: parseFloat(data.l),
              volume24h: parseFloat(data.v),
              quoteVolume24h: parseFloat(data.q),
              trades24h: data.n,
              timestamp: new Date().toISOString(),
              openPrice: parseFloat(data.o),
              prevClosePrice: parseFloat(data.x),
              weightedAvgPrice: parseFloat(data.w),
            };

            onUpdate(ticker);
          } catch (error) {
            console.error(`❌ Error parsing ticker WebSocket message for ${streamName}:`, error);
          }
        };

        ws.onerror = (error) => {
          console.error(`❌ Ticker WebSocket error for ${streamName}:`, error);
          if (!wsConnected) {
            // Connection failed, switch to polling immediately
            switchToPolling();
          }
        };

        ws.onclose = (event) => {
          this.websockets.delete(streamName);
          
          // Switch to polling if WebSocket failed
          if (event.code !== 1000 && !pollingUnsubscribe) {
            const attempts = this.reconnectAttempts.get(streamName) || 0;
            if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
              this.reconnectAttempts.set(streamName, attempts + 1);
              setTimeout(tryWebSocket, this.RECONNECT_DELAY * (attempts + 1));
            } else {
              switchToPolling();
            }
          }
        };

        // Set timeout for connection - reduced timeout
        setTimeout(() => {
          if (!wsConnected && ws.readyState !== WebSocket.OPEN) {
            if (process.env.NODE_ENV === 'development') {
              debugLogger.log('STREAMING', `WS timeout ${symbol}, usando polling`);
            }
            ws.close();
            switchToPolling();
          }
        }, 1500); // Reduced from 3000 to 1500 for faster fallback

      } catch (error) {
        debugLogger.error(`Error creating WebSocket for ${streamName}:`, error);
        switchToPolling();
      }
    };

    const switchToPolling = () => {
      if (pollingUnsubscribe) return; // Already polling
      
      if (process.env.NODE_ENV === 'development') {
        debugLogger.log('STREAMING', `Fallback a polling: ${symbol}`);
      }
      isUsingWebSocket = false;
      pollingUnsubscribe = this.startPollingFallback(symbol, onUpdate, onError);
    };

    // Try WebSocket first
    tryWebSocket();

    // Return combined unsubscribe function
    return () => {
      const ws = this.websockets.get(streamName);
      if (ws) {
        ws.close(1000, 'Manual disconnect');
        this.websockets.delete(streamName);
        this.reconnectAttempts.delete(streamName);
      }
      
      if (pollingUnsubscribe) {
        pollingUnsubscribe();
        pollingUnsubscribe = null;
      }
    };
  }

  /**
   * Get the last cached candle update instantly
   */
  getLastCandleUpdate(symbol: string, interval: string): CandleData | null {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    return this.lastCandleUpdates.get(streamName) || null;
  }

  /**
   * Clear cache for a specific symbol/interval
   */
  clearCache(symbol?: string, interval?: string): void {
    if (symbol && interval) {
      const cacheKey = `${symbol}_${interval}`;
      this.candleCache.delete(cacheKey);
      // Solo log en desarrollo
      if (process.env.NODE_ENV === 'development') {
        debugLogger.log('STREAMING', `Cleared cache for ${symbol} ${interval}`);
      }
    } else {
      this.candleCache.clear();
      if (process.env.NODE_ENV === 'development') {
        debugLogger.log('STREAMING', `Cleared all cache`);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.candleCache.size,
      keys: Array.from(this.candleCache.keys())
    };
  }

  /**
   * Convert timeframe to Binance interval format
   */
  getIntervalFromTimeframe(timeframe: string): string {
    const intervalMap: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '2h': '2h',
      '4h': '4h',
      '6h': '6h',
      '8h': '8h',
      '12h': '12h',
      '1d': '1d',
      '3d': '3d',
      '1w': '1w',
      '1M': '1M',
    };
    return intervalMap[timeframe] || '1h';
  }

  /**
   * Cleanup all WebSocket connections, polling, and cache
   */
  disconnect(): void {
    // Solo log importante de desconexión
    if (process.env.NODE_ENV === 'development') {
      debugLogger.log('STREAMING', `Disconnecting all connections (${this.websockets.size} WebSockets, ${this.pollingIntervals.size} polling)`);
    }
    
    // Close all WebSockets
    this.websockets.forEach((ws, streamName) => {
      ws.close(1000, 'Service shutdown');
    });
    
    // Stop all polling
    this.pollingIntervals.forEach((intervalId, pollKey) => {
      clearInterval(intervalId);
    });
    
    // Clear all data structures
    this.websockets.clear();
    this.reconnectAttempts.clear();
    this.updateCallbacks.clear();
    this.lastCandleUpdates.clear();
    this.candleCache.clear();
    this.pollingIntervals.clear();
    this.pollingCallbacks.clear();
    
    if (process.env.NODE_ENV === 'development') {
      debugLogger.log('STREAMING', `All connections and cache cleared`);
    }
  }
}

export const binanceService = new BinanceService();