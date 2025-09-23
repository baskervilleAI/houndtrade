import { useCallback, useRef } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
} from 'react-native';
import { CameraControls } from './useChartCamera';

interface UseChartGesturesProps {
  cameraControls: CameraControls;
  onTap?: (x: number, y: number) => void;
  onDoubleTap?: (x: number, y: number) => void;
  onLongPress?: (x: number, y: number) => void;
  onInteractionStart?: () => void;  // Se llama cuando el usuario comienza a interactuar
  onInteractionEnd?: () => void;    // Se llama cuando el usuario termina de interactuar
  chartWidth: number;
  chartHeight: number;
  enabled?: boolean;
}

interface TouchState {
  startTime: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  initialDistance: number;
  initialZoom: number;
  initialOffsetX: number;
  initialOffsetY: number;
  isMultiTouch: boolean;
  lastTapTime: number;
  isInteracting: boolean;  // Nuevo: indica si el usuario está interactuando activamente
}

export const useChartGestures = ({
  cameraControls,
  onTap,
  onDoubleTap,
  onLongPress,
  onInteractionStart,
  onInteractionEnd,
  chartWidth,
  chartHeight,
  enabled = true,
}: UseChartGesturesProps) => {
  const touchState = useRef<TouchState>({
    startTime: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    initialDistance: 0,
    initialZoom: 1,
    initialOffsetX: 0,
    initialOffsetY: 0,
    isMultiTouch: false,
    lastTapTime: 0,
    isInteracting: false,
  });

  // Conectar con las funciones de cámara para manejar el estado de interacción
  const handleInteractionStart = useCallback(() => {
    cameraControls.startUserInteraction();
    onInteractionStart?.();
  }, [cameraControls, onInteractionStart]);

  const handleInteractionEnd = useCallback(() => {
    cameraControls.endUserInteraction();
    onInteractionEnd?.();
  }, [cameraControls, onInteractionEnd]);

  // Calculate distance between two touches
  const getDistance = useCallback((touches: any[]) => {
    if (touches.length < 2) return 0;
    
    const touch1 = touches[0];
    const touch2 = touches[1];
    
    const dx = touch1.pageX - touch2.pageX;
    const dy = touch1.pageY - touch2.pageY;
    
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Get center point between two touches
  const getCenterPoint = useCallback((touches: any[]) => {
    if (touches.length < 2) {
      return touches.length === 1 
        ? { x: touches[0].pageX, y: touches[0].pageY }
        : { x: 0, y: 0 };
    }
    
    const touch1 = touches[0];
    const touch2 = touches[1];
    
    return {
      x: (touch1.pageX + touch2.pageX) / 2,
      y: (touch1.pageY + touch2.pageY) / 2,
    };
  }, []);

  // Convert screen coordinates to chart coordinates
  const screenToChart = useCallback((screenX: number, screenY: number) => {
    const chartX = screenX / chartWidth;
    const chartY = screenY / chartHeight;
    
    return { x: chartX, y: chartY };
  }, [chartWidth, chartHeight]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => enabled,
    onMoveShouldSetPanResponder: () => enabled,
    onPanResponderGrant: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      const { touches } = evt.nativeEvent;
      const currentTime = Date.now();
      
      // Marcar el inicio de la interacción
      if (!touchState.current.isInteracting) {
        touchState.current.isInteracting = true;
        handleInteractionStart();
        console.log('👆 User started interacting with chart');
      }
      
      touchState.current = {
        ...touchState.current,
        startTime: currentTime,
        startX: gestureState.x0,
        startY: gestureState.y0,
        lastX: gestureState.x0,
        lastY: gestureState.y0,
        isMultiTouch: touches.length > 1,
        initialZoom: cameraControls.camera.zoomLevel,
        initialOffsetX: cameraControls.camera.offsetX,
        initialOffsetY: cameraControls.camera.offsetY,
        isInteracting: true,
      };

      if (touches.length > 1) {
        // Multi-touch: prepare for pinch-to-zoom
        touchState.current.initialDistance = getDistance(touches);
      }
    },

    onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      const { touches } = evt.nativeEvent;
      const currentTime = Date.now();
      
      if (touches.length > 1) {
        // Multi-touch: handle pinch-to-zoom
        const currentDistance = getDistance(touches);
        const centerPoint = getCenterPoint(touches);
        
        if (touchState.current.initialDistance > 0) {
          // Calculate zoom change
          const zoomRatio = currentDistance / touchState.current.initialDistance;
          const newZoom = touchState.current.initialZoom * zoomRatio;
          
          // Apply zoom constraints
          const constrainedZoom = Math.max(0.1, Math.min(20, newZoom));
          
          // Optional: adjust pan to zoom towards the center point
          const chartPoint = screenToChart(centerPoint.x, centerPoint.y);
          let newOffsetX = touchState.current.initialOffsetX;
          let newOffsetY = touchState.current.initialOffsetY;
          
          if (chartPoint.x >= 0 && chartPoint.x <= 1) {
            const panAdjustment = (chartPoint.x - 0.5) * 0.1; // Small adjustment
            newOffsetX = Math.max(0, Math.min(1, 
              touchState.current.initialOffsetX + panAdjustment
            ));
          }
          
          // Usar setTemporaryPosition para actualizaciones en tiempo real durante la interacción
          cameraControls.setTemporaryPosition(constrainedZoom, newOffsetX, newOffsetY);
        }
      } else {
        // Single touch: handle panning
        const deltaX = gestureState.dx;
        const deltaY = gestureState.dy;
        
        // Calculate pan deltas as percentage of chart size
        const panDeltaX = -deltaX / chartWidth * 0.5; // Negative for natural direction
        const panDeltaY = -deltaY / chartHeight * 0.5;
        
        // Apply new pan position
        const newOffsetX = Math.max(0, Math.min(1, 
          touchState.current.initialOffsetX + panDeltaX
        ));
        const newOffsetY = Math.max(-1, Math.min(1, 
          touchState.current.initialOffsetY + panDeltaY
        ));
        
        // Usar setTemporaryPosition para actualizaciones en tiempo real durante la interacción
        cameraControls.setTemporaryPosition(
          touchState.current.initialZoom, 
          newOffsetX, 
          newOffsetY
        );
      }
      
      touchState.current.lastX = gestureState.moveX;
      touchState.current.lastY = gestureState.moveY;
    },

    onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      const currentTime = Date.now();
      const duration = currentTime - touchState.current.startTime;
      const distance = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
      
      // Marcar el fin de la interacción
      if (touchState.current.isInteracting) {
        touchState.current.isInteracting = false;
        handleInteractionEnd();
        console.log('✋ User finished interacting with chart - locking position');
      }
      
      // Determine gesture type based on duration and distance
      if (distance < 10 && duration < 300) {
        // This was a tap
        const timeSinceLastTap = currentTime - touchState.current.lastTapTime;
        
        if (timeSinceLastTap < 300) {
          // Double tap
          const chartPoint = screenToChart(gestureState.x0, gestureState.y0);
          onDoubleTap?.(chartPoint.x, chartPoint.y);
          
          // Default double-tap behavior: zoom in/out
          if (cameraControls.camera.zoomLevel < 2) {
            cameraControls.setZoom(cameraControls.camera.zoomLevel * 2);
          } else {
            cameraControls.setZoom(1);
          }
        } else {
          // Single tap
          const chartPoint = screenToChart(gestureState.x0, gestureState.y0);
          onTap?.(chartPoint.x, chartPoint.y);
        }
        
        touchState.current.lastTapTime = currentTime;
      } else if (distance < 10 && duration >= 500) {
        // Long press
        const chartPoint = screenToChart(gestureState.x0, gestureState.y0);
        onLongPress?.(chartPoint.x, chartPoint.y);
      }
      
      // Reset multi-touch state
      touchState.current.isMultiTouch = false;
    },

    onPanResponderTerminationRequest: () => true,
    onShouldBlockNativeResponder: () => false,
  });

  // Quick gesture functions
  const simulateDoubleTap = useCallback((x: number = 0.5, y: number = 0.5) => {
    onDoubleTap?.(x, y);
    if (cameraControls.camera.zoomLevel < 2) {
      cameraControls.setZoom(cameraControls.camera.zoomLevel * 2);
    } else {
      cameraControls.setZoom(1);
    }
  }, [cameraControls, onDoubleTap]);

  const simulatePinchZoom = useCallback((zoomFactor: number, centerX: number = 0.5) => {
    const newZoom = cameraControls.camera.zoomLevel * zoomFactor;
    cameraControls.setZoom(newZoom);
    
    // Adjust pan to zoom towards the specified point
    if (centerX !== 0.5) {
      const panAdjustment = (centerX - 0.5) * 0.1;
      const newOffsetX = Math.max(0, Math.min(1, 
        cameraControls.camera.offsetX + panAdjustment
      ));
      cameraControls.setPan(newOffsetX, cameraControls.camera.offsetY);
    }
  }, [cameraControls]);

  const simulatePan = useCallback((deltaX: number, deltaY: number) => {
    const newOffsetX = Math.max(0, Math.min(1, 
      cameraControls.camera.offsetX + deltaX
    ));
    const newOffsetY = Math.max(-1, Math.min(1, 
      cameraControls.camera.offsetY + deltaY
    ));
    
    cameraControls.setPan(newOffsetX, newOffsetY);
  }, [cameraControls]);

  return {
    panHandlers: enabled ? panResponder.panHandlers : {},
    simulateDoubleTap,
    simulatePinchZoom,
    simulatePan,
    isGestureActive: touchState.current.isMultiTouch,
    isUserInteracting: () => touchState.current.isInteracting,  // Nueva función para verificar estado de interacción
  };
};
