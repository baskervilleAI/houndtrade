import { debugLogger } from '../utils/debugLogger';

/**
 * Servicio avanzado de simulación de mercado con patrones realistas
 */
export class MarketSimulationService {
  private static instance: MarketSimulationService;
  
  // Estado de precios por símbolo
  private marketData: Map<string, {
    currentPrice: number;
    basePrice: number; // Precio base para oscilaciones
    trend: 'up' | 'down' | 'sideways';
    volatility: number; // 0.01 = 1% volatilidad por update
    momentum: number; // -1 a 1, fuerza de la tendencia actual
    lastUpdate: number;
    priceHistory: { price: number; timestamp: number }[];
    volume: number;
    dailyHigh: number;
    dailyLow: number;
    dailyOpen: number;
  }> = new Map();

  // Configuración de simulación por símbolo
  private symbolConfigs: Map<string, {
    basePrice: number;
    volatility: number;
    trendProbability: number; // Probabilidad de cambio de tendencia
    maxPriceChange: number; // Máximo cambio por tick (porcentaje)
    correlations: { symbol: string; correlation: number }[]; // Correlaciones con otros símbolos
  }> = new Map();

  // Intervalos de actualización
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private subscribers: Map<string, Set<(data: MarketData) => void>> = new Map();

  private constructor() {
    this.initializeDefaultConfigs();
  }

  public static getInstance(): MarketSimulationService {
    if (!MarketSimulationService.instance) {
      MarketSimulationService.instance = new MarketSimulationService();
    }
    return MarketSimulationService.instance;
  }

  /**
   * Inicializa configuraciones predeterminadas para criptomonedas populares
   */
  private initializeDefaultConfigs(): void {
    const configs = {
      'BTCUSDT': {
        basePrice: 45000,
        volatility: 0.015, // 1.5% volatilidad
        trendProbability: 0.05,
        maxPriceChange: 0.003, // Máximo 0.3% por tick
        correlations: [
          { symbol: 'ETHUSDT', correlation: 0.7 },
          { symbol: 'BNBUSDT', correlation: 0.5 }
        ]
      },
      'ETHUSDT': {
        basePrice: 3000,
        volatility: 0.018,
        trendProbability: 0.06,
        maxPriceChange: 0.004,
        correlations: [
          { symbol: 'BTCUSDT', correlation: 0.7 }
        ]
      },
      'BNBUSDT': {
        basePrice: 350,
        volatility: 0.022,
        trendProbability: 0.07,
        maxPriceChange: 0.005,
        correlations: [
          { symbol: 'BTCUSDT', correlation: 0.5 }
        ]
      },
      'ADAUSDT': {
        basePrice: 0.5,
        volatility: 0.025,
        trendProbability: 0.08,
        maxPriceChange: 0.006,
        correlations: []
      },
      'SOLUSDT': {
        basePrice: 100,
        volatility: 0.028,
        trendProbability: 0.09,
        maxPriceChange: 0.007,
        correlations: []
      },
      'DOTUSDT': {
        basePrice: 8,
        volatility: 0.024,
        trendProbability: 0.075,
        maxPriceChange: 0.0055,
        correlations: []
      },
      'LINKUSDT': {
        basePrice: 15,
        volatility: 0.026,
        trendProbability: 0.08,
        maxPriceChange: 0.006,
        correlations: []
      },
      'MATICUSDT': {
        basePrice: 1.2,
        volatility: 0.027,
        trendProbability: 0.085,
        maxPriceChange: 0.0065,
        correlations: []
      },
      // Nuevos símbolos agregados
      'XRPUSDT': {
        basePrice: 0.6,
        volatility: 0.030,
        trendProbability: 0.09,
        maxPriceChange: 0.008,
        correlations: []
      },
      'AVAXUSDT': {
        basePrice: 25,
        volatility: 0.032,
        trendProbability: 0.095,
        maxPriceChange: 0.008,
        correlations: []
      },
      'DOGEUSDT': {
        basePrice: 0.08,
        volatility: 0.035,
        trendProbability: 0.10,
        maxPriceChange: 0.009,
        correlations: []
      },
      'ATOMUSDT': {
        basePrice: 8,
        volatility: 0.029,
        trendProbability: 0.08,
        maxPriceChange: 0.007,
        correlations: []
      },
      'BCHUSDT': {
        basePrice: 250,
        volatility: 0.027,
        trendProbability: 0.075,
        maxPriceChange: 0.006,
        correlations: []
      },
      'FILUSDT': {
        basePrice: 4,
        volatility: 0.031,
        trendProbability: 0.09,
        maxPriceChange: 0.008,
        correlations: []
      },
      'OPUSDT': {
        basePrice: 2,
        volatility: 0.033,
        trendProbability: 0.095,
        maxPriceChange: 0.008,
        correlations: []
      },
      'UNIUSDT': {
        basePrice: 8,
        volatility: 0.028,
        trendProbability: 0.08,
        maxPriceChange: 0.007,
        correlations: []
      },
      'LTCUSDT': {
        basePrice: 70,
        volatility: 0.025,
        trendProbability: 0.07,
        maxPriceChange: 0.006,
        correlations: []
      },
      'TRXUSDT': {
        basePrice: 0.1,
        volatility: 0.030,
        trendProbability: 0.085,
        maxPriceChange: 0.007,
        correlations: []
      },
      'APTUSDT': {
        basePrice: 8,
        volatility: 0.032,
        trendProbability: 0.09,
        maxPriceChange: 0.008,
        correlations: []
      },
      'ICPUSDT': {
        basePrice: 12,
        volatility: 0.030,
        trendProbability: 0.08,
        maxPriceChange: 0.007,
        correlations: []
      },
      'ETCUSDT': {
        basePrice: 25,
        volatility: 0.028,
        trendProbability: 0.075,
        maxPriceChange: 0.006,
        correlations: []
      },
      'NEARUSDT': {
        basePrice: 4,
        volatility: 0.031,
        trendProbability: 0.09,
        maxPriceChange: 0.008,
        correlations: []
      },
      'XLMUSDT': {
        basePrice: 0.12,
        volatility: 0.029,
        trendProbability: 0.08,
        maxPriceChange: 0.007,
        correlations: []
      },
      'ARBUSDT': {
        basePrice: 1,
        volatility: 0.033,
        trendProbability: 0.095,
        maxPriceChange: 0.008,
        correlations: []
      },
      'VETUSDT': {
        basePrice: 0.025,
        volatility: 0.030,
        trendProbability: 0.085,
        maxPriceChange: 0.007,
        correlations: []
      }
    };

    Object.entries(configs).forEach(([symbol, config]) => {
      this.symbolConfigs.set(symbol, config);
    });
  }

