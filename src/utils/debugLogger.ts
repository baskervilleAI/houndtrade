/**
 * Sistema de logging centralizado para debugging selectivo
 * Permite habilitar/deshabilitar categorías específicas de logs
 * CONFIGURADO PARA DEBUGGING DETALLADO DE CÁMARA Y VIEWPORT
 */

// Configuración inline para timing y debug - OPTIMIZADA PARA PRODUCCIÓN
const DEBUG_CONFIG = {
  ENABLED: false,
  DETAILED_LOGS: false, // Reducido para mejor rendimiento
  LOG_PERFORMANCE: false, // Solo para debugging específico
  ENABLE_CAMERA_LOGS: false, // Solo para debugging de cámara
  ENABLE_VIEWPORT_LOGS: false, // Solo para debugging de viewport
  ENABLE_INTERACTION_LOGS: true, // Habilitado para debugging de interacciones del chart
  ENABLE_TIDAL_LOGS: false, // Solo para debugging de tidal flow
  ENABLE_STATE_LOGS: false, // Solo para debugging de estado
  ENABLE_PERSISTENCE_LOGS: true, // HABILITADO para debugging de persistencia
  ENABLE_CHART_LOGS: true, // Habilitado para debugging de colores del chart
  ENABLE_STREAMING_LOGS: false, // Solo para debugging de streaming
  ENABLE_PERFORMANCE_LOGS: false, // Solo para debugging de performance
  ENABLE_WEBVIEW_LOGS: false, // Solo para debugging de webview
  ENABLE_ANIMATION_LOGS: false, // Solo para debugging de animaciones
  
  // NUEVOS: Logs específicos para debugging de escala y última vela
  ENABLE_LAST_CANDLE_LOGS: false, // Para debugging de última vela
  ENABLE_SCALE_LOGS: false, // Para debugging de escala
  ENABLE_CRYPTO_CHANGE_LOGS: false, // Para debugging de cambio de cripto
  ENABLE_CHART_COLOR_LOGS: true, // NUEVO: Para debugging de colores del chart
  ENABLE_CLICK_LOGS: true, // NUEVO: Para debugging de clicks
  ENABLE_STORAGE_LOGS: true, // NUEVO: Para debugging de localStorage/sessionStorage
  ENABLE_HOOK_LOGS: true, // NUEVO: Para debugging de hooks de React
  
  // Control específico para logs de desarrollo que saturan la consola
  ENABLE_DEVELOPMENT_LOGS: false, // Logs de desarrollo (portfolio, localStorage, etc.)
};

const CAMERA_TIMINGS = {
  USER_INTERACTION_DELAY: 300,
  INTERACTION_TIMEOUT: 500,
  PAN_DEBOUNCE: 50,
  ZOOM_DEBOUNCE: 50,
  LOG_DEDUP_WINDOW: 100
};

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
  | 'LAST_CANDLE'  // Logs específicos para debugging de última vela
  | 'SCALE'        // Logs específicos para debugging de escala
  | 'CRYPTO_CHANGE' // Logs específicos para debugging de cambio de cripto
  | 'CHART_COLOR'  // NUEVO: Logs específicos para colores del chart
  | 'CLICK'        // NUEVO: Logs específicos para clicks
  | 'STORAGE'      // NUEVO: Logs específicos para localStorage/sessionStorage
  | 'HOOK'         // NUEVO: Logs específicos para hooks de React

interface LogConfig {
  enabled: boolean;
  emoji: string;
  color?: string;
}

