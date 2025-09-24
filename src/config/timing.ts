/**
 * Configuración centralizada de timings para el sistema de cámara
 * Optimizado para mejor respuesta y menor bloqueo de eventos
 */

export const CAMERA_TIMINGS = {
  // Timeouts para debounce de interacciones
  ZOOM_DEBOUNCE: 150,        // Incrementado para más suavidad
  PAN_DEBOUNCE: 150,         // Incrementado para más suavidad
  
  // Timeouts para procesar estado final
  ZOOM_FINAL_CAPTURE: 100,   // Incrementado para mejor captura
  PAN_FINAL_CAPTURE: 100,    // Incrementado para mejor captura
  
  // Timeouts para liberar bloqueos globales
  ZOOM_GLOBAL_RELEASE: 100,  // Incrementado para evitar conflictos
  PAN_GLOBAL_RELEASE: 100,   // Incrementado para evitar conflictos
  
  // Throttling de eventos
  ZOOM_THROTTLE: 150,        // Incrementado para menos ajustes
  PAN_THROTTLE: 150,         // Incrementado para menos ajustes
  
  // Camera state management
  INTERACTION_END_DELAY: 50, // Incrementado para mejor control
  COOLDOWN_DURATION: 2000,   // Incrementado para evitar resets frecuentes
  
  // Chart update throttling
  CHART_UPDATE_THROTTLE: 150, // Incrementado para menos actualizaciones
  
  // Log deduplication
  LOG_DEDUP_WINDOW: 20       // Incrementado para reducir spam de logs
} as const;

export const VIEWPORT_DEFAULTS = {
  DEFAULT_TIDE: 0.8,
  MIN_VISIBLE_CANDLES: 20,
  MAX_VISIBLE_CANDLES: 1000,
  PREFERRED_VISIBLE_CANDLES: 1000
} as const;

/**
 * Configuración para debugging
 */
export const DEBUG_CONFIG = {
  ENABLE_CAMERA_LOGS: true,
  ENABLE_VIEWPORT_LOGS: false,  // Deshabilitado para reducir spam
  ENABLE_INTERACTION_LOGS: false, // Deshabilitado para reducir spam
  ENABLE_TIDAL_LOGS: false,     // Deshabilitado para reducir spam
  ENABLE_STATE_LOGS: true,
  ENABLE_PERSISTENCE_LOGS: false, // Deshabilitado para reducir spam
  ENABLE_CHART_LOGS: false,     // Deshabilitado para reducir spam
  
  // Deshabilitados para reducir ruido
  ENABLE_STREAMING_LOGS: false,
  ENABLE_PERFORMANCE_LOGS: false,
  ENABLE_WEBVIEW_LOGS: false,
  ENABLE_ANIMATION_LOGS: false
} as const;