  /**
   * Inicializa la simulación para un símbolo
   */
  public initializeSymbol(symbol: string, currentPrice?: number): void {
    const config = this.symbolConfigs.get(symbol);
    if (!config) {
      debugLogger.warn(`No hay configuración para ${symbol}, usando valores por defecto`);
    }

    const basePrice = currentPrice || config?.basePrice || 1000;
    const volatility = config?.volatility || 0.02;

    this.marketData.set(symbol, {
      currentPrice: basePrice,
      basePrice,
      trend: 'sideways',
      volatility,
      momentum: 0,
      lastUpdate: Date.now(),
      priceHistory: [{ price: basePrice, timestamp: Date.now() }],
      volume: Math.random() * 1000000 + 100000,
      dailyHigh: basePrice * 1.02,
      dailyLow: basePrice * 0.98,
      dailyOpen: basePrice * (0.99 + Math.random() * 0.02)
    });

    debugLogger.debug(`Símbol inicializado: ${symbol} at $${basePrice}`);
  }

  /**
   * Genera el siguiente precio basado en algoritmos de simulación realista
   */
  private generateNextPrice(symbol: string): number {
    const data = this.marketData.get(symbol);
    const config = this.symbolConfigs.get(symbol);
    
    if (!data || !config) {
      debugLogger.error(`Datos no encontrados para ${symbol}`);
      return 1000;
    }

    const now = Date.now();
    const timeDelta = (now - data.lastUpdate) / 1000; // segundos
    
    // 1. Determinar si cambia la tendencia
    if (Math.random() < config.trendProbability * timeDelta) {
      const trends: ('up' | 'down' | 'sideways')[] = ['up', 'down', 'sideways'];
      data.trend = trends[Math.floor(Math.random() * trends.length)];
      debugLogger.debug(`${symbol} cambió tendencia a ${data.trend}`);
    }

    // 2. Calcular momentum basado en la tendencia
    const trendImpact = {
      'up': 0.3,
      'down': -0.3,
      'sideways': 0
    }[data.trend];

    // Suavizar el momentum
    data.momentum = data.momentum * 0.9 + trendImpact * 0.1;

    // 3. Generar ruido aleatorio
    const randomNoise = (Math.random() - 0.5) * 2; // -1 a 1
    
    // 4. Aplicar correlaciones con otros símbolos
    let correlationImpact = 0;
    if (config.correlations.length > 0) {
      for (const corr of config.correlations) {
        const correlatedData = this.marketData.get(corr.symbol);
        if (correlatedData) {
          const correlatedChange = (correlatedData.currentPrice - correlatedData.basePrice) / correlatedData.basePrice;
          correlationImpact += correlatedChange * corr.correlation;
        }
      }
      correlationImpact /= config.correlations.length; // Promedio
    }

    // 5. Combinar todos los factores
    const totalImpact = 
      data.momentum * 0.4 + // Tendencia principal
      randomNoise * data.volatility * 0.5 + // Ruido aleatorio
      correlationImpact * 0.1; // Correlaciones

    // 6. Limitar el cambio máximo
    const limitedImpact = Math.max(
      -config.maxPriceChange, 
      Math.min(config.maxPriceChange, totalImpact)
    );

    // 7. Calcular nuevo precio
    const newPrice = data.currentPrice * (1 + limitedImpact);

    // 8. Actualizar estadísticas diarias
    data.dailyHigh = Math.max(data.dailyHigh, newPrice);
    data.dailyLow = Math.min(data.dailyLow, newPrice);

    // 9. Actualizar volumen de forma realista
    const volumeChange = Math.abs(limitedImpact) * 100000; // Mayor movimiento = mayor volumen
    data.volume += volumeChange * (0.5 + Math.random() * 0.5);

    return Math.max(0.001, newPrice); // Evitar precios negativos o cero
  }