// Configuración de logs - optimizada para debugging específico
const LOG_CONFIG: Record<LogCategory, LogConfig> = {
  CAMERA: { enabled: DEBUG_CONFIG.ENABLE_CAMERA_LOGS, emoji: '📷' },
  VIEWPORT: { enabled: DEBUG_CONFIG.ENABLE_VIEWPORT_LOGS, emoji: '🖼️' },
  INTERACTION: { enabled: DEBUG_CONFIG.ENABLE_INTERACTION_LOGS, emoji: '👆' },
  TIDAL: { enabled: DEBUG_CONFIG.ENABLE_TIDAL_LOGS, emoji: '🌊' },
  STATE: { enabled: DEBUG_CONFIG.ENABLE_STATE_LOGS, emoji: '⚡' },
  PERSISTENCE: { enabled: DEBUG_CONFIG.ENABLE_PERSISTENCE_LOGS, emoji: '💾' },
  CHART: { enabled: DEBUG_CONFIG.ENABLE_CHART_LOGS, emoji: '📊' },
  STREAMING: { enabled: DEBUG_CONFIG.ENABLE_STREAMING_LOGS, emoji: '📡' },
  GESTURES: { enabled: false, emoji: '🤏' }, // Reducido para menor spam
  PERFORMANCE: { enabled: DEBUG_CONFIG.ENABLE_PERFORMANCE_LOGS, emoji: '⚡' },
  ERROR: { enabled: true, emoji: '❌' }, // Siempre habilitado
  WEBVIEW: { enabled: DEBUG_CONFIG.ENABLE_WEBVIEW_LOGS, emoji: '📱' },
  ANIMATION: { enabled: DEBUG_CONFIG.ENABLE_ANIMATION_LOGS, emoji: '🎬' },
  
  // NUEVOS: Logs específicos para debugging crítico
  LAST_CANDLE: { enabled: DEBUG_CONFIG.ENABLE_LAST_CANDLE_LOGS, emoji: '🕯️' },
  SCALE: { enabled: DEBUG_CONFIG.ENABLE_SCALE_LOGS, emoji: '📏' },
  CRYPTO_CHANGE: { enabled: DEBUG_CONFIG.ENABLE_CRYPTO_CHANGE_LOGS, emoji: '🔄' },
  
  // NUEVOS: Logs específicos para persistencia y colores
  CHART_COLOR: { enabled: DEBUG_CONFIG.ENABLE_CHART_COLOR_LOGS, emoji: '🎨' },
  CLICK: { enabled: DEBUG_CONFIG.ENABLE_CLICK_LOGS, emoji: '🖱️' },
  STORAGE: { enabled: DEBUG_CONFIG.ENABLE_STORAGE_LOGS, emoji: '🗄️' },
  HOOK: { enabled: DEBUG_CONFIG.ENABLE_HOOK_LOGS, emoji: '🪝' },
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
   * Log específico para operaciones de localStorage/sessionStorage
   */
  storage(operation: 'SAVE' | 'LOAD' | 'DELETE' | 'CLEAR' | 'EXISTS', storageType: 'localStorage' | 'sessionStorage', key: string, data?: any, success?: boolean) {
    if (LOG_CONFIG.STORAGE.enabled) {
      console.log(`🗄️ [STORAGE] ${storageType.toUpperCase()}_${operation}${success !== undefined ? ` (${success ? 'SUCCESS' : 'FAILED'})` : ''}:`, {
        key,
        dataType: typeof data,
        dataSize: data ? (typeof data === 'string' ? data.length : JSON.stringify(data).length) : 0,
        preview: data && typeof data === 'object' ? Object.keys(data) : data,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para colores del chart y su visibilidad
   */
  chartColor(action: string, colorInfo?: any) {
    if (LOG_CONFIG.CHART_COLOR.enabled) {
      console.log(`🎨 [CHART_COLOR] ${action}:`, {
        ...colorInfo,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para clicks en el chart
   */
  chartClick(clickType: string, position?: any, elementInfo?: any, resultingAction?: string) {
    if (LOG_CONFIG.CLICK.enabled) {
      console.log(`🖱️ [CHART_CLICK] ${clickType}:`, {
        position,
        element: elementInfo,
        result: resultingAction,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para clicks que afectan la visibilidad de colores
   */
  chartClickColorChange(clickType: string, beforeState: any, afterState: any, affectedElements?: string[]) {
    if (LOG_CONFIG.CLICK.enabled || LOG_CONFIG.CHART_COLOR.enabled) {
      console.log(`🖱️🎨 [CHART_CLICK_COLOR_CHANGE] ${clickType}:`, {
        before: beforeState,
        after: afterState,
        affected: affectedElements,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para seguimiento de elementos del chart que cambian de visibilidad
   */
  chartElementVisibility(elementId: string, elementType: string, visible: boolean, colorInfo?: any, trigger?: string) {
    if (LOG_CONFIG.CHART_COLOR.enabled) {
      console.log(`👁️ [CHART_ELEMENT_VISIBILITY] ${elementType}_${elementId}:`, {
        visible,
        trigger,
        color: colorInfo,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para hooks de React y su estado
   */
  reactHook(hookName: string, phase: 'INIT' | 'UPDATE' | 'EFFECT' | 'CLEANUP' | 'ERROR', data?: any) {
    if (LOG_CONFIG.HOOK.enabled) {
      console.log(`🪝 [HOOK] ${hookName}_${phase}:`, {
        ...data,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para debugging de hooks que violan las reglas
   */
  hookViolation(hookName: string, violationType: string, callLocation: string, stackTrace?: string) {
    // Este log siempre se muestra porque es un error crítico
    console.error(`🚫 [HOOK_VIOLATION] ${hookName} called in ${violationType}:`, {
      location: callLocation,
      violation: violationType,
      stackTrace: stackTrace || new Error().stack,
      timestamp: new Date().toLocaleTimeString(),
      suggestion: `Move ${hookName} to the top level of the component function`
    });
  }

  /**
   * Log específico para detectar cuando se llama useTechnicalIndicators incorrectamente
   */
  detectTechnicalIndicatorHookViolation(callerFunction: string, candleDataLength?: number) {
    this.hookViolation(
      'useTechnicalIndicators',
      'CALLBACK_FUNCTION',
      callerFunction,
      `useTechnicalIndicators was called inside ${callerFunction} - this violates Rules of Hooks`
    );
    
    console.error(`🚫🔧 [TECHNICAL_INDICATOR_FIX] Immediate fix needed:`, {
      problem: `useTechnicalIndicators called inside ${callerFunction}`,
      location: 'MinimalistChart.tsx:299',
      solution: 'Move useTechnicalIndicators to component top level',
      candleDataLength,
      timestamp: new Date().toLocaleTimeString()
    });
  }

  /**
   * Log específico para monitorear cuando se pierden colores en el chart
   */
  chartColorLoss(lossType: string, beforeState: any, afterState: any, trigger: string) {
    if (LOG_CONFIG.CHART_COLOR.enabled) {
      console.warn(`🎨❌ [CHART_COLOR_LOSS] ${lossType}:`, {
        trigger,
        before: beforeState,
        after: afterState,
        lostColors: this.compareColorStates(beforeState, afterState),
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Función auxiliar para comparar estados de colores
   */
  private compareColorStates(before: any, after: any): string[] {
    const lost: string[] = [];
    if (before && after) {
      for (const key in before) {
        if (!(key in after)) {
          lost.push(key);
        }
      }
    }
    return lost;
  }

  /**
   * Log específico para colores del chart cuando se hacen visibles/invisibles
   */
  chartColorVisibility(action: 'SHOW' | 'HIDE' | 'TOGGLE', elementType: string, colorInfo?: any) {
    if (LOG_CONFIG.CHART_COLOR.enabled) {
      console.log(`🎨 [CHART_COLOR_VISIBILITY] ${action}_${elementType}:`, {
        ...colorInfo,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para persistencia de colores del chart
   */
  chartColorPersistence(action: 'SAVE' | 'LOAD' | 'RESTORE' | 'CLEAR', colorData?: any, symbol?: string, timeframe?: string) {
    if (LOG_CONFIG.CHART_COLOR.enabled || LOG_CONFIG.PERSISTENCE.enabled) {
      const storageKey = symbol && timeframe ? `houndtrade_colors_${symbol}_${timeframe}` : 'unknown';
      console.log(`🎨💾 [CHART_COLOR_PERSISTENCE] ${action}:`, {
        storageKey,
        colorData,
        symbol,
        timeframe,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para seguimiento de estado de colores después de clicks
   */
  chartColorStateAfterClick(clickPosition: any, colorsBefore: any, colorsAfter: any, shouldPersist: boolean) {
    if (LOG_CONFIG.CHART_COLOR.enabled || LOG_CONFIG.CLICK.enabled) {
      console.log(`🖱️🎨 [CHART_COLOR_STATE_AFTER_CLICK]:`, {
        clickPosition,
        colorsBefore,
        colorsAfter,
        shouldPersist,
        colorsChanged: JSON.stringify(colorsBefore) !== JSON.stringify(colorsAfter),
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para debugging de retención de colores durante actualizaciones del chart
   */
  chartColorRetention(updateType: string, expectedColors: any, actualColors: any, retained: boolean) {
    if (LOG_CONFIG.CHART_COLOR.enabled) {
      console.log(`🎨🔄 [CHART_COLOR_RETENTION] ${updateType}:`, {
        expectedColors,
        actualColors,
        retained,
        colorCount: actualColors ? Object.keys(actualColors).length : 0,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para el ciclo completo de persistencia de colores
   */
  chartColorLifecycle(phase: 'CLICK' | 'PERSIST' | 'RELOAD' | 'RESTORE' | 'UPDATE' | 'LOST', details?: any) {
    if (LOG_CONFIG.CHART_COLOR.enabled) {
      console.log(`🎨♻️ [CHART_COLOR_LIFECYCLE] ${phase}:`, {
        ...details,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para debugging de colores que parpadean
   */
  chartColorFlicker(flickerType: 'APPEAR_ON_HOVER' | 'DISAPPEAR_ON_LEAVE' | 'STREAM_UPDATE_LOSS' | 'HOOK_ERROR_LOSS', details?: any) {
    if (LOG_CONFIG.CHART_COLOR.enabled) {
      console.warn(`🎨⚡ [CHART_COLOR_FLICKER] ${flickerType}:`, {
        ...details,
        timestamp: new Date().toLocaleTimeString(),
        stackTrace: new Error().stack?.split('\n').slice(0, 3)
      });
    }
  }

  /**
   * Log específico para eventos de mouse que afectan colores
   */
  chartMouseColorEvent(eventType: 'MOUSEENTER' | 'MOUSELEAVE' | 'MOUSEMOVE' | 'HOVER', position?: any, colorState?: any) {
    if (LOG_CONFIG.CHART_COLOR.enabled || LOG_CONFIG.CLICK.enabled) {
      console.log(`🖱️🎨 [CHART_MOUSE_COLOR] ${eventType}:`, {
        position,
        colorState,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para el error del hook que está causando problemas
   */
  hookErrorLoop(iteration: number, errorLocation: string, candleDataLength?: number) {
    // Este log se muestra siempre porque es crítico
    console.error(`🚫🔄 [HOOK_ERROR_LOOP] Iteration ${iteration}:`, {
      location: errorLocation,
      candleDataLength,
      timestamp: new Date().toLocaleTimeString(),
      message: 'useTechnicalIndicators called in callback - BREAKING THE APP'
    });
  }

  /**
   * Log específico para rastrear el estado de colores durante stream updates
   */
  streamUpdateColorTracking(updateType: string, beforeColors: any, afterColors: any, hookErrorOccurred: boolean) {
    if (LOG_CONFIG.CHART_COLOR.enabled || LOG_CONFIG.CHART.enabled) {
      console.log(`🌊🎨 [STREAM_COLOR_TRACKING] ${updateType}:`, {
        beforeColors: beforeColors ? Object.keys(beforeColors) : 'none',
        afterColors: afterColors ? Object.keys(afterColors) : 'none',
        colorsLost: beforeColors && !afterColors,
        hookErrorOccurred,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para cuando los colores son aplicados sobre el gráfico
   */
  chartColorApplication(elementType: string, colors: any, position?: any) {
    if (LOG_CONFIG.CHART_COLOR.enabled) {
      console.log(`🖌️ [CHART_COLOR_APPLY] ${elementType}:`, {
        colors,
        position,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  /**
   * Log específico para persistencia de indicadores técnicos
   */
  indicatorPersistence(action: string, symbol: string, timeframe: string, indicators?: any) {
    this.log('PERSISTENCE', `INDICATOR_${action.toUpperCase()}`, {
      symbol,
      timeframe,
      storageKey: `houndtrade_indicators_${symbol}_${timeframe}`,
      indicatorCount: indicators ? Object.keys(indicators).length : 0,
      indicators: indicators ? Object.keys(indicators) : [],
      timestamp: new Date().toLocaleTimeString()
    });
  }

  /**
   * Log específico para persistencia de viewport
   */
  viewportPersistence(action: string, symbol: string, timeframe: string, viewportData?: any) {
    this.log('PERSISTENCE', `VIEWPORT_${action.toUpperCase()}`, {
      symbol,
      timeframe,
      storageKey: `houndtrade_viewport_${symbol}_${timeframe}`,
      viewport: viewportData,
      timestamp: new Date().toLocaleTimeString()
    });
  }

  /**
   * Log específico para cache de datos de mercado
   */
  marketDataCache(action: string, symbol: string, dataType: string, cacheInfo?: any) {
    this.log('PERSISTENCE', `MARKET_CACHE_${action.toUpperCase()}`, {
      symbol,
      dataType,
      cacheKey: `${symbol}_${dataType}`,
      ...cacheInfo,
      timestamp: new Date().toLocaleTimeString()
    });
  }

  /**
   * Log específico para el ciclo completo de persistencia de indicadores
   */
  indicatorLifecycle(phase: 'MOUNT' | 'LOAD' | 'RESTORE' | 'SAVE' | 'UNMOUNT', symbol: string, timeframe: string, details?: any) {
    this.log('PERSISTENCE', `INDICATOR_LIFECYCLE_${phase}`, {
      symbol,
      timeframe,
      storageKey: `houndtrade_indicators_${symbol}_${timeframe}`,
      ...details,
      timestamp: new Date().toLocaleTimeString()
    });
  }

  /**
   * Log específico para debugging de recuperación de estado desde storage
   */
  stateRecovery(storageType: 'localStorage' | 'sessionStorage', key: string, recovered: boolean, data?: any, error?: any) {
    this.log('PERSISTENCE', `STATE_RECOVERY_${recovered ? 'SUCCESS' : 'FAILED'}`, {
      storageType,
      key,
      recovered,
      dataType: data ? typeof data : 'none',
      error: error?.message,
      timestamp: new Date().toLocaleTimeString()
    });
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
   * Log solo para debugging crítico (controlable)
   */
  debug(message: string, data?: any) {
    if (DEBUG_CONFIG.ENABLE_DEVELOPMENT_LOGS) {
      console.log(`🔍 [DEBUG] ${message}`, data);
    }
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

  /**
   * Funciones específicas para logging del overlay
   */
  overlayCreate(dimensions: any, position: any) {
    if (LOG_CONFIG.CHART_COLOR.enabled) {
      console.log(`🎨📋 [OVERLAY_CREATE] Overlay creado:`, {
        dimensions,
        position,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  overlayPosition(chartBounds: any, overlayBounds: any, aligned: boolean) {
    if (LOG_CONFIG.CHART_COLOR.enabled) {
      console.log(`📍 [OVERLAY_POSITION] Posicionamiento del overlay:`, {
        chartBounds,
        overlayBounds,
        aligned,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  overlayClick(clickPosition: any, colorData: any) {
    if (LOG_CONFIG.CLICK.enabled || LOG_CONFIG.CHART_COLOR.enabled) {
      console.log(`🖱️📋 [OVERLAY_CLICK] Click en overlay:`, {
        clickPosition,
        colorData,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  overlayClose(reason: 'CLOSE_ORDER_BUTTON' | 'MANUAL' | 'ERROR', finalState: any) {
    if (LOG_CONFIG.CHART_COLOR.enabled) {
      console.log(`❌📋 [OVERLAY_CLOSE] Overlay cerrado:`, {
        reason,
        finalState,
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

// NUEVAS funciones para debugging específico
export const logLastCandle = (message: string, data?: any) => debugLogger.log('LAST_CANDLE', message, data);
export const logScale = (message: string, data?: any) => debugLogger.log('SCALE', message, data);
export const logCryptoChange = (message: string, data?: any) => debugLogger.log('CRYPTO_CHANGE', message, data);

// Funciones para logs de persistencia avanzada
export const logStorage = (operation: 'SAVE' | 'LOAD' | 'DELETE' | 'CLEAR' | 'EXISTS', storageType: 'localStorage' | 'sessionStorage', key: string, data?: any, success?: boolean) => 
  debugLogger.storage(operation, storageType, key, data, success);

export const logChartColor = (action: string, colorInfo?: any) => debugLogger.chartColor(action, colorInfo);
export const logChartClick = (clickType: string, position?: any, elementInfo?: any, resultingAction?: string) => 
  debugLogger.chartClick(clickType, position, elementInfo, resultingAction);

export const logChartClickColorChange = (clickType: string, beforeState: any, afterState: any, affectedElements?: string[]) =>
  debugLogger.chartClickColorChange(clickType, beforeState, afterState, affectedElements);

export const logChartElementVisibility = (elementId: string, elementType: string, visible: boolean, colorInfo?: any, trigger?: string) =>
  debugLogger.chartElementVisibility(elementId, elementType, visible, colorInfo, trigger);

export const logReactHook = (hookName: string, phase: 'INIT' | 'UPDATE' | 'EFFECT' | 'CLEANUP' | 'ERROR', data?: any) => 
  debugLogger.reactHook(hookName, phase, data);

export const logHookViolation = (hookName: string, violationType: string, callLocation: string, stackTrace?: string) =>
  debugLogger.hookViolation(hookName, violationType, callLocation, stackTrace);

export const logChartColorVisibility = (action: 'SHOW' | 'HIDE' | 'TOGGLE', elementType: string, colorInfo?: any) =>
  debugLogger.chartColorVisibility(action, elementType, colorInfo);

export const logChartColorApplication = (elementType: string, colors: any, position?: any) =>
  debugLogger.chartColorApplication(elementType, colors, position);

export const logChartColorPersistence = (action: 'SAVE' | 'LOAD' | 'RESTORE' | 'CLEAR', colorData?: any, symbol?: string, timeframe?: string) =>
  debugLogger.chartColorPersistence(action, colorData, symbol, timeframe);

export const logChartColorStateAfterClick = (clickPosition: any, colorsBefore: any, colorsAfter: any, shouldPersist: boolean) =>
  debugLogger.chartColorStateAfterClick(clickPosition, colorsBefore, colorsAfter, shouldPersist);

export const logChartColorRetention = (updateType: string, expectedColors: any, actualColors: any, retained: boolean) =>
  debugLogger.chartColorRetention(updateType, expectedColors, actualColors, retained);

export const logChartColorLifecycle = (phase: 'CLICK' | 'PERSIST' | 'RELOAD' | 'RESTORE' | 'UPDATE' | 'LOST', details?: any) =>
  debugLogger.chartColorLifecycle(phase, details);

export const logTechnicalIndicatorHookViolation = (callerFunction: string, candleDataLength?: number) =>
  debugLogger.detectTechnicalIndicatorHookViolation(callerFunction, candleDataLength);

export const logChartColorLoss = (lossType: string, beforeState: any, afterState: any, trigger: string) =>
  debugLogger.chartColorLoss(lossType, beforeState, afterState, trigger);

export const logChartColorFlicker = (flickerType: 'APPEAR_ON_HOVER' | 'DISAPPEAR_ON_LEAVE' | 'STREAM_UPDATE_LOSS' | 'HOOK_ERROR_LOSS', details?: any) =>
  debugLogger.chartColorFlicker(flickerType, details);

export const logChartMouseColorEvent = (eventType: 'MOUSEENTER' | 'MOUSELEAVE' | 'MOUSEMOVE' | 'HOVER', position?: any, colorState?: any) =>
  debugLogger.chartMouseColorEvent(eventType, position, colorState);

export const logHookErrorLoop = (iteration: number, errorLocation: string, candleDataLength?: number) =>
  debugLogger.hookErrorLoop(iteration, errorLocation, candleDataLength);

export const logStreamUpdateColorTracking = (updateType: string, beforeColors: any, afterColors: any, hookErrorOccurred: boolean) =>
  debugLogger.streamUpdateColorTracking(updateType, beforeColors, afterColors, hookErrorOccurred);

export const logIndicatorPersistence = (action: string, symbol: string, timeframe: string, indicators?: any) => 
  debugLogger.indicatorPersistence(action, symbol, timeframe, indicators);

export const logViewportPersistence = (action: string, symbol: string, timeframe: string, viewportData?: any) => 
  debugLogger.viewportPersistence(action, symbol, timeframe, viewportData);

export const logMarketDataCache = (action: string, symbol: string, dataType: string, cacheInfo?: any) => 
  debugLogger.marketDataCache(action, symbol, dataType, cacheInfo);

export const logIndicatorLifecycle = (phase: 'MOUNT' | 'LOAD' | 'RESTORE' | 'SAVE' | 'UNMOUNT', symbol: string, timeframe: string, details?: any) =>
  debugLogger.indicatorLifecycle(phase, symbol, timeframe, details);

export const logStateRecovery = (storageType: 'localStorage' | 'sessionStorage', key: string, recovered: boolean, data?: any, error?: any) =>
  debugLogger.stateRecovery(storageType, key, recovered, data, error);

// Función específica para debugging de colores del chart (mantenida por compatibilidad)
export const logChartColors = (message: string, data?: any) => {
  console.log(`🎨 [CHART_COLORS] ${message}`, data);
};

// Función específica para debugging de clicks en el chart (mantenida por compatibilidad)
export const logChartClick_legacy = (message: string, data?: any) => {
  console.log(`🖱️ [CHART_CLICK] ${message}`, data);
};

// Para habilitar logs específicos desde consola del navegador:
// debugLogger.setEnabled('STREAMING', true);
// debugLogger.setEnabled('LAST_CANDLE', true);
// debugLogger.setEnabled('SCALE', true);
// debugLogger.setEnabled('CRYPTO_CHANGE', true);

// Función global para habilitar debugging específico
if (typeof window !== 'undefined') {
  (window as any).enableHoundTradeDebug = (categories?: string[]) => {
    const availableCategories = [
      'CAMERA', 'VIEWPORT', 'INTERACTION', 'TIDAL', 'STATE', 'PERSISTENCE',
      'CHART', 'STREAMING', 'GESTURES', 'PERFORMANCE', 'WEBVIEW', 'ANIMATION',
      'LAST_CANDLE', 'SCALE', 'CRYPTO_CHANGE', 'CHART_COLOR', 'CLICK', 'STORAGE', 'HOOK'
    ];
    
    if (!categories) {
      // Habilitar todas las categorías de debugging
      availableCategories.forEach(cat => {
        debugLogger.setEnabled(cat as LogCategory, true);
      });
      console.log('🔍 [HOUND_DEBUG] Todas las categorías de debugging habilitadas');
    } else {
      // Habilitar solo las categorías especificadas
      categories.forEach(cat => {
        if (availableCategories.includes(cat.toUpperCase())) {
          debugLogger.setEnabled(cat.toUpperCase() as LogCategory, true);
          console.log(`🔍 [HOUND_DEBUG] Debugging habilitado para: ${cat.toUpperCase()}`);
        } else {
          console.warn(`⚠️ [HOUND_DEBUG] Categoría desconocida: ${cat}`);
        }
      });
    }
    
    console.log('📋 [HOUND_DEBUG] Estado actual:', debugLogger.getConfig());
  };

  (window as any).disableHoundTradeDebug = () => {
    const categories = ['CAMERA', 'VIEWPORT', 'INTERACTION', 'TIDAL', 'STATE', 'PERSISTENCE', 'CHART', 'STREAMING', 'GESTURES', 'PERFORMANCE', 'WEBVIEW', 'ANIMATION'];
    categories.forEach(cat => {
      debugLogger.setEnabled(cat as LogCategory, false);
    });
    console.log('🔇 [HOUND_DEBUG] Debugging deshabilitado');
  };

  // Funciones específicas para logs de desarrollo
  (window as any).enableDevLogs = () => {
    DEBUG_CONFIG.ENABLE_DEVELOPMENT_LOGS = true;
    console.log('🔧 [HOUND_DEBUG] Logs de desarrollo habilitados');
  };

  (window as any).disableDevLogs = () => {
    DEBUG_CONFIG.ENABLE_DEVELOPMENT_LOGS = false;
    console.log('🔇 [HOUND_DEBUG] Logs de desarrollo deshabilitados');
  };

  // Funciones para debugging de chart específicamente
  (window as any).enableChartDebug = () => {
    debugLogger.setEnabled('CHART', true);
    debugLogger.setEnabled('CHART_COLOR', true);
    debugLogger.setEnabled('CLICK', true);
    debugLogger.setEnabled('INTERACTION', true);
    console.log('🎨 [HOUND_DEBUG] Debugging de chart completo habilitado');
  };

  // Función para debugging de persistencia específicamente
  (window as any).enablePersistenceDebug = () => {
    debugLogger.setEnabled('PERSISTENCE', true);
    debugLogger.setEnabled('STORAGE', true);
    debugLogger.setEnabled('STATE', true);
    console.log('💾 [HOUND_DEBUG] Debugging de persistencia habilitado');
  };

  // Funciones para debugging de hooks específicamente
  (window as any).enableHookDebug = () => {
    debugLogger.setEnabled('HOOK', true);
    console.log('🪝 [HOUND_DEBUG] Debugging de hooks habilitado');
  };

  // Función específica para debugging del error de hook en MinimalistChart
  (window as any).debugHookViolation = () => {
    console.log(`
🚫 [HOOK_VIOLATION_DEBUG] Información sobre el error de hook en MinimalistChart:

PROBLEMA DETECTADO:
- useTechnicalIndicators está siendo llamado dentro de restoreIndicatorConfigs()
- restoreIndicatorConfigs es un callback, no el cuerpo principal del componente
- Esto viola las Reglas de Hooks de React

UBICACIÓN DEL ERROR:
- Archivo: src/components/chart/MinimalistChart.tsx
- Línea: ~299
- Función: restoreIndicatorConfigs (callback)

SOLUCIÓN RECOMENDADA:
1. Mover useTechnicalIndicators al nivel superior del componente
2. Pasar los indicadores como parámetro a restoreIndicatorConfigs
3. O usar useMemo/useEffect para calcular los indicadores una sola vez

EJEMPLO DE FIX:
// En el componente principal (CORRECTO):
const technicalIndicators = useTechnicalIndicators(candleData);

// En restoreIndicatorConfigs (INCORRECTO - actual):
const currentTechnicalIndicators = useTechnicalIndicators(candleData);
    `);
  };

  // Función para debugging completo de persistencia y colores
  (window as any).enableFullDebug = () => {
    debugLogger.setEnabled('PERSISTENCE', true);
    debugLogger.setEnabled('STORAGE', true);
    debugLogger.setEnabled('CHART_COLOR', true);
    debugLogger.setEnabled('CLICK', true);
    debugLogger.setEnabled('HOOK', true);
    debugLogger.setEnabled('CHART', true);
    debugLogger.setEnabled('INTERACTION', true);
    console.log('🔧 [HOUND_DEBUG] Debugging completo habilitado (persistencia + colores + hooks)');
  };

  // Función específica para monitorear el flujo de indicadores
  (window as any).monitorIndicators = () => {
    debugLogger.setEnabled('PERSISTENCE', true);
    debugLogger.setEnabled('CHART', true);
    console.log(`
📊 [INDICATOR_MONITOR] Monitoring de indicadores activado:

OBSERVANDO:
- Carga desde localStorage de configuraciones de indicadores
- Restauración de indicadores en el chart
- Guardado automático de cambios
- Errores de hooks en el proceso de restauración

STORAGE KEYS MONITOREADOS:
- houndtrade_indicators_BTCUSDT_1m
- houndtrade_indicators_[SYMBOL]_[TIMEFRAME]
- houndtrade_viewport_[SYMBOL]_[TIMEFRAME]

Para ver detalles completos, usa: enableFullDebug()
    `);
  };

  // Nueva función específica para debugging de colores del chart
  (window as any).monitorChartColors = () => {
    debugLogger.setEnabled('CHART_COLOR', true);
    debugLogger.setEnabled('CLICK', true);
    debugLogger.setEnabled('PERSISTENCE', true);
    console.log(`
🎨 [CHART_COLOR_MONITOR] Monitoring de colores del chart activado:

OBSERVANDO:
- Clicks en el chart y cambios de color resultantes
- Persistencia de colores en localStorage/sessionStorage
- Retención de colores durante actualizaciones del chart
- Restauración de colores al recargar la página

STORAGE KEYS DE COLORES:
- houndtrade_colors_BTCUSDT_1m
- houndtrade_colors_[SYMBOL]_[TIMEFRAME]
- Chart color state in session storage

FUNCIONES DE DEBUG DISPONIBLES:
- debugChartColorState() - Ver estado actual de colores
- fixChartColorPersistence() - Información sobre cómo arreglar la persistencia
    `);
  };

  // Función para debuggear el estado actual de colores del chart
  (window as any).debugChartColorState = () => {
    const chartColors = JSON.parse(localStorage.getItem('houndtrade_colors_BTCUSDT_1m') || '{}');
    const sessionColors = JSON.parse(sessionStorage.getItem('houndtrade_chart_colors') || '{}');
    
    console.log(`
🎨🔍 [CHART_COLOR_DEBUG] Estado actual de colores:

LOCALSTORAGE (houndtrade_colors_BTCUSDT_1m):`, chartColors, `

SESSIONSTORAGE (houndtrade_chart_colors):`, sessionColors, `

PROBLEMA TÍPICO:
- Los colores se guardan correctamente después del click
- Pero se pierden durante las actualizaciones del chart (stream updates)
- Esto pasa porque el chart se redibuja sin restaurar los colores persistidos

SOLUCIÓN NECESARIA:
1. Guardar colores inmediatamente después del click
2. Restaurar colores en cada actualización del chart
3. Verificar que los colores persistan durante stream updates
    `);
  };

  // Función específica para arreglar la persistencia de colores
  (window as any).fixChartColorPersistence = () => {
    console.log(`
🎨🔧 [CHART_COLOR_PERSISTENCE_FIX] Guía para arreglar la persistencia:

PROBLEMA IDENTIFICADO:
- Los colores del chart no se mantienen después de actualizaciones de stream
- Los clicks agregan colores pero se pierden en la próxima actualización

PASOS PARA SOLUCIONARLO:

1. GUARDAR COLORES DESPUÉS DEL CLICK:
   logChartColorPersistence('SAVE', colorData, 'BTCUSDT', '1m');

2. RESTAURAR COLORES EN CADA ACTUALIZACIÓN:
   logChartColorRetention('STREAM_UPDATE', expectedColors, actualColors, retained);

3. VERIFICAR CICLO COMPLETO:
   logChartColorLifecycle('CLICK', clickDetails);
   logChartColorLifecycle('PERSIST', persistDetails);
   logChartColorLifecycle('UPDATE', updateDetails);
   logChartColorLifecycle('RESTORE', restoreDetails);

UBICACIONES CLAVE PARA AGREGAR LOGS:
- En el evento de click del chart: usar logChartColorStateAfterClick()
- En las actualizaciones de stream: usar logChartColorRetention()
- En la restauración: usar logChartColorPersistence()

STORAGE KEYS A MONITOREAR:
- houndtrade_colors_BTCUSDT_1m
- houndtrade_chart_colors (session)
    `);
  };

  // Nueva función para debugging específico del parpadeo de colores
  (window as any).debugColorFlicker = () => {
    debugLogger.setEnabled('CHART_COLOR', true);
    debugLogger.setEnabled('CLICK', true);
    debugLogger.setEnabled('HOOK', true);
    console.log(`
🎨⚡ [COLOR_FLICKER_DEBUG] Debugging de parpadeo de colores activado:

PROBLEMA DETECTADO:
- Los colores aparecen cuando el mouse está sobre "Configurar Orden"
- Los colores parpadean cuando el mouse sale del gráfico
- Esto sugiere que hay eventos de hover que controlan la visibilidad

HIPÓTESIS:
1. Los colores están manejados por CSS hover o eventos de mouse
2. El parpadeo ocurre por conflictos con stream updates
3. El hook error está interfiriendo con el estado del chart

NUEVA FUNCIONES DE DEBUG:
- logChartMouseColorEvent() - Para eventos de mouse
- logChartColorFlicker() - Para detectar parpadeos
- logStreamUpdateColorTracking() - Para seguir colores durante updates

PARA USAR:
1. Mueve el mouse sobre "Configurar Orden" y observa los logs
2. Mueve el mouse fuera del gráfico y observa los logs
3. Los logs mostrarán exactamente qué está causando el parpadeo

SIGUIENTE PASO:
- Hacer click en el chart para agregar colores
- Observar qué pasa cuando se mueve el mouse
- Verificar si los colores están en localStorage/sessionStorage
    `);
  };

  // Función específica para detectar y corregir el parpadeo
  (window as any).analyzeColorFlicker = () => {
    debugLogger.setEnabled('CHART_COLOR', true);
    debugLogger.setEnabled('CHART', true);
    debugLogger.setEnabled('CLICK', true);
    
    let colorState = { 
      visible: false, 
      lastEvent: null as { type: string; x: number; y: number; target: string } | null 
    };
    
    // Interceptar eventos del DOM para detectar cuando aparecen/desaparecen colores
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
          const target = mutation.target as HTMLElement;
          
          // Buscar elementos que puedan ser colores del chart
          if (target.style.backgroundColor || target.style.color || target.classList.contains('chart-color')) {
            const isVisible = target.style.display !== 'none' && target.style.opacity !== '0';
            
            if (colorState.visible !== isVisible) {
              colorState.visible = isVisible;
              debugLogger.chartColorFlicker(
                isVisible ? 'APPEAR_ON_HOVER' : 'DISAPPEAR_ON_LEAVE',
                {
                  element: target.tagName + '.' + target.className,
                  style: target.style.cssText,
                  event: colorState.lastEvent
                }
              );
            }
          }
        }
      });
    });
    
    // Observar cambios en el DOM
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'class']
    });
    
    // Interceptar eventos de mouse para correlacionar con cambios de colores
    document.addEventListener('mousemove', (e) => {
      colorState.lastEvent = {
        type: 'mousemove',
        x: e.clientX,
        y: e.clientY,
        target: (e.target as HTMLElement).tagName + '.' + (e.target as HTMLElement).className
      };
    });
    
    console.log(`
🎨🔍 [ANALYZE_COLOR_FLICKER] Análisis de parpadeo iniciado:

OBSERVANDO:
- Cambios de estilo en elementos del DOM (style, class)
- Eventos de mouse (mousemove, hover)
- Correlación entre movimiento del mouse y aparición de colores

DETECTARÁ:
- Cuándo aparecen los colores (APPEAR_ON_HOVER)
- Cuándo desaparecen los colores (DISAPPEAR_ON_LEAVE)
- Qué elementos específicos están cambiando
- Qué eventos de mouse los están causando

PRÓXIMOS PASOS:
1. Mueve el mouse sobre el gráfico
2. Observa los logs de CHART_COLOR_FLICKER
3. Verifica qué elementos están cambiando de estilo
4. Identifica el patrón de aparición/desaparición
    `);
  };

  // Función específica para rastrear el DRAWING_TRADING_ELEMENTS
  (window as any).trackTradingElementsDrawing = () => {
    debugLogger.setEnabled('CHART', true);
    debugLogger.setEnabled('CHART_COLOR', true);
    
    console.log(`
📊🎨 [TRACK_TRADING_ELEMENTS] Rastreando elementos de trading:

OBSERVADO EN LOGS:
- DRAWING_TRADING_ELEMENTS aparece después de clicks
- showTradingOverlay: true indica que los colores deben ser visibles
- Esto sugiere que los colores están relacionados con elementos de trading

HIPÓTESIS:
1. Los colores son parte de la "trading overlay"
2. Se muestran cuando showTradingOverlay es true
3. Pueden desaparecer si la overlay se oculta por algún motivo

MONITOREAR:
- Cuándo se llama DRAWING_TRADING_ELEMENTS
- El estado de showTradingOverlay
- Los niveles de precio (currentPriceLevel, takeProfitLevel, stopLossLevel)
- Si estos elementos persisten después de stream updates

PASOS PARA DEBUGGEAR:
1. Haz click en el chart para activar DRAWING_TRADING_ELEMENTS
2. Observa si showTradingOverlay permanece true
3. Verifica si los niveles de precio se mantienen
4. Mueve el mouse y observa si los elementos desaparecen
    `);
    
    // Interceptar cuando se loggea DRAWING_TRADING_ELEMENTS
    const originalLog = console.log;
    console.log = (...args) => {
      if (args[1] && typeof args[1] === 'string' && args[1].includes('DRAWING_TRADING_ELEMENTS')) {
        debugLogger.chartColorLifecycle('UPDATE', {
          message: 'DRAWING_TRADING_ELEMENTS detected',
          data: args[2] || args[1],
          timestamp: new Date().toLocaleTimeString()
        });
      }
      originalLog.apply(console, args);
    };
  };

  // Nueva función para debugging del overlay de colores
  (window as any).debugChartOverlay = () => {
    debugLogger.setEnabled('CHART_COLOR', true);
    debugLogger.setEnabled('CLICK', true);
    
    console.log(`
🎨📋 [CHART_OVERLAY_DEBUG] Sistema de overlay para colores activado:

CONCEPTO:
- Crear un div vacío con las mismas dimensiones que el gráfico de velas
- Posicionarlo exactamente encima del gráfico (z-index superior)
- Manejar los colores independientemente del gráfico original
- Solo cerrarlo con el botón "Cerrar Orden"

VENTAJAS:
1. ✅ Independiente de stream updates
2. ✅ No afectado por errores de hooks  
3. ✅ Control total sobre visibilidad
4. ✅ Fácil manejo de eventos de click/hover
5. ✅ Persistencia controlada por ti

ARQUITECTURA SUGERIDA:
- TradingOverlay.tsx (nuevo componente)
- Mismo tamaño que MinimalistChart
- position: absolute, z-index: 1000
- Manejo independiente de colores
- Estado controlado por TradingScreen

LOGS A IMPLEMENTAR:
- logOverlayCreate() - Cuando se crea el overlay
- logOverlayPosition() - Para verificar posicionamiento
- logOverlayClick() - Para clicks en el overlay
- logOverlayClose() - Cuando se cierra con "Cerrar Orden"
    `);
  };

  // Función para contar los errores de hook repetitivos
  (window as any).countHookErrors = () => {
    let errorCount = 0;
    const originalError = console.error;
    console.error = (...args) => {
      if (args[0]?.includes && args[0].includes('useTechnicalIndicators')) {
        errorCount++;
        if (errorCount % 10 === 0) {
          debugLogger.hookErrorLoop(errorCount, 'MinimalistChart.tsx:299', 1000);
        }
      }
      originalError.apply(console, args);
    };
    
    console.log(`🚫📊 [HOOK_ERROR_COUNTER] Contador de errores de hook iniciado. Errores actuales: ${errorCount}`);
  };

  // Función CRÍTICA: Solución temporal para el problema del hook
  (window as any).emergencyHookFix = () => {
    console.error(`
🚨🚫 [EMERGENCY_HOOK_FIX] SOLUCIÓN CRÍTICA NECESARIA:

PROBLEMA FATAL:
- useTechnicalIndicators llamado en línea 299 de MinimalistChart.tsx
- Dentro de restoreIndicatorConfigs() callback
- Causando errores repetitivos que rompen la aplicación
- Interfiriendo con la persistencia de colores

SOLUCIÓN INMEDIATA REQUERIDA:
1. Mover useTechnicalIndicators al nivel superior del componente
2. Pasar los indicadores como props a restoreIndicatorConfigs

CÓDIGO ACTUAL (INCORRECTO):
const restoreIndicatorConfigs = useCallback((chart, candleData) => {
  const currentTechnicalIndicators = useTechnicalIndicators(candleData); // ❌ ESTO ESTÁ MAL
  // ...
});

CÓDIGO CORREGIDO (CORRECTO):
// En el componente principal:
const technicalIndicators = useTechnicalIndicators(candleData); // ✅ ESTO ESTÁ BIEN

const restoreIndicatorConfigs = useCallback((chart, candleData, indicators) => {
  // usar 'indicators' en lugar de llamar al hook aquí
  // ...
});

HASTA QUE NO SE ARREGLE ESTO:
- Los colores seguirán parpadeando
- Los stream updates fallarán
- La aplicación tendrá errores constantes

PRIORIDAD: CRÍTICA ⚠️
    `);
  };

  // Función específica para rastrear los colores con hover
  (window as any).trackHoverColors = () => {
    debugLogger.setEnabled('CHART_COLOR', true);
    debugLogger.setEnabled('CLICK', true);
    
    // Interceptar eventos de mouse para ver qué está pasando
    let hoverState = { active: false, target: null as EventTarget | null };
    
    document.addEventListener('mouseover', (e) => {
      if (e.target && (e.target as HTMLElement).textContent?.includes('Configurar Orden')) {
        hoverState.active = true;
        hoverState.target = e.target;
        debugLogger.chartMouseColorEvent('MOUSEENTER', { 
          x: e.clientX, 
          y: e.clientY, 
          target: (e.target as HTMLElement).textContent 
        }, hoverState);
      }
    });
    
    document.addEventListener('mouseout', (e) => {
      if (hoverState.active && e.target === hoverState.target) {
        hoverState.active = false;
        debugLogger.chartMouseColorEvent('MOUSELEAVE', { 
          x: e.clientX, 
          y: e.clientY, 
          target: 'Configurar Orden' 
        }, hoverState);
        hoverState.target = null;
      }
    });
    
    console.log(`
🖱️🎨 [HOVER_COLOR_TRACKER] Tracking de hover activado:

MONITOREANDO:
- Eventos mouseover/mouseout en "Configurar Orden"
- Cambios de estado de colores relacionados con hover
- Timing de aparición/desaparición de colores

TEORÍA:
- Los colores aparecen cuando el mouse está sobre ciertos elementos
- Esto sugiere que hay CSS hover o JavaScript que controla la visibilidad
- El parpadeo puede ser causado por conflictos entre hover states y stream updates

PRÓXIMOS PASOS:
1. Mueve el mouse sobre "Configurar Orden"
2. Observa los logs de MOUSEENTER/MOUSELEAVE
3. Correlaciona con la aparición/desaparición de colores
4. Identifica si hay CSS o JavaScript controlando esto
    `);
  };

  // Mantener habilitados por defecto solo los logs críticos
  // Debug instructions removed for cleaner console
}

// Instancia singleton - ELIMINADO DUPLICADO

// Export default para compatibilidad
export default debugLogger;
