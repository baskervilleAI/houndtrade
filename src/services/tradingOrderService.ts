import { TradingOrder, OrderCreationParams, OrderStatus, OrderSide, OrderType, OrderValidation, MarketPrice } from '../types/trading';
import { TradingStorageService } from './tradingStorageService';
import { debugLogger } from '../utils/debugLogger';

/**
 * Servicio para gestionar órdenes de trading con TP/SL automático
 */
export class TradingOrderService {
  private static instance: TradingOrderService;
  private storageService: TradingStorageService;
  private marketPrices: Map<string, MarketPrice> = new Map();
  private priceMonitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.storageService = TradingStorageService.getInstance();
  }

  public static getInstance(): TradingOrderService {
    if (!TradingOrderService.instance) {
      TradingOrderService.instance = new TradingOrderService();
    }
    return TradingOrderService.instance;
  }

  /**
   * Genera un ID único para las órdenes
   */
  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Valida los parámetros para crear una orden
   */
  validateOrderParams(params: OrderCreationParams): OrderValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validaciones básicas
    if (!params.symbol || params.symbol.trim() === '') {
      errors.push('El símbolo de la criptomoneda es requerido');
    }

    if (!params.symbol.includes('USDT')) {
      warnings.push('Se recomienda usar pares con USDT para mejor cálculo de PnL');
    }

    if (params.usdtAmount <= 0) {
      errors.push('La cantidad en USDT debe ser mayor que 0');
    }

    if (params.usdtAmount < 10) {
      warnings.push('Cantidad muy pequeña, se recomienda mínimo $10 USDT');
    }

    if (params.usdtAmount > 50000) {
      warnings.push('Cantidad muy grande, considere dividir en múltiples órdenes');
    }

    // Validar TP/SL
    if (params.takeProfitUSDT && params.takeProfitUSDT <= 0) {
      errors.push('El Take Profit en USDT debe ser mayor que 0');
    }

    if (params.stopLossUSDT && params.stopLossUSDT <= 0) {
      errors.push('El Stop Loss en USDT debe ser mayor que 0');
    }

    if (params.takeProfitPrice && params.stopLossPrice) {
      if (params.side === OrderSide.BUY) {
        if (params.takeProfitPrice <= params.stopLossPrice) {
          errors.push('Para órdenes BUY, el Take Profit debe ser mayor que el Stop Loss');
        }
      } else {
        if (params.takeProfitPrice >= params.stopLossPrice) {
          errors.push('Para órdenes SELL, el Take Profit debe ser menor que el Stop Loss');
        }
      }
    }

    // Validar que no haya demasiadas órdenes abiertas
    const activeOrders = this.getActiveOrders();
    if (activeOrders.length >= 20) {
      warnings.push('Tienes muchas órdenes abiertas, considera cerrar algunas antes de abrir nuevas');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calcula el precio de TP/SL basado en la ganancia/pérdida deseada en USDT
   */
  private calculateTPSLPrices(
    entryPrice: number,
    quantity: number,
    side: OrderSide,
    takeProfitUSDT?: number,
    stopLossUSDT?: number
  ): { takeProfitPrice?: number; stopLossPrice?: number } {
    const result: { takeProfitPrice?: number; stopLossPrice?: number } = {};

    if (takeProfitUSDT) {
      const profitPerCoin = takeProfitUSDT / quantity;
      if (side === OrderSide.BUY) {
        result.takeProfitPrice = entryPrice + profitPerCoin;
      } else {
        result.takeProfitPrice = entryPrice - profitPerCoin;
      }
    }

    if (stopLossUSDT) {
      const lossPerCoin = stopLossUSDT / quantity;
      if (side === OrderSide.BUY) {
        result.stopLossPrice = entryPrice - lossPerCoin;
      } else {
        result.stopLossPrice = entryPrice + lossPerCoin;
      }
    }

    return result;
  }

  /**
   * Calcula la cantidad de crypto basada en el monto USDT y el precio actual
   */
  private calculateQuantity(usdtAmount: number, price: number): number {
    return usdtAmount / price;
  }

  /**
   * Obtiene el precio actual de un símbolo (simulado por ahora)
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    // Por ahora devolvemos un precio simulado
    // En una implementación real, esto se conectaría a la API de Binance
    const cached = this.marketPrices.get(symbol);
    if (cached && Date.now() - cached.timestamp < 10000) { // Cache por 10 segundos
      return cached.price;
    }

    // Precios simulados para testing
    const simulatedPrices: Record<string, number> = {
      'BTCUSDT': 45000 + (Math.random() - 0.5) * 2000,
      'ETHUSDT': 3000 + (Math.random() - 0.5) * 200,
      'BNBUSDT': 350 + (Math.random() - 0.5) * 30,
      'ADAUSDT': 0.5 + (Math.random() - 0.5) * 0.1,
      'SOLUSDT': 100 + (Math.random() - 0.5) * 20,
      'DOTUSDT': 8 + (Math.random() - 0.5) * 2,
      'LINKUSDT': 15 + (Math.random() - 0.5) * 3,
      'MATICUSDT': 1.2 + (Math.random() - 0.5) * 0.3,
    };

    const price = simulatedPrices[symbol] || 1000;
    
    this.marketPrices.set(symbol, {
      symbol,
      price,
      timestamp: Date.now()
    });

    debugLogger.debug(`Precio simulado para ${symbol}: $${price.toFixed(2)}`);
    return price;
  }

  /**
   * Crea una nueva orden de trading
   */
  async createOrder(params: OrderCreationParams): Promise<{ success: boolean; order?: TradingOrder; errors?: string[] }> {
    debugLogger.debug('Creando nueva orden', params);

    // Validar parámetros
    const validation = this.validateOrderParams(params);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    try {
      // Obtener precio actual
      const currentPrice = await this.getCurrentPrice(params.symbol);
      const quantity = this.calculateQuantity(params.usdtAmount, currentPrice);

      // Calcular precios de TP/SL
      let { takeProfitPrice, stopLossPrice } = this.calculateTPSLPrices(
        currentPrice,
        quantity,
        params.side,
        params.takeProfitUSDT,
        params.stopLossUSDT
      );

      // Si se proporcionaron precios directos, usarlos
      if (params.takeProfitPrice) {
        takeProfitPrice = params.takeProfitPrice;
      }
      if (params.stopLossPrice) {
        stopLossPrice = params.stopLossPrice;
      }

      // Crear la orden
      const order: TradingOrder = {
        id: this.generateOrderId(),
        symbol: params.symbol.toUpperCase(),
        type: params.type,
        side: params.side,
        status: OrderStatus.ACTIVE,
        
        entryPrice: currentPrice,
        quantity,
        usdtAmount: params.usdtAmount,
        
        takeProfitPrice: takeProfitPrice || null,
        stopLossPrice: stopLossPrice || null,
        takeProfitUSDT: params.takeProfitUSDT || null,
        stopLossUSDT: params.stopLossUSDT || null,
        
        exitPrice: null,
        realizedPnL: null,
        
        createdAt: Date.now(),
        closedAt: null,
        
        notes: params.notes,
        tags: params.tags || []
      };

      // Guardar la orden
      const saved = this.storageService.saveOrder(order);
      if (!saved) {
        return {
          success: false,
          errors: ['Error al guardar la orden en localStorage']
        };
      }

      debugLogger.debug('Orden creada exitosamente', {
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        usdtAmount: order.usdtAmount,
        quantity: quantity.toFixed(6),
        entryPrice: currentPrice.toFixed(2),
        takeProfitPrice: takeProfitPrice?.toFixed(2),
        stopLossPrice: stopLossPrice?.toFixed(2)
      });

      // Iniciar monitoreo de precios si no está activo
      this.startPriceMonitoring();

      return {
        success: true,
        order
      };

    } catch (error) {
      debugLogger.error('Error al crear orden', error);
      return {
        success: false,
        errors: ['Error interno al crear la orden']
      };
    }
  }

  /**
   * Cierra una orden manualmente
   */
  async closeOrder(orderId: string, reason?: string): Promise<{ success: boolean; order?: TradingOrder; error?: string }> {
    const order = this.storageService.getOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: 'Orden no encontrada'
      };
    }

    if (order.status !== OrderStatus.ACTIVE) {
      return {
        success: false,
        error: 'La orden ya está cerrada'
      };
    }

    try {
      // Obtener precio actual para cerrar
      const currentPrice = await this.getCurrentPrice(order.symbol);
      
      // Calcular PnL
      const pnl = this.calculatePnL(order, currentPrice);

      // Actualizar orden
      const updatedOrder: TradingOrder = {
        ...order,
        status: OrderStatus.CLOSED_MANUAL,
        exitPrice: currentPrice,
        realizedPnL: pnl,
        closedAt: Date.now(),
        notes: order.notes ? `${order.notes}\nCerrado manualmente: ${reason || 'Sin razón especificada'}` : `Cerrado manualmente: ${reason || 'Sin razón especificada'}`
      };

      // Guardar orden actualizada
      const saved = this.storageService.saveOrder(updatedOrder);
      if (!saved) {
        return {
          success: false,
          error: 'Error al guardar el cierre de la orden'
        };
      }

      debugLogger.debug('Orden cerrada manualmente', {
        orderId: order.id,
        exitPrice: currentPrice.toFixed(2),
        pnl: pnl.toFixed(2),
        reason
      });

      return {
        success: true,
        order: updatedOrder
      };

    } catch (error) {
      debugLogger.error('Error al cerrar orden', error);
      return {
        success: false,
        error: 'Error interno al cerrar la orden'
      };
    }
  }

  /**
   * Cancela una orden
   */
  cancelOrder(orderId: string, reason?: string): { success: boolean; order?: TradingOrder; error?: string } {
    const order = this.storageService.getOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: 'Orden no encontrada'
      };
    }

    if (order.status !== OrderStatus.ACTIVE) {
      return {
        success: false,
        error: 'La orden ya está cerrada'
      };
    }

    // Actualizar orden como cancelada
    const updatedOrder: TradingOrder = {
      ...order,
      status: OrderStatus.CANCELLED,
      closedAt: Date.now(),
      notes: order.notes ? `${order.notes}\nCancelado: ${reason || 'Sin razón especificada'}` : `Cancelado: ${reason || 'Sin razón especificada'}`
    };

    // Guardar orden actualizada
    const saved = this.storageService.saveOrder(updatedOrder);
    if (!saved) {
      return {
        success: false,
        error: 'Error al guardar la cancelación de la orden'
      };
    }

    debugLogger.debug('Orden cancelada', {
      orderId: order.id,
      reason
    });

    return {
      success: true,
      order: updatedOrder
    };
  }

  /**
   * Calcula el PnL de una orden basado en el precio actual
   */
  private calculatePnL(order: TradingOrder, currentPrice: number): number {
    if (order.side === OrderSide.BUY) {
      return (currentPrice - order.entryPrice) * order.quantity;
    } else {
      return (order.entryPrice - currentPrice) * order.quantity;
    }
  }

  /**
   * Calcula el PnL no realizado de una orden activa
   */
  async calculateUnrealizedPnL(order: TradingOrder): Promise<number> {
    if (order.status !== OrderStatus.ACTIVE) {
      return 0;
    }

    const currentPrice = await this.getCurrentPrice(order.symbol);
    return this.calculatePnL(order, currentPrice);
  }

  /**
   * Verifica si una orden debe ejecutar TP o SL
   */
  private async checkTPSLTriggers(order: TradingOrder): Promise<boolean> {
    const currentPrice = await this.getCurrentPrice(order.symbol);
    let shouldClose = false;
    let newStatus = order.status;

    if (order.takeProfitPrice) {
      if (order.side === OrderSide.BUY && currentPrice >= order.takeProfitPrice) {
        shouldClose = true;
        newStatus = OrderStatus.FILLED_TP;
      } else if (order.side === OrderSide.SELL && currentPrice <= order.takeProfitPrice) {
        shouldClose = true;
        newStatus = OrderStatus.FILLED_TP;
      }
    }

    if (!shouldClose && order.stopLossPrice) {
      if (order.side === OrderSide.BUY && currentPrice <= order.stopLossPrice) {
        shouldClose = true;
        newStatus = OrderStatus.FILLED_SL;
      } else if (order.side === OrderSide.SELL && currentPrice >= order.stopLossPrice) {
        shouldClose = true;
        newStatus = OrderStatus.FILLED_SL;
      }
    }

    if (shouldClose) {
      const pnl = this.calculatePnL(order, currentPrice);
      
      const updatedOrder: TradingOrder = {
        ...order,
        status: newStatus,
        exitPrice: currentPrice,
        realizedPnL: pnl,
        closedAt: Date.now()
      };

      this.storageService.saveOrder(updatedOrder);

      debugLogger.debug('Orden cerrada automáticamente', {
        orderId: order.id,
        reason: newStatus === OrderStatus.FILLED_TP ? 'Take Profit' : 'Stop Loss',
        exitPrice: currentPrice.toFixed(2),
        pnl: pnl.toFixed(2)
      });

      return true;
    }

    return false;
  }

  /**
   * Inicia el monitoreo de precios para órdenes activas
   */
  private startPriceMonitoring(): void {
    if (this.priceMonitoringInterval) {
      return; // Ya está activo
    }

    debugLogger.debug('Iniciando monitoreo de precios para TP/SL');

    this.priceMonitoringInterval = setInterval(async () => {
      const activeOrders = this.getActiveOrders();
      
      if (activeOrders.length === 0) {
        this.stopPriceMonitoring();
        return;
      }

      // Verificar TP/SL para cada orden activa
      for (const order of activeOrders) {
        try {
          await this.checkTPSLTriggers(order);
        } catch (error) {
          debugLogger.error(`Error al verificar TP/SL para orden ${order.id}`, error);
        }
      }
    }, 5000); // Verificar cada 5 segundos
  }

  /**
   * Detiene el monitoreo de precios
   */
  private stopPriceMonitoring(): void {
    if (this.priceMonitoringInterval) {
      clearInterval(this.priceMonitoringInterval);
      this.priceMonitoringInterval = null;
      debugLogger.debug('Monitoreo de precios detenido');
    }
  }

  /**
   * Obtiene todas las órdenes
   */
  getAllOrders(): TradingOrder[] {
    return this.storageService.loadOrders();
  }

  /**
   * Obtiene solo las órdenes activas
   */
  getActiveOrders(): TradingOrder[] {
    return this.getAllOrders().filter(order => order.status === OrderStatus.ACTIVE);
  }

  /**
   * Obtiene las órdenes cerradas
   */
  getClosedOrders(): TradingOrder[] {
    return this.getAllOrders().filter(order => order.status !== OrderStatus.ACTIVE);
  }

  /**
   * Obtiene órdenes por símbolo
   */
  getOrdersBySymbol(symbol: string): TradingOrder[] {
    return this.getAllOrders().filter(order => order.symbol.toUpperCase() === symbol.toUpperCase());
  }

  /**
   * Obtiene el precio actual cacheado de un símbolo
   */
  getCurrentPriceSync(symbol: string): number | null {
    const cached = this.marketPrices.get(symbol);
    return cached ? cached.price : null;
  }

  /**
   * Actualiza manualmente el precio de un símbolo (para testing)
   */
  updatePrice(symbol: string, price: number): void {
    this.marketPrices.set(symbol, {
      symbol,
      price,
      timestamp: Date.now()
    });
    
    debugLogger.debug(`Precio actualizado manualmente para ${symbol}: $${price.toFixed(2)}`);
  }

  /**
   * Fuerza la verificación de TP/SL para todas las órdenes activas
   */
  async checkAllTPSL(): Promise<number> {
    const activeOrders = this.getActiveOrders();
    let closedCount = 0;

    for (const order of activeOrders) {
      try {
        const wasClosed = await this.checkTPSLTriggers(order);
        if (wasClosed) {
          closedCount++;
        }
      } catch (error) {
        debugLogger.error(`Error al verificar TP/SL para orden ${order.id}`, error);
      }
    }

    debugLogger.debug(`Verificación de TP/SL completada. Órdenes cerradas: ${closedCount}`);
    return closedCount;
  }

  /**
   * Limpia el servicio y detiene el monitoreo
   */
  cleanup(): void {
    this.stopPriceMonitoring();
    this.marketPrices.clear();
    debugLogger.debug('TradingOrderService limpiado');
  }
}