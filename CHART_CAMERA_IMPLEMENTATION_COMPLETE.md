# 📷 Chart.js Camera Control System - Implementation Complete

## 🎯 **Overview**

Este sistema implementa un control de cámara avanzado para Chart.js que mantiene la posición del usuario independientemente del live streaming, asegura que solo se muestren las últimas 900 velas, y proporciona controles intuitivos para la navegación.

## ✅ **Características Implementadas**

### 1. **Estado de Cámara Persistente**
- ✅ La cámara mantiene su posición durante actualizaciones de velas
- ✅ Estado independiente del live streaming
- ✅ Soporte para zoom manual y automático
- ✅ Bloqueo de cámara para posición fija

### 2. **Límite de 900 Velas**
- ✅ Forzado en `ChartJSFinancialChart.tsx` con `slice(-900)`
- ✅ Optimización de memoria y rendimiento
- ✅ Configuración dinámica del límite

### 3. **Controles de Cámara**
- ✅ Botón "📷 Camera" para reset a últimas velas
- ✅ Botón "🔒 Lock" para bloquear posición
- ✅ Ajuste automático después de cada actualización
- ✅ Respeta la posición manual del usuario

### 4. **Integración WebView**
- ✅ Mensajes específicos de cámara: `RESET_CAMERA`, `LOCK_CAMERA`
- ✅ Comando `ADJUST_CAMERA_AFTER_UPDATE`
- ✅ Feedback bidireccional React Native ↔ Chart.js

## 🚀 **Como Usar**

### **Importación Básica**
```tsx
import { ChartWithCameraControls } from '../components/chart/ChartWithCameraControls';

// Uso simple
<ChartWithCameraControls 
  symbol="BTCUSDT" 
  interval="1m" 
  height={500} 
/>
```

### **Control Manual de Cámara**
```tsx
import { useChartCamera } from '../hooks/useChartCamera';
import { useChartJSIntegration } from '../hooks/useChartJSIntegration';

const MyChart = () => {
  // Hook de cámara con 900 velas máximo
  const cameraControls = useChartCamera({
    candleCount: candles.length,
    onCameraChange: (camera) => {
      console.log('📷 Camera state:', camera);
    },
    onNewDataReceived: !!lastUpdate,
  });

  // Integración con Chart.js
  const { onChartAction } = useChartJSIntegration({
    candleCount: candles.length,
  });

  // Controles disponibles
  const resetCamera = () => {
    cameraControls.resetCameraToLatest(); // Estado nativo
    onChartAction('RESET_CAMERA');        // Chart.js WebView
  };

  const lockCamera = () => {
    cameraControls.lockCameraPosition();  // Estado nativo
    onChartAction('LOCK_CAMERA');         // Chart.js WebView
  };

  const setMaxCandles = (count: number) => {
    cameraControls.setMaxVisibleCandlesCount(count);
    onChartAction('SET_MAX_CANDLES', { count });
  };
};
```

### **Chart.js WebView Messaging**
```javascript
// Dentro del HTML de Chart.js
window.addEventListener('message', function(event) {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'RESET_CAMERA':
      resetCamera();
      break;
    case 'LOCK_CAMERA':
      lockCamera();
      break;
    case 'ADJUST_CAMERA_AFTER_UPDATE':
      adjustCameraAfterUpdate();
      break;
    case 'SET_MAX_CANDLES':
      // data.count contiene el número máximo
      break;
  }
});
```

## 🔧 **API Reference**

### **useChartCamera Hook**
```typescript
interface CameraState {
  zoomLevel: number;
  offsetX: number;
  offsetY: number;
  isLocked: boolean;
  followLatest: boolean;
  maxVisibleCandles: number;
  chartJsZoom: {
    min: number | null;
    max: number | null;
    centerX: number | null;
  };
}

interface CameraControls {
  camera: CameraState;
  
  // Nuevos métodos específicos para Chart.js
  setChartJsZoomState: (min: number | null, max: number | null, centerX?: number | null) => void;
  resetCameraToLatest: () => void;
  lockCameraPosition: () => void;
  setMaxVisibleCandlesCount: (count: number) => void;
  
  // Métodos tradicionales
  zoomIn: () => void;
  zoomOut: () => void;
  // ... otros métodos
}
```

### **useChartJSIntegration Hook**
```typescript
const { 
  onChartAction,     // Enviar comandos al Chart.js
  isChartReady,      // Estado de readiness
  setChartRef        // Configurar referencia WebView
} = useChartJSIntegration({
  candleCount: number,
  onCameraChange?: (camera: any) => void,
});

// Comandos disponibles
onChartAction('RESET_CAMERA');
onChartAction('LOCK_CAMERA');
onChartAction('SET_MAX_CANDLES', { count: 900 });
onChartAction('ADJUST_CAMERA_AFTER_UPDATE');
```

