import { useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';

interface UsePerformanceOptimizationProps {
  enabled?: boolean;
  renderThrottleMs?: number;
  interactionThrottleMs?: number;
}

interface PerformanceState {
  isInteracting: boolean;
  lastRenderTime: number;
  lastInteractionTime: number;
  renderQueue: (() => void)[];
  renderTimeoutId: NodeJS.Timeout | null;
  frameId: number | null;
}

export const usePerformanceOptimization = ({
  enabled = true,
  renderThrottleMs = 16, // ~60fps
  interactionThrottleMs = 8, // ~120fps for interactions
}: UsePerformanceOptimizationProps = {}) => {
  const performanceState = useRef<PerformanceState>({
    isInteracting: false,
    lastRenderTime: 0,
    lastInteractionTime: 0,
    renderQueue: [],
    renderTimeoutId: null,
    frameId: null,
  });

  const isWeb = Platform.select({ web: true, default: false });

  // Throttled render function
  const throttledRender = useCallback((renderFn: () => void) => {
    if (!enabled) {
      renderFn();
      return;
    }

    const now = Date.now();
    const timeSinceLastRender = now - performanceState.current.lastRenderTime;
    const throttleMs = performanceState.current.isInteracting ? interactionThrottleMs : renderThrottleMs;

    if (timeSinceLastRender >= throttleMs) {
      // Immediate render
      performanceState.current.lastRenderTime = now;
      
      if (isWeb && typeof window !== 'undefined') {
        // Cancel any pending frame
        if (performanceState.current.frameId) {
          cancelAnimationFrame(performanceState.current.frameId);
        }
        
        performanceState.current.frameId = requestAnimationFrame(() => {
          renderFn();
          performanceState.current.frameId = null;
        });
      } else {
        renderFn();
      }
    } else {
      // Throttled render - queue for later
      performanceState.current.renderQueue.push(renderFn);
      
      if (!performanceState.current.renderTimeoutId) {
        const delay = throttleMs - timeSinceLastRender;
        performanceState.current.renderTimeoutId = setTimeout(() => {
          const queue = [...performanceState.current.renderQueue];
          performanceState.current.renderQueue = [];
          performanceState.current.renderTimeoutId = null;
          performanceState.current.lastRenderTime = Date.now();
          
          if (isWeb && typeof window !== 'undefined') {
            if (performanceState.current.frameId) {
              cancelAnimationFrame(performanceState.current.frameId);
            }
            
            performanceState.current.frameId = requestAnimationFrame(() => {
              // Execute all queued renders in one frame
              queue.forEach(fn => fn());
              performanceState.current.frameId = null;
            });
          } else {
            queue.forEach(fn => fn());
          }
        }, delay);
      }
    }
  }, [enabled, renderThrottleMs, interactionThrottleMs, isWeb]);

  // Optimized interaction handler
  const throttledInteraction = useCallback((interactionFn: () => void) => {
    if (!enabled) {
      interactionFn();
      return;
    }

    const now = Date.now();
    const timeSinceLastInteraction = now - performanceState.current.lastInteractionTime;

    if (timeSinceLastInteraction >= interactionThrottleMs) {
      performanceState.current.lastInteractionTime = now;
      performanceState.current.isInteracting = true;
      
      interactionFn();
      
      // Auto-reset interaction state after a delay
      setTimeout(() => {
        performanceState.current.isInteracting = false;
      }, 100);
    }
  }, [enabled, interactionThrottleMs]);

  // Debounced function for expensive operations
  const debounced = useCallback((fn: () => void, delay: number = 300) => {
    if (!enabled) {
      fn();
      return;
    }

    const debounceId = setTimeout(fn, delay);
    return () => clearTimeout(debounceId);
  }, [enabled]);

  // Optimized batch update function
  const batchUpdate = useCallback((updates: (() => void)[]) => {
    if (!enabled) {
      updates.forEach(fn => fn());
      return;
    }

    if (isWeb && typeof window !== 'undefined') {
      if (performanceState.current.frameId) {
        cancelAnimationFrame(performanceState.current.frameId);
      }
      
      performanceState.current.frameId = requestAnimationFrame(() => {
        updates.forEach(fn => fn());
        performanceState.current.frameId = null;
      });
    } else {
      // Batch updates in next tick for React Native
      setTimeout(() => {
        updates.forEach(fn => fn());
      }, 0);
    }
  }, [enabled, isWeb]);

  // Performance monitoring
  const measurePerformance = useCallback(<T extends any[], R>(
    fn: (...args: T) => R,
    label?: string
  ) => {
    return (...args: T): R => {
      if (!enabled || !isWeb) {
        return fn(...args);
      }

      const startTime = performance.now();
      const result = fn(...args);
      const endTime = performance.now();
      
      if (label && (endTime - startTime) > 5) { // Log if operation takes more than 5ms
        console.log(`[Performance] ${label}: ${(endTime - startTime).toFixed(2)}ms`);
      }
      
      return result;
    };
  }, [enabled, isWeb]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (performanceState.current.renderTimeoutId) {
        clearTimeout(performanceState.current.renderTimeoutId);
      }
      if (performanceState.current.frameId) {
        if (isWeb && typeof window !== 'undefined') {
          cancelAnimationFrame(performanceState.current.frameId);
        }
      }
      performanceState.current.renderQueue = [];
    };
  }, [isWeb]);

  // Memory optimization for large datasets
  const optimizeMemory = useCallback(<T>(
    data: T[],
    windowSize: number = 1000,
    currentIndex: number = 0
  ): T[] => {
    if (!enabled || data.length <= windowSize) {
      return data;
    }

    // Keep a sliding window of data around the current position
    const halfWindow = Math.floor(windowSize / 2);
    const start = Math.max(0, currentIndex - halfWindow);
    const end = Math.min(data.length, currentIndex + halfWindow);
    
    return data.slice(start, end);
  }, [enabled]);

  return {
    throttledRender,
    throttledInteraction,
    debounced,
    batchUpdate,
    measurePerformance,
    optimizeMemory,
    isInteracting: performanceState.current.isInteracting,
    isEnabled: enabled,
  };
};

export default usePerformanceOptimization;