  /**
   * Actualiza el precio de un símbolo y notifica a los suscriptores
   */
  private updatePrice(symbol: string): void {
    const data = this.marketData.get(symbol);
    if (!data) return;

    const newPrice = this.generateNextPrice(symbol);
    const previousPrice = data.currentPrice;
    
    // Actualizar datos
    data.currentPrice = newPrice;
    data.lastUpdate = Date.now();
    
    // Mantener historial limitado (últimos 100 puntos)
    data.priceHistory.push({ price: newPrice, timestamp: Date.now() });
    if (data.priceHistory.length > 100) {
      data.priceHistory = data.priceHistory.slice(-100);
    }

    // Calcular cambio porcentual
    const changePercent = ((newPrice - previousPrice) / previousPrice) * 100;

    // Crear objeto MarketData
    const marketData: MarketData = {
      symbol,
      price: newPrice,
      change24h: newPrice - data.dailyOpen,
      changePercent24h: ((newPrice - data.dailyOpen) / data.dailyOpen) * 100,
      high24h: data.dailyHigh,
      low24h: data.dailyLow,
      volume24h: data.volume,
      timestamp: Date.now(),
      trend: data.trend,
      momentum: data.momentum,
      volatility: data.volatility
    };

    // Notificar a suscriptores
    this.notifySubscribers(symbol, marketData);

    // Log ocasional para debug
    if (Math.abs(changePercent) > 1 || Math.random() < 0.001) {
      debugLogger.debug(`${symbol}: $${newPrice.toFixed(6)} (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(3)}%) [${data.trend}]`);
    }
  }

  /**
   * Notifica a todos los suscriptores de un símbolo
   */
  private notifySubscribers(symbol: string, marketData: MarketData): void {
    const symbolSubscribers = this.subscribers.get(symbol);
    if (symbolSubscribers && symbolSubscribers.size > 0) {
      symbolSubscribers.forEach(callback => {
        try {
          callback(marketData);
        } catch (error) {
          debugLogger.error(`Error notificando suscriptor de ${symbol}:`, error);
        }
      });
    }
  }

  /**
   * Inicia la simulación para un símbolo
   */
  public startSimulation(symbol: string, interval: number = 2000): void {
    // Detener simulación existente si hay una
    this.stopSimulation(symbol);

    // Inicializar si no existe
    if (!this.marketData.has(symbol)) {
      this.initializeSymbol(symbol);
    }

    // Crear intervalo de actualización
    const intervalId = setInterval(() => {
      this.updatePrice(symbol);
    }, interval);

    this.updateIntervals.set(symbol, intervalId);
    debugLogger.debug(`Simulación iniciada para ${symbol} cada ${interval}ms`);

    // Primera actualización inmediata
    setTimeout(() => this.updatePrice(symbol), 100);
  }

