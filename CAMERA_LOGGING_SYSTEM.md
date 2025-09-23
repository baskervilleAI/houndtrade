# Sistema de Logs Detallados de Cámara

## 📋 Resumen
Se han agregado logs extensivos para hacer seguimiento detallado de la gobernanza de usuario sobre la cámara y el comportamiento del sistema de persistencia de viewport.

## 🔍 Logs Agregados

### 1. useSimpleCamera.ts

#### Detección de Interacción Activa
```
🔍 [SimpleCamera] isActivelyInteracting - Estado actual: {mode: X, lastUserAction: X}
🔍 [SimpleCamera] isActivelyInteracting: TRUE/FALSE - [razón]
```

#### Persistencia de Viewport
```
🎯 [SimpleCamera] shouldPersistViewport: TRUE/FALSE - {mode: X, hasUserAction: X}
🎯 [SimpleCamera] shouldPersistViewport check: {criterios detallados}
```

#### Eventos de Usuario
```
📷 [SimpleCamera] onUserStartInteraction - timestamp: X
📷 [SimpleCamera] onUserStartInteraction - Estado actualizado: {detalles}
📷 [SimpleCamera] onUserEndInteraction - timestamp: X
📷 [SimpleCamera] onUserEndInteraction - Estado final: {detalles}
```

#### Zoom y Pan
```
📷 [SimpleCamera] onUserZoom - {min, max, centerX, timestamp}
📷 [SimpleCamera] onUserZoom - Estado a aplicar: {detalles}
📷 [SimpleCamera] onUserPan - {min, max, centerX, timestamp}
```

#### Bloqueo/Desbloqueo de Cámara
```
🔒 [SimpleCamera] lockCamera llamado - Bloqueando cámara
🔒 [SimpleCamera] lockCamera - Estado actualizado: {detalles}
🔓 [SimpleCamera] unlockCamera llamado - Desbloqueando cámara
🔓 [SimpleCamera] unlockCamera - Estado actualizado: {detalles}
```

#### Actualización desde Chart
```
📷 [SimpleCamera] updateFromChartViewport - {min, max, centerX}
📷 [SimpleCamera] updateFromChartViewport - Estado actualizado: {detalles}
```

### 2. MinimalistChart.tsx

#### Actualización de Chart
```
🚀 [updateChart] INICIO - Nueva vela recibida: {timestamp, price, isFinal}
📪 [updateChart] Guardando viewport del usuario...
🔍 [updateChart] Estado de interacción: {isActivelyInteracting, shouldPersistViewport}
📷 [updateChart] Estado de cámara completo: {mode, isLocked, lastUserAction}
```

#### Eventos de Zoom
```
🔍 [ZOOM] Usuario inicia ZOOM - Datos del evento: {min, max, center, timestamp}
🔍 [ZOOM] Estado PRE-interacción: {mode, isLocked}
🔍 [ZOOM] Estado POST-startInteraction: {mode, isLocked}
🔍 [ZOOM] Llamando simpleCamera.onUserZoom con estado final...
🔍 [ZOOM] Estado POST-zoom completo: {mode, isLocked, viewport}
```

#### Manejo de Velas
```
🎬 [handleCandleUpdate] Estado POST-updateChart: {mode, isLocked, shouldAutoAdjust, shouldPersist, isActivelyInteracting}
[MinimalistChart] Nueva vela - cámara BLOQUEADA por usuario, manteniendo posición fija
[MinimalistChart] Estado de cámara: {isLocked, lastUserAction, viewport}
```

## 🎯 Flujo de Logs Esperado

### Durante Interacción de Usuario (Zoom/Pan):
1. `🔍 [ZOOM] Usuario inicia ZOOM` - Datos del evento
2. `🔍 [ZOOM] Estado PRE-interacción` - Estado antes
3. `📷 [SimpleCamera] onUserStartInteraction` - Notificación de inicio
4. `🔍 [ZOOM] Estado POST-startInteraction` - Estado después de inicio
5. `🔍 [ZOOM] Llamando simpleCamera.onUserZoom` - Guardando estado final
6. `📷 [SimpleCamera] onUserZoom` - Detalles del zoom
7. `🔒 [SimpleCamera] lockCamera` - Bloqueo de cámara
8. `📷 [SimpleCamera] onUserEndInteraction` - Fin de interacción

### Durante Actualización de Vela:
1. `🚀 [updateChart] INICIO` - Nueva vela recibida
2. `📪 [updateChart] Guardando viewport` - Snapshot si es necesario
3. `🔍 [updateChart] Estado de interacción` - Verificación de estado
4. `📷 [updateChart] Estado de cámara completo` - Estado detallado
5. `🎯 [updateChart] Manteniendo interacción fluida` - O restaurando viewport
6. `🎬 [handleCandleUpdate] Estado POST-updateChart` - Estado final

## 🎪 Interpretación de Estados

### Modos de Cámara:
- `FIRST_LOAD`: Carga inicial, permite auto-ajuste
- `AUTO_ADJUST`: Seguimiento automático de nuevas velas
- `USER_INTERACTING`: Usuario está interactuando activamente
- `USER_LOCKED`: Usuario ha terminado interacción, cámara bloqueada

### Flags Importantes:
- `isLocked`: Cámara bloqueada por preferencia de usuario
- `isActivelyInteracting`: Usuario está interactuando AHORA mismo
- `shouldPersistViewport`: Viewport debe ser persistido
- `shouldAutoAdjust`: Permitir ajuste automático

## 🐛 Debugging

### Para identificar problemas de persistencia:
1. Buscar logs `🎯 [updateChart] Manteniendo interacción fluida` vs `🔄 [updateChart] Restaurando viewport`
2. Verificar `isActivelyInteracting` durante actualizaciones de velas
3. Revisar transiciones de modo: `FIRST_LOAD` → `USER_INTERACTING` → `USER_LOCKED`

### Para problemas de gobernanza:
1. Verificar secuencia `onUserStartInteraction` → `onUserZoom/Pan` → `onUserEndInteraction`
2. Comprobar que `lastUserAction` se actualiza correctamente
3. Verificar que `isLocked` se mantiene después de interacciones

## 🎨 Colores de Logs:
- 📷 Operaciones de cámara
- 🔍 Análisis de estado
- 🎯 Decisiones de persistencia
- 🔒/🔓 Bloqueo/desbloqueo
- 🚀 Inicio de operaciones
- 📪 Snapshots
- 🎬 Estados finales
