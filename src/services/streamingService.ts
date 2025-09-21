import { binanceService, CandleData, TickerData } from './binanceService';

interface StreamingCallbacks {
  onTickerUpdate?: (ticker: TickerData) => void;
  onCandleUpdate?: (candle: CandleData) => void;
  onError?: (error: Error) => void;
}

interface StreamingSubscription {
  symbol: string;
  interval?: string;
  callbacks: StreamingCallbacks;
  unsubscribeTicker?: () => void;
  unsubscribeCandle?: () => void;
}

class StreamingService {
  private subscriptions: Map<string, StreamingSubscription> = new Map();
  private isInitialized = false;

  /**
   * Initialize the streaming service with default subscriptions
   */
  async initialize(symbols: string[] = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT']) {
    if (this.isInitialized) {
      return;
    }

    // Load initial ticker data for all symbols
    try {
      for (const symbol of symbols) {
        try {
          const ticker = await binanceService.getTicker24hr(symbol);
          const tickerData = Array.isArray(ticker) ? ticker[0] : ticker;
        } catch (error) {
          console.warn(`⚠️ Failed to load initial ticker for ${symbol}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error loading initial ticker data:', error);
    }

    this.isInitialized = true;
  }

  /**
   * Subscribe to both ticker and candle updates for a symbol
   */
  subscribe(
    symbol: string, 
    interval: string = '1m', 
    callbacks: StreamingCallbacks
  ): () => void {
    const key = `${symbol}_${interval}`;

    // Check if we already have a subscription
    let subscription = this.subscriptions.get(key);
    
    if (subscription) {
      // Update callbacks
      subscription.callbacks = { ...subscription.callbacks, ...callbacks };
    } else {
      // Create new subscription
      subscription = {
        symbol,
        interval,
        callbacks,
      };
      this.subscriptions.set(key, subscription);
    }

    // Setup ticker subscription if callback provided
    if (callbacks.onTickerUpdate && !subscription.unsubscribeTicker) {
      try {
        subscription.unsubscribeTicker = binanceService.subscribeToTicker(
          symbol,
          (ticker) => {
            callbacks.onTickerUpdate?.(ticker);
          },
          (error) => {
            console.error(`❌ Ticker error for ${symbol}:`, error);
            callbacks.onError?.(error);
          }
        );
      } catch (error) {
        console.error(`❌ Failed to setup ticker subscription for ${symbol}:`, error);
        callbacks.onError?.(error as Error);
      }
    }

    // Setup candle subscription if callback provided
    if (callbacks.onCandleUpdate && !subscription.unsubscribeCandle) {
      try {
        subscription.unsubscribeCandle = binanceService.subscribeToKlines(
          symbol,
          binanceService.getIntervalFromTimeframe(interval),
          (candle) => {
            callbacks.onCandleUpdate?.(candle);
          },
          (error) => {
            console.error(`❌ Candle error for ${key}:`, error);
            callbacks.onError?.(error);
          }
        );
      } catch (error) {
        console.error(`❌ Failed to setup candle subscription for ${key}:`, error);
        callbacks.onError?.(error as Error);
      }
    }

    // Return unsubscribe function
    return () => {
      const sub = this.subscriptions.get(key);
      if (sub) {
        sub.unsubscribeTicker?.();
        sub.unsubscribeCandle?.();
        
        this.subscriptions.delete(key);
      }
    };
  }

  /**
   * Subscribe only to ticker updates
   */
  subscribeToTicker(symbol: string, onUpdate: (ticker: TickerData) => void, onError?: (error: Error) => void): () => void {
    return this.subscribe(symbol, '1m', { onTickerUpdate: onUpdate, onError });
  }

  /**
   * Subscribe only to candle updates
   */
  subscribeToCandles(
    symbol: string, 
    interval: string, 
    onUpdate: (candle: CandleData) => void, 
    onError?: (error: Error) => void
  ): () => void {
    return this.subscribe(symbol, interval, { onCandleUpdate: onUpdate, onError });
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Force reconnect all subscriptions
   */
  reconnectAll(): void {
    const currentSubscriptions = Array.from(this.subscriptions.entries());
    
    // Clear all subscriptions
    this.subscriptions.forEach((sub) => {
      sub.unsubscribeTicker?.();
      sub.unsubscribeCandle?.();
    });
    this.subscriptions.clear();
    
    // Recreate subscriptions
    currentSubscriptions.forEach(([key, sub]) => {
      setTimeout(() => {
        this.subscribe(sub.symbol, sub.interval || '1m', sub.callbacks);
      }, 1000); // Delay to avoid overwhelming the API
    });
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribeTicker?.();
      sub.unsubscribeCandle?.();
    });
    
    this.subscriptions.clear();
    this.isInitialized = false;
  }

  /**
   * Get subscription status
   */
  getStatus(): {
    initialized: boolean;
    subscriptions: number;
    symbols: string[];
  } {
    return {
      initialized: this.isInitialized,
      subscriptions: this.subscriptions.size,
      symbols: Array.from(this.subscriptions.values()).map(s => s.symbol),
    };
  }
}

export const streamingService = new StreamingService();
