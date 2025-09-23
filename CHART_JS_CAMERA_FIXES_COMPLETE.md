# 📷 Correcciones del Control de Cámara para Chart.js Financial

## 🎯 Resumen de Implementación

Se han implementado las correcciones para el control de cámara del gráfico de velas siguiendo las **mejores prácticas oficiales de Chart.js**. Estas mejoras solucionan los problemas de reseteo del viewport y proporcionan un control de cámara robusto y predecible.

## 🔧 Correcciones Implementadas

### 1. **Hook `usePersistentViewport`** ✨
```typescript
// /src/hooks/usePersistentViewport.ts
```

**Función:** Implementa el patrón oficial **snapshot/restore** para persistencia del viewport.

**Características:**
- ✅ Usa la API oficial de `chartjs-plugin-zoom` (`getZoomedScaleBounds`, `zoomScale`)
- ✅ Fallback directo a escalas de Chart.js si el plugin no está disponible
- ✅ Muta opciones **en sitio** sin recrear objetos
- ✅ Usa `chart.update('none')` para actualizaciones sin animación

**Métodos principales:**
- `snapshot()`: Captura el viewport actual
- `restore(mode)`: Restaura el viewport guardado
- `resetZoom(mode)`: Reset completo usando API oficial
- `applyViewport(min, max)`: Aplica un viewport específico

### 2. **Mejoras en `useSimpleCamera`** 🔄

**Nuevos métodos agregados:**
```typescript
interface SimpleCameraControls {
  // ... métodos existentes
  updateFromChartViewport: (min: number | null, max: number | null) => void;
  shouldPersistViewport: () => boolean;
  lockCamera: () => void;
  unlockCamera: () => void;
}
```

**Función:** Gestiona el estado de la cámara con compatibilidad para Chart.js oficial.

### 3. **Actualización de `MinimalistChart.tsx`** 📊

#### A. **Memoización de Opciones**
```typescript
const chartOptions = useMemo(() => ({
  animation: { duration: 0 },
  responsive: false,
  maintainAspectRatio: false,
  parsing: false as const, // CRÍTICO para performance
  // ... resto de configuración
}), [currentSymbol, currentInterval, isStreaming, debouncedZoomHandler, debouncedPanHandler]);
```

**CRÍTICO:** Las opciones están memoizadas para **evitar recreación** en cada render, que es lo que causaba el reseteo del viewport.

#### B. **Función `updateChart` Mejorada**
```typescript
const updateChart = useCallback((newCandle: CandleData, isFinal: boolean) => {
  // 1) SNAPSHOT: Capturar viewport si la cámara está bloqueada
  if (simpleCamera.shouldPersistViewport()) {
    persistentViewport.snapshot();
  }

  // 2) MUTACIÓN IN-SITU: Mutar datos existentes
  const dataset = chart.data.datasets[0];
  if (existingIndex >= 0) {
    (dataset.data as any)[existingIndex] = candleData; // Actualizar existente
  } else {
    (dataset.data as any[]).push(candleData); // Agregar nueva
  }

  // 3) UPDATE: Sin animación
  chart.update('none');

  // 4) RESTORE: Restaurar viewport del usuario
  if (simpleCamera.shouldPersistViewport() && persistentViewport.hasSnapshot()) {
    persistentViewport.restore('none');
  }
}, [/* dependencias memoizadas */]);
```

**Patrón oficial:** 
1. **Snapshot** → 2. **Mutación** → 3. **Update** → 4. **Restore**

#### C. **Handlers de Zoom/Pan Mejorados**
```typescript
// Los handlers ahora usan el sistema de persistencia mejorado
zoomTimeoutRef.current = setTimeout(() => {
  const finalScale = chart.scales.x;
  if (finalScale) {
    simpleCamera.onUserZoom(finalScale.min, finalScale.max, center);
    simpleCamera.lockCamera(); // NUEVO: Bloquear inmediatamente
  }
}, 100);
```

## 🎛️ Funcionalidades Nuevas

### **Botón de Reset Mejorado**
```tsx
<TouchableOpacity onPress={() => {
  simpleCamera.resetToLatest(); // Limpia estado persistido
  persistentViewport.resetZoom('none'); // Reset usando Chart.js oficial
  persistentViewport.clearSnapshot(); // Limpia snapshot guardado
}}>
  <Text>{simpleCamera.isLocked() ? '📷 Reset' : '📷 Auto'}</Text>
</TouchableOpacity>
```

## 🔬 Beneficios de las Correcciones

### ✅ **Eliminación de Problemas**
1. **No más reseteo del viewport** al recibir nuevas velas
2. **No más loops infinitos** de forzado de viewport
3. **No más recreación de opciones** que confunde a Chart.js
4. **Mejor performance** con mutación in-situ de datos

### ✅ **Comportamiento Predecible**
1. **Snapshot/Restore garantizado** usando API oficial
2. **Memoización estable** previene re-renders innecesarios
3. **Control directo** sobre cuándo persistir/restaurar viewport
4. **Fallbacks robustos** si el plugin zoom no está disponible

### ✅ **Compatibilidad Total con Chart.js**
1. **API oficial de chartjs-plugin-zoom**
2. **Patrones recomendados** en la documentación
3. **Sin hacks ni workarounds**
4. **Futuro-compatible** con nuevas versiones

## 📖 Referencias Implementadas

Las correcciones siguen exactamente las **mejores prácticas oficiales**:

1. **[Chart.js Updates](https://www.chartjs.org/docs/latest/developers/updates.html)** - Mutación vs recreación
2. **[chartjs-plugin-zoom API](https://www.chartjs.org/chartjs-plugin-zoom/latest/guide/developers.html)** - Métodos snapshot/restore
3. **[Escalas y Opciones](https://www.chartjs.org/docs/latest/axes/)** - Manejo de min/max
4. **[Performance](https://www.chartjs.org/docs/latest/general/performance.html)** - Parsing false, update('none')

## 🚀 Resultado Final

El control de cámara del gráfico de velas ahora:

- ✅ **Persiste la posición del usuario** durante streaming en vivo
- ✅ **No resetea** al recibir nuevas velas
- ✅ **Usa APIs oficiales** de Chart.js
- ✅ **Performance optimizada** con mutaciones in-situ
- ✅ **Comportamiento predecible** y robusto
- ✅ **Compatibilidad futura** garantizada

## 🔄 Flujo de Datos Mejorado

```
Nueva Vela → Snapshot Viewport → Mutar Datos → Update Chart → Restore Viewport
     ↓              ↓               ↓            ↓              ↓
Streaming        Si Bloqueado    In-Situ     'none' mode    Si Necesario
```

**Resultado:** Viewport del usuario **siempre respetado**, sin reseteos ni loops.