### **ChartJSFinancialChart Props**
```typescript
interface ChartJSFinancialChartProps {
  candles: CandleData[];           // ✅ Limitado automáticamente a 900
  symbol: string;
  isStreaming: boolean;
  lastCandle?: CandleData;
  onZoom?: (zoomLevel: number) => void;
  onPan?: (panX: number, panY: number) => void;
  onWebViewReady?: (webViewRef: any) => void;  // ✅ Para setChartRef
  height?: number;
  showVolume?: boolean;
  enableControls?: boolean;
}
```

## 🎯 **Estados de Cámara**

### **1. Following Latest** (Default)
- 📍 Sigue automáticamente las nuevas velas
- 🔄 Se ajusta después de cada actualización
- ✅ Ideal para trading en vivo

### **2. Locked Position**
- 🔒 Posición fija, no se mueve con nuevas velas
- 👤 Mantiene zoom y posición manual del usuario
- ✅ Ideal para análisis histórico

### **3. Manual Position**
- 👤 Usuario navegó manualmente
- ⏸️ Pausa auto-follow temporalmente
- 🔄 Reset disponible para volver a seguir

## 📊 **Flujo de Actualización**

```
1. Nueva vela recibida
   ↓
2. ChartJSFinancialChart.slice(-900)
   ↓
3. updateCharts(limitedData)
   ↓
4. adjustCameraAfterUpdate()
   ↓
5. Si camera.isLocked: mantener posición
   Si camera.followLatest: ir a últimas velas
   Si manual: respetar posición usuario
```

## 🐛 **Solución de Problemas**

### **Problema: Más de 900 velas se muestran**
```typescript
// Verificar en ChartJSFinancialChart.tsx línea ~55
const maxCandles = 900;
const limitedCandles = candles.length > maxCandles ? candles.slice(-maxCandles) : candles;
```

### **Problema: Cámara no respeta posición**
```typescript
// Verificar estado de cámara
console.log('Camera state:', cameraControls.camera);

// Verificar si está bloqueada
if (cameraControls.camera.isLocked) {
  // La cámara no debería moverse
}
```

### **Problema: Live stream afecta cámara**
```javascript
// En Chart.js HTML, verificar adjustCameraAfterUpdate()
function adjustCameraAfterUpdate() {
  if (cameraState.isLocked) {
    console.log('📷 Cámara bloqueada - manteniendo posición');
    return; // ✅ No actualizar si está bloqueada
  }
  // Continuar con lógica de ajuste...
}
```

## 🎮 **Controles Disponibles en UI**

| Botón | Función | Comportamiento |
|-------|---------|----------------|
| 📷 Camera | Reset a últimas velas | `resetCameraToLatest()` |
| 🔒 Lock | Bloquear posición | `lockCameraPosition()` |
| 🔓 Unlock | Desbloquear y seguir | `enableAutoFollow()` |
| 🔍+ | Zoom In | Zoom manual |
| 🔍- | Zoom Out | Zoom manual |
| 📏 Auto | Auto-fit | Ajuste automático |

## 🏆 **Ventajas del Sistema**

1. **🎯 Precisión**: Exactamente 900 velas, no más
2. **🚀 Performance**: Optimizado para live streaming
3. **👤 UX**: Respeta la intención del usuario
4. **🔄 Consistencia**: Estado predecible y confiable
5. **📱 Cross-platform**: Funciona en Web y Mobile
6. **🛠️ Extensible**: Fácil agregar nuevas características

## 🔮 **Extensiones Futuras**

- [ ] Zoom a rango específico de fechas
- [ ] Modo "Picture in Picture" para múltiples timeframes
- [ ] Historial de posiciones de cámara
- [ ] Bookmarks de posiciones importantes
- [ ] Animaciones suaves entre transiciones

---

**✅ Implementation Complete!** 

El sistema de control de cámara está completamente implementado y listo para uso en producción. Todos los requisitos han sido cumplidos:

- ✅ Estado de cámara persistente
- ✅ Límite de 900 velas forzado
- ✅ Botón reset camera
- ✅ Ajuste después de actualizaciones
- ✅ Integración WebView messaging

**📧 Para soporte o preguntas, consultar el código en:**
- `src/hooks/useChartCamera.ts`
- `src/hooks/useChartJSIntegration.ts` 
- `src/components/chart/ChartJSFinancialChart.tsx`
- `src/components/chart/ChartWithCameraControls.tsx`