  /**
   * Detiene la simulación para un símbolo
   */
  public stopSimulation(symbol: string): void {
    const intervalId = this.updateIntervals.get(symbol);
    if (intervalId) {
      clearInterval(intervalId);
      this.updateIntervals.delete(symbol);
      debugLogger.debug(`Simulación detenida para ${symbol}`);
    }
  }

  /**
   * Suscribe a actualizaciones de precios de un símbolo
   */
  public subscribe(symbol: string, callback: (data: MarketData) => void): () => void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    
    this.subscribers.get(symbol)!.add(callback);
    
    // Enviar datos actuales si están disponibles
    const currentData = this.getMarketData(symbol);
    if (currentData) {
      setTimeout(() => callback(currentData), 10);
    }

    // Retornar función de desuscripción
    return () => {
      const symbolSubscribers = this.subscribers.get(symbol);
      if (symbolSubscribers) {
        symbolSubscribers.delete(callback);
        if (symbolSubscribers.size === 0) {
          this.subscribers.delete(symbol);
          // Si no hay más suscriptores, detener simulación
          this.stopSimulation(symbol);
        }
      }
    };
  }

  /**
   * Obtiene los datos de mercado actuales para un símbolo
   */
  public getMarketData(symbol: string): MarketData | null {
    const data = this.marketData.get(symbol);
    if (!data) return null;

    return {
      symbol,
      price: data.currentPrice,
      change24h: data.currentPrice - data.dailyOpen,
      changePercent24h: ((data.currentPrice - data.dailyOpen) / data.dailyOpen) * 100,
      high24h: data.dailyHigh,
      low24h: data.dailyLow,
      volume24h: data.volume,
      timestamp: data.lastUpdate,
      trend: data.trend,
      momentum: data.momentum,
      volatility: data.volatility
    };
  }

  /**
   * Obtiene el precio actual de un símbolo
   */
  public getCurrentPrice(symbol: string): number | null {
    const data = this.marketData.get(symbol);
    return data ? data.currentPrice : null;
  }

  /**
   * Fuerza una actualización manual del precio
   */
  public updatePriceManually(symbol: string, price: number): void {
    const data = this.marketData.get(symbol);
    if (data) {
      data.currentPrice = price;
      data.lastUpdate = Date.now();
      this.updatePrice(symbol);
    } else {
      this.initializeSymbol(symbol, price);
    }
  }

  /**
   * Obtiene estadísticas del historial de precios
   */
  public getPriceStatistics(symbol: string): {
    avgPrice: number;
    maxPrice: number;
    minPrice: number;
    priceStdDev: number;
    totalPoints: number;
  } | null {
    const data = this.marketData.get(symbol);
    if (!data || data.priceHistory.length === 0) return null;

    const prices = data.priceHistory.map(p => p.price);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
    const priceStdDev = Math.sqrt(variance);

    return {
      avgPrice,
      maxPrice,
      minPrice,
      priceStdDev,
      totalPoints: prices.length
    };
  }

  /**
   * Limpia todos los datos y detiene todas las simulaciones
   */
  public cleanup(): void {
    // Detener todas las simulaciones
    this.updateIntervals.forEach((intervalId, symbol) => {
      clearInterval(intervalId);
    });
    this.updateIntervals.clear();

    // Limpiar datos
    this.marketData.clear();
    this.subscribers.clear();

    debugLogger.debug('MarketSimulationService limpiado');
  }

  /**
   * Obtiene el estado del servicio
   */
  public getStatus(): {
    activeSymbols: string[];
    totalSubscribers: number;
    averagePrices: Record<string, number>;
  } {
    const activeSymbols = Array.from(this.updateIntervals.keys());
    const totalSubscribers = Array.from(this.subscribers.values()).reduce(
      (total, set) => total + set.size, 0
    );
    
    const averagePrices: Record<string, number> = {};
    this.marketData.forEach((data, symbol) => {
      averagePrices[symbol] = data.currentPrice;
    });

    return {
      activeSymbols,
      totalSubscribers,
      averagePrices
    };
  }
}

// Interfaces para tipos de datos
export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
  trend?: 'up' | 'down' | 'sideways';
  momentum?: number;
  volatility?: number;
}

export const marketSimulationService = MarketSimulationService.getInstance();