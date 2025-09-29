/**
 * MinimalistChart - Componente de gráfico con sistema avanzado de debugging de cámara
 * 
 * DEBUGGING DETALLADO DE CÁMARA Y VIEWPORT:
 * 
 * 🔍 Para debuggear el sistema de cámara, usa en la consola del navegador:
 *    window.debugCameraSystem()
 * 
 * 📋 Categorías de logs disponibles:
 *    - 📷 CAMERA: Control general de cámara
 *    - 🖼️ VIEWPORT: Estados detallados de viewport 
 *    - 👆 INTERACTION: Interacciones del usuario (zoom, pan)
 *    - 🌊 TIDAL: Sistema de gobernanza tidal
 *    - ⚡ STATE: Transiciones de estado
 *    - 💾 PERSISTENCE: Operaciones de sessionStorage
 *    - 📊 CHART: Eventos de Chart.js
 * 
 * ⚙️ Para habilitar/deshabilitar categorías específicas:
 *    debugLogger.setEnabled('STREAMING', true)  // Habilitar logs de streaming
 *    debugLogger.setEnabled('PERFORMANCE', true) // Habilitar logs de performance
 * 
 * 🎯 Ciclo de vida completo trackeable:
 *    1. Carga inicial → logs PERSISTENCE + VIEWPORT
 *    2. Interacción usuario → logs INTERACTION + STATE
 *    3. Persistencia viewport → logs TIDAL + CAMERA
 *    4. Actualizaciones streaming → logs CHART + TIDAL
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Text, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { useMarket } from '../../context/AppContext';
import liveStreamingService, { CandleData, StreamUpdate, TimeInterval } from '../../services/liveStreamingService';
import { useTechnicalIndicators, addIndicatorToChart } from '../../hooks/useTechnicalIndicators';
import { useSimpleCamera } from '../../hooks/useSimpleCamera';
import { usePersistentViewport } from '../../hooks/usePersistentViewport';
import { 
  logChart, 
  logTidalFlow, 
  logLifecycle, 
  logUserInteractionDetailed, 
  logViewportState,
  logTiming,
  logSystemSnapshot,
  logInteractionCycle,
  logError,
  logLastCandle,
  logScale,
  logCryptoChange
} from '../../utils/debugLogger';

interface MinimalistChartProps {
  symbol?: string;
}

const timeIntervals: { label: string; value: TimeInterval }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
];

const MinimalistChart: React.FC<MinimalistChartProps> = ({
  symbol = 'BTCUSDT'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);
  const initialViewportSet = useRef<boolean>(false); // Flag para rastrear si ya se configuró el viewport inicial
  const [status, setStatus] = useState<string>('Inicializando...');
  const [currentInterval, setCurrentInterval] = useState<TimeInterval>('1m');
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<Set<string>>(new Set());
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const updateThrottleMs = 100; // Throttle updates to max 10fps for better performance
  
  // Estados para controlar interacciones de usuario y evitar race conditions
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const panTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastZoomTime = useRef<number>(0);
  const lastPanTime = useRef<number>(0);
  
  // NUEVO: Estados para distinguir entre interacciones de cámara y clicks de trading
  const isCameraInteracting = useRef<boolean>(false);
  const isZoomingOrPanning = useRef<boolean>(false);
  const lastCameraInteractionTime = useRef<number>(0);
  const cameraInteractionCooldown = 150; // Reducido a 150ms para mejor respuesta
  
  // Estados para las mejoras de trading visual
  const [showTradingOverlay, setShowTradingOverlay] = useState(false);
  const [takeProfitLevel, setTakeProfitLevel] = useState<number | null>(null);
  const [stopLossLevel, setStopLossLevel] = useState<number | null>(null);
  const [currentPriceLevel, setCurrentPriceLevel] = useState<number | null>(null);
  
  // NUEVO: Estado para preservar configuración de indicadores técnicos persistentemente
  const [persistentIndicatorConfigs, setPersistentIndicatorConfigs] = useState<Record<string, any>>({});
  
  // Estado para detectar el tamaño de pantalla
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  // Hook para detectar cambios de tamaño de pantalla
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width <= 480) {
        setScreenSize('mobile');
      } else if (width <= 768) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };
    
    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  // Función para obtener estilos responsivos
  const getResponsiveStyles = (screenSize: 'mobile' | 'tablet' | 'desktop') => {
    const baseStyles = {
      mobile: {
        intervalButton: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          marginRight: 3,
        },
        intervalButtonText: {
          fontSize: 10,
        },
        indicatorButton: {
          paddingHorizontal: 6,
          paddingVertical: 3,
          marginLeft: 2,
        },
        indicatorButtonText: {
          fontSize: 9,
        }
      },
      tablet: {
        intervalButton: {
          paddingHorizontal: 10,
          paddingVertical: 5,
          marginRight: 4,
        },
        intervalButtonText: {
          fontSize: 11,
        },
        indicatorButton: {
          paddingHorizontal: 7,
          paddingVertical: 3,
          marginLeft: 3,
        },
        indicatorButtonText: {
          fontSize: 9,
        }
      },
      desktop: {
        intervalButton: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          marginRight: 6,
        },
        intervalButtonText: {
          fontSize: 12,
        },
        indicatorButton: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          marginLeft: 4,
        },
        indicatorButtonText: {
          fontSize: 10,
        }
      }
    };
    
    return baseStyles[screenSize];
  };

  const responsiveStyles = getResponsiveStyles(screenSize);
  
  // NUEVOS: Métricas detalladas para debugging del sistema
  const chartInitializationCount = useRef<number>(0);
  const cameraResetCount = useRef<number>(0);
  const unexpectedViewportChanges = useRef<number>(0);
  const lastChartUpdate = useRef<number>(0);
  const updateSequence = useRef<number>(0);
  const isInitializing = useRef<boolean>(false);
  
  // NUEVO: Referencias para configuraciones persistentes de indicadores
  const persistentIndicatorConfigsRef = useRef<Record<string, any>>({});
  
  // NUEVO: Referencias para control avanzado de eventos
  const zoomDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const panDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🐛 DEBUG: Referencias para controlar spam de logs
  const lastPluginLogState = useRef<boolean | null>(null);
  const lastPluginDrawTime = useRef<number>(0);
  
  // NUEVO: Control global para evitar cualquier solapamiento
  const globalInteractionBlocked = useRef<boolean>(false);
  
  // CRÍTICO: Controles separados para zoom y pan + throttle reducido
  const lastZoomProcessedTime = useRef<number>(0);
  const lastPanProcessedTime = useRef<number>(0);
  const isProcessingZoom = useRef<boolean>(false);
  const isProcessingPan = useRef<boolean>(false);
  
  // NUEVO: Flag para distinguir entre eventos automáticos y del usuario
  const isApplyingAutomaticViewport = useRef<boolean>(false);
  
  // NUEVO: Control para aplicar viewport completo solo una vez tras cambio
  const hasAppliedFullViewportAfterChange = useRef<boolean>(false);
  
  // CRÍTICO: Bandera para bloquear actualizaciones de vela durante cambios de criptomoneda
  const isChangingCryptocurrency = useRef<boolean>(false);
  const cryptocurrencyChangeTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // NUEVO: Sistema de control para elementos de trading (similar al sistema de cámara)
  const tradingOverlayState = useRef<{
    isActive: boolean;
    lastDrawTime: number;
    needsRedraw: boolean;
    isDrawing: boolean;
    currentPrice: number | null;
    takeProfitLevel: number | null;
    stopLossLevel: number | null;
  }>({
    isActive: false,
    lastDrawTime: 0,
    needsRedraw: false,
    isDrawing: false,
    currentPrice: null,
    takeProfitLevel: null,
    stopLossLevel: null
  });
  
  const { selectedPair } = useMarket();
  const currentSymbol = symbol || selectedPair;
  
  // NUEVO: Referencias para rastrear cambios intencionales de símbolo/intervalo
  const previousSymbolRef = useRef<string>('');
  const previousIntervalRef = useRef<TimeInterval | ''>('');
  const hasLoadedOnceRef = useRef<boolean>(false);

  // NUEVO: Funciones para controlar el estado de trading de manera estable - CON DEBUG
  const activateTradingOverlay = useCallback((currentPrice: number) => {
    const now = Date.now();
    
    console.log(`🟢 [OVERLAY DEBUG] ACTIVANDO overlay - Precio: $${currentPrice.toFixed(2)}`);
    
    // Configurar niveles iniciales
    const initialSpread = currentPrice * 0.02;
    const newTpLevel = currentPrice + initialSpread;
    const newSlLevel = currentPrice - initialSpread;
    
    console.log(`🎯 [OVERLAY DEBUG] Niveles calculados - TP: $${newTpLevel.toFixed(2)}, SL: $${newSlLevel.toFixed(2)}`);
    
    // Actualizar estado interno
    tradingOverlayState.current = {
      isActive: true,
      lastDrawTime: 0, // Forzar redibujado
      needsRedraw: true,
      isDrawing: false,
      currentPrice,
      takeProfitLevel: newTpLevel,
      stopLossLevel: newSlLevel
    };
    
    // Actualizar estados de React
    setShowTradingOverlay(true);
    setCurrentPriceLevel(currentPrice);
    setTakeProfitLevel(newTpLevel);
    setStopLossLevel(newSlLevel);
    
    console.log(`✅ [OVERLAY DEBUG] Estados actualizados - showTradingOverlay: true`);
    
    // Marcar para redibujado inmediato
    requestTradingRedraw();
  }, []);
  
  const deactivateTradingOverlay = useCallback(() => {
    console.log(`🔴 [OVERLAY DEBUG] DESACTIVANDO overlay`);
    
    // Resetear estado interno
    tradingOverlayState.current = {
      isActive: false,
      lastDrawTime: 0,
      needsRedraw: false,
      isDrawing: false,
      currentPrice: null,
      takeProfitLevel: null,
      stopLossLevel: null
    };
    
    console.log(`🔄 [OVERLAY DEBUG] Estado interno reseteado`);
    
    // Actualizar estados de React
    setShowTradingOverlay(false);
    setCurrentPriceLevel(null);
    setTakeProfitLevel(null);
    setStopLossLevel(null);
    
    console.log(`✅ [OVERLAY DEBUG] Estados React actualizados - showTradingOverlay: false`);
    
    // El plugin tradingElementsPlugin automáticamente no dibujará nada
    // cuando isActive sea false, limpiando el canvas automáticamente
    if (chartRef.current) {
      chartRef.current.update('none');
      console.log(`🎨 [OVERLAY DEBUG] Chart.update() ejecutado para limpiar canvas`);
    }
  }, []);
  
  const updateTradingLevels = useCallback((newTp?: number, newSl?: number) => {
    if (!tradingOverlayState.current.isActive) return;
    
    const currentState = tradingOverlayState.current;
    const needsUpdate = 
      (newTp !== undefined && newTp !== currentState.takeProfitLevel) ||
      (newSl !== undefined && newSl !== currentState.stopLossLevel);
    
    if (needsUpdate) {
      // Actualizar estado interno
      if (newTp !== undefined) {
        tradingOverlayState.current.takeProfitLevel = newTp;
        setTakeProfitLevel(newTp);
      }
      if (newSl !== undefined) {
        tradingOverlayState.current.stopLossLevel = newSl;
        setStopLossLevel(newSl);
      }
      
      tradingOverlayState.current.needsRedraw = true;
      requestTradingRedraw();
    }
  }, []);
  
  const requestTradingRedraw = useCallback(() => {
    // SIMPLIFICADO: Solo forzar update del chart, el plugin se encarga del dibujado
    if (chartRef.current && tradingOverlayState.current.isActive) {
      chartRef.current.update('none');
    }
  }, []);

  // NUEVO: Funciones para preservar y restaurar configuraciones de indicadores
  const preserveIndicatorConfigs = useCallback((chart: any) => {
    if (!chart?.data?.datasets) return;
    
    const configs: Record<string, any> = {};
    
    // Preservar configuraciones de todos los indicadores activos
    chart.data.datasets.forEach((dataset: any, index: number) => {
      if (index === 0) return; // Skip candlestick dataset
      
      const label = dataset.label;
      if (label && (
        label.includes('SMA') || 
        label.includes('EMA') || 
        label.includes('BB') ||
        label.includes('RSI') ||
        label.includes('MACD')
      )) {
        configs[label] = {
          label,
          type: dataset.type,
          borderColor: dataset.borderColor,
          backgroundColor: dataset.backgroundColor,
          borderWidth: dataset.borderWidth,
          pointRadius: dataset.pointRadius,
          tension: dataset.tension,
          borderDash: dataset.borderDash,
          yAxisID: dataset.yAxisID,
          fill: dataset.fill
        };
        
        logChart('PRESERVING_INDICATOR_CONFIG', {
          label,
          borderColor: dataset.borderColor,
          backgroundColor: dataset.backgroundColor
        });
      }
    });
    
    persistentIndicatorConfigsRef.current = configs;
    setPersistentIndicatorConfigs(configs);
    
    // También guardar en localStorage para persistencia entre sesiones
    try {
      const storageKey = `houndtrade_indicators_${currentSymbol}_${currentInterval}`;
      const configsWithActiveIndicators = {
        configs,
        activeIndicators: Array.from(activeIndicators)
      };
      localStorage.setItem(storageKey, JSON.stringify(configsWithActiveIndicators));
      
      logChart('INDICATOR_CONFIGS_SAVED_TO_STORAGE', {
        storageKey,
        configCount: Object.keys(configs).length,
        activeIndicators: Array.from(activeIndicators)
      });
    } catch (error) {
      logError('Failed to save indicator configs to localStorage', { error });
    }
  }, [currentSymbol, currentInterval, activeIndicators]);
  
  const restoreIndicatorConfigs = useCallback((chart: any, candleData: CandleData[]) => {
    if (!chart?.data?.datasets || !persistentIndicatorConfigsRef.current) return;
    
    const configs = persistentIndicatorConfigsRef.current;
    const configKeys = Object.keys(configs);
    
    if (configKeys.length === 0) return;
    
    logChart('RESTORING_INDICATOR_CONFIGS', {
      configCount: configKeys.length,
      configs: configKeys,
      candleDataLength: candleData.length
    });
    
    // Recalcular indicadores técnicos con datos actuales
    const currentTechnicalIndicators = useTechnicalIndicators(candleData);
    
    // Restaurar cada indicador preservando su configuración original
    configKeys.forEach(label => {
      const config = configs[label];
      let indicatorData: { x: number; y: number }[] = [];
      
      // Determinar qué datos usar según el label
      if (label === 'SMA 20') {
        indicatorData = candleData.map((candle, i) => ({
          x: candle.x,
          y: currentTechnicalIndicators.sma20[i]
        })).filter(point => !isNaN(point.y));
      } else if (label === 'SMA 50') {
        indicatorData = candleData.map((candle, i) => ({
          x: candle.x,
          y: currentTechnicalIndicators.sma50[i]
        })).filter(point => !isNaN(point.y));
      } else if (label === 'EMA 20') {
        indicatorData = candleData.map((candle, i) => ({
          x: candle.x,
          y: currentTechnicalIndicators.ema20[i]
        })).filter(point => !isNaN(point.y));
      } else if (label === 'BB Upper') {
        indicatorData = candleData.map((candle, i) => ({
          x: candle.x,
          y: currentTechnicalIndicators.bollinger.upper[i]
        })).filter(point => !isNaN(point.y));
      } else if (label === 'BB Middle') {
        indicatorData = candleData.map((candle, i) => ({
          x: candle.x,
          y: currentTechnicalIndicators.bollinger.middle[i]
        })).filter(point => !isNaN(point.y));
      } else if (label === 'BB Lower') {
        indicatorData = candleData.map((candle, i) => ({
          x: candle.x,
          y: currentTechnicalIndicators.bollinger.lower[i]
        })).filter(point => !isNaN(point.y));
      }
      
      // Crear dataset con configuración preservada y datos actuales
      if (indicatorData.length > 0) {
        const dataset = {
          ...config,
          data: indicatorData
        };
        
        chart.data.datasets.push(dataset);
        
        logChart('INDICATOR_RESTORED', {
          label,
          dataPoints: indicatorData.length,
          borderColor: config.borderColor,
          preservedConfig: config
        });
      }
    });
    
    logChart('ALL_INDICATORS_RESTORED', {
      restoredCount: configKeys.length,
      totalDatasets: chart.data.datasets.length
    });
  }, []);
  
  // NUEVO: Función para cargar configuraciones desde localStorage al inicializar
  const loadIndicatorConfigsFromStorage = useCallback(() => {
    try {
      const storageKey = `houndtrade_indicators_${currentSymbol}_${currentInterval}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const parsedData = JSON.parse(stored);
        const { configs, activeIndicators: storedActiveIndicators } = parsedData;
        
        if (configs && storedActiveIndicators) {
          persistentIndicatorConfigsRef.current = configs;
          setPersistentIndicatorConfigs(configs);
          
          // Restaurar indicadores activos
          setActiveIndicators(new Set(storedActiveIndicators));
          
          logChart('INDICATOR_CONFIGS_LOADED_FROM_STORAGE', {
            storageKey,
            configCount: Object.keys(configs).length,
            activeIndicators: storedActiveIndicators
          });
          
          return { configs, activeIndicators: storedActiveIndicators };
        }
      }
    } catch (error) {
      logError('Failed to load indicator configs from localStorage', { error });
    }
    
    return null;
  }, [currentSymbol, currentInterval]);

  // Callback estable para cambios de estado de cámara
  const onCameraStateChange = useCallback((cameraState: any) => {
    logViewportState(cameraState, 'CAMERA_STATE_CALLBACK');
  }, []);

  // Sistema de cámara simple y predecible
  const simpleCamera = useSimpleCamera({
    defaultVisibleCandles: 1000, // Permitir ver todas las velas por defecto
    // autoResetTimeMs eliminado - la cámara mantiene posición del usuario permanentemente
    onStateChange: onCameraStateChange,
  });

  // Hook para persistencia robusta del viewport
  const persistentViewport = usePersistentViewport(chartRef);

  // Helper functions para manejo de interacciones
  const startUserInteraction = useCallback(() => {
    const timestamp = Date.now();
    const preCameraState = simpleCamera.getCurrentState();
    
    // SIMPLIFICADO: Solo actualizar timestamp de interacción
    lastCameraInteractionTime.current = timestamp;
    
    logUserInteractionDetailed('START_USER_INTERACTION_CHART', {
      timestamp: new Date(timestamp).toLocaleTimeString(),
      component: 'MinimalistChart',
      preCameraMode: preCameraState.mode,
      preCameraLocked: preCameraState.isLocked,
      chartExists: !!chartRef.current,
      isStreamingActive: isStreaming,
      totalInteractions: 'starting_new_interaction'
    }, preCameraState);
    
    // Monitor for unexpected state changes
    const beforeInteraction = {
      cameraMode: preCameraState.mode,
      cameraLocked: preCameraState.isLocked,
      viewport: preCameraState.viewport
    };
    
    setIsUserInteracting(true);
    simpleCamera.onUserStartInteraction();
    
    // Log state after camera notification
    const postCameraState = simpleCamera.getCurrentState();
    logUserInteractionDetailed('CAMERA_NOTIFIED_OF_INTERACTION_START', {
      beforeInteraction,
      afterNotification: {
        cameraMode: postCameraState.mode,
        cameraLocked: postCameraState.isLocked,
        viewport: postCameraState.viewport
      },
      stateChanged: beforeInteraction.cameraMode !== postCameraState.mode || 
                    beforeInteraction.cameraLocked !== postCameraState.isLocked
    });
    
    // Limpiar timeout existente
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
      logChart('START_INTERACTION - cleared existing timeout');
    }
  }, [simpleCamera]);

  // Funciones para el trading overlay - DEBUGGING ESPECÍFICO PARA CLICKS
  const handleChartClick = useCallback((event: MouseEvent | TouchEvent) => {
    if (!chartRef.current || !canvasRef.current) {
      console.log('🔴 [CLICK DEBUG] Chart o canvas no disponible');
      return;
    }

    const now = Date.now();
    
    // SIMPLIFICADO: Solo bloquear clicks si acabamos de hacer zoom/pan recientemente
    const timeSinceLastCameraInteraction = now - lastCameraInteractionTime.current;
    if (timeSinceLastCameraInteraction < cameraInteractionCooldown) {
      console.log(`🔴 [CLICK DEBUG] Click bloqueado - interacción reciente (${timeSinceLastCameraInteraction}ms < ${cameraInteractionCooldown}ms)`);
      return;
    }

    const chart = chartRef.current;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Obtener coordenadas del click/touch
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Obtener el precio actual de la última vela
    const dataset = chart.data.datasets[0];
    if (!dataset || !dataset.data || dataset.data.length === 0) {
      console.log('🔴 [CLICK DEBUG] No hay datos de velas disponibles');
      return;
    }
    
    const lastCandle = dataset.data[dataset.data.length - 1] as any;
    const currentPrice = lastCandle.c;

    console.log(`🎯 [CLICK DEBUG] Click detectado en (${x}, ${y}) - Precio actual: $${currentPrice.toFixed(2)} - Overlay activo: ${showTradingOverlay}`);

    // TOGGLE: Activar/desactivar overlay según el estado actual
    if (showTradingOverlay) {
      // Si ya está activo, desactivarlo
      console.log('🔴 [CLICK DEBUG] Desactivando trading overlay');
      deactivateTradingOverlay();
    } else {
      // Si está inactivo, activarlo
      console.log('🟢 [CLICK DEBUG] Activando trading overlay con precio:', currentPrice.toFixed(2));
      activateTradingOverlay(currentPrice);
    }

  }, [showTradingOverlay, activateTradingOverlay, deactivateTradingOverlay]);

  // Configurar los event listeners para el canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isDragging = false;
    let dragTarget: 'tp' | 'sl' | null = null;

    // Función para detectar si el cursor está sobre una barra de TP/SL
    const getBarTarget = (x: number, y: number): 'tp' | 'sl' | null => {
      if (!chartRef.current || !showTradingOverlay || !takeProfitLevel || !stopLossLevel) return null;
      
      const chart = chartRef.current;
      const chartArea = chart.chartArea;
      const yScale = chart.scales.y;
      
      if (!yScale) return null;
      
      const barX = chartArea.right + 80; // Nueva posición X de las barras
      const barWidth = 16; // Ancho moderado
      const barHeight = 26; // Altura moderada
      
      // Verificar si está dentro del área de las barras
      if (x >= barX && x <= barX + barWidth) {
        const tpY = yScale.getPixelForValue(takeProfitLevel);
        const slY = yScale.getPixelForValue(stopLossLevel);
        
        // Verificar TP bar
        if (Math.abs(y - tpY) <= barHeight/2) return 'tp';
        // Verificar SL bar
        if (Math.abs(y - slY) <= barHeight/2) return 'sl';
      }
      
      return null;
    };

    // Manejar click del mouse
    const handleMouseClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const barTarget = getBarTarget(x, y);
      
      if (!barTarget && !isDragging) {
        // Solo activar en clicks simples (no en arrastres) y no sobre barras
        event.preventDefault();
        handleChartClick(event);
      }
    };

    // Manejar touch en móviles
    const handleTouchStart = (event: TouchEvent) => {
      // Solo activar en toques simples
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const barTarget = getBarTarget(x, y);
        
        if (barTarget) {
          event.preventDefault();
          isDragging = true;
          dragTarget = barTarget;
          canvas.style.cursor = 'grabbing';
        } else if (!isDragging) {
          event.preventDefault();
          handleChartClick(event);
        }
      }
    };

    // Manejar mouse down para iniciar arrastre
    const handleMouseDown = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const barTarget = getBarTarget(x, y);
      
      if (barTarget) {
        event.preventDefault();
        isDragging = true;
        dragTarget = barTarget;
        canvas.style.cursor = 'grabbing';
      }
    };

    // Manejar mouse move para cambiar cursor y arrastrar
    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      if (isDragging && dragTarget && chartRef.current) {
        event.preventDefault();
        
        const chart = chartRef.current;
        const yScale = chart.scales.y;
        
        if (!yScale) return;
        
        const canvasY = y * (canvas.height / rect.height);
        const priceAtCursor = yScale.getValueForPixel(canvasY);
        
        // Actualizar el nivel correspondiente usando el nuevo sistema
        if (dragTarget === 'tp') {
          updateTradingLevels(priceAtCursor, undefined);
        } else if (dragTarget === 'sl') {
          updateTradingLevels(undefined, priceAtCursor);
        }
        
        // No forzar redibujado aquí - el sistema controlado se encarga
        // chart.update('none'); // ELIMINADO para evitar bucles
        // setTimeout(() => { drawTradingElements(); }, 5); // ELIMINADO
        
      } else if (showTradingOverlay && !isDragging) {
        // Cambiar cursor si está sobre una barra
        const barTarget = getBarTarget(x, y);
        canvas.style.cursor = barTarget ? 'grab' : 'default';
      }
    };

    // Manejar mouse up para terminar arrastre
    const handleMouseUp = (event: MouseEvent) => {
      if (isDragging) {
        event.preventDefault();
        isDragging = false;
        dragTarget = null;
        canvas.style.cursor = 'default';
        
        logChart('TRADING_LEVEL_UPDATED', {
          takeProfitLevel,
          stopLossLevel,
          currentPriceLevel,
          dragTarget: dragTarget
        });
      }
    };

    // Manejar touch move para arrastre táctil
    const handleTouchMove = (event: TouchEvent) => {
      if (isDragging && dragTarget && event.touches.length === 1 && chartRef.current) {
        event.preventDefault();
        
        const touch = event.touches[0];
        const rect = canvas.getBoundingClientRect();
        const y = touch.clientY - rect.top;
        
        const chart = chartRef.current;
        const yScale = chart.scales.y;
        
        if (!yScale) return;
        
        const canvasY = y * (canvas.height / rect.height);
        const priceAtCursor = yScale.getValueForPixel(canvasY);
        
        // Actualizar el nivel correspondiente usando el nuevo sistema
        if (dragTarget === 'tp') {
          updateTradingLevels(priceAtCursor, undefined);
        } else if (dragTarget === 'sl') {
          updateTradingLevels(undefined, priceAtCursor);
        }
        
        // No forzar redibujado aquí - el sistema controlado se encarga
        // chart.update('none'); // ELIMINADO para evitar bucles
        // setTimeout(() => { drawTradingElements(); }, 5); // ELIMINADO
      }
    };

    // Manejar touch end para terminar arrastre táctil
    const handleTouchEnd = (event: TouchEvent) => {
      if (isDragging) {
        event.preventDefault();
        isDragging = false;
        dragTarget = null;
        
        logChart('TRADING_LEVEL_UPDATED_TOUCH', {
          takeProfitLevel,
          stopLossLevel,
          currentPriceLevel
        });
      }
    };

    // Registrar todos los event listeners
    canvas.addEventListener('click', handleMouseClick);
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('click', handleMouseClick);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      
      // Restaurar cursor
      canvas.style.cursor = 'default';
    };
  }, [handleChartClick, showTradingOverlay, takeProfitLevel, stopLossLevel]);

  // Actualizar el precio actual cuando cambian los datos de velas
  useEffect(() => {
    if (candleData.length > 0 && showTradingOverlay) {
      const lastCandle = candleData[candleData.length - 1];
      const newCurrentPrice = lastCandle.c;
      
      if (newCurrentPrice !== currentPriceLevel) {
        setCurrentPriceLevel(newCurrentPrice);
        
        // Actualizar gráfico si existe
        if (chartRef.current) {
          chartRef.current.update('none');
        }
      }
    }
  }, [candleData, showTradingOverlay, currentPriceLevel]);

  // Función para dibujar los elementos de trading directamente en el canvas - OPTIMIZADA
  const drawTradingElements = useCallback(() => {
    const state = tradingOverlayState.current;
    
    // CRÍTICO: Prevenir bucles infinitos con guards múltiples
    if (!state.isActive || state.isDrawing) {
      return;
    }
    
    if (!chartRef.current || !canvasRef.current) {
      return;
    }
    
    // Verificar que tenemos datos válidos
    if (!state.currentPrice || !state.takeProfitLevel || !state.stopLossLevel) {
      return;
    }

    const chart = chartRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const chartArea = chart.chartArea;
    const yScale = chart.scales.y;

    if (!ctx || !yScale || !chartArea) return;

    // Marcar que estamos dibujando para prevenir loops
    tradingOverlayState.current.isDrawing = true;
    const now = Date.now();
    
    logChart('DRAWING_TRADING_ELEMENTS_CONTROLLED', {
      currentPrice: state.currentPrice,
      takeProfitLevel: state.takeProfitLevel,
      stopLossLevel: state.stopLossLevel,
      timeSinceLastDraw: now - state.lastDrawTime,
      needsRedraw: state.needsRedraw
    });

    try {
      ctx.save();

      // Obtener la coordenada Y del precio actual
      const currentPriceY = yScale.getPixelForValue(state.currentPrice);

      // 1. Dibujar área verde (para TP) arriba del precio actual
      ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
      ctx.fillRect(
        chartArea.left,
        chartArea.top,
        chartArea.right - chartArea.left,
        currentPriceY - chartArea.top
      );

      // 2. Dibujar área roja (para SL) abajo del precio actual  
      ctx.fillStyle = 'rgba(255, 68, 68, 0.15)';
      ctx.fillRect(
        chartArea.left,
        currentPriceY,
        chartArea.right - chartArea.left,
        chartArea.bottom - currentPriceY
      );

      // 3. Dibujar línea horizontal del precio actual
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, currentPriceY);
      ctx.lineTo(chartArea.right, currentPriceY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. Dibujar líneas de TP y SL
      const tpY = yScale.getPixelForValue(state.takeProfitLevel);
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, tpY);
      ctx.lineTo(chartArea.right, tpY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Etiqueta TP
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      const tpText = `TP: $${(state.takeProfitLevel/1000).toFixed(1)}k`;
      ctx.strokeText(tpText, chartArea.right + 5, tpY - 5);
      ctx.fillText(tpText, chartArea.right + 5, tpY - 5);

      // Línea SL
      const slY = yScale.getPixelForValue(state.stopLossLevel);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff4444';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, slY);
      ctx.lineTo(chartArea.right, slY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Etiqueta SL
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      const slText = `SL: $${(state.stopLossLevel/1000).toFixed(1)}k`;
      ctx.strokeText(slText, chartArea.right + 5, slY + 15);
      ctx.fillText(slText, chartArea.right + 5, slY + 15);

      // 5. Dibujar barras de control interactivas
      const barWidth = 20;
      const barHeight = 30;
      const barX = chartArea.right + 80;

      // Barra TP
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(barX, tpY - barHeight/2, barWidth, barHeight);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, tpY - barHeight/2, barWidth, barHeight);

      // Barra SL
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(barX, slY - barHeight/2, barWidth, barHeight);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, slY - barHeight/2, barWidth, barHeight);

      ctx.restore();
      
      // Actualizar estado después del dibujado exitoso
      tradingOverlayState.current.lastDrawTime = now;
      tradingOverlayState.current.needsRedraw = false;
      
    } catch (error) {
      logError('Error drawing trading elements', { error });
    } finally {
      // CRÍTICO: Siempre liberar el flag de drawing
      tradingOverlayState.current.isDrawing = false;
    }
  }, []);

  // useEffect para controlar elementos de trading de manera eficiente - SIMPLIFICADO
  useEffect(() => {
    // Solo actualizar el chart cuando cambie el estado del overlay
    // El plugin tradingElementsPlugin se encargará del dibujado automático
    if (chartRef.current) {
      chartRef.current.update('none');
    }
  }, [showTradingOverlay]); // Solo cuando cambie el estado del overlay

  // useEffect para actualizar precios - SIMPLIFICADO
  useEffect(() => {
    if (!showTradingOverlay || !chartRef.current) return;
    
    // Solo actualizar el chart, el plugin se encarga del dibujado
    chartRef.current.update('none');
  }, [currentPriceLevel, takeProfitLevel, stopLossLevel, showTradingOverlay]);

  // useEffect para actualización de velas - SIMPLIFICADO  
  useEffect(() => {
    if (!showTradingOverlay || !tradingOverlayState.current.isActive || !chartRef.current) return;
    
    // Actualizar precio actual con la nueva vela
    if (candleData.length > 0) {
      const lastCandle = candleData[candleData.length - 1];
      const newPrice = lastCandle.c;
      
      if (newPrice !== tradingOverlayState.current.currentPrice) {
        tradingOverlayState.current.currentPrice = newPrice;
        setCurrentPriceLevel(newPrice);
        // El plugin tradingElementsPlugin se encargará del dibujado en el próximo update
      }
    }
  }, [candleData, showTradingOverlay]); // Solo cuando cambien las velas o el estado del overlay

  // Función para ocultar el overlay de trading - USANDO NUEVO SISTEMA
  const hideTradingOverlay = useCallback(() => {
    deactivateTradingOverlay();
  }, [deactivateTradingOverlay]);

  // 🐛 DEBUG: Rastrear cambios inesperados en el estado showTradingOverlay
  useEffect(() => {
    console.log(`🔄 [STATE DEBUG] showTradingOverlay cambió a: ${showTradingOverlay}`);
    console.log(`📊 [STATE DEBUG] Estado completo del trading:`, {
      showTradingOverlay,
      currentPriceLevel,
      takeProfitLevel: takeProfitLevel?.toFixed(2),
      stopLossLevel: stopLossLevel?.toFixed(2),
      internalState: {
        isActive: tradingOverlayState.current.isActive,
        isDrawing: tradingOverlayState.current.isDrawing,
        currentPrice: tradingOverlayState.current.currentPrice?.toFixed(2)
      }
    });
  }, [showTradingOverlay, currentPriceLevel, takeProfitLevel, stopLossLevel]);

  // NUEVO: Función para limpiar completamente el chart y datos
  const clearChartCompletely = useCallback(() => {
    logLifecycle('CLEARING_CHART_COMPLETELY', 'MinimalistChart', {
      reason: 'timeframe_change_preparation',
      chartExists: !!chartRef.current,
      dataLength: candleData.length
    });

    // CRÍTICO: Preservar configuraciones de indicadores ANTES de limpiar
    if (chartRef.current) {
      preserveIndicatorConfigs(chartRef.current);
      logChart('INDICATOR_CONFIGS_PRESERVED_BEFORE_CLEAR', {
        reason: 'timeframe_change_preparation',
        configCount: Object.keys(persistentIndicatorConfigsRef.current).length
      });
    }

    // 1. Limpiar datos del estado de React
    setCandleData([]);
    
    // 2. Limpiar completamente el chart si existe
    if (chartRef.current) {
      try {
        // Limpiar todos los datasets
        if (chartRef.current.data?.datasets) {
          chartRef.current.data.datasets.forEach((dataset: any) => {
            dataset.data = [];
          });
        }
        
        // Resetear escalas
        if (chartRef.current.options?.scales?.x) {
          delete chartRef.current.options.scales.x.min;
          delete chartRef.current.options.scales.x.max;
        }
        
        if (chartRef.current.options?.scales?.y) {
          delete chartRef.current.options.scales.y.min;
          delete chartRef.current.options.scales.y.max;
        }
        
        // Actualizar sin animación para cambio inmediato
        chartRef.current.update('none');
        
        logLifecycle('CHART_CLEARED_SUCCESSFULLY', 'MinimalistChart', {
          datasetsCleared: true,
          scalesReset: true
        });
        
      } catch (error) {
        logError('Error clearing chart data', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 3. Limpiar canvas directamente como backup
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        logLifecycle('CANVAS_CLEARED_MANUALLY', 'MinimalistChart', {
          canvasWidth: canvasRef.current.width,
          canvasHeight: canvasRef.current.height
        });
      }
    }

    // 4. Reset flags
    initialViewportSet.current = false;
    
  }, [candleData.length, preserveIndicatorConfigs]);

  // NUEVO: Función específica para limpiar el chart en cambios de criptomoneda
  const clearChartForCryptoCurrencyChange = useCallback(() => {
    logCryptoChange('CLEARING_CHART_FOR_CRYPTOCURRENCY_CHANGE', {
      reason: 'cryptocurrency_change_preparation',
      chartExists: !!chartRef.current,
      dataLength: candleData.length,
      currentSymbol,
      previousSymbol: previousSymbolRef.current,
      isStreaming,
      timestamp: new Date().toLocaleTimeString(),
      phase: 'start'
    });

    // CRÍTICO: Preservar configuraciones de indicadores ANTES de limpiar
    if (chartRef.current) {
      preserveIndicatorConfigs(chartRef.current);
      logCryptoChange('INDICATOR_CONFIGS_PRESERVED_BEFORE_CRYPTO_CHANGE', {
        reason: 'cryptocurrency_change_preparation',
        configCount: Object.keys(persistentIndicatorConfigsRef.current).length,
        previousSymbol: previousSymbolRef.current,
        newSymbol: currentSymbol,
        timestamp: new Date().toLocaleTimeString()
      });
    }

    // 1. Detener streaming anterior inmediatamente y limpiar listeners
    if (isStreaming) {
      logCryptoChange('STOPPING_STREAM_FOR_CRYPTOCURRENCY_CHANGE', {
        symbol: currentSymbol,
        interval: currentInterval,
        reason: 'preparing_for_new_crypto',
        timestamp: new Date().toLocaleTimeString()
      });
      
      // Forzar desconexión completa del stream anterior
      liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
      
      // Esperar un momento para asegurar desconexión completa
      liveStreamingService.disconnect();
      
      setIsStreaming(false);
    }
    
    // NUEVO: Limpiar explícitamente cualquier dato residual del símbolo anterior
    // Nota: liveStreamingService no tiene método clearCandleBuffer, pero podemos hacer disconnect
    // que limpia automáticamente los buffers pendientes
    
    // NUEVO: Forzar limpieza del trading overlay si está activo
    if (showTradingOverlay) {
      deactivateTradingOverlay();
      logCryptoChange('TRADING_OVERLAY_DEACTIVATED_FOR_CRYPTO_CHANGE', {
        reason: 'preparing_for_new_cryptocurrency',
        previousSymbol: previousSymbolRef.current,
        newSymbol: currentSymbol
      });
    }

    // 2. Limpiar datos del estado de React
    const previousDataLength = candleData.length;
    setCandleData([]);
    
    logCryptoChange('REACT_STATE_CLEARED', {
      previousDataLength,
      newDataLength: 0,
      timestamp: new Date().toLocaleTimeString()
    });
    
    // 3. Limpiar completamente el chart si existe
    if (chartRef.current) {
      try {
        const chart = chartRef.current;
        const previousScales = chart.scales?.x ? {
          min: chart.scales.x.min,
          max: chart.scales.x.max
        } : null;
        
        // Limpiar todos los datasets
        if (chart.data?.datasets) {
          const datasetCount = chart.data.datasets.length;
          chart.data.datasets.forEach((dataset: any, index: number) => {
            const previousLength = dataset.data?.length || 0;
            dataset.data = [];
            logCryptoChange(`DATASET_${index}_CLEARED`, {
              datasetLabel: dataset.label,
              previousLength,
              newLength: 0
            });
          });
        }
        
        // Resetear escalas completamente
        if (chart.options?.scales?.x) {
          delete chart.options.scales.x.min;
          delete chart.options.scales.x.max;
          logScale('SCALE_X_RESET_FOR_CRYPTO_CHANGE', {
            previousScales,
            action: 'deleted_min_max_from_options'
          });
        }
        
        if (chart.options?.scales?.y) {
          delete chart.options.scales.y.min;
          delete chart.options.scales.y.max;
          logScale('SCALE_Y_RESET_FOR_CRYPTO_CHANGE', {
            action: 'deleted_min_max_from_options'
          });
        }
        
        // Actualizar título del gráfico
        const previousTitle = chart.options?.plugins?.title?.text;
        if (chart.options?.plugins?.title) {
          chart.options.plugins.title.text = `${currentSymbol} - ${currentInterval.toUpperCase()} ⏳ CARGANDO...`;
          logCryptoChange('CHART_TITLE_UPDATED', {
            previousTitle,
            newTitle: chart.options.plugins.title.text
          });
        }
        
        // Actualizar sin animación para cambio inmediato
        const updateStart = Date.now();
        chart.update('none');
        const updateDuration = Date.now() - updateStart;
        
        logCryptoChange('CHART_UPDATE_COMPLETE_FOR_CRYPTO_CHANGE', {
          updateDuration,
          updateMode: 'none',
          datasetsCleared: true,
          scalesReset: true,
          titleUpdated: true,
          timestamp: new Date().toLocaleTimeString()
        });
        
      } catch (error) {
        logCryptoChange('ERROR_CLEARING_CHART_FOR_CRYPTO_CHANGE', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    // 4. Limpiar canvas directamente como backup
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        logCryptoChange('CANVAS_CLEARED_FOR_CRYPTOCURRENCY_CHANGE', {
          canvasWidth: canvasRef.current.width,
          canvasHeight: canvasRef.current.height,
          fillColor: '#000',
          timestamp: new Date().toLocaleTimeString()
        });
      }
    }

    // 5. Reset flags específicos para cambio de criptomoneda
    const flagsBefore = {
      initialViewportSet: initialViewportSet.current,
      hasAppliedFullViewportAfterChange: hasAppliedFullViewportAfterChange.current
    };
    
    initialViewportSet.current = false;
    hasAppliedFullViewportAfterChange.current = false;
    
    logCryptoChange('CRYPTOCURRENCY_CHANGE_CLEANUP_COMPLETE', {
      flagsBefore,
      flagsAfter: {
        initialViewportSet: initialViewportSet.current,
        hasAppliedFullViewportAfterChange: hasAppliedFullViewportAfterChange.current
      },
      streamingStopped: true,
      chartCleared: true,
      reactStateCleared: true,
      canvasCleared: true,
      phase: 'complete',
      timestamp: new Date().toLocaleTimeString()
    });
    
  }, [candleData.length, currentSymbol, currentInterval, isStreaming, preserveIndicatorConfigs]);

  const endUserInteraction = useCallback(() => {
    const timestamp = Date.now();
    const preCameraState = simpleCamera.getCurrentState();
    
    logUserInteractionDetailed('END_USER_INTERACTION_CHART', {
      timestamp: new Date(timestamp).toLocaleTimeString(),
      component: 'MinimalistChart',
      delay: 300,
      preCameraMode: preCameraState.mode,
      preCameraLocked: preCameraState.isLocked,
      hasViewport: !!preCameraState.viewport
    }, preCameraState);
    
    // Delay para capturar estado final
    userInteractionTimeoutRef.current = setTimeout(() => {
      const preEndState = simpleCamera.getCurrentState();
      
      logUserInteractionDetailed('END_USER_INTERACTION_DELAYED', {
        timestamp: new Date().toLocaleTimeString(),
        component: 'MinimalistChart',
        preEndCameraMode: preEndState.mode,
        preEndCameraLocked: preEndState.isLocked
      });
      
      setIsUserInteracting(false);
      simpleCamera.onUserEndInteraction();
      
      // Log final state after end interaction
      const finalState = simpleCamera.getCurrentState();
      logUserInteractionDetailed('INTERACTION_SEQUENCE_COMPLETE', {
        finalCameraMode: finalState.mode,
        finalCameraLocked: finalState.isLocked,
        finalViewport: finalState.viewport,
        interactionDuration: timestamp - (preCameraState.lastUserAction || timestamp),
        unexpectedChanges: unexpectedViewportChanges.current
      }, finalState);
    }, 300); // 300ms delay para capturar estado final
  }, [simpleCamera]);

  // ============================================
  // DEBOUNCE AGRESIVO PARA EVENTOS DE ZOOM/PAN
  // ============================================
  
  const debouncedZoomHandler = useCallback((chart: any, xScale: any) => {
    const now = Date.now();
    
    logUserInteractionDetailed('ZOOM_EVENT_RECEIVED', {
      min: xScale.min,
      max: xScale.max,
      center: (xScale.min + xScale.max) / 2,
      timestamp: new Date().toLocaleTimeString(),
      globalBlocked: globalInteractionBlocked.current,
      lastZoomTime: lastZoomProcessedTime.current,
      timeSinceLastZoom: now - lastZoomProcessedTime.current,
      isAutomaticViewport: isApplyingAutomaticViewport.current
    });
    
    // CRÍTICO: Ignorar eventos automáticos generados por actualizaciones de stream
    if (isApplyingAutomaticViewport.current) {
      logChart('ZOOM_EVENT_BLOCKED - automatic viewport update');
      return;
    }
    
    // PROTECCIÓN CRÍTICA: Bloquear eventos durante cambios de criptomoneda
    if (isChangingCryptocurrency.current) {
      logChart('ZOOM_EVENT_BLOCKED - cryptocurrency change in progress');
      return;
    }
    
    // BLOQUEO GLOBAL: Evitar cualquier solapamiento entre zoom y pan
    if (globalInteractionBlocked.current) {
      logChart('ZOOM_EVENT_BLOCKED - global interaction blocked');
      return;
    }
    
    // THROTTLE MEJORADO PARA ZOOM: Reducir bloqueos innecesarios
    if (now - lastZoomProcessedTime.current < 50) { // Reducido de 100ms a 50ms
      logChart('ZOOM_EVENT_BLOCKED - throttle limit');
      return;
    }
    
    // BLOQUEO: Evitar procesamiento simultáneo
    if (isProcessingZoom.current) {
      logChart('ZOOM_EVENT_BLOCKED - already processing zoom');
      return;
    }
    
    isProcessingZoom.current = true;
    globalInteractionBlocked.current = true;
    lastZoomProcessedTime.current = now;
    
    // Cancelar debounce anterior
    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
    }
    
    // NUEVO: Procesar inmediatamente el inicio de la interacción para mejor responsividad
    const preInteractionState = simpleCamera.getCurrentState();
    logUserInteractionDetailed('ZOOM_PROCESSING_START', {
      min: xScale.min,
      max: xScale.max,
      center: (xScale.min + xScale.max) / 2
    }, preInteractionState);
    
    // Notificar inicio de interacción inmediatamente
    startUserInteraction();
    
    // Log del estado después de notificar inicio
    const postStartState = simpleCamera.getCurrentState();
    logViewportState(postStartState, 'POST_START_INTERACTION_ZOOM');
    
    // Debounce reducido solo para el estado final
    zoomDebounceRef.current = setTimeout(() => {
      // Limpiar timeout anterior si existe
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
      
      // Timeout para capturar estado final
      zoomTimeoutRef.current = setTimeout(() => {
        const finalScale = chart.scales.x;
        if (finalScale) {
          logUserInteractionDetailed('ZOOM_FINAL_STATE_CAPTURE', {
            finalMin: finalScale.min,
            finalMax: finalScale.max,
            finalCenter: (finalScale.min + finalScale.max) / 2
          });
          
          // MEJORADO: Usar datos del evento actual, no del chart que puede haber cambiado
          const eventMin = xScale.min;
          const eventMax = xScale.max;
          const eventCenter = (eventMin + eventMax) / 2;
          
          logUserInteractionDetailed('USER_ZOOM', {
            eventMin,
            eventMax,
            eventCenter,
            finalScaleMin: finalScale.min,
            finalScaleMax: finalScale.max
          }, preInteractionState);
          
          simpleCamera.onUserZoom(eventMin, eventMax, eventCenter);
          simpleCamera.lockCamera(); // Bloquear la cámara en la nueva posición
          
          // Log del estado después del zoom completo
          const postZoomState = simpleCamera.getCurrentState();
          logViewportState(postZoomState, 'POST_ZOOM_COMPLETE');
        }
        
        endUserInteraction();
        
        // Log del estado después de end interaction
        const postEndState = simpleCamera.getCurrentState();
        logViewportState(postEndState, 'POST_END_INTERACTION_ZOOM');
        
        // Liberar bloqueos después de completar
        isProcessingZoom.current = false;
        
        // SIMPLIFICADO: Liberar bloqueo global inmediatamente
        setTimeout(() => {
          globalInteractionBlocked.current = false;
          logChart('ZOOM_GLOBAL_BLOCK_RELEASED');
        }, 25);
      }, 25); // Reducido de 50ms a 25ms para mejor respuesta
    }, 50); // Reducido de 100ms a 50ms para mejor respuesta
  }, [startUserInteraction, endUserInteraction, simpleCamera]);

  const debouncedPanHandler = useCallback((chart: any, xScale: any) => {
    const now = Date.now();
    
    logUserInteractionDetailed('PAN_EVENT_RECEIVED', {
      min: xScale.min,
      max: xScale.max,
      center: (xScale.min + xScale.max) / 2,
      timestamp: new Date().toLocaleTimeString(),
      globalBlocked: globalInteractionBlocked.current,
      lastPanTime: lastPanProcessedTime.current,
      timeSinceLastPan: now - lastPanProcessedTime.current,
      isAutomaticViewport: isApplyingAutomaticViewport.current
    });
    
    // CRÍTICO: Ignorar eventos automáticos generados por actualizaciones de stream
    if (isApplyingAutomaticViewport.current) {
      logChart('PAN_EVENT_BLOCKED - automatic viewport update');
      return;
    }
    
    // PROTECCIÓN CRÍTICA: Bloquear eventos durante cambios de criptomoneda
    if (isChangingCryptocurrency.current) {
      logChart('PAN_EVENT_BLOCKED - cryptocurrency change in progress');
      return;
    }
    
    // BLOQUEO GLOBAL: Evitar cualquier solapamiento entre zoom y pan
    if (globalInteractionBlocked.current) {
      logChart('PAN_EVENT_BLOCKED - global interaction blocked');
      return;
    }
    
    // THROTTLE MEJORADO PARA PAN: Reducir bloqueos innecesarios
    if (now - lastPanProcessedTime.current < 50) { // Reducido de 100ms a 50ms
      logChart('PAN_EVENT_BLOCKED - throttle limit');
      return;
    }
    
    // BLOQUEO: Evitar procesamiento simultáneo
    if (isProcessingPan.current) {
      logChart('PAN_EVENT_BLOCKED - already processing pan');
      return;
    }
    
    isProcessingPan.current = true;
    globalInteractionBlocked.current = true;
    lastPanProcessedTime.current = now;
    
    // Cancelar debounce anterior
    if (panDebounceRef.current) {
      clearTimeout(panDebounceRef.current);
    }
    
    // NUEVO: Procesar inmediatamente el inicio de la interacción para mejor responsividad
    const preInteractionState = simpleCamera.getCurrentState();
    logUserInteractionDetailed('PAN_PROCESSING_START', {
      min: xScale.min,
      max: xScale.max,
      center: (xScale.min + xScale.max) / 2
    }, preInteractionState);
    
    // Notificar inicio de interacción inmediatamente
    startUserInteraction();
    
    // Debounce reducido solo para el estado final
    panDebounceRef.current = setTimeout(() => {
      // Limpiar timeout anterior si existe
      if (panTimeoutRef.current) {
        clearTimeout(panTimeoutRef.current);
      }
      
      // Timeout para capturar estado final
      panTimeoutRef.current = setTimeout(() => {
        const finalScale = chart.scales.x;
        if (finalScale) {
          logUserInteractionDetailed('PAN_FINAL_STATE_CAPTURE', {
            finalMin: finalScale.min,
            finalMax: finalScale.max,
            finalCenter: (finalScale.min + finalScale.max) / 2
          });
          
          // MEJORADO: Usar datos del evento actual, no del chart que puede haber cambiado
          const eventMin = xScale.min;
          const eventMax = xScale.max;
          const eventCenter = (eventMin + eventMax) / 2;
          
          logUserInteractionDetailed('USER_PAN', {
            eventMin,
            eventMax,
            eventCenter,
            finalScaleMin: finalScale.min,
            finalScaleMax: finalScale.max
          }, preInteractionState);
          
          simpleCamera.onUserPan(eventMin, eventMax, eventCenter);
          simpleCamera.lockCamera(); // Bloquear la cámara en la nueva posición
        }
        endUserInteraction();
        
        // Liberar bloqueos después de completar
        isProcessingPan.current = false;
        
        // SIMPLIFICADO: Liberar bloqueo global inmediatamente
        setTimeout(() => {
          globalInteractionBlocked.current = false;
          logChart('PAN_GLOBAL_BLOCK_RELEASED');
        }, 25);
      }, 25); // Reducido de 50ms a 25ms para mejor respuesta
    }, 50); // Reducido de 100ms a 50ms para mejor respuesta
  }, [startUserInteraction, endUserInteraction, simpleCamera]);

  // ============================================

  // Calcular indicadores técnicos
  const technicalIndicators = useTechnicalIndicators(candleData);

  // ============================================
  // MEMOIZACIÓN DE OPCIONES PARA CHART.JS
  // ============================================
  
  // CRÍTICO: Memoizar opciones para evitar recreación en cada render
  // Esto previente que Chart.js resetee las escalas/zoom
  const chartOptions = useMemo(() => ({
    animation: {
      duration: 0  // Desactivar animaciones para mejor rendimiento en live
    },
    responsive: false,
    maintainAspectRatio: false,
    parsing: false as const, // Importante para performance con datos de velas
    // MEJORA DE RESOLUCIÓN: Configuraciones para aprovechar el PPI mejorado pero sin exagerar
    devicePixelRatio: Math.min((window.devicePixelRatio || 1) * 1.25, 2.5),
    elements: {
      point: {
        radius: 0, // Sin puntos para mejor performance
        hoverRadius: 2
      },
      line: {
        borderWidth: 1.5, // Líneas ligeramente más gruesas pero no exagerado
        tension: 0.1
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: currentInterval.includes('m') ? 'minute' as const : 
                currentInterval.includes('h') ? 'hour' as const : 'day' as const,
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MM/dd'
          }
        },
        ticks: {
          color: '#ffffff',
          maxTicksLimit: 12, // Volver al valor original
          font: {
            size: 12 // Tamaño normal, no muy pequeño
          }
        },
        grid: {
          display: false
        },
        border: {
          display: false
        },
        // CRÍTICO: Configuraciones para preservar viewport
        bounds: 'data' as const,
        // No definir min/max aquí - se manejan dinámicamente
        adapters: {
          date: {}
        },
        offset: false
      },
      y: {
        type: 'linear' as const,
        position: 'right' as const,
        ticks: {
          color: '#ffffff',
          font: {
            size: 12 // Tamaño normal para buena legibilidad
          },
          callback: function(value: any) {
            return '$' + (value / 1000).toFixed(2) + 'k';
          }
        },
        grid: {
          display: false
        },
        border: {
          display: false
        }
      }
    },
    plugins: {
      title: {
        display: true,
        text: `${currentSymbol} - ${currentInterval.toUpperCase()} ${isStreaming ? '🔴 LIVE' : ''}`,
        color: '#ffffff',
        font: { 
          size: 16 // Tamaño normal del título
        }
      },
      legend: {
        labels: { 
          color: '#ffffff',
          font: {
            size: 11 // Leyenda un poco más pequeña pero legible
          }
        }
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'x' as const,
          onZoom: function(context: any) {
            const chart = context.chart;
            const xScale = chart.scales.x;
            
            if (!xScale || !chart.data.datasets[0]?.data) return;
            
            // Usar el handler debounced para evitar múltiples eventos
            debouncedZoomHandler(chart, xScale);
          }
        },
        pan: {
          enabled: true,
          mode: 'x' as const,
          onPan: function(context: any) {
            const chart = context.chart;
            const xScale = chart.scales.x;
            
            if (!xScale || !chart.data.datasets[0]?.data) return;
            
            // Usar el handler debounced para evitar múltiples eventos
            debouncedPanHandler(chart, xScale);
          }
        }
      },
      // Plugin personalizado para el background de trading se registra en initializeChart
    }
  }), [currentSymbol, currentInterval, isStreaming, debouncedZoomHandler, debouncedPanHandler]);

  const addLog = (message: string) => {
    console.log(`[MinimalistChart] ${message}`);
  };

  const updateTechnicalIndicators = useCallback((chart: any) => {
    if (!chart || !chart.data || !chart.data.datasets) return;

    const candleDataset = chart.data.datasets[0];
    if (!candleDataset || !candleDataset.data) return;

    // Extraer datos de velas para recalcular indicadores
    const currentCandles: CandleData[] = candleDataset.data.map((candle: any) => ({
      x: candle.x,
      o: candle.o,
      h: candle.h,
      l: candle.l,
      c: candle.c
    }));

    // Recalcular indicadores técnicos
    const indicators = useTechnicalIndicators(currentCandles);

    // Actualizar datasets de indicadores
    chart.data.datasets.forEach((dataset: any, index: number) => {
      if (index === 0) return; // Skip candlestick dataset

      if (dataset.label === 'SMA 20' && activeIndicators.has('sma20')) {
        dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
          x: candle.x,
          y: indicators.sma20[i]
        })).filter((point: any) => !isNaN(point.y));
      } else if (dataset.label === 'SMA 50' && activeIndicators.has('sma50')) {
        dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
          x: candle.x,
          y: indicators.sma50[i]
        })).filter((point: any) => !isNaN(point.y));
      } else if (dataset.label === 'EMA 20' && activeIndicators.has('ema20')) {
        dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
          x: candle.x,
          y: indicators.ema20[i]
        })).filter((point: any) => !isNaN(point.y));
      } else if (dataset.label && dataset.label.startsWith('BB') && activeIndicators.has('bollinger')) {
        if (dataset.label === 'BB Upper') {
          dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
            x: candle.x,
            y: indicators.bollinger.upper[i]
          })).filter((point: any) => !isNaN(point.y));
        } else if (dataset.label === 'BB Middle') {
          dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
            x: candle.x,
            y: indicators.bollinger.middle[i]
          })).filter((point: any) => !isNaN(point.y));
        } else if (dataset.label === 'BB Lower') {
          dataset.data = currentCandles.map((candle: CandleData, i: number) => ({
            x: candle.x,
            y: indicators.bollinger.lower[i]
          })).filter((point: any) => !isNaN(point.y));
        }
      }
    });
  }, [activeIndicators]);

  const initializeChart = useCallback(async () => {
    // CRÍTICO: Prevenir inicializaciones múltiples simultáneas
    if (isInitializing.current) {
      logLifecycle('CHART_INITIALIZATION_BLOCKED', 'MinimalistChart', {
        reason: 'already_initializing',
        candleDataLength: candleData.length
      });
      return;
    }

    isInitializing.current = true;

    const initStartTime = Date.now();
    chartInitializationCount.current++;
    
    logLifecycle('CHART_INITIALIZATION_START', 'MinimalistChart', {
      initializationNumber: chartInitializationCount.current,
      platform: Platform.OS,
      candleDataLength: candleData.length,
      currentSymbol,
      currentInterval,
      activeIndicators: Array.from(activeIndicators),
      existingChart: !!chartRef.current,
      canvasRef: !!canvasRef.current
    });
    
    if (Platform.OS !== 'web') {
      setStatus('Solo disponible en plataforma web');
      logError('Chart initialization failed - not web platform', {
        platform: Platform.OS,
        initializationNumber: chartInitializationCount.current
      });
      isInitializing.current = false;
      return;
    }

    try {
      setStatus('Cargando Chart.js...');
      
      logLifecycle('LOADING_CHARTJS_DEPENDENCIES', 'MinimalistChart', {
        initializationNumber: chartInitializationCount.current
      });

      // Importar Chart.js y plugins
      const importStartTime = Date.now();
      const ChartJS = await import('chart.js/auto');
      const Chart = ChartJS.default;
      const ChartFinancial = await import('chartjs-chart-financial');
      const zoomPlugin = await import('chartjs-plugin-zoom');
      const importDuration = Date.now() - importStartTime;

      logTiming('Chart.js dependencies loaded', importDuration, {
        initializationNumber: chartInitializationCount.current,
        chartJSVersion: Chart.version || 'unknown',
        hasFinancialPlugin: !!ChartFinancial,
        hasZoomPlugin: !!zoomPlugin
      });

      try {
        await import('chartjs-adapter-date-fns');
        logLifecycle('DATE_ADAPTER_LOADED', 'MinimalistChart', {
          adapter: 'date-fns'
        });
      } catch (e) {
        logError('Date adapter not available', {
          error: e instanceof Error ? e.message : String(e),
          initializationNumber: chartInitializationCount.current
        });
        addLog('Adaptador de fechas no disponible');
      }

      // Registrar componentes y plugins
      Chart.register(
        ChartFinancial.CandlestickController,
        ChartFinancial.CandlestickElement,
        ChartFinancial.OhlcController,
        ChartFinancial.OhlcElement,
        zoomPlugin.default
      );

      // Plugin personalizado para elementos de trading persistentes - CON DEBUG
      const tradingElementsPlugin = {
        id: 'tradingElements',
        afterDraw: (chart: any) => {
          const state = tradingOverlayState.current;
          
          // Solo dibujar si el overlay está activo y no estamos ya dibujando
          if (!state.isActive || state.isDrawing) {
            // Solo logear cambios de estado para evitar spam
            if (lastPluginLogState.current !== state.isActive) {
              console.log(`🎨 [PLUGIN DEBUG] Estado overlay cambió: ${state.isActive ? 'ACTIVO' : 'INACTIVO'}`);
              lastPluginLogState.current = state.isActive;
            }
            return;
          }
          
          // Verificar que tenemos todos los datos necesarios
          if (!state.currentPrice || !state.takeProfitLevel || !state.stopLossLevel) {
            console.log(`❌ [PLUGIN DEBUG] No dibujando - datos incompletos:`, {
              currentPrice: state.currentPrice,
              takeProfitLevel: state.takeProfitLevel,
              stopLossLevel: state.stopLossLevel
            });
            return;
          }
          
          // Solo logear inicio de dibujado cada 2 segundos para evitar spam
          const now = Date.now();
          if (now - lastPluginDrawTime.current > 2000) {
            console.log(`✅ [PLUGIN DEBUG] Iniciando dibujado - Precio: $${state.currentPrice.toFixed(2)}, TP: $${state.takeProfitLevel.toFixed(2)}, SL: $${state.stopLossLevel.toFixed(2)}`);
            lastPluginDrawTime.current = now;
          }
          
          const ctx = chart.ctx;
          const chartArea = chart.chartArea;
          const yScale = chart.scales.y;

          if (!ctx || !yScale || !chartArea) {
            console.log(`❌ [PLUGIN DEBUG] No dibujando - contextos no disponibles:`, {
              ctx: !!ctx,
              yScale: !!yScale,
              chartArea: !!chartArea
            });
            return;
          }

          // Marcar que estamos dibujando para prevenir loops
          state.isDrawing = true;
          
          try {
            ctx.save();

            // Obtener la coordenada Y del precio actual
            const currentPriceY = yScale.getPixelForValue(state.currentPrice);

            // Área verde (para TP) arriba del precio actual
            ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
            ctx.fillRect(
              chartArea.left,
              chartArea.top,
              chartArea.right - chartArea.left,
              currentPriceY - chartArea.top
            );

            // Área roja (para SL) abajo del precio actual
            ctx.fillStyle = 'rgba(255, 68, 68, 0.15)';
            ctx.fillRect(
              chartArea.left,
              currentPriceY,
              chartArea.right - chartArea.left,
              chartArea.bottom - currentPriceY
            );

            // Línea del precio actual
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(chartArea.left, currentPriceY);
            ctx.lineTo(chartArea.right, currentPriceY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Líneas de TP y SL
            const tpY = yScale.getPixelForValue(state.takeProfitLevel);
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(chartArea.left, tpY);
            ctx.lineTo(chartArea.right, tpY);
            ctx.stroke();

            // Etiqueta TP
            ctx.fillStyle = '#00ff88';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'left';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            const tpText = `TP: $${(state.takeProfitLevel/1000).toFixed(1)}k`;
            ctx.strokeText(tpText, chartArea.right + 5, tpY - 5);
            ctx.fillText(tpText, chartArea.right + 5, tpY - 5);

            const slY = yScale.getPixelForValue(state.stopLossLevel);
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(chartArea.left, slY);
            ctx.lineTo(chartArea.right, slY);
            ctx.stroke();

            // Etiqueta SL
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'left';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            const slText = `SL: $${(state.stopLossLevel/1000).toFixed(1)}k`;
            ctx.strokeText(slText, chartArea.right + 5, slY + 15);
            ctx.fillText(slText, chartArea.right + 5, slY + 15);

            ctx.restore();
            
            // Actualizar estado después del dibujado
            state.lastDrawTime = Date.now();
            state.needsRedraw = false;
          } catch (error) {
            console.error('❌ [PLUGIN DEBUG] Error in trading plugin:', error);
          } finally {
            // CRÍTICO: Siempre liberar el flag
            state.isDrawing = false;
          }
        }
      };

      // Registrar el plugin personalizado
      Chart.register(tradingElementsPlugin);
      
      // Registrar solo los componentes básicos de Chart.js
      
      logLifecycle('PLUGINS_REGISTERED', 'MinimalistChart', {
        initializationNumber: chartInitializationCount.current,
        registeredPlugins: ['CandlestickController', 'CandlestickElement', 'OhlcController', 'OhlcElement', 'zoomPlugin', 'tradingBackgroundPlugin']
      });

      if (!canvasRef.current) {
        setStatus('Error: Canvas no disponible');
        logError('Canvas not available for chart initialization', {
          canvasRef: !!canvasRef.current,
          initializationNumber: chartInitializationCount.current
        });
        return;
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) {
        setStatus('Error: Context 2D no disponible');
        logError('2D context not available', {
          canvasRef: !!canvasRef.current,
          initializationNumber: chartInitializationCount.current
        });
        return;
      }

      logLifecycle('CANVAS_CONTEXT_ACQUIRED', 'MinimalistChart', {
        initializationNumber: chartInitializationCount.current,
        canvasWidth: canvasRef.current.width,
        canvasHeight: canvasRef.current.height
      });

      setStatus('Creando gráfico...');

      // CRÍTICO: Destruir gráfico anterior completamente
      if (chartRef.current) {
        const oldChartId = chartRef.current.id || 'unknown';
        logLifecycle('DESTROYING_EXISTING_CHART', 'MinimalistChart', {
          initializationNumber: chartInitializationCount.current,
          existingChartId: oldChartId
        });
        
        try {
          chartRef.current.destroy();
        } catch (destroyError) {
          logError('Error destroying existing chart', {
            error: destroyError instanceof Error ? destroyError.message : String(destroyError),
            oldChartId
          });
        }
        
        chartRef.current = null;
        
        // Esperar un frame para asegurar limpieza completa del canvas
        await new Promise(resolve => requestAnimationFrame(resolve));
      }

      // CRÍTICO: Validar datos antes de crear datasets
      if (candleData.length === 0) {
        setStatus('Error: No hay datos de velas disponibles');
        logError('No candle data available for chart creation', {
          candleDataLength: candleData.length,
          initializationNumber: chartInitializationCount.current
        });
        isInitializing.current = false;
        return;
      }

      // Validar que los timestamps estén en orden y no haya saltos excesivos
      const sortedData = [...candleData].sort((a, b) => a.x - b.x);
      const timeRange = sortedData[sortedData.length - 1].x - sortedData[0].x;
      const averageInterval = timeRange / (sortedData.length - 1);
      
      // Para 15m, el intervalo promedio debería ser ~900000ms (15min)
      // Para 1d, el intervalo promedio debería ser ~86400000ms (24h)
      const expectedIntervals: Record<string, number> = {
        '1m': 60000,
        '3m': 180000,
        '5m': 300000,
        '15m': 900000,
        '30m': 1800000,
        '1h': 3600000,
        '2h': 7200000,
        '4h': 14400000,
        '6h': 21600000,
        '8h': 28800000,
        '12h': 43200000,
        '1d': 86400000
      };
      
      const expectedInterval = expectedIntervals[currentInterval] || 60000;
      const intervalTolerance = expectedInterval * 2; // Tolerancia del 200%
      
      if (Math.abs(averageInterval - expectedInterval) > intervalTolerance) {
        logError('Invalid time range detected - data inconsistent with interval', {
          currentInterval,
          expectedInterval,
          averageInterval,
          timeRange,
          firstTimestamp: new Date(sortedData[0].x).toISOString(),
          lastTimestamp: new Date(sortedData[sortedData.length - 1].x).toISOString(),
          candleCount: sortedData.length
        });
        
        // Filtrar datos para mantener solo los más recientes y consistentes
        const maxCandles = Math.min(1000, sortedData.length);
        const recentData = sortedData.slice(-maxCandles);
        setCandleData(recentData);
        
        setStatus(`⚠️ Datos ajustados (${recentData.length} velas)`);
        isInitializing.current = false;
        return;
      }

      // Configurar datasets con datos validados
      const datasets: any[] = [
        {
          label: `${currentSymbol}`,
          type: 'candlestick',
          data: sortedData.map(candle => ({
            x: candle.x,
            o: candle.o,
            h: candle.h,
            l: candle.l,
            c: candle.c
          })),
          borderColor: '#00ff88',
          backgroundColor: 'rgba(0, 255, 136, 0.1)',
          borderWidth: 1,
          yAxisID: 'y'
        }
      ];

      // Los indicadores técnicos se agregan dinámicamente después de la creación inicial

      // Crear gráfico con opciones memoizadas
      const chartCreationStart = Date.now();
      
      logLifecycle('CREATING_CHART_INSTANCE', 'MinimalistChart', {
        initializationNumber: chartInitializationCount.current,
        datasetsCount: datasets.length,
        candleDataLength: candleData.length,
        activeIndicators: Array.from(activeIndicators),
        hasChartOptions: !!chartOptions
      });

      chartRef.current = new Chart(ctx, {
        type: 'candlestick',
        data: { datasets },
        options: chartOptions
      });

      const chartCreationDuration = Date.now() - chartCreationStart;
      const totalInitDuration = Date.now() - initStartTime;

      logLifecycle('CHART_INITIALIZATION_SUCCESS', 'MinimalistChart', {
        initializationNumber: chartInitializationCount.current,
        chartId: chartRef.current.id || 'unknown',
        chartCreationDuration,
        totalInitDuration,
        finalCandleCount: candleData.length,
        datasetsCreated: datasets.length
      });

      logTiming('Chart initialization completed', totalInitDuration, {
        initializationNumber: chartInitializationCount.current,
        success: true
      });

      setStatus(`✅ Gráfico listo (${candleData.length} velas)`);

      // MEJORADO: Cargar configuraciones guardadas y re-aplicar indicadores activos
      if (chartRef.current) {
        // Intentar cargar configuraciones desde localStorage primero
        const storedData = loadIndicatorConfigsFromStorage();
        
        setTimeout(() => {
          if (storedData?.configs && storedData?.activeIndicators?.length > 0) {
            // Usar configuraciones guardadas
            logChart('RESTORING_INDICATORS_FROM_STORAGE', {
              activeIndicators: storedData.activeIndicators,
              configCount: Object.keys(storedData.configs).length
            });
            
            // Restaurar directamente usando las configuraciones persistidas
            restoreIndicatorConfigs(chartRef.current, candleData);
          } else if (activeIndicators.size > 0) {
            // Usar indicadores activos actuales si no hay configuraciones guardadas
            logChart('APPLYING_CURRENT_ACTIVE_INDICATORS', {
              activeIndicators: Array.from(activeIndicators)
            });
            
            activeIndicators.forEach(indicator => {
              addIndicatorToChart(chartRef.current, indicator);
            });
          }
        }, 50); // Pequeño delay para asegurar que el gráfico esté completamente inicializado
      }

      // CRÍTICO: Liberar bandera de inicialización después del éxito
      isInitializing.current = false;

    } catch (error: any) {
      const initDuration = Date.now() - initStartTime;
      logError('Chart initialization failed', {
        error: error instanceof Error ? error.message : String(error),
        initializationNumber: chartInitializationCount.current,
        initDuration,
        candleDataLength: candleData.length,
        stackTrace: error.stack
      });
      setStatus(`Error: ${error.message}`);
      console.error('Error creando gráfico:', error);
      
      // CRÍTICO: Liberar bandera de inicialización después del error
      isInitializing.current = false;
    }
  }, [candleData, currentSymbol, currentInterval, isStreaming, technicalIndicators, chartOptions, debouncedZoomHandler, debouncedPanHandler]);

  const updateChart = useCallback((newCandle: CandleData, isFinal: boolean) => {
    const startTime = Date.now();
    updateSequence.current++;
    
    // PROTECCIÓN CRÍTICA: Bloquear actualizaciones durante cambios de criptomoneda
    if (isChangingCryptocurrency.current) {
      logCryptoChange('UPDATE_CHART_BLOCKED_CRYPTOCURRENCY_CHANGE', {
        updateSequence: updateSequence.current,
        price: newCandle.c,
        reason: 'cryptocurrency_change_in_progress',
        isChanging: isChangingCryptocurrency.current,
        currentSymbol,
        timestamp: new Date().toLocaleTimeString()
      });
      return;
    }

    // CRÍTICO: Capturar estado ANTES de cualquier modificación
    const preUpdateCameraState = simpleCamera.getCurrentState();
    const preUpdateChart = chartRef.current;
    const preUpdateViewport = preUpdateChart?.scales?.x ? {
      min: preUpdateChart.scales.x.min,
      max: preUpdateChart.scales.x.max
    } : null;
    
    logTidalFlow('UPDATE_CHART_START', {
      updateSequence: updateSequence.current,
      newCandle: {
        timestamp: new Date(newCandle.x).toLocaleTimeString(),
        price: newCandle.c,
        isFinal
      },
      chartExists: !!chartRef.current,
      preUpdateCameraState: {
        mode: preUpdateCameraState.mode,
        isLocked: preUpdateCameraState.isLocked,
        viewport: preUpdateCameraState.viewport
      },
      preUpdateChartViewport: preUpdateViewport,
      isUserCurrentlyInteracting: isUserInteracting,
      timeSinceLastUpdate: lastChartUpdate.current ? Date.now() - lastChartUpdate.current : 0
    });
    
    if (!chartRef.current) {
      logChart('UPDATE_CHART_ABORT - no chart reference', {
        updateSequence: updateSequence.current
      });
      return;
    }

    // Throttle updates for better performance, except for final candles
    const now = Date.now();
    if (!isFinal && now - lastUpdateTime < updateThrottleMs) {
      logChart('UPDATE_CHART_THROTTLED', { 
        updateSequence: updateSequence.current,
        timeSinceLastUpdate: now - lastUpdateTime,
        threshold: updateThrottleMs,
        price: newCandle.c
      });
      return;
    }
    setLastUpdateTime(now);

    const chart = chartRef.current;
    
    // ============================================
    // GOBERNANZA TIDAL - ORDEN FIJO SIN setState
    // ============================================
    
    // A) SNAPSHOT: Capturar viewport ANTES de tocar data - usar estado de cámara (NO chart scales)
    const snap = simpleCamera.getViewportFromCamera() 
                ?? persistentViewport.getCurrentViewport() 
                ?? { min: chart?.scales?.x?.min ?? 0, max: chart?.scales?.x?.max ?? 0 };
    
    logTidalFlow('UPDATE_CHART_SNAPSHOT', {
      source: simpleCamera.getViewportFromCamera() ? 'camera' : 
              persistentViewport.getCurrentViewport() ? 'persistent' : 'chart_scales',
      viewport: snap,
      cameraState: {
        mode: simpleCamera.getCurrentState().mode,
        isLocked: simpleCamera.isLocked()
      }
    });
    
    // B) MUTAR DATA EN SITIO (push/shift/assign), sin recrear arrays/objects
    const dataset = chart.data.datasets[0];
    if (dataset && dataset.data) {
      // Buscar vela existente usando ventana de tiempo
      let existingIndex = -1;
      const updateTimestamp = newCandle.x;
      
      // Función para obtener intervalo en milisegundos
      const getIntervalMs = (interval: string): number => {
        const intervals: { [key: string]: number } = {
          '1m': 60 * 1000,
          '3m': 3 * 60 * 1000,
          '5m': 5 * 60 * 1000,
          '15m': 15 * 60 * 1000,
          '30m': 30 * 60 * 1000,
          '1h': 60 * 60 * 1000,
          '2h': 2 * 60 * 60 * 1000,
          '4h': 4 * 60 * 60 * 1000,
          '6h': 6 * 60 * 60 * 1000,
          '8h': 8 * 60 * 60 * 1000,
          '12h': 12 * 60 * 60 * 1000,
          '1d': 24 * 60 * 60 * 1000,
          '3d': 3 * 24 * 60 * 60 * 1000,
          '1w': 7 * 24 * 60 * 60 * 1000,
          '1M': 30 * 24 * 60 * 60 * 1000,
        };
        return intervals[interval] || 60 * 1000;
      };
      
      const intervalMs = getIntervalMs(currentInterval);
      
      // Buscar en las últimas velas primero (más eficiente para streaming)
      if (dataset.data.length > 0) {
        // Verificar la última vela primero
        const lastIndex = dataset.data.length - 1;
        const lastCandle = dataset.data[lastIndex] as any;
        if (lastCandle && Math.abs(lastCandle.x - updateTimestamp) < intervalMs) {
          existingIndex = lastIndex;
        }
      }
      
      // MUTACIÓN IN-SITU: Actualizar o agregar vela
      const candleData = {
        x: newCandle.x,
        o: newCandle.o,
        h: newCandle.h,
        l: newCandle.l,
        c: newCandle.c
      };
      
      if (existingIndex >= 0) {
        // Actualizar vela existente (mutación in-situ)
        const oldCandle = (dataset.data as any)[existingIndex];
        logLastCandle('UPDATE_EXISTING_CANDLE', {
          index: existingIndex,
          symbol: currentSymbol,
          interval: currentInterval,
          oldPrice: oldCandle.c,
          newPrice: candleData.c,
          oldTimestamp: new Date(oldCandle.x).toLocaleTimeString(),
          newTimestamp: new Date(candleData.x).toLocaleTimeString(),
          priceChange: candleData.c - oldCandle.c,
          percentChange: ((candleData.c - oldCandle.c) / oldCandle.c * 100).toFixed(4),
          isFinal,
          totalCandles: dataset.data.length,
          updateSequence: updateSequence.current
        });
        (dataset.data as any)[existingIndex] = candleData;
      } else {
        // Agregar nueva vela (mutación in-situ)
        logLastCandle('ADD_NEW_CANDLE', {
          newPrice: candleData.c,
          timestamp: new Date(candleData.x).toLocaleTimeString(),
          symbol: currentSymbol,
          interval: currentInterval,
          isFinal,
          totalCandles: dataset.data.length + 1,
          updateSequence: updateSequence.current,
          candleRange: {
            open: candleData.o,
            high: candleData.h,
            low: candleData.l,
            close: candleData.c
          }
        });
        (dataset.data as any[]).push(candleData);
      }

      // Mantener límite de velas (mutación in-situ)
      const maxCandles = 1000;
      if (dataset.data.length > maxCandles) {
        const removedCount = dataset.data.length - maxCandles;
        logTidalFlow('UPDATE_CHART_MUTATE_TRIM', {
          removedCount,
          finalCount: maxCandles
        });
        (dataset.data as any[]).splice(0, removedCount);
      }
    }

    // C) COMPUTAR "viewport objetivo" según la marea tidal (SIN setState)
    const lastCandleTime = newCandle.x;
    const currentCameraState = simpleCamera.getCurrentState();
    
    // NUEVO: Si estamos en modo AUTO después de un reset (cambio de temporalidad),
    // forzar viewport a mostrar TODAS las velas disponibles (solo una vez)
    let desiredViewport;
    if (currentCameraState.mode === 'AUTO' && !currentCameraState.isLocked && !hasAppliedFullViewportAfterChange.current) {
      // Calcular viewport para mostrar TODAS las velas (no solo las últimas)
      const recommendedViewport = simpleCamera.getRecommendedViewport(dataset.data.length, dataset.data, true);
      if (recommendedViewport.min !== undefined && recommendedViewport.max !== undefined) {
        desiredViewport = {
          min: recommendedViewport.min,
          max: recommendedViewport.max
        };
        hasAppliedFullViewportAfterChange.current = true; // Marcar como aplicado
        logTidalFlow('UPDATE_CHART_AUTO_MODE_ALL_DATA', {
          reason: 'auto_mode_show_all_data_after_timeframe_change',
          recommendedViewport: desiredViewport,
          dataLength: dataset.data.length,
          showingAllCandles: true
        });
      } else {
        desiredViewport = simpleCamera.computeTidalViewport({
          snap,
          lastCandleTime
        });
      }
    } else {
      desiredViewport = simpleCamera.computeTidalViewport({
        snap,
        lastCandleTime
      });
    }
    
    logTidalFlow('UPDATE_CHART_TIDAL_COMPUTE', {
      lastCandleTime: new Date(lastCandleTime).toLocaleTimeString(),
      snapViewport: snap,
      desiredViewport,
      tideShift: {
        deltaMin: desiredViewport.min - snap.min,
        deltaMax: desiredViewport.max - snap.max
      }
    });

    // D) APLICAR viewport objetivo (no preguntar al chart) - SIN setState
    // CRÍTICO: Marcar que estamos aplicando viewport automático para evitar eventos de user
    isApplyingAutomaticViewport.current = true;
    
    try {
      // CRÍTICO: Log detallado antes de aplicar viewport
      logScale('APPLYING_VIEWPORT_TO_CHART', {
        updateSequence: updateSequence.current,
        symbol: currentSymbol,
        interval: currentInterval,
        desiredViewport,
        currentChartViewport: preUpdateViewport,
        viewportChange: preUpdateViewport ? {
          deltaMin: desiredViewport.min - preUpdateViewport.min,
          deltaMax: desiredViewport.max - preUpdateViewport.max,
          deltaMinPercent: ((desiredViewport.min - preUpdateViewport.min) / (preUpdateViewport.max - preUpdateViewport.min) * 100).toFixed(2),
          deltaMaxPercent: ((desiredViewport.max - preUpdateViewport.max) / (preUpdateViewport.max - preUpdateViewport.min) * 100).toFixed(2)
        } : 'no_previous_viewport',
        cameraState: preUpdateCameraState.mode,
        cameraLocked: preUpdateCameraState.isLocked,
        candleTimestamp: new Date(newCandle.x).toLocaleTimeString(),
        candlePrice: newCandle.c
      });
      
      const applySuccess = simpleCamera.applyViewportToChart(chart, desiredViewport);
      
      logScale('VIEWPORT_APPLICATION_RESULT', {
        success: applySuccess,
        desiredViewport,
        updateSequence: updateSequence.current
      });
      
      // CRÍTICO: Verificar si el viewport se aplicó correctamente (con tolerancia mejorada)
      const postApplyViewport = chart.scales?.x ? {
        min: chart.scales.x.min,
        max: chart.scales.x.max
      } : null;
      
      // Tolerancia más permisiva para evitar falsos positivos
      const tolerance = Math.abs(desiredViewport.max - desiredViewport.min) * 0.001; // 0.1% del rango
      const minTolerance = Math.max(tolerance, 100); // Mínimo 100ms de tolerancia
      
      const viewportAppliedCorrectly = postApplyViewport && 
        Math.abs(postApplyViewport.min - desiredViewport.min) < minTolerance &&
        Math.abs(postApplyViewport.max - desiredViewport.max) < minTolerance;
      
      logScale('SCALE_VERIFICATION_AFTER_APPLY', {
        symbol: currentSymbol,
        desiredViewport,
        actualViewport: postApplyViewport,
        appliedCorrectly: viewportAppliedCorrectly,
        tolerance: minTolerance,
        differences: postApplyViewport ? {
          minDiff: Math.abs(postApplyViewport.min - desiredViewport.min),
          maxDiff: Math.abs(postApplyViewport.max - desiredViewport.max),
          minDiffMs: Math.abs(postApplyViewport.min - desiredViewport.min),
          maxDiffMs: Math.abs(postApplyViewport.max - desiredViewport.max)
        } : null,
        updateSequence: updateSequence.current,
        candlePrice: newCandle.c,
        timestamp: new Date().toLocaleTimeString()
      });
      
      if (!viewportAppliedCorrectly) {
        unexpectedViewportChanges.current++;
        
        // Solo reportar como error si la diferencia es significativa
        const significantError = postApplyViewport && (
          Math.abs(postApplyViewport.min - desiredViewport.min) > minTolerance * 10 ||
          Math.abs(postApplyViewport.max - desiredViewport.max) > minTolerance * 10
        );
        
        if (significantError) {
          logScale('SCALE_APPLICATION_ERROR', {
            updateSequence: updateSequence.current,
            symbol: currentSymbol,
            desired: desiredViewport,
            actual: postApplyViewport,
            difference: postApplyViewport ? {
              minDiff: Math.abs(postApplyViewport.min - desiredViewport.min),
              maxDiff: Math.abs(postApplyViewport.max - desiredViewport.max)
            } : 'no_scales',
            tolerance: minTolerance,
            unexpectedChanges: unexpectedViewportChanges.current,
            reason: 'significant_scale_mismatch'
          });
        }
      }
      
      // E) chart.update('none') - sin animación para evitar saltos
      logTidalFlow('UPDATE_CHART_EXECUTE_UPDATE', {
        updateSequence: updateSequence.current,
        updateMode: 'none',
        chartUpdateStart: Date.now(),
        viewportCorrectlyApplied: viewportAppliedCorrectly
      });
      
      const updateStartTime = Date.now();
      
      // CRÍTICO: Restaurar indicadores técnicos ANTES de actualizar el gráfico
      // para preservar los colores y configuraciones del usuario
      if (persistentIndicatorConfigsRef.current && Object.keys(persistentIndicatorConfigsRef.current).length > 0) {
        restoreIndicatorConfigs(chart, candleData);
        logChart('INDICATORS_RESTORED_DURING_UPDATE', {
          updateSequence: updateSequence.current,
          indicatorCount: Object.keys(persistentIndicatorConfigsRef.current).length,
          timestamp: new Date().toLocaleTimeString()
        });
      }
      
      chart.update('none');
      const updateDuration = Date.now() - updateStartTime;
      
      // El plugin tradingElementsPlugin se encargará automáticamente del redibujado
      // si el overlay está activo - no necesitamos llamadas manuales
      
      logTidalFlow('CHART_UPDATE_COMPLETED', {
        updateSequence: updateSequence.current,
        updateDuration,
        finalViewport: chart.scales?.x ? {
          min: chart.scales.x.min,
          max: chart.scales.x.max
        } : null,
        tradingElementsRedrawn: showTradingOverlay
      });
      
    } finally {
      // Limpiar flag después de aplicar, con delay para capturar eventos tardíos
      setTimeout(() => {
        isApplyingAutomaticViewport.current = false;
        
        // CRÍTICO: Verificar estado final después de la actualización
        const finalCameraState = simpleCamera.getCurrentState();
        const finalChartViewport = chart.scales?.x ? {
          min: chart.scales.x.min,
          max: chart.scales.x.max
        } : null;
        
        // Detectar cambios inesperados en el estado de la cámara
        if (finalCameraState.mode !== preUpdateCameraState.mode || 
            finalCameraState.isLocked !== preUpdateCameraState.isLocked) {
          
          unexpectedViewportChanges.current++;
          
          logError('UNEXPECTED CAMERA STATE CHANGE during chart update', {
            updateSequence: updateSequence.current,
            before: {
              mode: preUpdateCameraState.mode,
              isLocked: preUpdateCameraState.isLocked,
              viewport: preUpdateCameraState.viewport
            },
            after: {
              mode: finalCameraState.mode,
              isLocked: finalCameraState.isLocked,
              viewport: finalCameraState.viewport
            },
            chartViewportBefore: preUpdateViewport,
            chartViewportAfter: finalChartViewport,
            unexpectedChanges: unexpectedViewportChanges.current,
            possibleCause: 'chart_update_triggered_camera_reset'
          });
        }
        
        logTidalFlow('UPDATE_CHART_FINALIZATION_COMPLETE', {
          updateSequence: updateSequence.current,
          flagCleared: true,
          finalCameraMode: finalCameraState.mode,
          finalViewport: finalChartViewport
        });
      }, 50);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logTiming('UPDATE_CHART_COMPLETE', duration, {
      isFinal,
      candlePrice: newCandle.c,
      finalViewport: desiredViewport
    });
  }, [currentInterval, simpleCamera, persistentViewport, lastUpdateTime, updateThrottleMs, restoreIndicatorConfigs, candleData]);

  const changeTimeInterval = useCallback(async (newInterval: TimeInterval) => {
    // CRÍTICO: Prevenir cambios de intervalo simultáneos
    if (isInitializing.current) {
      logLifecycle('INTERVAL_CHANGE_BLOCKED', 'MinimalistChart', {
        currentInterval,
        newInterval,
        reason: 'chart_initializing'
      });
      return;
    }

    const intervalChangeStart = Date.now();
    
    // CRÍTICO: Capturar estado ANTES del cambio
    const preChangeState = {
      currentInterval,
      newInterval,
      isStreaming,
      candleDataLength: candleData.length,
      cameraState: simpleCamera ? {
        viewport: simpleCamera.getViewportFromCamera(),
        currentState: simpleCamera.getCurrentState(),
        isLocked: simpleCamera.isLocked()
      } : null,
      chartExists: !!chartRef.current
    };

    logLifecycle('INTERVAL_CHANGE_START', 'MinimalistChart', preChangeState);
    
    // 1. RESETEAR LA CÁMARA suavemente para cambios de temporalidad
    if (simpleCamera && newInterval !== currentInterval) {
      logLifecycle('RESETTING_CAMERA_FOR_TIMEFRAME_CHANGE', 'MinimalistChart', {
        reason: 'timeframe_change_pre_data_load',
        oldInterval: currentInterval,
        newInterval: newInterval
      });
      // Solo resetear si realmente cambió el intervalo
      simpleCamera.resetForTimeframeChange();
    }

    // 2. LIMPIAR COMPLETAMENTE DATOS Y CHART ANTERIORES
    clearChartCompletely();
    setCurrentInterval(newInterval);
    setStatus('Cambiando intervalo...');
    
    // Resetear bandera para permitir nuevo viewport completo
    hasAppliedFullViewportAfterChange.current = false;

    try {
      // 3. DETENER STREAMING ANTERIOR
      if (isStreaming) {
        logLifecycle('UNSUBSCRIBING_FROM_STREAM', 'MinimalistChart', {
          symbol: currentSymbol,
          oldInterval: currentInterval,
          newInterval
        });
        liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
      }

      // 5. CARGAR DATOS HISTÓRICOS PARA EL NUEVO INTERVALO
      logLifecycle('LOADING_HISTORICAL_DATA', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: newInterval,
        candleCount: 1000
      });
      
      const historicalStart = Date.now();
      const historicalData = await liveStreamingService.loadHistoricalData(currentSymbol, newInterval, 1000);
      const historicalDuration = Date.now() - historicalStart;
      
      logTiming('Historical data loaded for interval change', historicalDuration, {
        symbol: currentSymbol,
        interval: newInterval,
        candlesReceived: historicalData.length,
        oldCandleCount: candleData.length,
        newCandleCount: historicalData.length
      });

      // 6. CONFIGURAR NUEVOS DATOS 
      setCandleData(historicalData);
      
      // 7. MARCAR PARA REINICIALIZACIÓN COMPLETA DEL CHART
      // Esto asegura que el chart se reconstruya completamente con los nuevos datos
      if (historicalData.length > 0) {
        // Marcar que necesitamos reinicializar el chart
        lastCandleCountRef.current = -1; // Forzar diferencia significativa
        chartNeedsReinitializationRef.current = true;
        
        // 8. CONFIGURAR VIEWPORT PARA MOSTRAR DATOS MÁS RECIENTES
        if (simpleCamera) {
          // Usar timeout más largo para asegurar que React procese los datos primero
          setTimeout(() => {
            const viewportSet = simpleCamera.setViewportToLatestData(historicalData);
            
            logLifecycle('VIEWPORT_CONFIGURED_FOR_NEW_TIMEFRAME', 'MinimalistChart', {
              newInterval,
              dataLength: historicalData.length,
              viewportSet,
              reason: 'show_all_data_full_graph',
              chartWillReinitialize: true
            });
            
            // Cambiar a modo AUTO después de configurar viewport para permitir seguimiento normal
            setTimeout(() => {
              const currentState = simpleCamera.getCurrentState();
              if (currentState.mode === 'FIRST_LOAD') {
                // Cambiar a AUTO para permitir seguimiento normal pero sin bloquear el usuario
                simpleCamera.unlockCamera(); // Esto cambiará a modo AUTO
                
                logLifecycle('CAMERA_MODE_CHANGED_TO_AUTO_AFTER_TIMEFRAME', 'MinimalistChart', {
                  previousMode: 'FIRST_LOAD',
                  newMode: 'AUTO',
                  reason: 'viewport_configured_successfully'
                });
              }
            }, 200); // Esperar que el chart se reinicialice
            
            // El viewport se aplicará automáticamente cuando el chart se reinicialice
            // por el useEffect que detecta cambios en candleData.length
            
          }, 100); // Dar tiempo para que React procese setCandleData
        }
      }

      // 8. REANUDAR STREAMING CON NUEVO INTERVALO
      if (isStreaming) {
        logLifecycle('SUBSCRIBING_TO_NEW_STREAM', 'MinimalistChart', {
          symbol: currentSymbol,
          interval: newInterval
        });
        await liveStreamingService.subscribeToStream(currentSymbol, newInterval);
      }

      const totalChangeDuration = Date.now() - intervalChangeStart;
      logTiming('Interval change completed', totalChangeDuration, {
        oldInterval: preChangeState.currentInterval,
        newInterval,
        success: true,
        historicalDataDuration: historicalDuration,
        newCandleCount: historicalData.length
      });

    } catch (error: any) {
      const changeDuration = Date.now() - intervalChangeStart;
      logError('Interval change failed', {
        error: error instanceof Error ? error.message : String(error),
        oldInterval: preChangeState.currentInterval,
        newInterval,
        changeDuration,
        stackTrace: error.stack
      });
      console.error('Error cambiando intervalo:', error);
    }
  }, [currentSymbol, currentInterval, isStreaming, candleData.length, simpleCamera, clearChartCompletely]);

  const startStreaming = useCallback(async () => {
    const streamingStart = Date.now();

    if (isStreaming) {
      logLifecycle('STREAMING_ALREADY_ACTIVE', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval
      });
      console.log('📊 Streaming ya está activo');
      return;
    }

    // Capturar estado antes de iniciar streaming
    const preStreamingState = {
      symbol: currentSymbol,
      interval: currentInterval,
      candleDataLength: candleData.length,
      cameraState: simpleCamera ? {
        viewport: simpleCamera.getViewportFromCamera(),
        currentState: simpleCamera.getCurrentState(),
        isLocked: simpleCamera.isLocked()
      } : null,
      chartExists: !!chartRef.current
    };

    logLifecycle('STREAMING_START_ATTEMPT', 'MinimalistChart', preStreamingState);

    try {
      setStatus('Conectando streaming...');

      logLifecycle('SUBSCRIBING_TO_STREAM', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval
      });

      const subscriptionStart = Date.now();
      await liveStreamingService.subscribeToStream(currentSymbol, currentInterval);
      const subscriptionDuration = Date.now() - subscriptionStart;

      logTiming('Stream subscription completed', subscriptionDuration, {
        symbol: currentSymbol,
        interval: currentInterval,
        success: true
      });
      
      setIsStreaming(true);
      setStatus('✅ Streaming conectado');

      const totalStartDuration = Date.now() - streamingStart;
      logLifecycle('STREAMING_START_SUCCESS', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval,
        totalStartDuration,
        subscriptionDuration
      });

    } catch (error: any) {
      const startDuration = Date.now() - streamingStart;
      
      logError('Streaming start failed, falling back to polling', {
        error: error instanceof Error ? error.message : String(error),
        symbol: currentSymbol,
        interval: currentInterval,
        startDuration,
        stackTrace: error.stack
      });

      console.error('Error iniciando streaming:', error);
      setStatus(`⚠️ Streaming en modo polling (WebSocket falló)`);
      setIsStreaming(true); // Aún funciona con polling

      logLifecycle('STREAMING_FALLBACK_TO_POLLING', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval,
        error: error.message,
        startDuration
      });
    }
  }, [currentSymbol, currentInterval, isStreaming, candleData.length, simpleCamera]);

  const stopStreaming = useCallback(() => {
    logLifecycle('STREAMING_STOP_ATTEMPT', 'MinimalistChart', {
      symbol: currentSymbol,
      interval: currentInterval,
      wasStreaming: isStreaming
    });

    if (!isStreaming) {
      logLifecycle('STREAMING_ALREADY_STOPPED', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval
      });
      return;
    }

    const stopStart = Date.now();
    
    try {
      liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
      setIsStreaming(false);
      
      const stopDuration = Date.now() - stopStart;
      logTiming('Streaming stopped', stopDuration, {
        symbol: currentSymbol,
        interval: currentInterval,
        success: true
      });

      logLifecycle('STREAMING_STOP_SUCCESS', 'MinimalistChart', {
        symbol: currentSymbol,
        interval: currentInterval,
        stopDuration
      });

    } catch (error: any) {
      const stopDuration = Date.now() - stopStart;
      logError('Error stopping streaming', {
        error: error instanceof Error ? error.message : String(error),
        symbol: currentSymbol,
        interval: currentInterval,
        stopDuration,
        stackTrace: error.stack
      });
    }
  }, [currentSymbol, currentInterval, isStreaming]);

  // ===== FUNCIONES DE DEBUGGING AVANZADAS =====
  
  const getSystemStateSnapshot = useCallback(() => {
    const snapshot = {
      timestamp: Date.now(),
      dateTime: new Date().toISOString(),
      
      // Estado del componente
      component: {
        currentSymbol,
        currentInterval,
        isStreaming,
        status,
        candleDataLength: candleData.length,
        activeIndicators: Array.from(activeIndicators),
        updateSequence: updateSequence.current,
        chartInitializationCount: chartInitializationCount.current
      },

      // Estado del gráfico
      chart: {
        exists: !!chartRef.current,
        id: chartRef.current?.id || null,
        canvas: {
          exists: !!canvasRef.current,
          width: canvasRef.current?.width || null,
          height: canvasRef.current?.height || null
        },
        scales: chartRef.current?.scales ? {
          x: {
            min: chartRef.current.scales.x?.min || null,
            max: chartRef.current.scales.x?.max || null
          },
          y: {
            min: chartRef.current.scales.y?.min || null,
            max: chartRef.current.scales.y?.max || null
          }
        } : null
      },

      // Estado de la cámara
      camera: simpleCamera ? {
        viewport: simpleCamera.getViewportFromCamera(),
        currentState: simpleCamera.getCurrentState(),
        isLocked: simpleCamera.isLocked(),
        isActivelyInteracting: simpleCamera.isActivelyInteracting(),
        shouldForceViewport: simpleCamera.shouldForceViewport(),
        shouldAutoAdjust: simpleCamera.shouldAutoAdjust(),
        forcedViewport: simpleCamera.getForcedViewport(),
        recommendedViewport: simpleCamera.getRecommendedViewport(candleData.length, candleData)
      } : null,

      // Estado del viewport persistente
      persistentViewport: persistentViewport ? {
        hasSnapshot: persistentViewport.hasSnapshot(),
        currentViewport: persistentViewport.getCurrentViewport()
      } : null,

      // Estado de los datos
      data: {
        candleDataLength: candleData.length,
        firstCandle: candleData.length > 0 ? {
          timestamp: candleData[0].x,
          date: new Date(candleData[0].x).toISOString()
        } : null,
        lastCandle: candleData.length > 0 ? {
          timestamp: candleData[candleData.length - 1].x,
          date: new Date(candleData[candleData.length - 1].x).toISOString()
        } : null
      },

      // Rendimiento
      performance: {
        lastUpdateTime,
        updateThrottleMs,
        memoryUsage: (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null
      }
    };

    return snapshot;
  }, [
    currentSymbol, currentInterval, isStreaming, status, candleData, activeIndicators,
    simpleCamera, persistentViewport, updateThrottleMs
  ]);

  const logSystemStateSnapshot = useCallback(() => {
    const snapshot = getSystemStateSnapshot();
    logLifecycle('SYSTEM_STATE_SNAPSHOT', 'MinimalistChart', snapshot);
    return snapshot;
  }, [getSystemStateSnapshot]);

  const startSystemMonitoring = useCallback((intervalMs: number = 5000) => {
    logLifecycle('SYSTEM_MONITORING_START', 'MinimalistChart', {
      intervalMs,
      timestamp: Date.now()
    });

    const monitoringInterval = setInterval(() => {
      const snapshot = getSystemStateSnapshot();
      
      // Detectar cambios críticos
      const criticalChanges = [];
      
      if (snapshot.camera?.viewport && snapshot.chart?.scales?.x) {
        const chartViewport = {
          min: snapshot.chart.scales.x.min,
          max: snapshot.chart.scales.x.max
        };
        const cameraViewport = snapshot.camera.viewport;
        
        if (Math.abs((chartViewport.min || 0) - (cameraViewport.min || 0)) > 1 ||
            Math.abs((chartViewport.max || 0) - (cameraViewport.max || 0)) > 1) {
          criticalChanges.push('CAMERA_CHART_VIEWPORT_MISMATCH');
        }
      }

      if (!snapshot.chart.exists && snapshot.component.candleDataLength > 0) {
        criticalChanges.push('CHART_MISSING_WITH_DATA');
      }

      if (snapshot.camera?.shouldForceViewport && !snapshot.camera?.isLocked) {
        criticalChanges.push('FORCE_VIEWPORT_WITHOUT_LOCK');
      }

      logLifecycle('SYSTEM_MONITORING_SNAPSHOT', 'MinimalistChart', {
        ...snapshot,
        criticalChanges,
        hasCriticalIssues: criticalChanges.length > 0
      });

      if (criticalChanges.length > 0) {
        logError('Critical system state issues detected', {
          issues: criticalChanges,
          snapshot
        });
      }
    }, intervalMs);

    // Retornar función de cleanup
    return () => {
      clearInterval(monitoringInterval);
      logLifecycle('SYSTEM_MONITORING_STOP', 'MinimalistChart', {
        timestamp: Date.now()
      });
    };
  }, [getSystemStateSnapshot]);

  const diagnoseCameraReset = useCallback(() => {
    const snapshot = getSystemStateSnapshot();
    
    const diagnosis = {
      timestamp: Date.now(),
      potentialCauses: [] as string[],
      recommendations: [] as string[],
      snapshot
    };

    // Analizar posibles causas del reset de cámara
    if (!snapshot.camera?.isLocked && snapshot.camera?.shouldAutoAdjust) {
      diagnosis.potentialCauses.push('CAMERA_NOT_LOCKED_AUTO_ADJUST_ACTIVE');
      diagnosis.recommendations.push('Lock camera during user interactions');
    }

    if (snapshot.chart?.scales?.x?.min !== snapshot.camera?.viewport?.min ||
        snapshot.chart?.scales?.x?.max !== snapshot.camera?.viewport?.max) {
      diagnosis.potentialCauses.push('CHART_CAMERA_VIEWPORT_MISMATCH');
      diagnosis.recommendations.push('Sync chart viewport with camera state');
    }

    if (snapshot.component.updateSequence > 100 && snapshot.performance.lastUpdateTime > 0) {
      const timeSinceLastUpdate = Date.now() - snapshot.performance.lastUpdateTime;
      if (timeSinceLastUpdate < 100) {
        diagnosis.potentialCauses.push('HIGH_FREQUENCY_UPDATES');
        diagnosis.recommendations.push('Increase update throttling');
      }
    }

    if (!snapshot.persistentViewport?.hasSnapshot && snapshot.camera?.currentState?.mode === 'USER_LOCKED') {
      diagnosis.potentialCauses.push('NO_VIEWPORT_PERSISTENCE');
      diagnosis.recommendations.push('Ensure viewport persistence is working');
    }

    logLifecycle('CAMERA_RESET_DIAGNOSIS', 'MinimalistChart', diagnosis);
    
    return diagnosis;
  }, [getSystemStateSnapshot]);

  // Exponer funciones de debugging globalmente para uso en consola
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).houndTradeDebug = {
        getSystemStateSnapshot,
        logSystemStateSnapshot,
        startSystemMonitoring,
        diagnoseCameraReset,
        chart: chartRef.current,
        camera: simpleCamera,
        persistentViewport
      };
    }
  }, [getSystemStateSnapshot, logSystemStateSnapshot, startSystemMonitoring, diagnoseCameraReset, simpleCamera, persistentViewport]);

  // Funciones para manejar indicadores dinámicamente
  const addIndicatorToChart = useCallback((chart: any, indicator: string) => {
    if (!chart?.data?.datasets || !technicalIndicators) return;

    const candleDataForIndicators = candleData;
    
    // CRÍTICO: Preservar configuraciones antes de añadir nuevos indicadores
    preserveIndicatorConfigs(chart);
    
    switch (indicator) {
      case 'sma20':
        chart.data.datasets.push({
          label: 'SMA 20',
          type: 'line',
          data: candleDataForIndicators.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.sma20[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: '#ffaa00',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          yAxisID: 'y'
        });
        break;
        
      case 'sma50':
        chart.data.datasets.push({
          label: 'SMA 50',
          type: 'line',
          data: candleDataForIndicators.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.sma50[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: '#ff6600',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          yAxisID: 'y'
        });
        break;
        
      case 'ema20':
        chart.data.datasets.push({
          label: 'EMA 20',
          type: 'line',
          data: candleDataForIndicators.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.ema20[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: '#00aaff',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          yAxisID: 'y'
        });
        break;
        
      case 'bollinger':
        // Banda superior
        chart.data.datasets.push({
          label: 'BB Upper',
          type: 'line',
          data: candleDataForIndicators.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.bollinger.upper[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: 'rgba(255, 255, 255, 0.5)',
          backgroundColor: 'transparent',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [5, 5],
          yAxisID: 'y'
        });
        
        // Banda media
        chart.data.datasets.push({
          label: 'BB Middle',
          type: 'line',
          data: candleDataForIndicators.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.bollinger.middle[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: '#ffffff',
          backgroundColor: 'transparent',
          borderWidth: 1,
          pointRadius: 0,
          yAxisID: 'y'
        });
        
        // Banda inferior
        chart.data.datasets.push({
          label: 'BB Lower',
          type: 'line',
          data: candleDataForIndicators.map((candle, i) => ({
            x: candle.x,
            y: technicalIndicators.bollinger.lower[i]
          })).filter(point => !isNaN(point.y)),
          borderColor: 'rgba(255, 255, 255, 0.5)',
          backgroundColor: 'transparent',
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [5, 5],
          yAxisID: 'y'
        });
        break;
    }
    
    // CRÍTICO: Actualizar configuraciones después de añadir indicador
    preserveIndicatorConfigs(chart);
    
    // Actualizar con animación
    chart.update('default');
  }, [candleData, technicalIndicators, preserveIndicatorConfigs]);

  const removeIndicatorFromChart = useCallback((chart: any, indicator: string) => {
    if (!chart?.data?.datasets) return;

    const labelsToRemove: string[] = [];
    switch (indicator) {
      case 'sma20':
        labelsToRemove.push('SMA 20');
        break;
      case 'sma50':
        labelsToRemove.push('SMA 50');
        break;
      case 'ema20':
        labelsToRemove.push('EMA 20');
        break;
      case 'bollinger':
        labelsToRemove.push('BB Upper', 'BB Middle', 'BB Lower');
        break;
    }
    
    // Eliminar datasets por label
    chart.data.datasets = chart.data.datasets.filter((dataset: any) => 
      !labelsToRemove.includes(dataset.label)
    );
    
    // Actualizar con animación
    chart.update('default');
  }, []);

  const toggleIndicator = useCallback((indicator: string) => {
    const chart = chartRef.current;
    if (!chart) return;

    setActiveIndicators(prev => {
      const newSet = new Set(prev);
      const isRemoving = newSet.has(indicator);
      
      if (isRemoving) {
        newSet.delete(indicator);
        removeIndicatorFromChart(chart, indicator);
      } else {
        newSet.add(indicator);
        addIndicatorToChart(chart, indicator);
      }
      
      return newSet;
    });
  }, [addIndicatorToChart, removeIndicatorFromChart]);

  // useEffect separado para manejar indicadores cuando se actualicen los datos técnicos
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !technicalIndicators || candleData.length === 0) return;

    // Actualizar solo los datasets de indicadores existentes sin triggear reinicialización
    activeIndicators.forEach(indicator => {
      const existingDatasets = chart.data.datasets;
      
      switch (indicator) {
        case 'sma20': {
          const smaDataset = existingDatasets.find((ds: any) => ds.label === 'SMA 20');
          if (smaDataset) {
            smaDataset.data = candleData.map((candle, i) => ({
              x: candle.x,
              y: technicalIndicators.sma20[i]
            })).filter(point => !isNaN(point.y));
          }
          break;
        }
        case 'sma50': {
          const smaDataset = existingDatasets.find((ds: any) => ds.label === 'SMA 50');
          if (smaDataset) {
            smaDataset.data = candleData.map((candle, i) => ({
              x: candle.x,
              y: technicalIndicators.sma50[i]
            })).filter(point => !isNaN(point.y));
          }
          break;
        }
        case 'ema20': {
          const emaDataset = existingDatasets.find((ds: any) => ds.label === 'EMA 20');
          if (emaDataset) {
            emaDataset.data = candleData.map((candle, i) => ({
              x: candle.x,
              y: technicalIndicators.ema20[i]
            })).filter(point => !isNaN(point.y));
          }
          break;
        }
        case 'bollinger': {
          const upperDataset = existingDatasets.find((ds: any) => ds.label === 'BB Upper');
          const middleDataset = existingDatasets.find((ds: any) => ds.label === 'BB Middle');
          const lowerDataset = existingDatasets.find((ds: any) => ds.label === 'BB Lower');
          
          if (upperDataset) {
            upperDataset.data = candleData.map((candle, i) => ({
              x: candle.x,
              y: technicalIndicators.bollinger.upper[i]
            })).filter(point => !isNaN(point.y));
          }
          if (middleDataset) {
            middleDataset.data = candleData.map((candle, i) => ({
              x: candle.x,
              y: technicalIndicators.bollinger.middle[i]
            })).filter(point => !isNaN(point.y));
          }
          if (lowerDataset) {
            lowerDataset.data = candleData.map((candle, i) => ({
              x: candle.x,
              y: technicalIndicators.bollinger.lower[i]
            })).filter(point => !isNaN(point.y));
          }
          break;
        }
      }
    });
    
    // Solo actualizar si hay indicadores activos
    if (activeIndicators.size > 0) {
      chart.update('none'); // Usar 'none' para evitar animaciones durante actualizaciones de datos
    }
  }, [technicalIndicators, candleData, activeIndicators]);

  // NUEVO: Efecto para cargar configuraciones de indicadores al montar el componente
  useEffect(() => {
    // Solo cargar al montar el componente por primera vez
    const storedData = loadIndicatorConfigsFromStorage();
    if (storedData) {
      logChart('COMPONENT_MOUNTED_WITH_STORED_INDICATORS', {
        activeIndicators: storedData.activeIndicators,
        configCount: Object.keys(storedData.configs).length
      });
    }
  }, []); // Sin dependencias para que solo se ejecute al montar

  // Efectos
  useEffect(() => {
    // Solo ejecutar si hay un cambio REAL del símbolo o intervalo, o es la primera carga
    const symbolChanged = previousSymbolRef.current !== '' && previousSymbolRef.current !== currentSymbol;  
    const intervalChanged = previousIntervalRef.current !== '' && previousIntervalRef.current !== currentInterval;
    const isFirstLoad = !hasLoadedOnceRef.current;
    
    logLifecycle('SYMBOL_INTERVAL_EFFECT_CHECK', 'MinimalistChart', {
      currentSymbol,
      previousSymbol: previousSymbolRef.current,
      currentInterval,
      previousInterval: previousIntervalRef.current,
      symbolChanged,
      intervalChanged,
      isFirstLoad,
      hasLoadedOnce: hasLoadedOnceRef.current,
      willExecute: symbolChanged || intervalChanged || isFirstLoad
    });
    
    if (!symbolChanged && !intervalChanged && !isFirstLoad) {
      // No hay cambio real, solo actualización de datos - no resetear cámara
      return;
    }

    const loadInitialData = async () => {
      try {
        logLifecycle('INTENTIONAL_SYMBOL_OR_INTERVAL_CHANGE', 'MinimalistChart', {
          previousSymbol: previousSymbolRef.current,
          newSymbol: currentSymbol,
          previousInterval: previousIntervalRef.current,
          newInterval: currentInterval,
          symbolChanged,
          intervalChanged,
          isFirstLoad,
          reason: 'user_initiated_change'
        });

        // 1. RESETEAR LA CÁMARA específicamente según el tipo de cambio
        if (simpleCamera && (symbolChanged || intervalChanged)) {
          if (symbolChanged) {
            // ACTIVAR PROTECCIÓN: Bloquear actualizaciones durante cambio de criptomoneda
            isChangingCryptocurrency.current = true;
            
            // Limpiar timeout anterior si existe
            if (cryptocurrencyChangeTimeout.current) {
              clearTimeout(cryptocurrencyChangeTimeout.current);
            }
            
            const preCameraState = simpleCamera.getCurrentState();
            logCryptoChange('RESETTING_CAMERA_FOR_CRYPTOCURRENCY_CHANGE', {
              reason: 'cryptocurrency_change',
              previousSymbol: previousSymbolRef.current,
              newSymbol: currentSymbol,
              interval: currentInterval,
              streamUpdatesBlocked: true,
              preCameraState: {
                mode: preCameraState.mode,
                isLocked: preCameraState.isLocked,
                viewport: preCameraState.viewport,
                lastUserAction: preCameraState.lastUserAction ? new Date(preCameraState.lastUserAction).toLocaleTimeString() : null
              },
              timestamp: new Date().toLocaleTimeString()
            });
            
            simpleCamera.resetForCryptoCurrencyChange();
            
            const postCameraState = simpleCamera.getCurrentState();
            logCryptoChange('CAMERA_RESET_COMPLETE_FOR_CRYPTO_CHANGE', {
              preCameraState: {
                mode: preCameraState.mode,
                isLocked: preCameraState.isLocked,
                viewport: preCameraState.viewport
              },
              postCameraState: {
                mode: postCameraState.mode,
                isLocked: postCameraState.isLocked,
                viewport: postCameraState.viewport
              },
              stateCleared: !postCameraState.isLocked && !postCameraState.lastUserAction,
              timestamp: new Date().toLocaleTimeString()
            });
          } else if (intervalChanged) {
            logLifecycle('RESETTING_CAMERA_FOR_TIMEFRAME_CHANGE', 'MinimalistChart', {
              reason: 'timeframe_change',
              symbol: currentSymbol,
              previousInterval: previousIntervalRef.current,
              newInterval: currentInterval
            });
            simpleCamera.resetForTimeframeChange();
          }
        }

        // 2. LIMPIAR DATOS ANTERIORES usando método específico según el tipo de cambio
        if (symbolChanged) {
          clearChartForCryptoCurrencyChange();
        } else {
          clearChartCompletely();
        }

        // 3. Marcar que necesitamos reinicializar debido a cambio de símbolo/intervalo
        chartNeedsReinitializationRef.current = true;
        
        // 4. Resetear bandera para permitir nuevo viewport completo
        hasAppliedFullViewportAfterChange.current = false;
        
        // 4. CARGAR DATOS HISTÓRICOS
        const historicalData = await liveStreamingService.loadHistoricalData(currentSymbol, currentInterval, 1000);
        setCandleData(historicalData);
        
        // NUEVO: Verificar que los datos históricos cargados sean válidos y del símbolo correcto
        if (historicalData && historicalData.length > 0) {
          logCryptoChange('HISTORICAL_DATA_LOADED_SUCCESSFULLY', {
            symbol: currentSymbol,
            interval: currentInterval,
            candleCount: historicalData.length,
            firstCandleTime: new Date(historicalData[0].x).toLocaleTimeString(),
            lastCandleTime: new Date(historicalData[historicalData.length - 1].x).toLocaleTimeString(),
            lastCandlePrice: historicalData[historicalData.length - 1].c.toFixed(4)
          });
        } else {
          logCryptoChange('HISTORICAL_DATA_LOAD_FAILED', {
            symbol: currentSymbol,
            interval: currentInterval,
            dataLength: historicalData ? historicalData.length : 0
          });
        }

        // 5. CONFIGURAR VIEWPORT PARA MOSTRAR TODAS LAS VELAS (específico por tipo de cambio)
        if (simpleCamera && historicalData.length > 0) {
          setTimeout(() => {
            const viewportSet = simpleCamera.setViewportToLatestData(historicalData);
            
            if (symbolChanged) {
              const currentCameraViewport = simpleCamera.getViewportFromCamera();
              logCryptoChange('VIEWPORT_CONFIGURED_FOR_CRYPTOCURRENCY_CHANGE', {
                previousSymbol: previousSymbolRef.current,
                newSymbol: currentSymbol,
                interval: currentInterval,
                dataLength: historicalData.length,
                viewportSet,
                reason: 'show_all_data_full_graph_cryptocurrency_change',
                newViewport: currentCameraViewport,
                dataRange: historicalData.length > 0 ? {
                  firstCandle: new Date(historicalData[0].x).toLocaleTimeString(),
                  lastCandle: new Date(historicalData[historicalData.length - 1].x).toLocaleTimeString(),
                  priceRange: {
                    min: Math.min(...historicalData.map(d => d.l)),
                    max: Math.max(...historicalData.map(d => d.h))
                  }
                } : null,
                timestamp: new Date().toLocaleTimeString()
              });
            } else {
              logLifecycle('VIEWPORT_CONFIGURED_FOR_TIMEFRAME_CHANGE', 'MinimalistChart', {
                symbol: currentSymbol,
                previousInterval: previousIntervalRef.current,
                newInterval: currentInterval,
                dataLength: historicalData.length,
                viewportSet,
                reason: 'show_all_data_full_graph_timeframe_change'
              });
            }

            // 6. CAMBIAR A MODO AUTO después de configurar viewport
            setTimeout(() => {
              const currentState = simpleCamera.getCurrentState();
              if (currentState.mode === 'FIRST_LOAD') {
                simpleCamera.unlockCamera(); // Esto cambiará a modo AUTO
                
                const changeType = symbolChanged ? 'cryptocurrency' : 'timeframe';
                
                if (symbolChanged) {
                  const finalCameraState = simpleCamera.getCurrentState();
                  logCryptoChange('CAMERA_MODE_CHANGED_TO_AUTO_AFTER_CRYPTOCURRENCY_CHANGE', {
                    previousMode: 'FIRST_LOAD',
                    newMode: 'AUTO',
                    reason: 'viewport_configured_successfully_cryptocurrency_change',
                    finalCameraState: {
                      mode: finalCameraState.mode,
                      isLocked: finalCameraState.isLocked,
                      viewport: finalCameraState.viewport
                    },
                    newSymbol: currentSymbol,
                    previousSymbol: previousSymbolRef.current,
                    timestamp: new Date().toLocaleTimeString()
                  });
                } else {
                  logLifecycle('CAMERA_MODE_CHANGED_TO_AUTO_AFTER_TIMEFRAME_CHANGE', 'MinimalistChart', {
                    previousMode: 'FIRST_LOAD',
                    newMode: 'AUTO',
                    reason: 'viewport_configured_successfully_timeframe_change'
                  });
                }
                
                // DESACTIVAR PROTECCIÓN: Permitir actualizaciones después del cambio de criptomoneda
                if (symbolChanged) {
                  cryptocurrencyChangeTimeout.current = setTimeout(() => {
                    isChangingCryptocurrency.current = false;
                    
                    // NUEVO: Verificación final de que tenemos datos de la nueva criptomoneda
                    if (candleData.length > 0) {
                      const lastCandle = candleData[candleData.length - 1];
                      logCryptoChange('FINAL_VERIFICATION_NEW_CRYPTO_DATA', {
                        newSymbol: currentSymbol,
                        lastCandlePrice: lastCandle.c.toFixed(4),
                        lastCandleTime: new Date(lastCandle.x).toLocaleTimeString(),
                        totalCandles: candleData.length,
                        verificationPassed: true
                      });
                    } else {
                      logCryptoChange('FINAL_VERIFICATION_NO_DATA_WARNING', {
                        newSymbol: currentSymbol,
                        reason: 'no_candle_data_after_crypto_change'
                      });
                    }
                    
                    logCryptoChange('CRYPTOCURRENCY_CHANGE_PROTECTION_DISABLED', {
                      reason: 'camera_and_viewport_configured_successfully',
                      streamUpdatesEnabled: true,
                      newSymbol: currentSymbol,
                      totalTransitionTime: Date.now(),
                      timestamp: new Date().toLocaleTimeString()
                    });
                  }, 1500); // Aumentado de 500ms a 1500ms para mayor seguridad
                }
              }
            }, 200);
          }, 100);
        }
      } catch (error) {
        console.error('Error cargando datos iniciales:', error);
      }
    };

    // Solo cargar datos si hay un cambio real o es primera carga
    if (symbolChanged || intervalChanged || isFirstLoad) {
      loadInitialData();
      hasLoadedOnceRef.current = true;
    }
    
    // Actualizar referencias para el próximo cambio
    previousSymbolRef.current = currentSymbol;
    previousIntervalRef.current = currentInterval;
  }, [currentSymbol, currentInterval, simpleCamera, clearChartCompletely, clearChartForCryptoCurrencyChange]);

  // NUEVO: Solo reinicializar el gráfico cuando realmente sea necesario
  const lastCandleCountRef = useRef<number>(0);
  const chartNeedsReinitializationRef = useRef<boolean>(false);
  
  useEffect(() => {
    // Solo inicializar si:
    // 1. Tenemos datos de velas
    // 2. No existe un gráfico actualmente
    // 3. El número de velas cambió significativamente (nuevo símbolo/intervalo)
    // 4. Se marcó explícitamente para reinicialización
    
    const shouldInitialize = candleData.length > 0 && (
      !chartRef.current || 
      Math.abs(candleData.length - lastCandleCountRef.current) > 50 ||
      chartNeedsReinitializationRef.current
    );
    
    if (shouldInitialize) {
      logLifecycle('CHART_REINITIALIZE_DECISION', 'MinimalistChart', {
        candleDataLength: candleData.length,
        lastCandleCount: lastCandleCountRef.current,
        chartExists: !!chartRef.current,
        forceReinit: chartNeedsReinitializationRef.current,
        sizeDelta: Math.abs(candleData.length - lastCandleCountRef.current)
      });
      
      lastCandleCountRef.current = candleData.length;
      chartNeedsReinitializationRef.current = false;
      initializeChart();
    } else {
      logLifecycle('CHART_REINITIALIZE_SKIPPED', 'MinimalistChart', {
        candleDataLength: candleData.length,
        lastCandleCount: lastCandleCountRef.current,
        chartExists: !!chartRef.current,
        sizeDelta: Math.abs(candleData.length - lastCandleCountRef.current)
      });
    }
  }, [candleData.length, currentSymbol, currentInterval, initializeChart]); // Solo depender de longitud, no de los datos completos

  // ❌ HOOK ELIMINADO: Este hook causaba loops de viewport forzado redundante
  // Ya no necesitamos forzar el viewport aquí porque updateChart ya lo maneja correctamente
  // El hook se ejecutaba en cada cambio de candleData creando interferencias

  useEffect(() => {
    // Handler estable que usa referencias para evitar dependencias circulares
    const handleCandleUpdate = (update: StreamUpdate) => {
      logLastCandle('STREAM_UPDATE_RECEIVED', {
        symbol: update.symbol,
        currentSymbol: currentSymbol,
        interval: update.interval,
        currentInterval: currentInterval,
        isFinal: update.isFinal,
        price: update.candle.c,
        timestamp: new Date().toLocaleTimeString(),
        candleTimestamp: new Date(update.candle.x).toLocaleTimeString(),
        matchesCurrentChart: update.symbol === currentSymbol && update.interval === currentInterval,
        candleRange: {
          open: update.candle.o,
          high: update.candle.h,
          low: update.candle.l,
          close: update.candle.c
        }
      });
      
      // PROTECCIÓN CRÍTICA: Bloquear updates durante cambios de criptomoneda
      if (isChangingCryptocurrency.current) {
        logCryptoChange('STREAM_UPDATE_BLOCKED_CRYPTOCURRENCY_CHANGE', {
          symbol: update.symbol,
          currentSymbol: currentSymbol,
          reason: 'cryptocurrency_change_in_progress',
          price: update.candle.c,
          timestamp: new Date().toLocaleTimeString()
        });
        return;
      }
      
      // NUEVA PROTECCIÓN: Verificar que el símbolo coincida exactamente antes de procesar
      if (update.symbol !== currentSymbol || update.interval !== currentInterval) {
        logLastCandle('STREAM_UPDATE_SYMBOL_MISMATCH', {
          updateSymbol: update.symbol,
          updateInterval: update.interval,
          currentSymbol: currentSymbol,
          currentInterval: currentInterval,
          reason: 'symbol_or_interval_mismatch_blocking_update',
          price: update.candle.c,
          timestamp: new Date().toLocaleTimeString()
        });
        return;
      }
      
      // Si llegamos aquí, el update es válido y coincide con el símbolo/intervalo actual
      logChart('STREAM_UPDATE_PROCESSING', {
        symbol: update.symbol,
        interval: update.interval,
        isFinal: update.isFinal,
        price: update.candle.c
      });
      
            // CRÍTICO: updateChart NO debe hacer setState ni lockCamera durante ticks
            updateChart(update.candle, update.isFinal);
            
            logChart('STREAM_UPDATE_CHART_COMPLETE', { 
              symbol: update.symbol, 
              price: update.candle.c,
              candleTimestamp: new Date(update.candle.x).toLocaleTimeString(),
              isNewSymbolFirstUpdate: previousSymbolRef.current !== currentSymbol
            });        setCandleData(prev => {
          const newData = [...prev];
          
          // Buscar vela existente considerando ventana de tiempo en lugar de timestamp exacto
          let existingIndex = -1;
          const updateTimestamp = update.candle.x;
          
          // Para la última vela (más común en streaming), verificar primero el final del array
          if (newData.length > 0) {
            const lastCandle = newData[newData.length - 1];
            const intervalMs = getIntervalInMs(currentInterval);
            const timeDiff = Math.abs(lastCandle.x - updateTimestamp);
            
            // Si la diferencia de tiempo es menor que el intervalo, es la misma vela
            if (timeDiff < intervalMs) {
              existingIndex = newData.length - 1;
            } else {
              // Buscar en las últimas 5 velas por si acaso
              for (let i = Math.max(0, newData.length - 5); i < newData.length - 1; i++) {
                const candleTimeDiff = Math.abs(newData[i].x - updateTimestamp);
                if (candleTimeDiff < intervalMs) {
                  existingIndex = i;
                  break;
                }
              }
            }
          }
          
          if (existingIndex >= 0) {
            // Actualizar vela existente
            const oldCandle = newData[existingIndex];
            const oldPrice = oldCandle.c;
            newData[existingIndex] = update.candle;
            
            // 🐛 DEBUG: Solo log cuando hay cambio significativo de precio
            const priceChange = Math.abs(update.candle.c - oldPrice);
            if (priceChange > oldPrice * 0.001) { // Solo si cambia más del 0.1%
              console.log(`📈 [VELA ACTUALIZADA] ${update.symbol}: $${oldPrice.toFixed(2)} → $${update.candle.c.toFixed(2)} (${((update.candle.c - oldPrice) / oldPrice * 100).toFixed(2)}%)`);
            }
          } else {
            // Agregar nueva vela
            newData.push(update.candle);
            
            // 🐛 DEBUG: Siempre log cuando se añade nueva vela
            console.log(`🆕 [NUEVA VELA] ${update.symbol}: $${update.candle.c.toFixed(2)} - Total: ${newData.length} velas`);
            
            // Mantener solo las últimas velas según configuración de cámara
            const maxCandles = 1000;
            if (newData.length > maxCandles) {
              const removedCount = newData.length - maxCandles;
              newData.splice(0, removedCount);
              console.log(`🗑️ [LIMPIEZA] Removidas ${removedCount} velas antiguas, quedan ${newData.length}`);
            }
          }
          
          // Ordenar por timestamp para asegurar orden correcto
          newData.sort((a, b) => a.x - b.x);
          
          return newData;
        });
    };

    // Función auxiliar para obtener intervalos en milisegundos
    const getIntervalInMs = (interval: string): number => {
      const intervals: { [key: string]: number } = {
        '1m': 60 * 1000,
        '3m': 3 * 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '2h': 2 * 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '8h': 8 * 60 * 60 * 1000,
        '12h': 12 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '3d': 3 * 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000,
        '1M': 30 * 24 * 60 * 60 * 1000,
      };
      return intervals[interval] || 60 * 1000;
    };

    liveStreamingService.on('candleUpdate', handleCandleUpdate);

    return () => {
      liveStreamingService.off('candleUpdate', handleCandleUpdate);
    };
  }, [currentSymbol, currentInterval, updateChart]); // Dependencias estables, NO incluir simpleCamera

  // Cleanup al desmontar
  useEffect(() => {
    // Listeners para estado de conexión
    const handleConnected = () => {
      setStatus('✅ WebSocket conectado');
    };

    const handleDisconnected = () => {
      setStatus(''); // Ocultar mensaje de reconexión
    };

    const handleMaxReconnectReached = () => {
      setStatus('⚠️ Usando modo polling (WebSocket no disponible)');
    };

    liveStreamingService.on('connected', handleConnected);
    liveStreamingService.on('disconnected', handleDisconnected);
    liveStreamingService.on('maxReconnectAttemptsReached', handleMaxReconnectReached);

    return () => {
      if (isStreaming) {
        liveStreamingService.unsubscribeFromStream(currentSymbol, currentInterval);
      }
      if (chartRef.current) {
        chartRef.current.destroy();
      }
      
      // Limpiar timeouts para evitar actualizaciones después del desmontaje
      if (cryptocurrencyChangeTimeout.current) {
        clearTimeout(cryptocurrencyChangeTimeout.current);
      }
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current);
      }
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
      if (panTimeoutRef.current) {
        clearTimeout(panTimeoutRef.current);
      }
      if (zoomDebounceRef.current) {
        clearTimeout(zoomDebounceRef.current);
      }
      if (panDebounceRef.current) {
        clearTimeout(panDebounceRef.current);
      }
      
      // Limpiar listeners
      liveStreamingService.off('connected', handleConnected);
      liveStreamingService.off('disconnected', handleDisconnected);
      liveStreamingService.off('maxReconnectAttemptsReached', handleMaxReconnectReached);
    };
  }, []);

  // useEffect para manejar el resize dinámico del canvas
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const wrapper = canvas.parentElement;
      if (!wrapper) return;

      // Obtener las dimensiones del wrapper
      const rect = wrapper.getBoundingClientRect();
      
      // Calcular altura mínima basada en el tamaño de la ventana
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      
      // Media queries en JavaScript para diferentes tamaños
      let minHeight = 300; // Altura mínima por defecto
      
      if (windowWidth <= 480) {
        // Móvil pequeño
        minHeight = Math.max(250, windowHeight * 0.4);
      } else if (windowWidth <= 768) {
        // Tablet/móvil grande
        minHeight = Math.max(350, windowHeight * 0.5);
      } else if (windowWidth <= 1024) {
        // Tablet horizontal/laptop pequeño
        minHeight = Math.max(400, windowHeight * 0.6);
      } else {
        // Desktop
        minHeight = Math.max(500, windowHeight * 0.7);
      }
      
      // Establecer el tamaño del canvas para que coincida con el wrapper
      // MEJORA DE RESOLUCIÓN: Aumentar PPI moderadamente para mejor definición
      const basePixelRatio = window.devicePixelRatio || 1;
      const enhancedPixelRatio = Math.min(basePixelRatio * 1.25, 2.5); // Moderado: máximo 25% extra, tope 2.5x
      const finalHeight = Math.max(rect.height, minHeight);
      
      // Configurar el tamaño real del canvas (buffer interno) con resolución mejorada
      canvas.width = rect.width * enhancedPixelRatio;
      canvas.height = finalHeight * enhancedPixelRatio;
      
      // Configurar el tamaño CSS del canvas
      canvas.style.width = rect.width + 'px';
      canvas.style.height = finalHeight + 'px';
      
      // Asegurar que el wrapper tenga la altura mínima
      if (wrapper instanceof HTMLElement) {
        wrapper.style.minHeight = minHeight + 'px';
      }
      
      // Escalar el contexto para manejar la densidad de píxeles mejorada
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(enhancedPixelRatio, enhancedPixelRatio);
      }

      // Si tenemos un gráfico, actualizar sus dimensiones
      if (chartRef.current) {
        chartRef.current.resize();
        chartRef.current.update('none');
      }

      logLifecycle('CANVAS_RESIZED_WITH_MEDIA_QUERIES', 'MinimalistChart', {
        windowSize: { width: windowWidth, height: windowHeight },
        wrapperSize: { width: rect.width, height: rect.height },
        canvasSize: { width: canvas.width, height: canvas.height },
        calculatedMinHeight: minHeight,
        finalHeight,
        basePixelRatio,
        enhancedPixelRatio,
        resolutionMultiplier: (enhancedPixelRatio / basePixelRatio).toFixed(2),
        chartExists: !!chartRef.current
      });
    };

    // Resize inicial
    resizeCanvas();

    // Escuchar cambios de tamaño de ventana
    window.addEventListener('resize', resizeCanvas);
    
    // También escuchar cambios de orientación en móviles
    window.addEventListener('orientationchange', () => {
      setTimeout(resizeCanvas, 100); // Delay para asegurar que la orientación se complete
    });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('orientationchange', resizeCanvas);
    };
  }, []);

  // Auto-iniciar streaming
  useEffect(() => {
    if (candleData.length > 0 && !isStreaming) {
      startStreaming();
    }
  }, [candleData, startStreaming, isStreaming]);

  // Configuración inicial del viewport SOLO al cargar por primera vez
  useEffect(() => {
    logLifecycle('VIEWPORT_INITIAL_SETUP_CHECK', 'MinimalistChart', {
      hasChart: !!chartRef.current,
      candleCount: candleData.length,
      initialViewportSet: initialViewportSet.current,
      shouldAutoAdjust: simpleCamera.shouldAutoAdjust(),
      isLocked: simpleCamera.isLocked()
    });
    
    if (!chartRef.current || candleData.length === 0 || initialViewportSet.current) {
      logLifecycle('VIEWPORT_INITIAL_SETUP_SKIP', 'MinimalistChart', {
        reason: !chartRef.current ? 'no_chart' : 
                candleData.length === 0 ? 'no_data' : 'already_set'
      });
      return;
    }
    
    const chart = chartRef.current;
    
    // Verificar si hay configuración guardada del usuario
    if (simpleCamera.isLocked()) {
      const userState = simpleCamera.state.chartJsState;
      logViewportState(userState, 'CHECKING_USER_SAVED_CONFIG');
      
      if (chart.scales.x && userState.min !== null && userState.max !== null) {
        logLifecycle('VIEWPORT_APPLYING_USER_CONFIG', 'MinimalistChart', {
          viewport: { min: userState.min, max: userState.max }
        });
        
        // Marcar como aplicación automática para evitar eventos de usuario
        isApplyingAutomaticViewport.current = true;
        
        try {
          chart.scales.x.min = userState.min;
          chart.scales.x.max = userState.max;
          chart.update('none');
          initialViewportSet.current = true;
          
          logViewportState({ min: userState.min, max: userState.max }, 'USER_CONFIG_APPLIED');
        } finally {
          setTimeout(() => {
            isApplyingAutomaticViewport.current = false;
          }, 50);
        }
        return;
      }
    }
    
    // En modo auto-ajuste: configurar vista inicial de TODAS las velas
    if (simpleCamera.shouldAutoAdjust()) {
      logLifecycle('VIEWPORT_APPLYING_AUTO_CONFIG', 'MinimalistChart');
      
      const viewport = simpleCamera.getRecommendedViewport(candleData.length, candleData, true);
      logViewportState(viewport, 'RECOMMENDED_VIEWPORT_ALL_DATA');
      
      if (chart.scales.x && viewport.min && viewport.max) {
        logLifecycle('VIEWPORT_SETTING_INITIAL_VIEW', 'MinimalistChart', {
          viewport
        });
        
        // Marcar como aplicación automática para evitar eventos de usuario
        isApplyingAutomaticViewport.current = true;
        
        try {
          chart.scales.x.min = viewport.min;
          chart.scales.x.max = viewport.max;
          chart.update('none');
          initialViewportSet.current = true;
          
          logViewportState(viewport, 'INITIAL_VIEW_APPLIED');
        } finally {
          setTimeout(() => {
            isApplyingAutomaticViewport.current = false;
          }, 50);
        }
      } else {
        logLifecycle('VIEWPORT_INITIAL_SETUP_FAILED', 'MinimalistChart', {
          reason: 'invalid_viewport_data',
          viewport
        });
      }
    }
  }, [candleData.length === 0 ? 0 : 1]); // Solo se ejecuta UNA VEZ cuando candleData pasa de vacío a tener datos

  // Auto-iniciar streaming
  useEffect(() => {
    if (candleData.length > 0 && !isStreaming) {
      startStreaming();
    }
  }, [candleData, startStreaming, isStreaming]);

  // Función global para debugging (disponible en consola del navegador)
  useEffect(() => {
    // Crear función global para debugging
    if (typeof window !== 'undefined') {
      (window as any).debugCameraSystem = () => {
        const cameraState = simpleCamera.getCurrentState();
        const chartScales = chartRef.current?.scales?.x;
        const persistentState = persistentViewport.getCurrentViewport();
        
        logSystemSnapshot('MANUAL_DEBUG_REQUEST', cameraState, {
          scalesMin: chartScales?.min,
          scalesMax: chartScales?.max,
          chartExists: !!chartRef.current
        }, persistentState);
        
        console.log('📋 [DEBUG] Sistema de cámara - Estado completo:');
        console.log('📷 Cámara:', cameraState);
        console.log('📊 Chart Scales:', { min: chartScales?.min, max: chartScales?.max });
        console.log('💾 Persistent:', persistentState);
        console.log('🎭 Flags:', { 
          initialViewportSet: initialViewportSet.current,
          isUserInteracting,
          isStreaming 
        });
        
        return {
          camera: cameraState,
          chartScales: { min: chartScales?.min, max: chartScales?.max },
          persistent: persistentState,
          flags: { initialViewportSet: initialViewportSet.current, isUserInteracting, isStreaming }
        };
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).debugCameraSystem;
      }
    };
  }, [simpleCamera, persistentViewport, isUserInteracting, isStreaming]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Este componente solo funciona en la plataforma web
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Gráfico con controles pegados arriba */}
      <View style={styles.chartContainer}>
        {/* Controles directamente arriba del gráfico */}
        <View style={styles.controlsAboveChart}>
          {/* Temporalidades */}
          <View style={styles.timeframeRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.intervalContainer}>
              {timeIntervals.map((interval) => (
                <TouchableOpacity
                  key={interval.value}
                  style={[
                    styles.intervalButton,
                    responsiveStyles.intervalButton,
                    currentInterval === interval.value && styles.intervalButtonActive
                  ]}
                  onPress={() => changeTimeInterval(interval.value)}
                >
                  <Text style={[
                    styles.intervalButtonText,
                    responsiveStyles.intervalButtonText,
                    currentInterval === interval.value && styles.intervalButtonTextActive
                  ]}>
                    {interval.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Indicadores en la misma fila */}
            <View style={styles.indicatorsRow}>
              <TouchableOpacity
                style={[
                  styles.indicatorButton, 
                  responsiveStyles.indicatorButton,
                  activeIndicators.has('sma20') && styles.indicatorButtonActive
                ]}
                onPress={() => toggleIndicator('sma20')}
              >
                <Text style={[styles.indicatorButtonText, responsiveStyles.indicatorButtonText]}>
                  SMA20
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.indicatorButton, 
                  responsiveStyles.indicatorButton,
                  activeIndicators.has('sma50') && styles.indicatorButtonActive
                ]}
                onPress={() => toggleIndicator('sma50')}
              >
                <Text style={[styles.indicatorButtonText, responsiveStyles.indicatorButtonText]}>
                  SMA50
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.indicatorButton, 
                  responsiveStyles.indicatorButton,
                  activeIndicators.has('ema20') && styles.indicatorButtonActive
                ]}
                onPress={() => toggleIndicator('ema20')}
              >
                <Text style={[styles.indicatorButtonText, responsiveStyles.indicatorButtonText]}>
                  EMA20
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.indicatorButton, 
                  responsiveStyles.indicatorButton,
                  activeIndicators.has('bollinger') && styles.indicatorButtonActive
                ]}
                onPress={() => toggleIndicator('bollinger')}
              >
                <Text style={[styles.indicatorButtonText, responsiveStyles.indicatorButtonText]}>
                  BB
                </Text>
              </TouchableOpacity>

              {/* Botón de reset de cámara con estado visual */}
              <TouchableOpacity
                style={[
                  styles.indicatorButton, 
                  responsiveStyles.indicatorButton,
                  simpleCamera.isLocked() ? styles.cameraManualButton : styles.cameraResetButton
                ]}
                onPress={() => {
                  logUserInteractionDetailed('CAMERA_RESET_BUTTON_PRESSED', {
                    currentMode: simpleCamera.getCurrentState().mode,
                    wasLocked: simpleCamera.isLocked(),
                    userAction: 'manual_reset_request'
                  });
                  
                  const preResetState = simpleCamera.getCurrentState();
                  logViewportState(preResetState, 'PRE_RESET');
                  
                  initialViewportSet.current = false; // Reset flag para permitir nuevo viewport inicial
                  simpleCamera.resetToLatest(); // Limpia estado persistido
                  persistentViewport.resetZoom('none'); // Reset usando Chart.js oficial
                  persistentViewport.clearSnapshot(); // Limpia snapshot guardado
                  
                  logLifecycle('CAMERA_RESET_COMPLETE', 'MinimalistChart', {
                    flagReset: true,
                    stateCleared: true,
                    snapshotCleared: true
                  });
                  
                  // El gráfico se reiniciará automáticamente con el próximo useEffect
                }}
              >
                <Text style={[styles.indicatorButtonText, responsiveStyles.indicatorButtonText]}>
                  {simpleCamera.isLocked() ? '📷 Reset' : '📷 Auto'}
                </Text>
              </TouchableOpacity>

              {/* Estado LIVE al final */}
              <View style={styles.liveIndicatorInline}>
                <View style={[
                  styles.liveDot,
                  { backgroundColor: isStreaming ? '#00ff88' : '#666' }
                ]} />
                <Text style={styles.liveText}>
                  {isStreaming ? 'LIVE' : 'PAUSED'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Canvas del gráfico pegado directamente */}
        <View style={styles.canvasWrapper}>
          <canvas
            ref={canvasRef}
            style={styles.chartCanvas as any}
          />
        </View>
        


        {/* Estado del gráfico en una línea minimalista debajo */}
        <View style={styles.statusBelow}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex' as any,
    flexDirection: 'column',
    overflow: 'hidden' as any,
  },
  chartContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    display: 'flex' as any,
    flexDirection: 'column',
    minHeight: 0,
    position: 'relative',
  },
  canvasWrapper: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
    minHeight: 300,
    width: '100%',
  },
  chartCanvas: {
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  controlsAboveChart: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexShrink: 0,
  },
  timeframeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as any,
    minHeight: 40,
  },
  intervalContainer: {
    flexDirection: 'row',
    flex: 1,
    minWidth: 200,
    marginRight: 8,
  },
  intervalButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginRight: 6,
  },
  intervalButtonActive: {
    backgroundColor: '#00ff88',
  },
  intervalButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  intervalButtonTextActive: {
    color: '#000',
  },
  indicatorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap' as any,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  indicatorButton: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    marginLeft: 4,
  },
  indicatorButtonActive: {
    backgroundColor: '#ff6600',
  },
  cameraResetButton: {
    backgroundColor: '#0088ff',
  },
  cameraManualButton: {
    backgroundColor: '#ff6600',
  },
  indicatorButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  liveIndicatorInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#222',
    borderRadius: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  liveText: {
    color: '#ccc',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBelow: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#666',
    fontSize: 10,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  // Estilos para el overlay de trading
  tradingOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(42, 42, 42, 0.95)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    minWidth: 200,
    zIndex: 1000,
  },
  overlayTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  overlayPrice: {
    color: '#ffffff',
    fontSize: 12,
    marginBottom: 6,
  },
  overlayTP: {
    color: '#00ff88',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  overlaySL: {
    color: '#ff4444',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  overlayCloseButton: {
    backgroundColor: '#444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'center',
  },
  overlayCloseText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '500',
  },
});

export default MinimalistChart;
