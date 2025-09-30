import { useEffect, useRef, useCallback, useState } from 'react';
import { useMarket } from '../context/AppContext';
import { marketSimulationService } from '../services/marketSimulationService';
import { debugLogger } from '../utils/debugLogger';

/**
 * Hook mejorado que integra datos reales de mercado con la simulación
 */
export const useIntegratedMarketData = () => {
  const { tickers } = useMarket();
  const [isInitialized, setIsInitialized] = useState(false);
  const synchronizedSymbols = useRef<Set<string>>(new Set());

  /**
   * Sincroniza precios reales con la simulación
   */
  const synchronizeWithRealData = useCallback(() => {
    if (Object.keys(tickers).length === 0) return;

    Object.entries(tickers).forEach(([symbol, ticker]) => {
      if (!synchronizedSymbols.current.has(symbol)) {
        // Primera vez que vemos este símbolo con datos reales
        debugLogger.debug(`Sincronizando ${symbol} con precio real: $${ticker.price}`);
        
        // Inicializar la simulación con el precio real actual
        marketSimulationService.initializeSymbol(symbol, ticker.price);
        marketSimulationService.startSimulation(symbol, 3000); // Cada 3 segundos
        
        synchronizedSymbols.current.add(symbol);
      } else {
        // Ya está sincronizado, ocasionalmente ajustar hacia el precio real
        const currentSimulatedPrice = marketSimulationService.getCurrentPrice(symbol);
        
        if (currentSimulatedPrice) {
          const drift = Math.abs(currentSimulatedPrice - ticker.price) / ticker.price;
          
          // Si la simulación se ha alejado más del 5% del precio real, reajustar
          if (drift > 0.05) {
            debugLogger.debug(`Reajustando ${symbol}: simulado $${currentSimulatedPrice.toFixed(6)}, real $${ticker.price}`);
            
            // Ajustar gradualmente hacia el precio real
            const adjustedPrice = currentSimulatedPrice + (ticker.price - currentSimulatedPrice) * 0.3;
            marketSimulationService.updatePriceManually(symbol, adjustedPrice);
          }
        }
      }
    });
  }, [tickers]);

  /**
   * Obtiene el mejor precio disponible (simulado con ajustes reales)
   */
  const getBestPrice = useCallback((symbol: string): number | null => {
    // Primero intentar obtener de la simulación (que está sincronizada con datos reales)
    const simulatedPrice = marketSimulationService.getCurrentPrice(symbol);
    if (simulatedPrice) {
      return simulatedPrice;
    }

    // Fallback a datos reales del ticker
    const ticker = tickers[symbol];
    if (ticker) {
      return ticker.price;
    }

    return null;
  }, [tickers]);

  /**
   * Suscribirse a actualizaciones de un símbolo
   */
  const subscribeToSymbol = useCallback((symbol: string, callback: (price: number) => void) => {
    return marketSimulationService.subscribe(symbol, (marketData) => {
      callback(marketData.price);
    });
  }, []);

  // Sincronizar cuando cambien los tickers
  useEffect(() => {
    if (Object.keys(tickers).length > 0) {
      synchronizeWithRealData();
      
      if (!isInitialized) {
        setIsInitialized(true);
        debugLogger.debug('Sistema de mercado integrado inicializado con datos reales');
      }
    }
  }, [tickers, synchronizeWithRealData, isInitialized]);

  // Resincronizar periódicamente
  useEffect(() => {
    if (!isInitialized) return;

    const interval = setInterval(() => {
      synchronizeWithRealData();
    }, 30000); // Cada 30 segundos

    return () => clearInterval(interval);
  }, [isInitialized, synchronizeWithRealData]);

  return {
    getBestPrice,
    subscribeToSymbol,
    isInitialized,
    getSimulationStatus: () => marketSimulationService.getStatus(),
    getAllPrices: () => {
      const prices: Record<string, number> = {};
      Object.keys(tickers).forEach(symbol => {
        const price = getBestPrice(symbol);
        if (price) {
          prices[symbol] = price;
        }
      });
      return prices;
    }
  };
};

export default useIntegratedMarketData;