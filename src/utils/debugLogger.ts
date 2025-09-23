/**
 * Sistema de logging centralizado para debugging selectivo
 * Permite habilitar/deshabilitar categorías específicas de logs
 * CONFIGURADO PARA DEBUGGING DETALLADO DE CÁMARA Y VIEWPORT
 */

import { DEBUG_CONFIG, CAMERA_TIMINGS } from '../config/timing';

type LogCategory = 
  | 'CAMERA'       // Logs de control de cámara
  | 'VIEWPORT'     // Logs específicos de viewport y persistencia
  | 'INTERACTION'  // Logs de interacciones del usuario (zoom, pan, gestos)
  | 'TIDAL'        // Logs del sistema de gobernanza tidal
  | 'CHART'        // Logs del gráfico Chart.js
  | 'STREAMING'    // Logs de streaming de datos
  | 'GESTURES'     // Logs de gestos del usuario
  | 'PERFORMANCE'  // Logs de rendimiento
  | 'ERROR'        // Logs de errores (siempre habilitados)
  | 'WEBVIEW'      // Logs de WebView
  | 'ANIMATION'    // Logs de animaciones
  | 'STATE'        // Logs de cambios de estado
  | 'PERSISTENCE'  // Logs de carga/guardado de sessionStorage

interface LogConfig {
  enabled: boolean;
  emoji: string;
  color?: string;
}

// Configuración de logs - habilitar solo las categorías necesarias
// ✅ CONFIGURACIÓN PARA DEBUGGING INTENSIVO DE CÁMARA
const LOG_CONFIG: Record<LogCategory, LogConfig> = {
  CAMERA: { enabled: DEBUG_CONFIG.ENABLE_CAMERA_LOGS, emoji: '📷' },
  VIEWPORT: { enabled: DEBUG_CONFIG.ENABLE_VIEWPORT_LOGS, emoji: '🖼️' },
  INTERACTION: { enabled: DEBUG_CONFIG.ENABLE_INTERACTION_LOGS, emoji: '👆' },
  TIDAL: { enabled: DEBUG_CONFIG.ENABLE_TIDAL_LOGS, emoji: '🌊' },
  STATE: { enabled: DEBUG_CONFIG.ENABLE_STATE_LOGS, emoji: '⚡' },
  PERSISTENCE: { enabled: DEBUG_CONFIG.ENABLE_PERSISTENCE_LOGS, emoji: '💾' },
  CHART: { enabled: DEBUG_CONFIG.ENABLE_CHART_LOGS, emoji: '📊' },
  STREAMING: { enabled: DEBUG_CONFIG.ENABLE_STREAMING_LOGS, emoji: '📡' },
  GESTURES: { enabled: true, emoji: '🤏' },
  PERFORMANCE: { enabled: DEBUG_CONFIG.ENABLE_PERFORMANCE_LOGS, emoji: '⚡' },
  ERROR: { enabled: true, emoji: '❌' },
  WEBVIEW: { enabled: DEBUG_CONFIG.ENABLE_WEBVIEW_LOGS, emoji: '📱' },
  ANIMATION: { enabled: DEBUG_CONFIG.ENABLE_ANIMATION_LOGS, emoji: '🎬' },
};

class DebugLogger {
  private lastLogTime = 0;
  private logBuffer = new Map<string, number>();
  
  /**
   * Log principal para todas las categorías
   */
  log(category: LogCategory, message: string, data?: any) {
    const config = LOG_CONFIG[category];
    
    // Los errores siempre se muestran
    if (category === 'ERROR' || config.enabled) {
      const prefix = `${config.emoji} [${category}]`;
      const logKey = `${category}:${message}`;
      const now = Date.now();
      
      // Prevenir logs duplicados en menos de window configurado
      if (this.logBuffer.has(logKey)) {
        const lastTime = this.logBuffer.get(logKey)!;
        if (now - lastTime < CAMERA_TIMINGS.LOG_DEDUP_WINDOW) {
          return;
        }
      }
      
      this.logBuffer.set(logKey, now);
      
      // Limpiar buffer cada 1000ms
      if (now - this.lastLogTime > 1000) {
        this.logBuffer.clear();
        this.lastLogTime = now;
      }
      
      if (data !== undefined) {
        console.log(prefix, message, data);
      } else {
        console.log(prefix, message);
      }
    }
  }

  /**
   * Log específico para errores (siempre habilitado)
   */
  error(message: string, error?: any) {
    console.error(`❌ [ERROR] ${message}`, error);
  }

