import { TradingOrder, TradingSettings, Portfolio, STORAGE_KEYS } from '../types/trading';
import { debugLogger } from '../utils/debugLogger';

/**
 * Servicio para manejar la persistencia de datos de trading en localStorage
 * Incluye manejo robusto de errores y validación de datos
 */
export class TradingStorageService {
  private static instance: TradingStorageService;

  public static getInstance(): TradingStorageService {
    if (!TradingStorageService.instance) {
      TradingStorageService.instance = new TradingStorageService();
    }
    return TradingStorageService.instance;
  }

  /**
   * Verifica si localStorage está disponible
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = 'localStorage_test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      debugLogger.error('LocalStorage no está disponible', e);
      return false;
    }
  }

  /**
   * Guarda datos de forma segura en localStorage
   */
  private saveToStorage<T>(key: string, data: T): boolean {
    if (!this.isLocalStorageAvailable()) {
      debugLogger.error('LocalStorage no disponible para guardar', { key });
      return false;
    }

    try {
      const jsonData = JSON.stringify(data, null, 2);
      localStorage.setItem(key, jsonData);
      debugLogger.debug(`Datos guardados en localStorage: ${key}`);
      return true;
    } catch (error) {
      debugLogger.error(`Error al guardar en localStorage: ${key}`, error);
      return false;
    }
  }

  /**
   * Carga datos de forma segura desde localStorage
   */
  private loadFromStorage<T>(key: string, defaultValue: T): T {
    if (!this.isLocalStorageAvailable()) {
      debugLogger.warn('LocalStorage no disponible para cargar', { key });
      return defaultValue;
    }

    try {
      const jsonData = localStorage.getItem(key);
      if (jsonData === null) {
        debugLogger.debug(`No hay datos en localStorage para: ${key}`);
        return defaultValue;
      }

      const parsed = JSON.parse(jsonData);
      debugLogger.debug(`Datos cargados desde localStorage: ${key}`);
      return parsed;
    } catch (error) {
      debugLogger.error(`Error al cargar desde localStorage: ${key}`, error);
      // En caso de error, intentamos limpiar el dato corrupto
      try {
        localStorage.removeItem(key);
      } catch (cleanupError) {
        debugLogger.error('Error al limpiar dato corrupto', cleanupError);
      }
      return defaultValue;
    }
  }

  /**
   * Valida que una orden tenga la estructura correcta
   */
  private validateOrder(order: any): order is TradingOrder {
    if (!order || typeof order !== 'object') return false;

    const requiredFields = [
      'id', 'symbol', 'type', 'side', 'status',
      'entryPrice', 'quantity', 'usdtAmount', 'createdAt'
    ];

    return requiredFields.every(field => field in order) &&
           typeof order.id === 'string' &&
           typeof order.symbol === 'string' &&
           typeof order.entryPrice === 'number' &&
           typeof order.quantity === 'number' &&
           typeof order.usdtAmount === 'number' &&
           typeof order.createdAt === 'number';
  }

  /**
   * Guarda todas las órdenes
   */
  saveOrders(orders: TradingOrder[]): boolean {
    // Validar todas las órdenes antes de guardar
    const validOrders = orders.filter(order => {
      if (!this.validateOrder(order)) {
        debugLogger.warn('Orden inválida encontrada, se omitirá', { orderId: (order as any)?.id });
        return false;
      }
      return true;
    });

    if (validOrders.length !== orders.length) {
      debugLogger.warn(`Se omitieron ${orders.length - validOrders.length} órdenes inválidas`);
    }

    return this.saveToStorage(STORAGE_KEYS.ORDERS, validOrders);
  }

  /**
   * Carga todas las órdenes
   */
  loadOrders(): TradingOrder[] {
    const orders = this.loadFromStorage<TradingOrder[]>(STORAGE_KEYS.ORDERS, []);
    
    // Re-validar las órdenes cargadas por si hay problemas de formato
    const validOrders = orders.filter(order => this.validateOrder(order));
    
    if (validOrders.length !== orders.length) {
      debugLogger.warn(`Se encontraron ${orders.length - validOrders.length} órdenes corruptas que se omitirán`);
      // Guardar solo las órdenes válidas para limpiar la corrupción
      this.saveOrders(validOrders);
    }

    return validOrders;
  }

  /**
   * Guarda una sola orden (actualiza la lista completa)
   */
  saveOrder(order: TradingOrder): boolean {
    if (!this.validateOrder(order)) {
      debugLogger.error('Intentando guardar orden inválida', { orderId: (order as any)?.id });
      return false;
    }

    const orders = this.loadOrders();
    const existingIndex = orders.findIndex(o => o.id === order.id);

    if (existingIndex >= 0) {
      orders[existingIndex] = order;
      debugLogger.debug('Orden actualizada', { orderId: order.id });
    } else {
      orders.push(order);
      debugLogger.debug('Nueva orden guardada', { orderId: order.id });
    }

    return this.saveOrders(orders);
  }

