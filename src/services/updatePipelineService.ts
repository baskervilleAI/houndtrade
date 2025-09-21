import { binanceService, TickerData } from './binanceService';
import { ultraFastStreamingService } from './ultraFastStreamingService';

interface PanelUpdateEvent {
  type: 'price' | 'candle' | 'volume' | 'market_data' | 'portfolio' | 'error';
  symbol: string;
  data: any;
  timestamp: Date;
}

interface UpdatePipelineConfig {
  symbols: string[];
  updateInterval: number; // milliseconds
  enableRealTime: boolean;
  onUpdate: (event: PanelUpdateEvent) => void;
  onError?: (error: Error) => void;
}

/**
 * Central pipeline service that coordinates data updates across all panels
 * Manages: Price updates, Chart data, Market data, Portfolio updates
 */
class UpdatePipelineService {
  private isRunning: boolean = false;
  private config: UpdatePipelineConfig | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, () => void> = new Map();
  private lastUpdates: Map<string, Date> = new Map();
  private errorCount: number = 0;
  private readonly MAX_ERRORS = 10;

  /**
   * Start the update pipeline
   */
  startPipeline(config: UpdatePipelineConfig): void {
    if (this.isRunning) {
      this.stopPipeline();
    }

    this.config = config;
    this.isRunning = true;
    this.errorCount = 0;
    
    console.log('🚀 Iniciando pipeline de actualización para:', config.symbols);

    // Start real-time streaming for each symbol
    if (config.enableRealTime) {
      this.startRealTimeStreaming();
    }

    // Start periodic full updates
    this.startPeriodicUpdates();
  }

