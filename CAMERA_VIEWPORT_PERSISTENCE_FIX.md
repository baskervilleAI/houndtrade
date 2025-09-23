# Fix del Reset de Cámara - Persistencia del Viewport del Usuario

## Problema Identificado

El gráfico estaba reseteando la vista de la cámara cuando llegaban actualizaciones en vivo, perdiendo la navegación del usuario independientemente del streaming.

## Cambios Implementados

### 1. Mejoras en `useSimpleCamera.ts`

#### A. Verificación Mejorada de Lock
- Cambió la lógica `isLocked()` para requerir tanto `isLocked: true` como un viewport válido (`min/max` no nulos)
- Redujo spam de logs de debug al 1% para evitar saturación de consola

#### B. Persistencia con SessionStorage
- Agregado estado inicial desde `sessionStorage` al cargar el hook
- Auto-guardado del estado en `sessionStorage` cada vez que cambia
- Limpieza de `sessionStorage` cuando se resetea la cámara

#### C. Actualización Inmediata del Ref
- Los métodos `onUserZoom` y `onUserPan` ahora actualizan `stateRef.current` inmediatamente
- Garantiza acceso sincrónico al estado actual desde cualquier callback

### 2. Mejoras en `MinimalistChart.tsx`

#### A. Preservación Robusta del Viewport
- Pre-preservación del viewport del usuario al inicio de `updateChart()`
- Triple verificación: antes, durante y después de `chart.update()`
- Restauración automática desde el estado de la cámara si Chart.js modifica el viewport

#### B. Detección Mejorada de Usuario Activo
- Lógica más estricta para determinar si el usuario está navegando
- Requiere tanto `isLocked: true` como viewport válido (`min/max` no nulos)

#### C. Hook de Preservación de CandleData
- Mejora en el hook que preserva viewport durante cambios de `candleData`
- Tolerancia de 100ms para evitar micro-ajustes innecesarios
- Usa `getCurrentState()` para acceso inmediato al estado

#### D. Restauración desde Estado de Cámara
- Si Chart.js cambia viewport sin permiso, restaura desde `currentCameraState.chartJsState`
- Verificación adicional para casos donde no se preservó viewport inicialmente

## Características del Fix

### ✅ Persistencia de Memoria
- El viewport del usuario se mantiene entre actualizaciones de streaming
- Estado persistido en `sessionStorage` para sobrevivir recargas de página
- Acceso sincrónico al estado actual desde cualquier callback

### ✅ Preservación Anti-Reset
- Triple capa de protección contra resets automáticos
- Restauración inmediata si Chart.js modifica viewport sin permiso
- Tolerancia configurable para cambios mínimos (100ms)

### ✅ Rendimiento Optimizado
- Logs de debug reducidos al 1% para evitar spam
- Throttling existente mantenido para updates de streaming
- Updates mínimos solo cuando hay cambios significativos

### ✅ Experiencia de Usuario
- Navegación del usuario completamente independiente del streaming
- Reset manual disponible con botón "📷 Reset"
- Estado visual claro (botón cambia de color cuando usuario navega)

## Testing

Para probar el fix:

1. **Navegación Básica**: Hacer zoom/pan en el gráfico
2. **Streaming Live**: Verificar que el viewport no se mueve con nuevas velas
3. **Recarga de Página**: Confirmar que el viewport se mantiene después de F5
4. **Reset Manual**: Usar botón "📷 Reset" para volver a vista automática

## Logs de Debug

El sistema ahora muestra logs claros:
- `📷 [SimpleCamera] User zoom:` - Cuando usuario navega
- `✅ [MinimalistChart] Viewport del usuario se mantuvo correctamente` - Confirmación de preservación
- `⚠️ [MinimalistChart] Chart.js cambió viewport sin permiso` - Cuando se detecta y corrige reset

## Estado Antes vs Después

**Antes**: 
- Viewport se reseteaba con cada update de streaming
- Sin persistencia entre recargas
- Usuario perdía navegación constantemente

**Después**:
- Viewport permanece fijo independientemente del streaming
- Persistencia completa con sessionStorage
- Navegación del usuario completamente respetada