  /**
   * Elimina una orden
   */
  deleteOrder(orderId: string): boolean {
    const orders = this.loadOrders();
    const filteredOrders = orders.filter(o => o.id !== orderId);
    
    if (filteredOrders.length === orders.length) {
      debugLogger.warn('No se encontró orden para eliminar', { orderId });
      return false;
    }

    debugLogger.debug('Orden eliminada', { orderId });
    return this.saveOrders(filteredOrders);
  }

  /**
   * Obtiene una orden específica por ID
   */
  getOrder(orderId: string): TradingOrder | null {
    const orders = this.loadOrders();
    return orders.find(o => o.id === orderId) || null;
  }

  /**
   * Guarda la configuración del trading
   */
  saveSettings(settings: TradingSettings): boolean {
    return this.saveToStorage(STORAGE_KEYS.SETTINGS, settings);
  }

  /**
   * Carga la configuración del trading
   */
  loadSettings(): TradingSettings {
    return this.loadFromStorage<TradingSettings>(STORAGE_KEYS.SETTINGS, {
      initialBalance: 10000,
      defaultRiskPercentage: 2,
      maxOpenOrders: 10,
      enableNotifications: true
    });
  }

  /**
   * Guarda el estado del portfolio
   */
  savePortfolio(portfolio: Portfolio): boolean {
    return this.saveToStorage(STORAGE_KEYS.PORTFOLIO, portfolio);
  }

  /**
   * Carga el estado del portfolio
   */
  loadPortfolio(): Portfolio | null {
    return this.loadFromStorage<Portfolio | null>(STORAGE_KEYS.PORTFOLIO, null);
  }

  /**
   * Exporta todos los datos de trading a JSON
   */
  exportAllData(): string {
    const data = {
      orders: this.loadOrders(),
      settings: this.loadSettings(),
      portfolio: this.loadPortfolio(),
      exportedAt: Date.now(),
      version: '1.0.0'
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Importa datos de trading desde JSON
   */
  importAllData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.orders || !Array.isArray(data.orders)) {
        throw new Error('Formato de datos inválido: falta array de órdenes');
      }

      // Validar órdenes
      const validOrders = data.orders.filter((order: any) => this.validateOrder(order));
      
      // Guardar datos
      this.saveOrders(validOrders);
      
      if (data.settings) {
        this.saveSettings(data.settings);
      }
      
      if (data.portfolio) {
        this.savePortfolio(data.portfolio);
      }

      debugLogger.debug('Datos importados correctamente', {
        ordersImported: validOrders.length,
        totalOrders: data.orders.length
      });

      return true;
    } catch (error) {
      debugLogger.error('Error al importar datos', error);
      return false;
    }
  }

  /**
   * Limpia todos los datos de trading (usar con precaución)
   */
  clearAllData(): boolean {
    try {
      localStorage.removeItem(STORAGE_KEYS.ORDERS);
      localStorage.removeItem(STORAGE_KEYS.SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.PORTFOLIO);
      
      debugLogger.debug('Todos los datos de trading han sido eliminados');
      return true;
    } catch (error) {
      debugLogger.error('Error al limpiar datos de trading', error);
      return false;
    }
  }

  /**
   * Obtiene el tamaño total de los datos almacenados
   */
  getStorageSize(): { orders: number; settings: number; portfolio: number; total: number } {
    const getSize = (key: string): number => {
      const data = localStorage.getItem(key);
      return data ? new Blob([data]).size : 0;
    };

    const orders = getSize(STORAGE_KEYS.ORDERS);
    const settings = getSize(STORAGE_KEYS.SETTINGS);
    const portfolio = getSize(STORAGE_KEYS.PORTFOLIO);

    return {
      orders,
      settings,
      portfolio,
      total: orders + settings + portfolio
    };
  }

  /**
   * Verifica la integridad de los datos almacenados
   */
  verifyDataIntegrity(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Verificar órdenes
      const orders = this.loadOrders();
      const orderIds = new Set<string>();
      
      orders.forEach((order, index) => {
        if (!this.validateOrder(order)) {
          errors.push(`Orden en índice ${index} es inválida`);
        }
        
        if (orderIds.has(order.id)) {
          errors.push(`Orden duplicada encontrada: ${order.id}`);
        }
        orderIds.add(order.id);

        // Validaciones de negocio
        if (order.entryPrice <= 0) {
          warnings.push(`Orden ${order.id} tiene precio de entrada inválido: ${order.entryPrice}`);
        }
        
        if (order.usdtAmount <= 0) {
          warnings.push(`Orden ${order.id} tiene cantidad USDT inválida: ${order.usdtAmount}`);
        }
      });

      // Verificar configuración
      const settings = this.loadSettings();
      if (settings.initialBalance <= 0) {
        warnings.push('Balance inicial debe ser mayor que 0');
      }

    } catch (error) {
      errors.push(`Error al verificar integridad: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}