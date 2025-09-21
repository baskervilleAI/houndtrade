import { useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';

interface UseWebGesturesProps {
  onZoom?: (factor: number, centerX?: number, centerY?: number) => void;
  onPan?: (deltaX: number, deltaY: number) => void;
  onDoubleClick?: (x: number, y: number) => void;
  onRightClick?: (x: number, y: number) => void;
  onKeyboard?: (key: string, ctrlKey: boolean, shiftKey: boolean, altKey: boolean) => void;
  enabled?: boolean;
  zoomSensitivity?: number;
  panSensitivity?: number;
  enableKeyboard?: boolean;
}

interface GestureState {
  isDragging: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastClickTime: number;
  wheelThrottle: number;
  animationFrame: number | null;
}

export const useWebGestures = ({
  onZoom,
  onPan,
  onDoubleClick,
  onRightClick,
  onKeyboard,
  enabled = true,
  zoomSensitivity = 0.1,
  panSensitivity = 1.0,
  enableKeyboard = true,
}: UseWebGesturesProps) => {
  const gestureState = useRef<GestureState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastClickTime: 0,
    wheelThrottle: 0,
    animationFrame: null,
  });

  const isWeb = Platform.select({ web: true, default: false });

  // Enhanced mouse wheel handler with throttling and smooth zoom
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!enabled || (!onZoom && !onPan)) return;
    
    event.preventDefault();
    event.stopPropagation();

    // Throttle wheel events for better performance
    const now = Date.now();
    if (now - gestureState.current.wheelThrottle < 16) return; // ~60fps
    gestureState.current.wheelThrottle = now;

    const { deltaY, deltaX, ctrlKey, metaKey, shiftKey } = event;
    
    // Get mouse position relative to the element
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = (event.clientX - rect.left) / rect.width;
    const centerY = (event.clientY - rect.top) / rect.height;

    // Cancel any pending animation frame
    if (gestureState.current.animationFrame) {
      cancelAnimationFrame(gestureState.current.animationFrame);
    }

    // Use requestAnimationFrame for smooth updates
    gestureState.current.animationFrame = requestAnimationFrame(() => {
      if (ctrlKey || metaKey) {
        // Enhanced zoom with better scaling
        if (onZoom) {
          const normalizedDelta = Math.max(-1, Math.min(1, deltaY / 100));
          const zoomFactor = Math.pow(1.1, -normalizedDelta * (zoomSensitivity * 10));
          onZoom(zoomFactor, centerX, centerY);
        }
      } else if (shiftKey) {
        // Horizontal pan with Shift + scroll
        if (onPan) {
          const panDeltaX = (deltaY * panSensitivity * 0.005);
          onPan(panDeltaX, 0);
        }
      } else {
        // Natural scrolling with improved sensitivity
        if (onPan) {
          const panDeltaX = (deltaX * panSensitivity * 0.003);
          const panDeltaY = -(deltaY * panSensitivity * 0.001); // Negative for natural vertical scrolling
          onPan(panDeltaX, panDeltaY);
        }
      }
      gestureState.current.animationFrame = null;
    });
  }, [enabled, onZoom, onPan, zoomSensitivity, panSensitivity]);

  // Mouse down handler
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!enabled) return;

    event.preventDefault();
    
    gestureState.current = {
      ...gestureState.current,
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
    };

    // Change cursor to grabbing
    const element = event.currentTarget as HTMLElement;
    element.style.cursor = 'grabbing';
  }, [enabled]);

  // Enhanced mouse move with smoother panning
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!enabled || !gestureState.current.isDragging || !onPan) return;

    event.preventDefault();

    const deltaX = event.clientX - gestureState.current.lastX;
    const deltaY = event.clientY - gestureState.current.lastY;

    // Apply momentum-based panning with improved sensitivity
    const panDeltaX = -deltaX * panSensitivity * 0.005; // Reduced for smoother movement
    const panDeltaY = deltaY * panSensitivity * 0.002; // Reduced vertical sensitivity

    onPan(panDeltaX, panDeltaY);

    gestureState.current.lastX = event.clientX;
    gestureState.current.lastY = event.clientY;
  }, [enabled, onPan, panSensitivity]);

  // Mouse up handler
  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!enabled) return;

    const wasDragging = gestureState.current.isDragging;
    gestureState.current.isDragging = false;

    // Restore cursor
    const element = event.currentTarget as HTMLElement;
    element.style.cursor = 'grab';

    // Check for click vs drag
    if (!wasDragging || (
      Math.abs(event.clientX - gestureState.current.startX) < 5 &&
      Math.abs(event.clientY - gestureState.current.startY) < 5
    )) {
      // This was a click, check for double click
      const now = Date.now();
      const timeSinceLastClick = now - gestureState.current.lastClickTime;
      
      if (timeSinceLastClick < 300 && onDoubleClick) {
        // Double click
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        onDoubleClick(x, y);
      }
      
      gestureState.current.lastClickTime = now;
    }
  }, [enabled, onDoubleClick]);

  // Context menu handler (right click)
  const handleContextMenu = useCallback((event: MouseEvent) => {
    if (!enabled || !onRightClick) return;

    event.preventDefault();
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    
    onRightClick(x, y);
  }, [enabled, onRightClick]);

  // Touch handlers for mobile compatibility
  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!enabled || event.touches.length !== 1) return;

    event.preventDefault();
    
    const touch = event.touches[0];
    gestureState.current = {
      ...gestureState.current,
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
    };
  }, [enabled]);

  // Enhanced touch move with improved sensitivity
  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!enabled || !gestureState.current.isDragging || event.touches.length !== 1 || !onPan) return;

    event.preventDefault();

    const touch = event.touches[0];
    const deltaX = touch.clientX - gestureState.current.lastX;
    const deltaY = touch.clientY - gestureState.current.lastY;

    // Apply pan with optimized sensitivity for touch
    const panDeltaX = -deltaX * panSensitivity * 0.003; // Slightly reduced for touch
    const panDeltaY = deltaY * panSensitivity * 0.001;

    onPan(panDeltaX, panDeltaY);

    gestureState.current.lastX = touch.clientX;
    gestureState.current.lastY = touch.clientY;
  }, [enabled, onPan, panSensitivity]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!enabled) return;

    gestureState.current.isDragging = false;
  }, [enabled]);

  // Keyboard handler for shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled || !enableKeyboard || !onKeyboard) return;

    // Don't interfere with form inputs
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    const { key, ctrlKey, shiftKey, altKey } = event;
    
    // Handle specific keys
    const handledKeys = [
      '+', '=', '-', '_', 'r', 'R', 'End', 'Home', 'ArrowLeft', 'ArrowRight', 
      'ArrowUp', 'ArrowDown', ' ', 'Escape'
    ];

    if (handledKeys.includes(key) || (ctrlKey && ['0', '1', '2', '3', '4', '5'].includes(key))) {
      event.preventDefault();
      onKeyboard(key, ctrlKey, shiftKey, altKey);
    }
  }, [enabled, enableKeyboard, onKeyboard]);

  // Enhanced attach/detach event listeners with keyboard support
  const attachGestures = useCallback((element: HTMLElement) => {
    if (!isWeb || !element) return () => {};

    // Set initial cursor and styles
    element.style.cursor = 'grab';
    element.style.userSelect = 'none';
    element.style.touchAction = 'none';
    element.tabIndex = 0; // Make element focusable for keyboard events

    // Mouse events
    element.addEventListener('wheel', handleWheel, { passive: false });
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('contextmenu', handleContextMenu);
    
    // Touch events
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    // Keyboard events
    if (enableKeyboard) {
      element.addEventListener('keydown', handleKeyDown);
      // Focus element on click to enable keyboard
      const focusHandler = () => element.focus();
      element.addEventListener('mousedown', focusHandler);
    }

    // Global mouse events for proper drag handling
    const globalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const globalMouseUp = (e: MouseEvent) => handleMouseUp(e);
    
    document.addEventListener('mousemove', globalMouseMove);
    document.addEventListener('mouseup', globalMouseUp);

    // Cleanup function
    return () => {
      // Cancel any pending animation frame
      if (gestureState.current.animationFrame) {
        cancelAnimationFrame(gestureState.current.animationFrame);
        gestureState.current.animationFrame = null;
      }

      // Mouse events
      element.removeEventListener('wheel', handleWheel);
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('contextmenu', handleContextMenu);
      
      // Touch events
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);

      // Keyboard events
      if (enableKeyboard) {
        element.removeEventListener('keydown', handleKeyDown);
      }

      // Global events
      document.removeEventListener('mousemove', globalMouseMove);
      document.removeEventListener('mouseup', globalMouseUp);

      // Reset styles
      element.style.cursor = '';
      element.style.userSelect = '';
      element.style.touchAction = '';
      element.tabIndex = -1;
    };
  }, [
    isWeb,
    enableKeyboard,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleKeyDown,
  ]);

  // Programmatic gestures
  const simulateZoom = useCallback((factor: number, centerX?: number, centerY?: number) => {
    if (onZoom) {
      onZoom(factor, centerX, centerY);
    }
  }, [onZoom]);

  const simulatePan = useCallback((deltaX: number, deltaY: number) => {
    if (onPan) {
      onPan(deltaX, deltaY);
    }
  }, [onPan]);

  const simulateDoubleClick = useCallback((x?: number, y?: number) => {
    if (onDoubleClick) {
      onDoubleClick(x ?? 0.5, y ?? 0.5);
    }
  }, [onDoubleClick]);

  return {
    attachGestures,
    simulateZoom,
    simulatePan,
    simulateDoubleClick,
    isDragging: gestureState.current.isDragging,
    isWebSupported: isWeb,
  };
};

export default useWebGestures;
