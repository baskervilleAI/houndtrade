# Implementación de Configuración de Cámara y Historial de 1000 Velas

## 📊 Resumen de Cambios

Se han implementado las siguientes mejoras para optimizar la experiencia del usuario:

### 1. Historial de 1000 Velas
- **Antes**: Los servicios mantenían entre 100-200 velas
- **Ahora**: Todos los servicios mantienen 1000 velas históricas
- **Beneficio**: Mejor análisis técnico y visualización histórica

### 2. Sistema de Configuración de Cámara Persistente
- **Lock/Unlock de Cámara**: Preserva zoom y posición durante streaming
- **Auto-Follow Inteligente**: Sigue nuevas velas solo cuando el usuario lo desea
- **Estado Manual vs Automático**: Distingue entre acciones del usuario y del sistema

## 🔧 Archivos Modificados

### `src/services/liveStreamingService.ts`
```typescript
// Cambios principales:
- getHistoricalDataUrl(): limit por defecto = 1000
- loadHistoricalData(): limit por defecto = 1000
- Buffer mantiene 1000 velas en memoria
```

### `src/hooks/useChartCamera.ts`
```typescript
// Nuevas funcionalidades:
export interface CameraState {
  // ... propiedades existentes
  isLocked: boolean;          // Estado de bloqueo de cámara
  manuallyAdjusted: boolean;  // Detecta ajustes manuales
}

export interface CameraControls {
  // ... controles existentes
  
  // Controles de bloqueo de cámara
  lockCamera: () => void;
  unlockCamera: () => void;
  toggleLock: () => void;
  isLocked: () => boolean;
  
  // Controles de auto-seguimiento
  enableAutoFollow: () => void;
  disableAutoFollow: () => void;
  isAutoFollowing: () => boolean;
}
```

### `src/context/ChartContext.tsx`
```typescript
// Cambios principales:
- ADD_NEW_CANDLE: mantiene 1000 velas (antes 200)
- generateMockCandles: genera 1000 velas por defecto
- loadCandles: carga 1000 velas históricas
```

### `src/hooks/useLiveChart.ts`
```typescript
// Cambios principales:
- maxCandles por defecto = 1000 (antes 100)
```

## 🎮 Cómo Usar el Sistema de Cámara

### Ejemplo de Implementación

```typescript
import { useChartCamera } from '../hooks/useChartCamera';

const ChartComponent = ({ candleData }) => {
  const cameraControls = useChartCamera({
    candleCount: candleData.length,
    chartWidth: 800,
    chartHeight: 400,
    onNewDataReceived: true, // Señal de nuevos datos
    onCameraChange: (camera) => {
      console.log('Camera state:', camera);
    }
  });

  // Controles de usuario
  const handleLockToggle = () => {
    cameraControls.toggleLock();
  };

  const handleAutoFollowToggle = () => {
    if (cameraControls.isAutoFollowing()) {
      cameraControls.disableAutoFollow();
    } else {
      cameraControls.enableAutoFollow();
    }
  };

  return (
    <div>
      {/* Controles de cámara */}
      <div className="camera-controls">
        <button onClick={handleLockToggle}>
          {cameraControls.isLocked() ? '🔒 Locked' : '🔓 Unlocked'}
        </button>
        
        <button onClick={handleAutoFollowToggle}>
          {cameraControls.isAutoFollowing() ? '📈 Following' : '📌 Fixed'}
        </button>
        
        <button onClick={cameraControls.zoomIn}>🔍+</button>
        <button onClick={cameraControls.zoomOut}>🔍-</button>
        <button onClick={cameraControls.fitAll}>🔄 Fit All</button>
      </div>

      {/* Chart rendering aquí */}
      <ChartView 
        data={candleData}
        camera={cameraControls.camera}
        // ... otras props
      />
    </div>
  );
};
```

## 🚀 Comportamiento del Sistema

### Estados de la Cámara

1. **Modo Auto-Follow (Por Defecto)**
   - `isLocked: false`
   - `autoFollow: true`
   - `manuallyAdjusted: false`
   - **Comportamiento**: Sigue automáticamente nuevas velas

2. **Modo Manual**
   - `isLocked: false`
   - `autoFollow: false`
   - `manuallyAdjusted: true`
   - **Comportamiento**: Usuario controla la vista, no sigue nuevas velas

3. **Modo Bloqueado**
   - `isLocked: true`
   - **Comportamiento**: Streaming no afecta la vista para nada

### Transiciones de Estado

```
Auto-Follow → Manual: Usuario hace zoom/pan/navigate
Manual → Auto-Follow: Usuario presiona "enableAutoFollow()"
Cualquier Estado → Locked: Usuario presiona "lockCamera()"
Locked → Previo Estado: Usuario presiona "unlockCamera()"
```

## 📈 Beneficios

### Para el Usuario
- **Control Total**: Puede bloquear la vista para análisis detallado
- **Seguimiento Inteligente**: Auto-follow solo cuando lo desea
- **Más Datos**: 1000 velas de historial para mejor análisis
- **Rendimiento**: Sistema optimizado que no afecta la UX

### Para el Desarrollador
- **API Clara**: Interfaz simple y intuitiva
- **Estado Predecible**: Comportamiento consistente
- **Extensible**: Fácil agregar nuevas funcionalidades
- **Type-Safe**: Completamente tipado con TypeScript

## 🔄 Flujo de Datos

```
Nueva Vela → LiveStreamingService → ChartContext → ChartComponent
                                                       ↓
                                              useChartCamera evalúa:
                                              - ¿Está locked?
                                              - ¿Auto-follow habilitado?
                                              - ¿Manualmente ajustado?
                                                       ↓
                                              Decide si actualizar vista
```

## ⚙️ Configuración Recomendada

```typescript
// Para trading activo (seguir el precio)
const tradingConfig = {
  autoFollow: true,
  lockCamera: false,
  defaultZoom: 1.5
};

// Para análisis técnico (vista fija)
const analysisConfig = {
  autoFollow: false,
  lockCamera: true,
  defaultZoom: 2.0
};

// Para overview general
const overviewConfig = {
  autoFollow: true,
  lockCamera: false,
  defaultZoom: 0.8
};
```

## 🐛 Debugging

Para debuggear el comportamiento de la cámara, revisa los logs de consola:

```
📷 Camera locked - streaming updates will not affect view
📷 Camera unlocked - will follow live data
📈 Auto-follow enabled - will track new data
📈 Auto-follow disabled - staying at current position
📈 Auto-following new data - staying at end
```

## 🎯 Próximos Pasos

1. **Persistencia**: Guardar configuración en localStorage
2. **Presets**: Configuraciones predefinidas para diferentes usos
3. **Gestos**: Soporte para gestos táctiles en móvil
4. **Animaciones**: Transiciones suaves entre estados
5. **Configuración Avanzada**: Más opciones de personalización