  /**
   * Stop the pipeline and clean up all subscriptions
   */
  stopPipeline(): void {
    if (!this.isRunning) return;

    console.log('🛑 Deteniendo pipeline de actualización');

    this.isRunning = false;
    
    // Clear interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Unsubscribe from all real-time streams
    this.subscriptions.forEach((unsubscribe, symbol) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error(`Error unsubscribing from ${symbol}:`, error);
      }
    });
    this.subscriptions.clear();

    // Stop ultra-fast streaming service
    ultraFastStreamingService.stopAllStreams();
    
    this.config = null;
  }

  /**
   * Force refresh all data from server
   */
  async forceRefreshAll(): Promise<void> {
    if (!this.config) {
      throw new Error('Pipeline not started');
    }

    console.log('🔄 Forzando actualización completa de todos los paneles...');

    try {
      // Stop real-time temporarily
      const wasRealTime = this.config.enableRealTime;
      if (wasRealTime) {
        this.stopRealTimeStreaming();
      }

      // Clear all caches
      binanceService.clearCache();

      // Wait for clean state
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fetch fresh data for all symbols
      const updatePromises = this.config.symbols.map(async (symbol) => {
        try {
          // Get fresh market data
          const [price, klines, tickerResult] = await Promise.all([
            binanceService.getPrice(symbol),
            binanceService.getKlines(symbol, '1m', 100),
            binanceService.getTicker24hr(symbol),
          ]);

          // Handle ticker result (can be array or single ticker)
          const ticker = Array.isArray(tickerResult) ? tickerResult[0] : tickerResult;

          // Emit updates
          this.emitUpdate({
            type: 'price',
            symbol,
            data: { price, ticker },
            timestamp: new Date(),
          });

          this.emitUpdate({
            type: 'candle',
            symbol,
            data: klines,
            timestamp: new Date(),
          });

          this.emitUpdate({
            type: 'market_data',
            symbol,
            data: ticker,
            timestamp: new Date(),
          });

          console.log(`✅ Datos actualizados para ${symbol}`);
        } catch (error) {
          console.error(`❌ Error actualizando ${symbol}:`, error);
          this.emitUpdate({
            type: 'error',
            symbol,
            data: { error: (error as Error).message },
            timestamp: new Date(),
          });
        }
      });

      await Promise.allSettled(updatePromises);

      // Restart real-time if it was enabled
      if (wasRealTime) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.startRealTimeStreaming();
      }

      console.log('✅ Actualización completa finalizada');
    } catch (error) {
      console.error('❌ Error en actualización completa:', error);
      this.handleError(error);
    }
  }

  /**
   * Clear all caches and restart data collection
   */
  async clearCacheAndRestart(): Promise<void> {
    if (!this.config) {
      throw new Error('Pipeline not started');
    }

    console.log('🧹 Limpiando cache y reiniciando pipeline...');

    try {
      const currentConfig = { ...this.config };
      
      // Stop everything
      this.stopPipeline();
      
      // Clear service caches
      binanceService.clearCache();
      
      // Wait for clean state
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Restart with same config
      this.startPipeline(currentConfig);
      
      console.log('✅ Pipeline reiniciado con cache limpio');
    } catch (error) {
      console.error('❌ Error reiniciando pipeline:', error);
      this.handleError(error);
    }
  }

  /**
   * Add a symbol to the pipeline
   */
  addSymbol(symbol: string): void {
    if (!this.config) return;
    
    if (!this.config.symbols.includes(symbol)) {
      this.config.symbols.push(symbol);
      
      // Start streaming for the new symbol if real-time is enabled
      if (this.config.enableRealTime) {
        this.startSymbolStreaming(symbol);
      }
      
      console.log(`➕ Símbolo agregado al pipeline: ${symbol}`);
    }
  }

  /**
   * Remove a symbol from the pipeline
   */
  removeSymbol(symbol: string): void {
    if (!this.config) return;
    
    const index = this.config.symbols.indexOf(symbol);
    if (index >= 0) {
      this.config.symbols.splice(index, 1);
      
      // Stop streaming for the symbol
      const unsubscribe = this.subscriptions.get(symbol);
      if (unsubscribe) {
        unsubscribe();
        this.subscriptions.delete(symbol);
      }
      
      console.log(`➖ Símbolo removido del pipeline: ${symbol}`);
    }
  }

  /**
   * Get pipeline statistics
   */
  getStats(): {
    isRunning: boolean;
    symbolCount: number;
    lastUpdateTimes: { [symbol: string]: Date };
    errorCount: number;
  } {
    return {
      isRunning: this.isRunning,
      symbolCount: this.config?.symbols.length || 0,
      lastUpdateTimes: Object.fromEntries(this.lastUpdates),
      errorCount: this.errorCount,
    };
  }

  // Private methods

  private startRealTimeStreaming(): void {
    if (!this.config) return;

    console.log('📡 Iniciando streaming en tiempo real...');
    
    this.config.symbols.forEach(symbol => {
      this.startSymbolStreaming(symbol);
    });
  }

  private startSymbolStreaming(symbol: string): void {
    if (!this.config) return;

    // Start ultra-fast streaming for this symbol
    const unsubscribe = ultraFastStreamingService.startUltraFastStream({
      symbol,
      interval: '1m',
      cycleDelay: 100, // 100ms for pipeline updates
      onUpdate: (candle) => {
        this.emitUpdate({
          type: 'candle',
          symbol,
          data: candle,
          timestamp: new Date(),
        });
        this.lastUpdates.set(symbol, new Date());
      },
      onError: (error) => {
        this.emitUpdate({
          type: 'error',
          symbol,
          data: { error: error.message },
          timestamp: new Date(),
        });
        this.handleError(error);
      }
    });

    this.subscriptions.set(symbol, unsubscribe);
  }

  private stopRealTimeStreaming(): void {
    console.log('📡 Deteniendo streaming en tiempo real...');
    
    this.subscriptions.forEach((unsubscribe, symbol) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error(`Error stopping stream for ${symbol}:`, error);
      }
    });
    this.subscriptions.clear();
  }

  private startPeriodicUpdates(): void {
    if (!this.config) return;

    this.updateInterval = setInterval(async () => {
      if (!this.isRunning || !this.config) return;

      try {
        // Fetch periodic updates (less frequent than real-time)
        await this.fetchPeriodicUpdates();
      } catch (error) {
        this.handleError(error);
      }
    }, this.config.updateInterval);
  }

  private async fetchPeriodicUpdates(): Promise<void> {
    if (!this.config) return;

    // Fetch market data for all symbols
    const updatePromises = this.config.symbols.map(async (symbol) => {
      try {
        const tickerResult = await binanceService.getTicker24hr(symbol);
        const ticker = Array.isArray(tickerResult) ? tickerResult[0] : tickerResult;
        
        this.emitUpdate({
          type: 'market_data',
          symbol,
          data: ticker,
          timestamp: new Date(),
        });

      } catch (error) {
        console.error(`Error fetching periodic update for ${symbol}:`, error);
      }
    });

    await Promise.allSettled(updatePromises);
  }

  private emitUpdate(event: PanelUpdateEvent): void {
    if (!this.config || !this.isRunning) return;

    try {
      this.config.onUpdate(event);
    } catch (error) {
      console.error('Error emitting update:', error);
      this.handleError(error);
    }
  }

  private handleError(error: any): void {
    this.errorCount++;
    
    if (this.config?.onError) {
      this.config.onError(error);
    }

    // Stop pipeline if too many errors
    if (this.errorCount >= this.MAX_ERRORS) {
      console.error(`🚫 Demasiados errores (${this.errorCount}), deteniendo pipeline`);
      this.stopPipeline();
    }
  }
}

export const updatePipelineService = new UpdatePipelineService();
export type { PanelUpdateEvent, UpdatePipelineConfig };
