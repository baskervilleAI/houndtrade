import { debugLogger } from '../utils/debugLogger';

/**
 * Tipos de notificaciones de trading
 */
export enum NotificationType {
  TAKE_PROFIT_HIT = 'TAKE_PROFIT_HIT',
  STOP_LOSS_HIT = 'STOP_LOSS_HIT',
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  MANUAL_CLOSE = 'MANUAL_CLOSE',
  PRICE_ALERT = 'PRICE_ALERT',
  PORTFOLIO_MILESTONE = 'PORTFOLIO_MILESTONE',
  ERROR_NOTIFICATION = 'ERROR_NOTIFICATION'
}

export interface TradingNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
  symbol?: string;
  amount?: number;
  price?: number;
  pnl?: number;
  timestamp: number;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

/**
 * Servicio para gestionar notificaciones de trading
 */
export class TradingNotificationService {
  private static instance: TradingNotificationService;
  private notifications: TradingNotification[] = [];
  private subscribers: Set<(notification: TradingNotification) => void> = new Set();
  private allNotificationsSubscribers: Set<(notifications: TradingNotification[]) => void> = new Set();
  private maxNotifications = 100; // Límite máximo de notificaciones almacenadas

  private constructor() {
    this.loadNotifications();
  }

  public static getInstance(): TradingNotificationService {
    if (!TradingNotificationService.instance) {
      TradingNotificationService.instance = new TradingNotificationService();
    }
    return TradingNotificationService.instance;
  }