  /**
   * Log específico para warnings
   */
  warn(message: string, data?: any) {
    console.warn(`⚠️ [WARN] ${message}`, data);
  }

  /**
   * Log específico para estado de la cámara (con formato especial)
   */
  cameraState(state: any) {
    if (LOG_CONFIG.CAMERA.enabled) {
      console.log(`📷 [CAMERA_STATE] Posición actual:`, {
        zoom: state.zoomLevel?.toFixed(2),
        offsetX: state.offsetX?.toFixed(3),
        offsetY: state.offsetY?.toFixed(3),
        isLocked: state.isLocked,
        isUserInteracting: state.isUserInteracting,
        startIndex: state.startIndex,
        endIndex: state.endIndex,
        visibleCandles: state.endIndex - state.startIndex,
        followLatest: state.followLatest,
        chartJsZoom: state.chartJsZoom
      });
    }
  }

  /**
   * Log específico para estado detallado de viewport y persistencia
   */
  viewportState(state: any, context?: string) {
    if (LOG_CONFIG.VIEWPORT.enabled) {
      console.log(`🖼️ [VIEWPORT_STATE]${context ? ` ${context}` : ''} Estado completo:`, {
        mode: state.mode,
        isLocked: state.isLocked,
        viewport: state.viewport,
        chartJsState: state.chartJsState,
        lastUserAction: state.lastUserAction ? new Date(state.lastUserAction).toLocaleTimeString() : null,
        lastUserActionTs: state.lastUserActionTs ? new Date(state.lastUserActionTs).toLocaleTimeString() : null,
        tide: state.tide,
        cooldownMs: state.cooldownMs,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para interacciones del usuario con detalles completos
   */
  userInteractionDetailed(type: string, details: any, preState?: any, postState?: any) {
    if (LOG_CONFIG.INTERACTION.enabled) {
      console.log(`👆 [USER_INTERACTION] ${type}:`, {
        event: details,
        preState: preState ? {
          mode: preState.mode,
          isLocked: preState.isLocked,
          viewport: preState.viewport
        } : null,
        postState: postState ? {
          mode: postState.mode,
          isLocked: postState.isLocked,
          viewport: postState.viewport
        } : null,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para el sistema de gobernanza tidal
   */
  tidalFlow(phase: string, data: any) {
    if (LOG_CONFIG.TIDAL.enabled) {
      console.log(`🌊 [TIDAL_FLOW] ${phase}:`, {
        ...data,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para cambios de estado con comparación antes/después
   */
  stateTransition(from: any, to: any, trigger: string) {
    if (LOG_CONFIG.STATE.enabled) {
      console.log(`⚡ [STATE_TRANSITION] ${trigger}:`, {
        from: {
          mode: from.mode,
          isLocked: from.isLocked,
          lastUserAction: from.lastUserAction ? new Date(from.lastUserAction).toLocaleTimeString() : null
        },
        to: {
          mode: to.mode,
          isLocked: to.isLocked,
          lastUserAction: to.lastUserAction ? new Date(to.lastUserAction).toLocaleTimeString() : null
        },
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para operaciones de persistencia
   */
  persistence(operation: string, data?: any, success?: boolean) {
    if (LOG_CONFIG.PERSISTENCE.enabled) {
      console.log(`💾 [PERSISTENCE] ${operation}${success !== undefined ? ` (${success ? 'SUCCESS' : 'FAILED'})` : ''}:`, {
        data,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log para acciones de cámara específicas
   */
  cameraAction(action: string, details?: any) {
    this.log('CAMERA', `Acción: ${action}`, details);
  }

  /**
   * Log para interacciones del usuario
   */
  userInteraction(type: string, details?: any) {
    this.log('GESTURES', `Interacción: ${type}`, details);
  }

  /**
   * Log para actualizaciones del Chart.js
   */
  chartUpdate(message: string, data?: any) {
    this.log('CHART', message, data);
  }

  /**
   * Habilitar/deshabilitar una categoría de logs
   */
  setEnabled(category: LogCategory, enabled: boolean) {
    LOG_CONFIG[category].enabled = enabled;
    this.log('CAMERA', `Logs de ${category} ${enabled ? 'habilitados' : 'deshabilitados'}`);
  }

  /**
   * Obtener estado de configuración actual
   */
  getConfig() {
    return Object.entries(LOG_CONFIG).map(([category, config]) => ({
      category,
      enabled: config.enabled,
      emoji: config.emoji
    }));
  }

  /**
   * Log solo para debugging crítico (siempre habilitado)
   */
  debug(message: string, data?: any) {
    console.log(`🔍 [DEBUG] ${message}`, data);
  }

  /**
   * Log con seguimiento de ciclo de vida completo
   */
  lifecycle(phase: string, component: string, data?: any) {
    this.log('STATE', `[${component}] ${phase}`, data);
  }

  /**
   * Log específico para timing y performance crítico
   */
  timing(operation: string, duration?: number, data?: any) {
    if (LOG_CONFIG.PERFORMANCE.enabled) {
      console.log(`⏱️ [TIMING] ${operation}${duration ? ` (${duration}ms)` : ''}:`, data);
    }
  }

  /**
   * Resumen completo del estado del sistema de cámara
   */
  systemSnapshot(context: string, cameraState?: any, chartState?: any, persistentState?: any) {
    if (LOG_CONFIG.VIEWPORT.enabled) {
      console.log(`📋 [SYSTEM_SNAPSHOT] ${context}:`, {
        timestamp: new Date().toLocaleTimeString(),
        camera: cameraState ? {
          mode: cameraState.mode,
          isLocked: cameraState.isLocked,
          viewport: cameraState.viewport,
          chartJsState: cameraState.chartJsState,
          lastUserAction: cameraState.lastUserAction ? new Date(cameraState.lastUserAction).toLocaleTimeString() : null
        } : 'not_provided',
        chart: chartState || 'not_provided',
        persistent: persistentState || 'not_provided'
      });
    }
  }

  /**
   * Log para seguimiento de ciclos completos de interacción
   */
  interactionCycle(phase: 'START' | 'MIDDLE' | 'END', type: string, data?: any) {
    if (LOG_CONFIG.INTERACTION.enabled) {
      const phaseEmojis = { START: '🟢', MIDDLE: '🟡', END: '🔴' };
      console.log(`${phaseEmojis[phase]} [INTERACTION_CYCLE] ${phase}_${type}:`, {
        ...data,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }
}

// Instancia singleton
export const debugLogger = new DebugLogger();

// Exportar funciones de conveniencia para logging detallado
export const logCamera = (message: string, data?: any) => debugLogger.log('CAMERA', message, data);
export const logViewport = (message: string, data?: any) => debugLogger.log('VIEWPORT', message, data);
export const logInteraction = (message: string, data?: any) => debugLogger.log('INTERACTION', message, data);
export const logTidal = (message: string, data?: any) => debugLogger.log('TIDAL', message, data);
export const logState = (message: string, data?: any) => debugLogger.log('STATE', message, data);
export const logPersistence = (message: string, data?: any) => debugLogger.log('PERSISTENCE', message, data);
export const logChart = (message: string, data?: any) => debugLogger.log('CHART', message, data);
export const logError = (message: string, error?: any) => debugLogger.error(message, error);
export const logCameraState = (state: any) => debugLogger.cameraState(state);
export const logViewportState = (state: any, context?: string) => debugLogger.viewportState(state, context);
export const logCameraAction = (action: string, details?: any) => debugLogger.cameraAction(action, details);
export const logUserInteraction = (type: string, details?: any) => debugLogger.userInteraction(type, details);
export const logUserInteractionDetailed = (type: string, details: any, preState?: any, postState?: any) => 
  debugLogger.userInteractionDetailed(type, details, preState, postState);
export const logTidalFlow = (phase: string, data: any) => debugLogger.tidalFlow(phase, data);
export const logStateTransition = (from: any, to: any, trigger: string) => debugLogger.stateTransition(from, to, trigger);
export const logPersistenceOp = (operation: string, data?: any, success?: boolean) => debugLogger.persistence(operation, data, success);
export const logLifecycle = (phase: string, component: string, data?: any) => debugLogger.lifecycle(phase, component, data);
export const logTiming = (operation: string, duration?: number, data?: any) => debugLogger.timing(operation, duration, data);
export const logSystemSnapshot = (context: string, cameraState?: any, chartState?: any, persistentState?: any) => 
  debugLogger.systemSnapshot(context, cameraState, chartState, persistentState);
export const logInteractionCycle = (phase: 'START' | 'MIDDLE' | 'END', type: string, data?: any) => 
  debugLogger.interactionCycle(phase, type, data);

// Para habilitar logs de streaming si es necesario para debugging:
// debugLogger.setEnabled('STREAMING', true);

export default debugLogger;
