# Análisis Detallado del Flujo de Datos y Control de Cámara

## 📊 RESUMEN EJECUTIVO

He realizado un análisis completo del flujo desde la obtención de datos hasta la actualización del gráfico. He identificado **múltiples problemas en el control de la cámara** que causan los saltos no deseados.

## 🔍 FLUJO COMPLETO PASO A PASO

### 1. OBTENCIÓN DE DATOS
```typescript
// useMarketData.ts
- Inicializa streamingService con símbolos populares
- Carga datos iniciales con timeout de 10s
- Configura streaming en tiempo real
- Fallback a datos mock si falla

// liveStreamingService.ts  
- Intenta WebSocket a múltiples URLs de Binance
- Si falla, usa polling cada 3 segundos
- Carga 900 velas históricas inicialmente
- Emite eventos 'candleUpdate' y 'historicalDataLoaded'
```

### 2. PROCESAMIENTO EN MINIMALIST CHART
```typescript
// MinimalistChart.tsx - handleCandleUpdate
1. Recibe evento 'candleUpdate' del liveStreamingService
2. Verifica si coincide con símbolo/intervalo actual
3. Llama updateChart(newCandle, isFinal)
4. Actualiza el estado candleData
5. Actualiza el gráfico Chart.js
```

### 3. CONTROL DE CÁMARA (useSimpleCamera)
```typescript
// useSimpleCamera.ts
- Maneja estado: isLocked, lastUserAction, chartJsState (min/max/centerX)
- Persiste en sessionStorage
- Controla si forzar viewport o permitir auto-ajuste
```

## 🚨 PROBLEMAS IDENTIFICADOS

### PROBLEMA #1: MÚLTIPLES EVENTOS DUPLICADOS
**Ubicación:** liveStreamingService.ts líneas 345-468
```typescript
// 🔥 PROBLEMA: Emite múltiples actualizaciones para la misma vela
liveStreamingService.ts:345 🔄 [LiveStreamingService] Updated candle at index 0
liveStreamingService.ts:345 🔄 [LiveStreamingService] Updated candle at index 1  
liveStreamingService.ts:345 🔄 [LiveStreamingService] Updated candle at index 2
```

**Análisis de logs:**
```
MinimalistChart.tsx:776 📈 [handleCandleUpdate] NUEVA ACTUALIZACIÓN RECIBIDA
MinimalistChart.tsx:776 📈 [handleCandleUpdate] NUEVA ACTUALIZACIÓN RECIBIDA  
MinimalistChart.tsx:776 📈 [handleCandleUpdate] NUEVA ACTUALIZACIÓN RECIBIDA
```

**Causa:** El servicio emite 3 actualizaciones consecutivas (velas históricas) cada vez que hace polling.

### PROBLEMA #2: RACE CONDITIONS EN ZOOM/PAN
**Ubicación:** MinimalistChart.tsx líneas 383-436
```typescript
// 🔥 PROBLEMA: Múltiples eventos de zoom sin throttling adecuado
MinimalistChart.tsx:383 📍 [ZOOM] Usuario inicia ZOOM  
MinimalistChart.tsx:383 📍 [ZOOM] Usuario inicia ZOOM
MinimalistChart.tsx:383 📍 [ZOOM] Usuario inicia ZOOM  
MinimalistChart.tsx:383 📍 [ZOOM] Usuario inicia ZOOM
MinimalistChart.tsx:397 🔍 [ZOOM] Guardando estado final del zoom
```

**Análisis de logs:**
```
useSimpleCamera.ts:175 📷 [SimpleCamera] User started interaction
useSimpleCamera.ts:203 📷 [SimpleCamera] User zoom  
useSimpleCamera.ts:190 📷 [SimpleCamera] User ended interaction
```

**Causa:** Cada evento de zoom/pan del Chart.js dispara múltiples callbacks sin debounce adecuado.

### PROBLEMA #3: LOOPS DE VIEWPORT FORZADO
**Ubicación:** MinimalistChart.tsx líneas 722-767
```typescript
// 🔥 PROBLEMA: Hook que se ejecuta en cada cambio de candleData
useEffect(() => {
  // Este hook se ejecuta CADA VEZ que cambia candleData
  // Fuerza el viewport del usuario constantemente
  chart.scales.x.min = userState.min;
  chart.scales.x.max = userState.max;
  chart.update('none');
}, [candleData.length, simpleCamera.state.chartJsState.min, simpleCamera.state.chartJsState.max]);
```

**Análisis de logs:**
```
MinimalistChart.tsx:722 🔄 [candleData Hook] Ejecutándose por cambio en candleData
MinimalistChart.tsx:746 🔍 [candleData Hook] Comparando viewports
MinimalistChart.tsx:767 ✅ [candleData Hook] Viewport ya está correcto
```

### PROBLEMA #4: DOBLE APLICACIÓN DE VIEWPORT
**Ubicación:** MinimalistChart.tsx líneas 467-635
```typescript
// 🔥 PROBLEMA: updateChart aplica viewport Y luego el hook también lo aplica
if (shouldForceViewport && forcedViewport) {
  console.log('🔒 [updateChart] FORZANDO viewport del usuario:', forcedViewport);
  chart.options.scales!.x!.min = forcedViewport.min;
  chart.options.scales!.x!.max = forcedViewport.max;
  chart.scales.x.min = forcedViewport.min;
  chart.scales.x.max = forcedViewport.max;
}
// ... después el useEffect también fuerza el viewport
```

