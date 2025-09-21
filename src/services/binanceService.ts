interface BinanceKlineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
  ignore: string;
}

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
  private readonly BASE_URL = 'https://api.binance.com/api/v3';
  private readonly WS_BASE_URL = 'wss://stream.binance.com:9443/ws';
  private websockets: Map<string, WebSocket> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 10; // Increased for better resilience
  private readonly RECONNECT_DELAY = 2000; // Increased slightly for stability
  private readonly MAX_CONCURRENT_CONNECTIONS = 10; // Increased limit
  private connectionQueue: Array<() => void> = [];
  private isProcessingQueue = false;
  
  // Cache for storing candle data to avoid unnecessary requests
  private candleCache: Map<string, { data: CandleData[], lastUpdate: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds cache
  
  // Fast update optimization
  private lastCandleUpdates: Map<string, CandleData> = new Map();
  private updateCallbacks: Map<string, Set<(candle: CandleData) => void>> = new Map();

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
   */
  async getLatestKlines(
    symbol: string,
    interval: string,
    limit: number = 20 // Reduced default for faster response
  ): Promise<CandleData[]> {
    const cacheKey = `${symbol}_${interval}`;
    const cached = this.candleCache.get(cacheKey);
    
    // Check cache first
    if (cached && (Date.now() - cached.lastUpdate) < this.CACHE_DURATION) {
      console.log(`📚 Using cached data for ${symbol} ${interval}`);
      return cached.data.slice(-limit);
    }

    try {
      const params = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        interval,
        limit: Math.min(limit, 100).toString(), // Cap at 100 for speed
      });

      console.log(`⚡ Fast fetching latest ${limit} klines for ${symbol} ${interval}`);

      const response = await fetch(`${this.BASE_URL}/klines?${params}`);
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data: BinanceKlineData[] = await response.json();
      
      const candles: CandleData[] = data.map(kline => ({
        timestamp: new Date(kline.openTime).toISOString(),
        open: parseFloat(kline.open),
        high: parseFloat(kline.high),
        low: parseFloat(kline.low),
        close: parseFloat(kline.close),
        volume: parseFloat(kline.volume),
        trades: kline.numberOfTrades,
        quoteVolume: parseFloat(kline.quoteAssetVolume),
      }));

      // Update cache
      this.candleCache.set(cacheKey, {
        data: candles,
        lastUpdate: Date.now()
      });

      console.log(`✅ Fast loaded ${candles.length} candles for ${symbol}`);
      return candles;
    } catch (error) {
      console.error(`❌ Error fetching latest klines for ${symbol}:`, error);
      throw error;
    }
  }

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

      console.log(`⚡ Fetching missing klines for ${symbol} since ${lastTimestamp}`);

      const response = await fetch(`${this.BASE_URL}/klines?${params}`);
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data: BinanceKlineData[] = await response.json();
      
      const candles: CandleData[] = data.map(kline => ({
        timestamp: new Date(kline.openTime).toISOString(),
        open: parseFloat(kline.open),
        high: parseFloat(kline.high),
        low: parseFloat(kline.low),
        close: parseFloat(kline.close),
        volume: parseFloat(kline.volume),
        trades: kline.numberOfTrades,
        quoteVolume: parseFloat(kline.quoteAssetVolume),
      }));

      console.log(`✅ Loaded ${candles.length} missing candles for ${symbol}`);
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
    limit: number = 500,
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

      console.log(`📊 Fetching Binance klines for ${symbol} ${interval}:`, {
        url: `${this.BASE_URL}/klines?${params}`,
        limit,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
      });

      const response = await fetch(`${this.BASE_URL}/klines?${params}`);
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data: BinanceKlineData[] = await response.json();
      
      const candles: CandleData[] = data.map(kline => ({
        timestamp: new Date(kline.openTime).toISOString(),
        open: parseFloat(kline.open),
        high: parseFloat(kline.high),
        low: parseFloat(kline.low),
        close: parseFloat(kline.close),
        volume: parseFloat(kline.volume),
        trades: kline.numberOfTrades,
        quoteVolume: parseFloat(kline.quoteAssetVolume),
      }));

      console.log(`✅ Successfully fetched ${candles.length} candles for ${symbol}:`, {
        firstCandle: candles[0],
        lastCandle: candles[candles.length - 1],
        priceRange: {
          min: Math.min(...candles.map(c => c.low)),
          max: Math.max(...candles.map(c => c.high)),
        }
      });

      return candles;
    } catch (error) {
      console.error(`❌ Error fetching klines for ${symbol}:`, error);
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

      console.log(`📈 Fetching Binance 24hr ticker:`, { symbol, url });

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const data: BinanceTicker24hr | BinanceTicker24hr[] = await response.json();
      
      const transformTicker = (ticker: BinanceTicker24hr): TickerData => ({
        symbol: ticker.symbol,
        price: parseFloat(ticker.lastPrice),
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
      });

      if (Array.isArray(data)) {
        const tickers = data.map(transformTicker);
        console.log(`✅ Successfully fetched ${tickers.length} tickers`);
        return tickers;
      } else {
        const ticker = transformTicker(data);
        console.log(`✅ Successfully fetched ticker for ${symbol}:`, {
          price: ticker.price,
          change: ticker.changePercent24h,
          volume: ticker.volume24h,
        });
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
      const response = await fetch(`${this.BASE_URL}/ticker/price?symbol=${symbol.toUpperCase()}`);
      
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

    console.log(`� FAST WebSocket subscription:`, { symbol, interval });

    // Store callback for fast updates
    if (!this.updateCallbacks.has(streamName)) {
      this.updateCallbacks.set(streamName, new Set());
    }
    this.updateCallbacks.get(streamName)!.add(onUpdate);

    const connectWebSocket = () => {
      // Reuse existing connection if available
      if (this.websockets.has(streamName)) {
        console.log(`♻️ Reusing existing WebSocket for ${streamName}`);
        return;
      }

      const ws = new WebSocket(wsUrl);
      this.websockets.set(streamName, ws);

      ws.onopen = () => {
        console.log(`⚡ FAST WebSocket connected for ${streamName}`);
        this.reconnectAttempts.set(streamName, 0);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const kline = data.k;
          
          if (kline) {
            const candle: CandleData = {
              timestamp: new Date(kline.t).toISOString(),
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
                  console.error(`❌ Error in callback for ${streamName}:`, error);
                }
              });
            }

            // Log only for new closed candles to reduce noise
            if (kline.x) {
              console.log(`📊 NEW CANDLE ${symbol}:`, {
                price: candle.close,
                volume: candle.volume,
                time: new Date(candle.timestamp).toLocaleTimeString()
              });
            }
          }
        } catch (error) {
          console.error(`❌ Error parsing WebSocket message for ${streamName}:`, error);
          onError?.(error as Error);
        }
      };

      ws.onerror = (error) => {
        console.error(`❌ WebSocket error for ${streamName}:`, error);
        onError?.(new Error(`WebSocket error for ${streamName}`));
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed for ${streamName}:`, { code: event.code });
        this.websockets.delete(streamName);
        
        // Fast reconnect for critical streams
        if (event.code !== 1000 && this.updateCallbacks.has(streamName) && this.updateCallbacks.get(streamName)!.size > 0) {
          const attempts = this.reconnectAttempts.get(streamName) || 0;
          if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts.set(streamName, attempts + 1);
            console.log(`🔄 Fast reconnect ${streamName} (${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(connectWebSocket, this.RECONNECT_DELAY); // Fast reconnect
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
            console.log(`🔌 Closing unused WebSocket for ${streamName}`);
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
   * Subscribe to real-time ticker updates via WebSocket
   */
  subscribeToTicker(
    symbol: string,
    onUpdate: (ticker: TickerData) => void,
    onError?: (error: Error) => void
  ): () => void {
    const streamName = `${symbol.toLowerCase()}@ticker`;
    const wsUrl = `${this.WS_BASE_URL}/${streamName}`;

    console.log(`🔌 Subscribing to ticker WebSocket:`, { symbol, wsUrl });

    const connectWebSocket = () => {
      // Check if we already have this connection
      if (this.websockets.has(streamName)) {
        console.log(`⚠️ WebSocket already exists for ${streamName}, skipping`);
        return;
      }

      // Check connection limit
      if (this.websockets.size >= this.MAX_CONCURRENT_CONNECTIONS) {
        console.log(`⚠️ Max connections reached (${this.MAX_CONCURRENT_CONNECTIONS}), queueing ${streamName}`);
        this.connectionQueue.push(connectWebSocket);
        this.processConnectionQueue();
        return;
      }

      try {
        const ws = new WebSocket(wsUrl);
        this.websockets.set(streamName, ws);

        ws.onopen = () => {
          console.log(`✅ Ticker WebSocket connected for ${streamName}`);
          this.reconnectAttempts.set(streamName, 0);
          this.processConnectionQueue(); // Process any queued connections
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

          console.log(`📈 Real-time ticker update for ${symbol}:`, {
            price: ticker.price,
            change: ticker.changePercent24h,
          });

          onUpdate(ticker);
        } catch (error) {
          console.error(`❌ Error parsing ticker WebSocket message for ${streamName}:`, error);
          onError?.(error as Error);
        }
      };

      ws.onerror = (error) => {
        console.error(`❌ Ticker WebSocket error for ${streamName}:`, error);
        onError?.(new Error(`Ticker WebSocket error for ${streamName}`));
      };

        ws.onclose = (event) => {
          console.log(`🔌 Ticker WebSocket closed for ${streamName}:`, { code: event.code, reason: event.reason });
          this.websockets.delete(streamName);
          
          // Attempt to reconnect if not manually closed
          if (event.code !== 1000) {
            const attempts = this.reconnectAttempts.get(streamName) || 0;
            if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
              this.reconnectAttempts.set(streamName, attempts + 1);
              console.log(`🔄 Attempting to reconnect ticker ${streamName} (${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
              setTimeout(connectWebSocket, this.RECONNECT_DELAY * (attempts + 1)); // Exponential backoff
            } else {
              console.error(`❌ Max reconnection attempts reached for ticker ${streamName}`);
              onError?.(new Error(`Failed to reconnect to ticker ${streamName} after ${this.MAX_RECONNECT_ATTEMPTS} attempts`));
            }
          }
          
          this.processConnectionQueue(); // Process any queued connections
        };
      } catch (error) {
        console.error(`❌ Error creating WebSocket for ${streamName}:`, error);
        onError?.(error as Error);
      }
    };

    connectWebSocket();

    // Return unsubscribe function
    return () => {
      const ws = this.websockets.get(streamName);
      if (ws) {
        console.log(`🔌 Unsubscribing from ticker ${streamName}`);
        ws.close(1000, 'Manual disconnect');
        this.websockets.delete(streamName);
        this.reconnectAttempts.delete(streamName);
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
      console.log(`🗑️ Cleared cache for ${symbol} ${interval}`);
    } else {
      this.candleCache.clear();
      console.log(`🗑️ Cleared all cache`);
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
   * Cleanup all WebSocket connections and cache
   */
  disconnect(): void {
    console.log(`🔌 Disconnecting all WebSocket connections (${this.websockets.size})`);
    
    this.websockets.forEach((ws, streamName) => {
      ws.close(1000, 'Service shutdown');
    });
    
    this.websockets.clear();
    this.reconnectAttempts.clear();
    this.updateCallbacks.clear();
    this.lastCandleUpdates.clear();
    this.candleCache.clear();
    
    console.log(`✅ All connections and cache cleared`);
  }
}

export const binanceService = new BinanceService();