  /**
   * Carga las notificaciones desde localStorage
   */
  private loadNotifications(): void {
    try {
      const stored = localStorage.getItem('houndtrade_notifications');
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch (error) {
      debugLogger.error('Error cargando notificaciones:', error);
      this.notifications = [];
    }
  }

  /**
   * Guarda las notificaciones en localStorage
   */
  private saveNotifications(): void {
    try {
      localStorage.setItem('houndtrade_notifications', JSON.stringify(this.notifications));
    } catch (error) {
      debugLogger.error('Error guardando notificaciones:', error);
    }
  }

  /**
   * Genera un ID único para la notificación
   */
  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Crea una nueva notificación
   */
  public createNotification(params: {
    type: NotificationType;
    title: string;
    message: string;
    orderId?: string;
    symbol?: string;
    amount?: number;
    price?: number;
    pnl?: number;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    actions?: NotificationAction[];
  }): TradingNotification {
    const notification: TradingNotification = {
      id: this.generateNotificationId(),
      type: params.type,
      title: params.title,
      message: params.message,
      orderId: params.orderId,
      symbol: params.symbol,
      amount: params.amount,
      price: params.price,
      pnl: params.pnl,
      timestamp: Date.now(),
      isRead: false,
      priority: params.priority || 'medium',
      actions: params.actions
    };

    // Agregar al inicio de la lista
    this.notifications.unshift(notification);

    // Mantener límite de notificaciones
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    // Guardar y notificar
    this.saveNotifications();
    this.notifySubscribers(notification);
    this.notifyAllNotificationsSubscribers();

    // Log según prioridad
    const logLevel = notification.priority === 'critical' ? 'error' : 
                    notification.priority === 'high' ? 'warn' : 'debug';
    debugLogger[logLevel](`Notificación [${notification.type}]: ${notification.message}`);

    return notification;
  }

  /**
   * Notificaciones específicas para cada evento de trading
   */

  public notifyTakeProfitHit(orderId: string, symbol: string, exitPrice: number, pnl: number): void {
    this.createNotification({
      type: NotificationType.TAKE_PROFIT_HIT,
      title: '🎯 Take Profit Ejecutado',
      message: `${symbol}: TP ejecutado a $${exitPrice.toFixed(6)}. Ganancia: +$${Math.abs(pnl).toFixed(2)}`,
      orderId,
      symbol,
      price: exitPrice,
      pnl: Math.abs(pnl), // Asegurar que sea positivo
      priority: 'high'
    });
  }

  public notifyStopLossHit(orderId: string, symbol: string, exitPrice: number, pnl: number): void {
    this.createNotification({
      type: NotificationType.STOP_LOSS_HIT,
      title: '🛑 Stop Loss Ejecutado',
      message: `${symbol}: SL ejecutado a $${exitPrice.toFixed(6)}. Pérdida: -$${Math.abs(pnl).toFixed(2)}`,
      orderId,
      symbol,
      price: exitPrice,
      pnl: -Math.abs(pnl), // Asegurar que sea negativo
      priority: 'high'
    });
  }

  public notifyOrderCreated(orderId: string, symbol: string, side: string, amount: number): void {
    this.createNotification({
      type: NotificationType.ORDER_CREATED,
      title: '✅ Orden Creada',
      message: `${symbol}: Nueva orden ${side} por $${amount.toFixed(2)} USDT`,
      orderId,
      symbol,
      amount,
      priority: 'medium'
    });
  }

  public notifyOrderCancelled(orderId: string, symbol: string, reason?: string): void {
    this.createNotification({
      type: NotificationType.ORDER_CANCELLED,
      title: '❌ Orden Cancelada',
      message: `${symbol}: Orden cancelada${reason ? ` - ${reason}` : ''}`,
      orderId,
      symbol,
      priority: 'medium'
    });
  }

  public notifyManualClose(orderId: string, symbol: string, exitPrice: number, pnl: number): void {
    const isProfitable = pnl >= 0;
    this.createNotification({
      type: NotificationType.MANUAL_CLOSE,
      title: isProfitable ? '💰 Orden Cerrada con Ganancia' : '📉 Orden Cerrada con Pérdida',
      message: `${symbol}: Cerrada manualmente a $${exitPrice.toFixed(6)}. PnL: ${isProfitable ? '+' : ''}$${pnl.toFixed(2)}`,
      orderId,
      symbol,
      price: exitPrice,
      pnl,
      priority: 'medium'
    });
  }

  public notifyPriceAlert(symbol: string, currentPrice: number, targetPrice: number, direction: 'above' | 'below'): void {
    this.createNotification({
      type: NotificationType.PRICE_ALERT,
      title: '🔔 Alerta de Precio',
      message: `${symbol} está ${direction === 'above' ? 'por encima' : 'por debajo'} de $${targetPrice.toFixed(6)} (actual: $${currentPrice.toFixed(6)})`,
      symbol,
      price: currentPrice,
      priority: 'medium'
    });
  }

  public notifyPortfolioMilestone(milestone: string, currentBalance: number, previousBalance: number): void {
    this.createNotification({
      type: NotificationType.PORTFOLIO_MILESTONE,
      title: '🏆 Hito del Portfolio',
      message: `${milestone}! Balance actual: $${currentBalance.toFixed(2)} (antes: $${previousBalance.toFixed(2)})`,
      amount: currentBalance,
      priority: 'high'
    });
  }

  public notifyError(error: string, context?: string): void {
    this.createNotification({
      type: NotificationType.ERROR_NOTIFICATION,
      title: '⚠️ Error del Sistema',
      message: `${context ? `[${context}] ` : ''}${error}`,
      priority: 'critical'
    });
  }

  /**
   * Suscribirse a nuevas notificaciones
   */
  public subscribe(callback: (notification: TradingNotification) => void): () => void {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Suscribirse a cambios en todas las notificaciones
   */
  public subscribeToAll(callback: (notifications: TradingNotification[]) => void): () => void {
    this.allNotificationsSubscribers.add(callback);
    
    // Enviar notificaciones actuales inmediatamente
    setTimeout(() => callback([...this.notifications]), 0);
    
    return () => {
      this.allNotificationsSubscribers.delete(callback);
    };
  }

  /**
   * Notifica a los suscriptores de nuevas notificaciones
   */
  private notifySubscribers(notification: TradingNotification): void {
    this.subscribers.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        debugLogger.error('Error en callback de notificación:', error);
      }
    });
  }

  /**
   * Notifica a los suscriptores de todos los cambios
   */
  private notifyAllNotificationsSubscribers(): void {
    this.allNotificationsSubscribers.forEach(callback => {
      try {
        callback([...this.notifications]);
      } catch (error) {
        debugLogger.error('Error en callback de todas las notificaciones:', error);
      }
    });
  }

  /**
   * Marca una notificación como leída
   */
  public markAsRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.isRead) {
      notification.isRead = true;
      this.saveNotifications();
      this.notifyAllNotificationsSubscribers();
    }
  }

  /**
   * Marca todas las notificaciones como leídas
   */
  public markAllAsRead(): void {
    let hasChanges = false;
    this.notifications.forEach(notification => {
      if (!notification.isRead) {
        notification.isRead = true;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.saveNotifications();
      this.notifyAllNotificationsSubscribers();
    }
  }

  /**
   * Elimina una notificación
   */
  public deleteNotification(notificationId: string): void {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index >= 0) {
      this.notifications.splice(index, 1);
      this.saveNotifications();
      this.notifyAllNotificationsSubscribers();
    }
  }

  /**
   * Limpia todas las notificaciones
   */
  public clearAllNotifications(): void {
    this.notifications = [];
    this.saveNotifications();
    this.notifyAllNotificationsSubscribers();
  }

  /**
   * Obtiene todas las notificaciones
   */
  public getAllNotifications(): TradingNotification[] {
    return [...this.notifications];
  }

  /**
   * Obtiene notificaciones no leídas
   */
  public getUnreadNotifications(): TradingNotification[] {
    return this.notifications.filter(n => !n.isRead);
  }

  /**
   * Obtiene el número de notificaciones no leídas
   */
  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  /**
   * Filtra notificaciones por tipo
   */
  public getNotificationsByType(type: NotificationType): TradingNotification[] {
    return this.notifications.filter(n => n.type === type);
  }

  /**
   * Filtra notificaciones por símbolo
   */
  public getNotificationsBySymbol(symbol: string): TradingNotification[] {
    return this.notifications.filter(n => n.symbol === symbol);
  }

  /**
   * Obtiene estadísticas de notificaciones
   */
  public getStatistics(): {
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
    byPriority: Record<string, number>;
  } {
    const byType: Record<NotificationType, number> = {} as any;
    const byPriority: Record<string, number> = {};

    this.notifications.forEach(notification => {
      // Por tipo
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      
      // Por prioridad
      byPriority[notification.priority] = (byPriority[notification.priority] || 0) + 1;
    });

    return {
      total: this.notifications.length,
      unread: this.getUnreadCount(),
      byType,
      byPriority
    };
  }
}

export const tradingNotificationService = TradingNotificationService.getInstance();