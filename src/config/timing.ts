/**
 * Configuración centralizada de timings para el sistema de cámara
 * Optimizado para mejor respuesta y menor bloqueo de eventos
 */

export const CAMERA_TIMINGS = {
  // Timeouts para debounce de interacciones
  ZOOM_DEBOUNCE: 100,        // Reducido de 150ms
  PAN_DEBOUNCE: 100,         // Reducido de 150ms
  
  // Timeouts para procesar estado final
  ZOOM_FINAL_CAPTURE: 50,    // Reducido de 100ms
  PAN_FINAL_CAPTURE: 50,     // Reducido de 100ms
  
  // Timeouts para liberar bloqueos globales
  ZOOM_GLOBAL_RELEASE: 50,   // Reducido de 100ms
  PAN_GLOBAL_RELEASE: 50,    // Reducido de 100ms
  
  // Throttling de eventos
  ZOOM_THROTTLE: 100,        // Reducido de 150ms
  PAN_THROTTLE: 100,         // Reducido de 150ms
  
  // Camera state management
  INTERACTION_END_DELAY: 25, // Reducido de 50ms
  COOLDOWN_DURATION: 1500,   // Reducido de 3000ms
  
  // Chart update throttling
  CHART_UPDATE_THROTTLE: 100, // Para evitar updates muy frecuentes
  
  // Log deduplication
  LOG_DEDUP_WINDOW: 10       // Prevenir logs duplicados en 10ms
} as const;

export const VIEWPORT_DEFAULTS = {
  DEFAULT_TIDE: 0.8,
  MIN_VISIBLE_CANDLES: 20,
  MAX_VISIBLE_CANDLES: 200,
  PREFERRED_VISIBLE_CANDLES: 50
} as const;

/**
 * Configuración para debugging
 */
export const DEBUG_CONFIG = {
  ENABLE_CAMERA_LOGS: true,
  ENABLE_VIEWPORT_LOGS: true,
  ENABLE_INTERACTION_LOGS: true,
  ENABLE_TIDAL_LOGS: true,
  ENABLE_STATE_LOGS: true,
  ENABLE_PERSISTENCE_LOGS: true,
  ENABLE_CHART_LOGS: true,
  
  // Deshabilitados para reducir ruido
  ENABLE_STREAMING_LOGS: false,
  ENABLE_PERFORMANCE_LOGS: false,
  ENABLE_WEBVIEW_LOGS: false,
  ENABLE_ANIMATION_LOGS: false
} as const;
