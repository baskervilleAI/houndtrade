import { useState, useCallback, useRef, useMemo, useEffect } from 'react';

export interface SimpleCameraState {
  isLocked: boolean;
  lastUserAction: number | null;
  chartJsState: {
    min: number | null;
    max: number | null;
    centerX: number | null;
  };
}

export interface SimpleCameraControls {
  state: SimpleCameraState;
  isLocked: () => boolean;
  getCurrentState: () => SimpleCameraState; // Add this for immediate state access
  onUserStartInteraction: () => void;
  onUserEndInteraction: () => void;
  onUserZoom: (min: number, max: number, centerX: number) => void;
  onUserPan: (min: number, max: number, centerX: number) => void;
  resetToLatest: () => void;
  getRecommendedViewport: (totalCandles: number, candleData?: any[]) => { min?: number; max?: number };
}

interface UseSimpleCameraProps {
  defaultVisibleCandles?: number;
  onStateChange?: (state: SimpleCameraState) => void;
}

export const useSimpleCamera = ({
  defaultVisibleCandles = 100,
  onStateChange
}: UseSimpleCameraProps = {}): SimpleCameraControls => {
  
  const [state, setState] = useState<SimpleCameraState>({
    isLocked: false,
    lastUserAction: null,
    chartJsState: {
      min: null,
      max: null,
      centerX: null,
    }
  });

  // Use a ref to maintain current state accessible from callbacks
  const stateRef = useRef(state);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update ref whenever state changes
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Check if camera is locked (user has interacted) - use ref for immediate access
  const isLocked = useCallback(() => {
    const currentState = stateRef.current;
    console.log('📷 [SimpleCamera] isLocked check:', { 
      stateIsLocked: currentState.isLocked, 
      hasViewport: currentState.chartJsState.min !== null && currentState.chartJsState.max !== null,
      lastUserAction: currentState.lastUserAction ? new Date(currentState.lastUserAction).toLocaleTimeString() : null
    });
    return currentState.isLocked;
  }, []); // No dependencies - always uses current ref

  // Get current state immediately
  const getCurrentState = useCallback(() => {
    return stateRef.current;
  }, []);

  // Start user interaction
  const onUserStartInteraction = useCallback(() => {
    console.log('📷 [SimpleCamera] User started interaction');
    setState(prev => ({
      ...prev,
      isLocked: true,
      lastUserAction: Date.now()
    }));
    
    // Clear any existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
  }, []);

  // End user interaction (with slight delay to capture final state)
  const onUserEndInteraction = useCallback(() => {
    console.log('📷 [SimpleCamera] User ended interaction');
    // Small delay to ensure we capture the final state
    interactionTimeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        lastUserAction: Date.now()
      }));
    }, 50);
  }, []);

  // Handle user zoom
  const onUserZoom = useCallback((min: number, max: number, centerX: number) => {
    console.log('📷 [SimpleCamera] User zoom:', { min, max, centerX });
    setState(prev => {
      const newState = {
        ...prev,
        isLocked: true,
        lastUserAction: Date.now(),
        chartJsState: {
          min,
          max,
          centerX
        }
      };
      
      if (onStateChange) {
        onStateChange(newState);
      }
      
      return newState;
    });
  }, [onStateChange]);

  // Handle user pan
  const onUserPan = useCallback((min: number, max: number, centerX: number) => {
    console.log('📷 [SimpleCamera] User pan:', { min, max, centerX });
    setState(prev => {
      const newState = {
        ...prev,
        isLocked: true,
        lastUserAction: Date.now(),
        chartJsState: {
          min,
          max,
          centerX
        }
      };
      
      if (onStateChange) {
        onStateChange(newState);
      }
      
      return newState;
    });
  }, [onStateChange]);

  // Reset to latest candles
  const resetToLatest = useCallback(() => {
    console.log('📷 [SimpleCamera] Reset to latest');
    setState(prev => {
      const newState = {
        ...prev,
        isLocked: false,
        lastUserAction: null,
        chartJsState: {
          min: null,
          max: null,
          centerX: null
        }
      };
      
      if (onStateChange) {
        onStateChange(newState);
      }
      
      return newState;
    });
  }, [onStateChange]);

  // Get recommended viewport for initial setup
  const getRecommendedViewport = useCallback((totalCandles: number, candleData?: any[]) => {
    if (!candleData || candleData.length === 0) {
      return { min: undefined, max: undefined };
    }

    // Show last defaultVisibleCandles candles
    const visibleCandles = Math.min(defaultVisibleCandles, candleData.length);
    const startIndex = Math.max(0, candleData.length - visibleCandles);
    const endIndex = candleData.length - 1;

    if (startIndex >= candleData.length || endIndex >= candleData.length) {
      return { min: undefined, max: undefined };
    }

    const minTimestamp = candleData[startIndex]?.x;
    const maxTimestamp = candleData[endIndex]?.x;

    if (minTimestamp === undefined || maxTimestamp === undefined) {
      return { min: undefined, max: undefined };
    }

    // Add some padding
    const timeRange = maxTimestamp - minTimestamp;
    const padding = timeRange * 0.05; // 5% padding

    return {
      min: minTimestamp - padding,
      max: maxTimestamp + padding
    };
  }, [defaultVisibleCandles]);

    // Memoize the return object to prevent unnecessary re-creations
  const controls = useMemo(() => ({
    state,
    isLocked,
    getCurrentState,
    onUserStartInteraction,
    onUserEndInteraction,
    onUserZoom,
    onUserPan,
    resetToLatest,
    getRecommendedViewport
  }), [state, isLocked, getCurrentState, onUserStartInteraction, onUserEndInteraction, onUserZoom, onUserPan, resetToLatest, getRecommendedViewport]);

  return controls;
};
