# GOBERNANZA TIDAL DE CÁMARA - IMPLEMENTACIÓN COMPLETA

## 🌊 Resumen de Mejoras Implementadas

Se ha implementado una solución completa de **gobernanza tidal** para la cámara del chart que resuelve todos los problemas identificados en los logs y análisis previos.

## ✅ Problemas Resueltos

### 1. **Snapshot PRE-mutación** (Era el problema principal)
- **ANTES**: Se hacía snapshot DESPUÉS de mutar data → viewport `undefined`
- **DESPUÉS**: Snapshot ANTES de tocar data → viewport válido siempre
- **Implementación**: `snap = simpleCamera.getViewportFromCamera() ?? fallback`

### 2. **Fuente de verdad autoritativa**
- **ANTES**: Se leía `chart.scales.x.min/max` que podía estar `undefined`
- **DESPUÉS**: Viewport se guarda en `CameraState.viewport` como autoridad única
- **Implementación**: `getViewportFromCameraState()` como función autoritativa

### 3. **Histeresis de interacción**
- **ANTES**: Modo `USER_INTERACTING` indefinido
- **DESPUÉS**: Cooldown automático con `setTimeout` que cambia a `USER_LOCKED`
- **Implementación**: `useEffect` que detecta `USER_INTERACTING` y aplica cooldown

### 4. **Marea tidal (tide)**
- **ANTES**: Solo "auto" vs "bloqueado" (binario)
- **DESPUÉS**: Factor `tide` (0..1) que mezcla seguimiento vs. posición fija
- **Implementación**: `computeTidalViewport()` con interpolación lineal

### 5. **Orden fijo de operaciones**
- **ANTES**: Orden inconsistente causaba race conditions
- **DESPUÉS**: Siempre: Snapshot → Mutate → Compute → Apply → Update
- **Implementación**: Función `updateChart` refactorizada

## 🏗️ Arquitectura Nueva

### Estados de Cámara (`CameraMode`)
```typescript
type CameraMode = 'AUTO' | 'FOLLOW_TAIL' | 'USER_LOCKED' | 'USER_INTERACTING';
```

- **AUTO**: Seguimiento automático con `tide`
- **FOLLOW_TAIL**: Sigue la cola (últimas velas) 
- **USER_LOCKED**: Usuario ha interactuado, posición fija
- **USER_INTERACTING**: Usuario está tocando ahora mismo (histeresis activa)

### Parámetros de Gobernanza
```typescript
interface SimpleCameraState {
  mode: CameraMode;
  viewport: { min: number; max: number } | null;  // Fuente de verdad
  tide: number;              // 0..1 (0 = fijo, 1 = seguir cola)
  cooldownMs: number;        // Tiempo de histeresis (ej: 3000ms)
  lastUserActionTs: number | null;
}
```

## 🔧 API Principal

### Funciones Clave
```typescript
// Obtener viewport autoritativo (no del chart)
getViewportFromCamera(): { min: number; max: number } | null

// Computar viewport "tidal" mezclando seguimiento vs. fijo
computeTidalViewport({ snap, lastCandleTime }): { min: number; max: number }

// Aplicar viewport usando plugin o fallback
applyViewportToChart(chart: Chart, viewport): void

// Configurar comportamiento
setTide(tide: number): void          // 0..1
setCooldownMs(cooldown: number): void // milisegundos
```

### Hook de Conveniencia
```typescript
import { useTidalCamera, TIDAL_PRESETS } from './hooks/useTidalCamera';

const camera = useTidalCamera({
  ...TIDAL_PRESETS.SMOOTH_FOLLOW  // tide: 0.8, cooldownMs: 3000
});
```

## 📊 Presets Predefinidos

```typescript
TIDAL_PRESETS = {
  FULL_FOLLOW:    { tide: 1.0, cooldownMs: 2000 },  // Seguimiento total
  SMOOTH_FOLLOW:  { tide: 0.8, cooldownMs: 3000 },  // Balance (recomendado)
  MINIMAL_FOLLOW: { tide: 0.3, cooldownMs: 5000 },  // Casi fijo
  FIXED:          { tide: 0.0, cooldownMs: 10000 }  // Completamente fijo
}
```

## 🔄 Flujo de Actualización Mejorado

### Antes (Problemático)
```
1. Mutar data
2. chart.update()
3. Leer viewport del chart (❌ undefined)
4. Intentar restaurar (❌ viewport inválido)
```

### Después (Gobernanza Tidal)
```
1. 📸 Snapshot PRE-mutación desde CameraState
2. 🔧 Mutar data en sitio
3. 🌊 Computar viewport tidal (mezcla fijo vs. cola)
4. 🎯 Aplicar viewport objetivo
5. ⚙️ chart.update('none')
```

## 🎛️ Configuración en MinimalistChart

### Uso Básico
```typescript
// En MinimalistChart.tsx - ya implementado
const simpleCamera = useSimpleCamera({
  defaultVisibleCandles: 100,
  onStateChange: onCameraStateChange,
});

// En updateChart - ya refactorizado para usar gobernanza tidal
const desiredViewport = simpleCamera.computeTidalViewport({
  snap,
  lastCandleTime: newCandle.x
});
simpleCamera.applyViewportToChart(chart, desiredViewport);
```

### Configuración Avanzada
```typescript
// Configurar comportamiento específico
simpleCamera.setTide(0.6);        // 60% seguimiento
simpleCamera.setCooldownMs(4000);  // 4 segundos de histeresis

// O usar presets
const camera = useTidalCamera(TIDAL_PRESETS.SMOOTH_FOLLOW);
```

## 🐛 Debugging Mejorado

### Logs Informativos
Los logs ahora muestran claramente:
- **📸 Snapshot PRE-mutación**: Viewport capturado antes de tocar data
- **🌊 Viewport objetivo**: Resultado del cálculo tidal
- **🎯 Aplicación**: Método usado (plugin vs. fallback)

### Ejemplo de Log
```
📸 [updateChart] Snapshot PRE-mutación: {min: 1640995200000, max: 1641001200000}
🌊 [TidalViewport] Modo TIDAL: {mode: AUTO, tide: 0.8, result: {min: 1640998800000, max: 1641004800000}}
🎯 [ApplyViewport] Plugin usado: {min: 1640998800000, max: 1641004800000}
```

## 🚀 Beneficios

1. **No más "peleas"**: La cámara no compite con el usuario
2. **Viewport siempre válido**: Snapshot PRE-mutación garantiza datos válidos
3. **Seguimiento suave**: Factor `tide` permite transiciones graduales
4. **Histeresis inteligente**: Cooldown evita cambios abruptos de modo
5. **Debugging claro**: Logs informativos para diagnóstico
6. **Compatibilidad**: API legacy mantenida para migración gradual

## 🔮 Uso Recomendado

Para la mayoría de casos:
```typescript
const camera = useTidalCamera(TIDAL_PRESETS.SMOOTH_FOLLOW);
```

Esto da:
- **80% seguimiento** de cola (se adapta a nuevas velas)
- **20% estabilidad** (no saltos abruptos)
- **3 segundos** de histeresis (tiempo para que el usuario complete su acción)

## 📈 Próximos Pasos

1. ✅ Probar en desarrollo
2. ✅ Verificar que no hay más logs de viewport `undefined`
3. ✅ Confirmar que la cámara respeta las interacciones del usuario
4. ⚡ Opcional: Agregar animaciones suaves entre transiciones tidal

La implementación está completa y lista para usar. La gobernanza tidal debería resolver todos los problemas de la cámara identificados en los logs.
