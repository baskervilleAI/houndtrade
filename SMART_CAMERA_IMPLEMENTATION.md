# 📷 Sistema de Cámara Inteligente para Gráfico de Velas

## 🚀 Resumen

El sistema de cámara inteligente implementa automáticamente el comportamiento que solicitas:

1. **Por defecto**: Muestra las últimas 100 velas con escala automática
2. **Estado persistente**: Guarda la posición/zoom cuando el usuario interactúa
3. **Actualización inteligente**: Mantiene la posición durante las actualizaciones de velas

## 🎯 Funcionalidades Implementadas

### 1. **Modo Automático (Por Defecto)**
- ✅ Muestra las últimas 100 velas
- ✅ Escala automática optimizada
- ✅ Sigue las nuevas velas en tiempo real
- ✅ Se activa automáticamente al cargar

### 2. **Modo Manual (Cuando el Usuario Interactúa)**
- ✅ Guarda la posición de zoom del usuario
- ✅ Guarda la posición de pan (desplazamiento)
- ✅ Mantiene la configuración durante actualizaciones
- ✅ Auto-reset después de 30 segundos de inactividad

### 3. **Botón de Reset Rápido**
- ✅ Botón "📷 100" para volver al modo automático
- ✅ Resetea inmediatamente a las últimas 100 velas
- ✅ Limpia cualquier configuración manual

## 🔧 Componentes Implementados

### 1. **useSmartCameraState.ts**
Hook que gestiona el estado inteligente de la cámara:

```typescript
interface SmartCameraState {
  isUserControlled: boolean;          // Si el usuario ha interactuado
  lastUserInteraction: number;        // Timestamp de última interacción
  defaultVisibleCandles: number;      // 100 velas por defecto
  currentVisibleCandles: number;      // Velas actualmente visibles
  userZoom: number | null;            // Zoom configurado por el usuario
  userPanX: number | null;            // Posición X configurada por el usuario
  chartJsState: {                     // Estado específico de Chart.js
    min: number | null;
    max: number | null;
    centerX: number | null;
    zoomLevel: number | null;
  };
  autoResetAfterMs: number;           // 30000 ms = 30 segundos
}
```

### 2. **useIntegratedCamera.ts**
Hook que combina el sistema tradicional con el inteligente:

```typescript
interface IntegratedCameraControls {
  // Métodos principales
  resetToLatest100: () => void;         // Reset manual a últimas 100
  onUserZoom: (zoom, centerX?) => void; // Callback de zoom del usuario
  onUserPan: (x, y?) => void;          // Callback de pan del usuario
  onChartUpdate: () => void;           // Notificación de nueva vela
  
  // Estado
  shouldAutoFollow: () => boolean;     // Si debe seguir automáticamente
  getRecommendedSettings: () => {...}; // Configuración recomendada
}
```

### 3. **MinimalistChart.tsx (Modificado)**
Integración completa en el componente principal:

- ✅ Hook integrado de cámara
- ✅ Callbacks de zoom/pan conectados
- ✅ Botón de reset en la UI
- ✅ Límite dinámico de velas (100/200)
- ✅ Configuración inicial automática

## 🎮 Cómo Funciona

### **Escenario 1: Usuario Carga el Gráfico**
1. Sistema se inicializa en modo automático
2. Muestra las últimas 100 velas
3. Escala automática optimizada
4. Sigue nuevas velas en tiempo real

### **Escenario 2: Usuario Hace Zoom/Pan**
1. Sistema detecta interacción del usuario
2. Cambia a modo manual
3. Guarda posición/zoom del usuario
4. Mantiene configuración durante updates
5. Inicia timer de 30 segundos

### **Escenario 3: Nueva Vela Llega**
- **Modo automático**: Ajusta vista para incluir nueva vela
- **Modo manual**: Mantiene posición del usuario, solo actualiza datos

### **Escenario 4: Auto-Reset (30s sin interacción)**
1. Timer expira después de 30 segundos
2. Sistema vuelve al modo automático
3. Resetea a las últimas 100 velas
4. Escala automática activada

### **Escenario 5: Usuario Presiona "📷 100"**
1. Reset inmediato al modo automático
2. Limpia configuración manual
3. Muestra últimas 100 velas
4. Cancela timer de auto-reset

## 📊 Configuración

```typescript
// En MinimalistChart.tsx
const integratedCamera = useIntegratedCamera({
  candleCount: candleData.length,
  chartWidth: width,
  chartHeight: height,
  defaultVisibleCandles: 100,        // ← Últimas 100 velas por defecto
  onCameraChange: (cameraState) => {
    console.log('📷 Camera state changed:', cameraState);
  },
  onNewDataReceived: candleData.length > 0,
});
```

## 🎨 UI/UX

### **Botón de Reset**
```tsx
<TouchableOpacity
  style={[styles.indicatorButton, styles.cameraResetButton]}
  onPress={() => integratedCamera.resetToLatest100()}
>
  <Text style={styles.indicatorButtonText}>📷 100</Text>
</TouchableOpacity>
```

### **Indicadores Visuales**
- Botón azul "📷 100" siempre disponible
- Estado LIVE indica streaming activo
- Console logs para debugging

## 🔄 Flujo de Estados

```
[INICIO] → Modo Automático (100 velas)
    ↓
[Usuario interactúa] → Modo Manual (posición guardada)
    ↓
[30s sin interacción] → Auto-reset → Modo Automático
    ↓
[Usuario presiona 📷 100] → Reset inmediato → Modo Automático
```

## 🚀 Beneficios

1. **Experiencia por defecto optimizada**: Siempre muestra las últimas 100 velas
2. **Respeta preferencias del usuario**: Mantiene zoom/pan durante interacciones
3. **Auto-recuperación inteligente**: Vuelve al modo óptimo automáticamente
4. **Reset rápido**: Un click para volver al estado ideal
5. **Rendimiento optimizado**: Límite dinámico de velas según contexto

## 📝 Notas Técnicas

- **Timer de auto-reset**: 30 segundos configurable
- **Límite de velas**: 100 (automático) / 200 (manual)
- **Throttling**: Updates limitados a 10fps para mejor rendimiento
- **Compatibilidad**: Solo plataforma web (Chart.js)
- **Estado persistente**: Se mantiene durante toda la sesión

---

**¡El sistema está completamente implementado y listo para usar!** 🎉
