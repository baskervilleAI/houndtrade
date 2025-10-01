import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  TradingOrder, 
  Portfolio, 
  TradingStats, 
  OrderCreationParams, 
  TradingSettings,
  OrderStatus 
} from '../types/trading';
import { TradingStorageService } from '../services/tradingStorageService';
import { TradingOrderService } from '../services/tradingOrderService';
import { PortfolioCalculatorService } from '../services/portfolioCalculatorService';
import { useIntegratedMarketData } from './useIntegratedMarketData';
import { debugLogger } from '../utils/debugLogger';

interface UseTradingState {
  // Estados principales
  orders: TradingOrder[];
  activeOrders: TradingOrder[];
  closedOrders: TradingOrder[];
  portfolio: Portfolio | null;
  stats: TradingStats | null;
  settings: TradingSettings;
  
  // Estados de UI
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  
  // Métodos de órdenes
  createOrder: (params: OrderCreationParams) => Promise<{ success: boolean; order?: TradingOrder; errors?: string[] }>;
  closeOrder: (orderId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  cancelOrder: (orderId: string, reason?: string) => { success: boolean; error?: string };
  
  // Métodos de portfolio
  refreshPortfolio: () => Promise<void>;
  getPortfolioSummary: () => Promise<any>;
  
  // Métodos de configuración
  updateSettings: (newSettings: Partial<TradingSettings>) => void;
  
  // Métodos de datos
  exportData: () => string;
  importData: (jsonData: string) => boolean;
  clearAllData: () => boolean;
  
  // Utilidades
  getCurrentPrice: (symbol: string) => number | null;
  updatePrice: (symbol: string, price: number) => void;
  
  // Performance y análisis
  getPerformanceBySymbol: () => Record<string, any>;
  getPerformanceOverTime: (period?: 'daily' | 'weekly' | 'monthly') => any[];
  getRiskMetrics: () => any;
}

/**
 * Hook principal para el manejo completo del sistema de trading
 */
export function useTrading(): UseTradingState {
  // Referencias a los servicios
  const storageService = useRef(TradingStorageService.getInstance());
  const orderService = useRef(TradingOrderService.getInstance());
  const portfolioService = useRef(PortfolioCalculatorService.getInstance());
  
  // Hook de datos de mercado integrados
  const { getBestPrice, subscribeToSymbol, isInitialized: marketInitialized } = useIntegratedMarketData();
  
  // Referencia para desuscribirse de actualizaciones de precios
  const priceUpdateUnsubscribe = useRef<(() => void) | null>(null);
  
  // Estados principales
  const [orders, setOrders] = useState<TradingOrder[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [stats, setStats] = useState<TradingStats | null>(null);
  const [settings, setSettings] = useState<TradingSettings>({
    initialBalance: 10000,
    defaultRiskPercentage: 2,
    maxOpenOrders: 10,
    enableNotifications: true
  });
  
  // Estados de UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Estados derivados
  const activeOrders = orders.filter(order => order.status === OrderStatus.ACTIVE);
  const closedOrders = orders.filter(order => order.status !== OrderStatus.ACTIVE);

  /**
   * Carga los datos iniciales
   */
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      debugLogger.debug('Cargando datos iniciales de trading...');
      
      // Cargar órdenes
      const loadedOrders = storageService.current.loadOrders();
      setOrders(loadedOrders);
      
      // Cargar configuración
      const loadedSettings = storageService.current.loadSettings();
      setSettings(loadedSettings);
      
      // Calcular portfolio
      const calculatedPortfolio = await portfolioService.current.calculatePortfolio();
      setPortfolio(calculatedPortfolio);
      
      // Calcular estadísticas
      const tradingStats = portfolioService.current.getTradingStats();
      setStats(tradingStats);
      
      setLastUpdate(Date.now());
      setError(null);
      
      debugLogger.debug('Datos iniciales cargados', {
        ordersCount: loadedOrders.length,
        activeOrders: loadedOrders.filter(o => o.status === OrderStatus.ACTIVE).length,
        portfolioBalance: calculatedPortfolio.totalBalance.toFixed(2)
      });
      
    } catch (err) {
      debugLogger.error('Error al cargar datos iniciales', err);
      setError('Error al cargar los datos de trading');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresca solo el portfolio
   */
  const refreshPortfolio = useCallback(async () => {
    try {
      const calculatedPortfolio = await portfolioService.current.calculatePortfolio();
      setPortfolio(calculatedPortfolio);
      
      const tradingStats = portfolioService.current.getTradingStats();
      setStats(tradingStats);
      
      setLastUpdate(Date.now());
    } catch (err) {
      debugLogger.error('Error al refrescar portfolio', err);
    }
  }, []);

  /**
   * Configura actualizaciones de portfolio en tiempo real
   */
  const setupRealTimeUpdates = useCallback(() => {
    // Limpiar suscripción anterior si existe
    if (priceUpdateUnsubscribe.current) {
      priceUpdateUnsubscribe.current();
    }

    // Suscribirse a actualizaciones de precios
    priceUpdateUnsubscribe.current = orderService.current.onPriceUpdate((symbol, price) => {
      // Solo actualizar si tenemos órdenes activas con este símbolo
      const currentActiveOrders = orderService.current.getActiveOrders();
      const hasActiveOrdersForSymbol = currentActiveOrders.some(order => order.symbol === symbol);
      
      if (hasActiveOrdersForSymbol) {
        // Actualizar portfolio cuando cambie el precio de un símbolo con órdenes activas
        // Usar setTimeout para evitar demasiadas actualizaciones consecutivas
        setTimeout(() => {
          refreshPortfolio();
        }, 100);
      }
    });

    debugLogger.debug('Actualizaciones de portfolio en tiempo real configuradas');
  }, [refreshPortfolio]);

  /**
   * Refresca todos los datos
   */
  const refreshData = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  /**
   * Crea una nueva orden
   */
  const createOrder = useCallback(async (params: OrderCreationParams) => {
    debugLogger.debug('Creando nueva orden desde hook', params);
    setIsLoading(true);
    
    try {
      const result = await orderService.current.createOrder(params);
      
      if (result.success && result.order) {
        // Actualizar lista de órdenes
        const updatedOrders = storageService.current.loadOrders();
        setOrders(updatedOrders);
        
        // Refrescar portfolio
        await refreshPortfolio();
        
        debugLogger.debug('Orden creada exitosamente desde hook', { orderId: result.order.id });
      }
      
      return result;
    } catch (err) {
      debugLogger.error('Error al crear orden desde hook', err);
      return {
        success: false,
        errors: ['Error interno al crear la orden']
      };
    } finally {
      setIsLoading(false);
    }
  }, [refreshPortfolio]);

  /**
   * Cierra una orden manualmente
   */
  const closeOrder = useCallback(async (orderId: string, reason?: string) => {
    debugLogger.debug('Cerrando orden desde hook', { orderId, reason });
    setIsLoading(true);
    
    try {
      const result = await orderService.current.closeOrder(orderId, reason);
      
      if (result.success) {
        // Actualizar lista de órdenes
        const updatedOrders = storageService.current.loadOrders();
        setOrders(updatedOrders);
        
        // Refrescar portfolio
        await refreshPortfolio();
        
        debugLogger.debug('Orden cerrada exitosamente desde hook', { orderId });
      }
      
      return result;
    } catch (err) {
      debugLogger.error('Error al cerrar orden desde hook', err);
      return {
        success: false,
        error: 'Error interno al cerrar la orden'
      };
    } finally {
      setIsLoading(false);
    }
  }, [refreshPortfolio]);

  /**
   * Cancela una orden
   */
  const cancelOrder = useCallback((orderId: string, reason?: string) => {
    debugLogger.debug('Cancelando orden desde hook', { orderId, reason });
    
    const result = orderService.current.cancelOrder(orderId, reason);
    
    if (result.success) {
      // Actualizar lista de órdenes
      const updatedOrders = storageService.current.loadOrders();
      setOrders(updatedOrders);
      
      // Refrescar portfolio (sin await para mantener síncrono)
      refreshPortfolio();
      
      debugLogger.debug('Orden cancelada exitosamente desde hook', { orderId });
    }
    
    return result;
  }, [refreshPortfolio]);

  /**
   * Actualiza la configuración
   */
  const updateSettings = useCallback((newSettings: Partial<TradingSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    storageService.current.saveSettings(updatedSettings);
    
    debugLogger.debug('Configuración actualizada', updatedSettings);
    
    // Refrescar portfolio si cambió el balance inicial
    if (newSettings.initialBalance !== undefined) {
      refreshPortfolio();
    }
  }, [settings, refreshPortfolio]);

  /**
   * Exporta todos los datos
   */
  const exportData = useCallback(() => {
    return storageService.current.exportAllData();
  }, []);

  /**
   * Importa datos
   */
  const importData = useCallback((jsonData: string) => {
    const success = storageService.current.importAllData(jsonData);
    if (success) {
      // Recargar todos los datos
      loadInitialData();
    }
    return success;
  }, [loadInitialData]);

  /**
   * Limpia todos los datos
   */
  const clearAllData = useCallback(() => {
    const success = storageService.current.clearAllData();
    if (success) {
      setOrders([]);
      setPortfolio(null);
      setStats(null);
      setSettings({
        initialBalance: 10000,
        defaultRiskPercentage: 2,
        maxOpenOrders: 10,
        enableNotifications: true
      });
      setLastUpdate(Date.now());
    }
    return success;
  }, []);

  /**
   * Obtiene el precio actual de un símbolo
   */
  const getCurrentPrice = useCallback((symbol: string) => {
    return getBestPrice(symbol);
  }, [getBestPrice]);

  /**
   * Actualiza manualmente el precio de un símbolo
   */
  const updatePrice = useCallback((symbol: string, price: number) => {
    orderService.current.updatePrice(symbol, price);
  }, []);

  /**
   * Obtiene el resumen del portfolio
   */
  const getPortfolioSummary = useCallback(async () => {
    return await portfolioService.current.getPortfolioSummary();
  }, []);

  /**
   * Obtiene performance por símbolo
   */
  const getPerformanceBySymbol = useCallback(() => {
    return portfolioService.current.getPerformanceBySymbol();
  }, []);

  /**
   * Obtiene performance a lo largo del tiempo
   */
  const getPerformanceOverTime = useCallback((period: 'daily' | 'weekly' | 'monthly' = 'daily') => {
    return portfolioService.current.getPerformanceOverTime(period);
  }, []);

  /**
   * Obtiene métricas de riesgo
   */
  const getRiskMetrics = useCallback(() => {
    return portfolioService.current.getRiskMetrics();
  }, []);

  // Efectos
  useEffect(() => {
    loadInitialData();
    
    // Limpiar servicios al desmontar
    return () => {
      // Limpiar suscripción de tiempo real
      if (priceUpdateUnsubscribe.current) {
        priceUpdateUnsubscribe.current();
      }
      orderService.current.cleanup();
    };
  }, [loadInitialData]);

  // Configurar actualizaciones en tiempo real cuando hay órdenes activas y el mercado está inicializado
  useEffect(() => {
    if (activeOrders.length > 0 && marketInitialized) {
      setupRealTimeUpdates();
    } else {
      // Si no hay órdenes activas, limpiar suscripciones
      if (priceUpdateUnsubscribe.current) {
        priceUpdateUnsubscribe.current();
        priceUpdateUnsubscribe.current = null;
      }
    }
  }, [activeOrders.length, marketInitialized, setupRealTimeUpdates]);

  // Auto-refresh del portfolio cada 30 segundos como respaldo (reducido de importancia)
  useEffect(() => {
    if (activeOrders.length === 0) return;

    const interval = setInterval(() => {
      refreshPortfolio();
    }, 30000); // 30 segundos como respaldo

    return () => clearInterval(interval);
  }, [activeOrders.length, refreshPortfolio]);

  // Debug logging para cambios importantes
  useEffect(() => {
    debugLogger.debug('Estado del trading actualizado', {
      totalOrders: orders.length,
      activeOrders: activeOrders.length,
      closedOrders: closedOrders.length,
      portfolioBalance: portfolio?.totalBalance?.toFixed(2),
      lastUpdate: new Date(lastUpdate).toLocaleTimeString()
    });
  }, [orders.length, activeOrders.length, closedOrders.length, portfolio?.totalBalance, lastUpdate]);

  return {
    // Estados principales
    orders,
    activeOrders,
    closedOrders,
    portfolio,
    stats,
    settings,
    
    // Estados de UI
    isLoading,
    error,
    lastUpdate,
    
    // Métodos de órdenes
    createOrder,
    closeOrder,
    cancelOrder,
    
    // Métodos de portfolio
    refreshPortfolio,
    getPortfolioSummary,
    
    // Métodos de configuración
    updateSettings,
    
    // Métodos de datos
    exportData,
    importData,
    clearAllData,
    
    // Utilidades
    getCurrentPrice,
    updatePrice,
    
    // Performance y análisis
    getPerformanceBySymbol,
    getPerformanceOverTime,
    getRiskMetrics
  };
}