### PROBLEMA #5: PERSISTENCIA AGRESIVA EN sessionStorage
**Ubicación:** useSimpleCamera.ts líneas 69-76
```typescript
// 🔥 PROBLEMA: Cada cambio de estado dispara escritura a sessionStorage
useEffect(() => {
  stateRef.current = state;
  // Persistir estado en sessionStorage - SE EJECUTA EN CADA CAMBIO
  sessionStorage.setItem('simpleCamera_state', JSON.stringify(state));
  if (onStateChange) {
    onStateChange(state); // Esto puede disparar más cambios
  }
}, [state, onStateChange]);
```

## 🎯 PUNTOS CRÍTICOS DEL FLUJO

### Secuencia problemática observada en logs:
1. **Polling trae 3 velas** → Emite 3 eventos `candleUpdate`
2. **Cada evento** → Ejecuta `handleCandleUpdate` → Llama `updateChart`
3. **updateChart** → Fuerza viewport del usuario
4. **Hook de candleData** → Se ejecuta por cambio → Vuelve a forzar viewport
5. **Usuario hace zoom** → Múltiples eventos de Chart.js → Múltiples llamadas a `onUserZoom`
6. **onUserZoom** → Actualiza estado → Dispara hook → Persiste en sessionStorage
7. **Nuevo estado** → Dispara `onStateChange` → Puede crear loops

## 🛠️ DIAGNÓSTICO Y SOLUCIONES RECOMENDADAS

### SOLUCIÓN 1: Debounce en liveStreamingService
```typescript
// En lugar de emitir 3 eventos seguidos, agrupar y emitir uno solo
private debounceUpdates = new Map<string, NodeJS.Timeout>();

private emitCandleUpdate(update: StreamUpdate) {
  const key = `${update.symbol}_${update.interval}`;
  
  if (this.debounceUpdates.has(key)) {
    clearTimeout(this.debounceUpdates.get(key)!);
  }
  
  this.debounceUpdates.set(key, setTimeout(() => {
    this.emit('candleUpdate', update);
    this.debounceUpdates.delete(key);
  }, 100));
}
```

### SOLUCIÓN 2: Throttling mejorado en Chart.js callbacks
```typescript
onZoom: function(context: any) {
  const now = Date.now();
  if (now - lastZoomTime < 500) return; // Aumentar throttle
  lastZoomTime = now;
  
  // Usar debounce para capturar estado final
  clearTimeout(zoomTimeout);
  zoomTimeout = setTimeout(() => {
    simpleCamera.onUserZoom(/*...*/);
  }, 200);
}
```

### SOLUCIÓN 3: Eliminar hook de viewport forzado redundante
```typescript
// REMOVER el useEffect que fuerza viewport en cada cambio de candleData
// Solo mantener la lógica en updateChart
```

### SOLUCIÓN 4: Optimizar persistencia
```typescript
// Debounce la escritura a sessionStorage
const debouncedPersist = useMemo(() => 
  debounce((state: SimpleCameraState) => {
    sessionStorage.setItem('simpleCamera_state', JSON.stringify(state));
  }, 500), []
);
```

### SOLUCIÓN 5: Estado de interacción más preciso
```typescript
// Distinguir entre "interactuando" y "tiene preferencias"
const isCurrentlyInteracting = useRef(false);

onUserStartInteraction: () => {
  isCurrentlyInteracting.current = true;
  // No forzar viewport mientras se interactúa
}

onUserEndInteraction: () => {
  setTimeout(() => {
    isCurrentlyInteracting.current = false;
    // Ahora sí guardar preferencias
  }, 300);
}
```

## 📋 PRIORIDADES DE IMPLEMENTACIÓN

1. **CRÍTICO:** Debounce en liveStreamingService (elimina 3x eventos)
2. **ALTO:** Mejorar throttling en zoom/pan (elimina race conditions)  
3. **ALTO:** Remover hook redundante de viewport (elimina double-forcing)
4. **MEDIO:** Optimizar persistencia sessionStorage
5. **BAJO:** Mejorar logging para debug

## 🎛️ CONTROL DE CÁMARA IDEAL

La cámara debería tener estos estados claramente definidos:

1. **FIRST_LOAD:** Usuario nunca ha interactuado → Auto-ajuste a últimas 100 velas
2. **USER_INTERACTING:** Usuario está haciendo zoom/pan → No forzar viewport
3. **USER_LOCKED:** Usuario terminó interacción → Respetar sus preferencias
4. **RESET:** Usuario presiona reset → Volver a estado FIRST_LOAD

**El problema actual es que estos estados se confunden y se ejecutan simultáneamente.**

## 🔧 VALIDACIÓN DE LA SOLUCIÓN

Para confirmar que las soluciones funcionan, deberíamos ver en los logs:

- ✅ Solo 1 evento `candleUpdate` por actualización real
- ✅ Solo 1 evento `onUserZoom` por interacción de zoom  
- ✅ Hook de `candleData` no se ejecuta constantemente
- ✅ `sessionStorage` se actualiza máximo 1 vez por segundo
- ✅ No más "saltos" de cámara inesperados

La cámara debe ser **predecible y gobernada únicamente por el usuario** una vez que haya interactuado.
