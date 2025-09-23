/**
 * Sistema de logging centralizado para debugging selectivo
 * Permite habilitar/deshabilitar categorías específicas de logs
 */

type LogCategory = 
  | 'CAMERA'       // Logs de control de cámara
  | 'CHART'        // Logs del gráfico Chart.js
  | 'STREAMING'    // Logs de streaming de datos
  | 'GESTURES'     // Logs de gestos del usuario
  | 'PERFORMANCE'  // Logs de rendimiento
  | 'ERROR'        // Logs de errores (siempre habilitados)
  | 'WEBVIEW'      // Logs de WebView
  | 'ANIMATION'    // Logs de animaciones

interface LogConfig {
  enabled: boolean;
  emoji: string;
  color?: string;
}

// Configuración de logs - habilitar solo las categorías necesarias
const LOG_CONFIG: Record<LogCategory, LogConfig> = {
  CAMERA: { enabled: true, emoji: '📷' },      // ✅ Mantener logs de cámara
  CHART: { enabled: true, emoji: '📊' },       // ✅ Mantener logs de Chart.js
  STREAMING: { enabled: false, emoji: '📡' },  // ❌ Deshabilitar logs de streaming
  GESTURES: { enabled: true, emoji: '👆' },    // ✅ Mantener logs de gestos
  PERFORMANCE: { enabled: false, emoji: '⚡' }, // ❌ Deshabilitar logs de performance
  ERROR: { enabled: true, emoji: '❌' },        // ✅ Siempre mantener errores
  WEBVIEW: { enabled: false, emoji: '📱' },     // ❌ Deshabilitar logs de WebView
  ANIMATION: { enabled: false, emoji: '🎬' },   // ❌ Deshabilitar logs de animación
};

class DebugLogger {
  /**
   * Log principal para todas las categorías
   */
  log(category: LogCategory, message: string, data?: any) {
    const config = LOG_CONFIG[category];
    
    // Los errores siempre se muestran
    if (category === 'ERROR' || config.enabled) {
      const prefix = `${config.emoji} [${category}]`;
      
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
   * Log para estado de la cámara (con formato especial)
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
}

// Instancia singleton
export const debugLogger = new DebugLogger();

// Exportar funciones de conveniencia
export const logCamera = (message: string, data?: any) => debugLogger.log('CAMERA', message, data);
export const logChart = (message: string, data?: any) => debugLogger.log('CHART', message, data);
export const logError = (message: string, error?: any) => debugLogger.error(message, error);
export const logCameraState = (state: any) => debugLogger.cameraState(state);
export const logCameraAction = (action: string, details?: any) => debugLogger.cameraAction(action, details);
export const logUserInteraction = (type: string, details?: any) => debugLogger.userInteraction(type, details);

// Para habilitar logs de streaming si es necesario para debugging:
// debugLogger.setEnabled('STREAMING', true);

export default debugLogger;
