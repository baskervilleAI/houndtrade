import { useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';

interface UseWebGesturesProps {
  onZoom?: (factor: number, centerX?: number, centerY?: number) => void;
  onPan?: (deltaX: number, deltaY: number) => void;
  onDoubleClick?: (x: number, y: number) => void;
  onRightClick?: (x: number, y: number) => void;
  enabled?: boolean;
  zoomSensitivity?: number;
  panSensitivity?: number;
}

interface GestureState {
  isDragging: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastClickTime: number;
}

export const useWebGestures = ({
  onZoom,
  onPan,
  onDoubleClick,
  onRightClick,
  enabled = true,
  zoomSensitivity = 0.1,
  panSensitivity = 1.0,
}: UseWebGesturesProps) => {
  const gestureState = useRef<GestureState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastClickTime: 0,
  });

  const isWeb = Platform.select({ web: true, default: false });

  // Mouse wheel handler for zoom and pan
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!enabled || !onZoom || !onPan) return;
    
    event.preventDefault();
    event.stopPropagation();

    const { deltaY, deltaX, ctrlKey, metaKey, shiftKey } = event;
    
    // Get mouse position relative to the element
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = (event.clientX - rect.left) / rect.width;
    const centerY = (event.clientY - rect.top) / rect.height;

    if (ctrlKey || metaKey) {
      // Zoom with Ctrl/Cmd + scroll
      const zoomFactor = 1 + (deltaY > 0 ? -zoomSensitivity : zoomSensitivity);
      onZoom(zoomFactor, centerX, centerY);
    } else if (shiftKey) {
      // Horizontal pan with Shift + scroll
      const panDeltaX = deltaY * panSensitivity * 0.01;
      onPan(panDeltaX, 0);
    } else {
      // Normal pan with scroll
      const panDeltaX = deltaX * panSensitivity * 0.01;
      const panDeltaY = deltaY * panSensitivity * 0.01;
      onPan(panDeltaX, panDeltaY);
    }
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

  // Mouse move handler
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!enabled || !gestureState.current.isDragging || !onPan) return;

    event.preventDefault();

    const deltaX = event.clientX - gestureState.current.lastX;
    const deltaY = event.clientY - gestureState.current.lastY;

    // Apply pan with sensitivity
    const panDeltaX = -deltaX * panSensitivity * 0.01; // Negative for natural direction
    const panDeltaY = deltaY * panSensitivity * 0.01;

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

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!enabled || !gestureState.current.isDragging || event.touches.length !== 1 || !onPan) return;

    event.preventDefault();

    const touch = event.touches[0];
    const deltaX = touch.clientX - gestureState.current.lastX;
    const deltaY = touch.clientY - gestureState.current.lastY;

    // Apply pan with sensitivity
    const panDeltaX = -deltaX * panSensitivity * 0.01;
    const panDeltaY = deltaY * panSensitivity * 0.01;

    onPan(panDeltaX, panDeltaY);

    gestureState.current.lastX = touch.clientX;
    gestureState.current.lastY = touch.clientY;
  }, [enabled, onPan, panSensitivity]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!enabled) return;

    gestureState.current.isDragging = false;
  }, [enabled]);

  // Attach/detach event listeners
  const attachGestures = useCallback((element: HTMLElement) => {
    if (!isWeb || !element) return () => {};

    // Set initial cursor
    element.style.cursor = 'grab';
    element.style.userSelect = 'none';
    element.style.touchAction = 'none';

    // Mouse events
    element.addEventListener('wheel', handleWheel, { passive: false });
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('contextmenu', handleContextMenu);
    
    // Touch events
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    // Global mouse events for proper drag handling
    const globalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const globalMouseUp = (e: MouseEvent) => handleMouseUp(e);
    
    document.addEventListener('mousemove', globalMouseMove);
    document.addEventListener('mouseup', globalMouseUp);

    return () => {
      // Mouse events
      element.removeEventListener('wheel', handleWheel);
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('contextmenu', handleContextMenu);
      
      // Touch events
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);

      // Global events
      document.removeEventListener('mousemove', globalMouseMove);
      document.removeEventListener('mouseup', globalMouseUp);

      // Reset styles
      element.style.cursor = '';
      element.style.userSelect = '';
      element.style.touchAction = '';
    };
  }, [
    isWeb,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
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
