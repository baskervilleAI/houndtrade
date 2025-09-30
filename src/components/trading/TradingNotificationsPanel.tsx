import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native';
import { tradingNotificationService, TradingNotification, NotificationType } from '../../services/tradingNotificationService';

interface TradingNotificationsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const TradingNotificationsPanel: React.FC<TradingNotificationsPanelProps> = ({
  visible,
  onClose,
}) => {
  const [notifications, setNotifications] = useState<TradingNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Suscribirse a todas las notificaciones
    const unsubscribe = tradingNotificationService.subscribeToAll((allNotifications) => {
      setNotifications(allNotifications);
      setUnreadCount(tradingNotificationService.getUnreadCount());
    });

    return unsubscribe;
  }, []);

  /**
   * Marca todas las notificaciones como leídas al abrir el panel
   */
  useEffect(() => {
    if (visible && unreadCount > 0) {
      setTimeout(() => {
        tradingNotificationService.markAllAsRead();
      }, 1000); // Marcar como leídas después de 1 segundo
    }
  }, [visible, unreadCount]);

  /**
   * Obtiene el icono para cada tipo de notificación
   */
  const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
      case NotificationType.TAKE_PROFIT_HIT:
        return '🎯';
      case NotificationType.STOP_LOSS_HIT:
        return '🛑';
      case NotificationType.ORDER_CREATED:
        return '✅';
      case NotificationType.ORDER_CANCELLED:
        return '❌';
      case NotificationType.MANUAL_CLOSE:
        return '💰';
      case NotificationType.PRICE_ALERT:
        return '🔔';
      case NotificationType.PORTFOLIO_MILESTONE:
        return '🏆';
      case NotificationType.ERROR_NOTIFICATION:
        return '⚠️';
      default:
        return '📄';
    }
  };

  /**
   * Obtiene el color de prioridad
   */
  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical':
        return '#ff4444';
      case 'high':
        return '#ff8800';
      case 'medium':
        return '#00ff88';
      case 'low':
        return '#888888';
      default:
        return '#888888';
    }
  };

  /**
   * Formatea la fecha de la notificación
   */
  const formatNotificationDate = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    // Menos de 1 minuto
    if (diff < 60000) {
      return 'Ahora';
    }
    
    // Menos de 1 hora
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `Hace ${minutes}m`;
    }
    
    // Menos de 1 día
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `Hace ${hours}h`;
    }
    
    // Más de 1 día
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Maneja el press en una notificación
   */
  const handleNotificationPress = (notification: TradingNotification) => {
    if (!notification.isRead) {
      tradingNotificationService.markAsRead(notification.id);
    }
    
    // Mostrar detalles si es necesario
    if (notification.actions && notification.actions.length > 0) {
      Alert.alert(
        notification.title,
        notification.message,
        notification.actions.map(action => ({
          text: action.label,
          onPress: action.action,
          style: action.style === 'danger' ? 'destructive' : 'default'
        }))
      );
    }
  };

  /**
   * Renderiza una notificación
   */
  const renderNotification = (notification: TradingNotification) => {
    const priorityColor = getPriorityColor(notification.priority);
    const icon = getNotificationIcon(notification.type);
    
    return (
      <TouchableOpacity
        key={notification.id}
        style={[
          styles.notificationCard,
          {
            backgroundColor: notification.isRead ? '#1a1a1a' : '#2a2a2a',
            borderLeftColor: priorityColor,
          }
        ]}
        onPress={() => handleNotificationPress(notification)}
        onLongPress={() => {
          Alert.alert(
            'Eliminar Notificación',
            '¿Quieres eliminar esta notificación?',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar',
                style: 'destructive',
                onPress: () => tradingNotificationService.deleteNotification(notification.id)
              }
            ]
          );
        }}
      >
        <View style={styles.notificationHeader}>
          <View style={styles.notificationIcon}>
            <Text style={styles.iconText}>{icon}</Text>
          </View>
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationTitle, { color: notification.isRead ? '#cccccc' : '#ffffff' }]}>
              {notification.title}
            </Text>
            <Text style={styles.notificationTime}>
              {formatNotificationDate(notification.timestamp)}
            </Text>
          </View>
          {!notification.isRead && <View style={styles.unreadIndicator} />}
        </View>
        
        <Text style={[styles.notificationMessage, { color: notification.isRead ? '#888888' : '#cccccc' }]}>
          {notification.message}
        </Text>
        
        {/* Información adicional si está disponible */}
        {(notification.symbol || notification.pnl !== undefined || notification.amount !== undefined) && (
          <View style={styles.notificationDetails}>
            {notification.symbol && (
              <Text style={styles.detailText}>Símbolo: {notification.symbol}</Text>
            )}
            {notification.pnl !== undefined && (
              <Text style={[
                styles.detailText,
                { color: notification.pnl >= 0 ? '#00ff88' : '#ff4444' }
              ]}>
                PnL: {notification.pnl >= 0 ? '+' : ''}${notification.pnl.toFixed(2)}
              </Text>
            )}
            {notification.amount !== undefined && (
              <Text style={styles.detailText}>
                Cantidad: ${notification.amount.toFixed(2)}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Notificaciones {notifications.length > 0 && `(${notifications.length})`}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Acciones rápidas */}
        {notifications.length > 0 && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                Alert.alert(
                  'Limpiar Notificaciones',
                  '¿Estás seguro de que quieres eliminar todas las notificaciones?',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Limpiar Todo',
                      style: 'destructive',
                      onPress: () => tradingNotificationService.clearAllNotifications()
                    }
                  ]
                );
              }}
            >
              <Text style={styles.actionButtonText}>Limpiar Todo</Text>
            </TouchableOpacity>
            
            {unreadCount > 0 && (
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryActionButton]}
                onPress={() => tradingNotificationService.markAllAsRead()}
              >
                <Text style={styles.primaryActionButtonText}>Marcar como Leídas</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Lista de notificaciones */}
        <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                📭{'\n'}No tienes notificaciones
              </Text>
            </View>
          ) : (
            notifications.map(renderNotification)
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

/**
 * Componente del botón de notificaciones
 */
interface NotificationsButtonProps {
  onPress: () => void;
}

export const NotificationsButton: React.FC<NotificationsButtonProps> = ({ onPress }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribe = tradingNotificationService.subscribeToAll(() => {
      setUnreadCount(tradingNotificationService.getUnreadCount());
    });

    return unsubscribe;
  }, []);

  return (
    <TouchableOpacity style={styles.notificationButton} onPress={onPress}>
      <Text style={styles.notificationButtonIcon}>🔔</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount.toString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#888888',
  },
  quickActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#555555',
  },
  primaryActionButton: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  primaryActionButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  notificationsList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 28,
  },
  notificationCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 16,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  notificationTime: {
    fontSize: 12,
    color: '#888888',
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff88',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationDetails: {
    backgroundColor: '#2a2a2a',
    padding: 8,
    borderRadius: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailText: {
    fontSize: 12,
    color: '#cccccc',
  },
  // Botón de notificaciones
  notificationButton: {
    position: 'relative',
    padding: 12,
  },
  notificationButtonIcon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default TradingNotificationsPanel;