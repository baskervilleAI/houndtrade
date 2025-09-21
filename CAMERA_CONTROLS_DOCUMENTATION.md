# 🎥 Sistema de Controles de Cámara para Gráfico de Velas Japonesas

## 📋 Resumen

Se ha implementado un sistema completo de controles de cámara para el gráfico de velas japonesas que permite:

- **🔍 Zoom avanzado**: Acercar y alejar con precisión
- **🔄 Paneo**: Mover la vista horizontal y verticalmente
- **🕒 Navegación temporal**: Saltar a fechas y momentos específicos
- **👆 Controles gestuales**: Pinch-to-zoom y pan con dedos
- **📊 Modo histórico**: Navegar por datos del pasado

## 🚀 Funcionalidades Implementadas

### 1. Hook de Cámara (`useChartCamera.ts`)
- **Gestión de zoom**: Niveles de 0.1x a 20x
- **Control de paneo**: Desplazamiento horizontal y vertical
- **Viewport dinámico**: Calcula automáticamente las velas visibles
- **Callbacks de cambio**: Notifica cuando cambia la posición de la cámara

### 2. Controles Gestuales (`useChartGestures.ts`)
- **Pinch-to-zoom**: Pellizcar para hacer zoom
- **Pan gestures**: Arrastrar para desplazar
- **Tap detection**: Detecta toques simples, dobles y prolongados
- **Multi-touch**: Soporte completo para múltiples toques

### 3. Panel de Controles de Cámara (`ChartCameraControls.tsx`)
- **Controles de zoom**: Botones y presets de zoom
- **Controles de paneo**: Botones direccionales
- **Navegación por índices**: Ir a vela específica
- **Ajustes automáticos**: Fit all, fit visible
- **Acciones rápidas**: Vistas predefinidas

### 4. Navegación Temporal (`TimeNavigation.tsx`)
- **Presets rápidos**: 1h, 6h, 1d, 1 semana, etc.
- **Eventos de mercado**: Apertura/cierre NYSE, Tokio, etc.
- **Fecha específica**: Seleccionar fecha y hora exacta
- **Navegación relativa**: X minutos/horas/días atrás
- **Modo histórico**: Toggle entre live y datos históricos

### 5. Gráfico Principal (`CandlestickChart_WithCamera.tsx`)
- **Integración completa**: Todos los controles unificados
- **Renderizado optimizado**: Solo dibuja velas visibles
- **Gestión de estado**: Sincroniza cámara con datos
- **Interfaz intuitiva**: Botones de acceso rápido

## 🎯 Cómo Usar

### Controles Básicos
1. **Zoom**: 
   - Doble tap para zoom 2x
   - Pellizcar con dos dedos
   - Botones de zoom en controles
   
2. **Paneo**:
   - Arrastrar con un dedo
   - Botones direccionales
   - Ir a inicio/final

3. **Navegación Temporal**:
   - Botón "🕒 Tiempo" para abrir panel
   - Seleccionar presets rápidos
   - Ir a fechas específicas

### Controles Avanzados
1. **Panel de Cámara** (🎥 Cámara):
   - Información detallada del viewport
   - Controles precisos de zoom y pan
   - Presets de zoom (0.1x - 20x)
   - Acciones rápidas predefinidas

2. **Navegación Temporal** (🕒 Tiempo):
   - Cambiar a modo histórico
   - Navegación por presets (1h, 1d, etc.)
   - Eventos de mercado específicos
   - Fecha y hora exacta
   - Navegación relativa

## 📱 Gestos Soportados

### Toque Simple
- **Acción**: Seleccionar punto en el gráfico
- **Feedback**: Log de posición en consola

### Doble Toque
- **Acción**: Zoom inteligente (2x o reset)
- **Comportamiento**: Si zoom < 2x → zoom a 2x, sino → reset a 1x

### Toque Prolongado
- **Acción**: Abrir controles de cámara
- **Duración**: > 500ms

### Pellizcar (Pinch)
- **Acción**: Zoom proporcional
- **Rango**: 0.1x - 20x
- **Centro**: Punto medio entre dedos

### Arrastrar (Pan)
- **Acción**: Desplazar vista
- **Horizontal**: Navegar por tiempo
- **Vertical**: Ajustar rango de precios

## 🔧 Configuración

### Parámetros del Hook de Cámara
```typescript
const cameraControls = useChartCamera({
  candleCount: displayCandles.length,    // Número total de velas
  chartWidth: screenWidth - 32,          // Ancho del gráfico
  chartHeight: CHART_HEIGHT,             // Alto del gráfico
  minCandleWidth: 2,                     // Ancho mínimo de vela
  maxCandleWidth: 50,                    // Ancho máximo de vela
  defaultZoom: 1.0,                      // Zoom inicial
  onCameraChange: (camera) => { ... }    // Callback de cambios
});
```

### Configuración de Gestos
```typescript
const gestureControls = useChartGestures({
  cameraControls,                        // Controles de cámara
  chartWidth: screenWidth - 32,          // Ancho del gráfico
  chartHeight: CHART_HEIGHT,             // Alto del gráfico
  enabled: true,                         // Habilitar gestos
  onTap: (x, y) => { ... },             // Callback de tap
  onDoubleTap: (x, y) => { ... },       // Callback de doble tap
  onLongPress: (x, y) => { ... },       // Callback de long press
});
```

## 🎨 Estados Visuales

### Indicadores de Estado
- **⚡ EN VIVO**: Streaming activo
- **📊 HISTÓRICO**: Modo histórico activo
- **🔄 RECONECTAR**: Conexión perdida
- **🎥 [zoom]x | [velas] velas**: Info de cámara
- **🤏 Gesto Activo**: Gesto multi-touch en curso

### Botones de Acceso Rápido
- **🎥 Cámara**: Abrir panel de controles de cámara
- **🕒 Tiempo**: Abrir navegación temporal
- **🔍 Zoom**: Zoom rápido 2x
- **📐 Ajustar**: Fit all automático
- **⏭️ Reciente**: Ir a datos más recientes

## 📊 Optimizaciones

### Renderizado Inteligente
- Solo renderiza velas visibles en el viewport
- Cálculo eficiente de rangos de precios
- Memoización de componentes pesados

### Gestión de Memoria
- Limita número máximo de velas en memoria
- Libera recursos de datos no visibles
- Cache inteligente de datos históricos

### Performance
- Throttling de eventos de gesto
- Debouncing de cambios de cámara
- Animaciones suaves con Animated API

## 🔮 Funcionalidades Futuras

### Posibles Mejoras
1. **Crosshair**: Líneas de referencia en tap
2. **Zoom a área**: Seleccionar área específica
3. **Bookmarks**: Guardar posiciones favoritas
4. **Sincronización**: Múltiples gráficos sincronizados
5. **Gestos 3D**: Rotación y perspectiva
6. **Realidad aumentada**: Overlays informativos

### Extensiones
1. **Indicadores técnicos**: MA, RSI, MACD con zoom
2. **Anotaciones**: Marcar puntos importantes
3. **Comparación**: Superponer múltiples símbolos
4. **Exportación**: Guardar vistas como imagen
5. **Sharing**: Compartir posiciones específicas

## 🛠 Mantenimiento

### Archivos Clave
- `useChartCamera.ts`: Lógica principal de cámara
- `useChartGestures.ts`: Manejo de gestos
- `ChartCameraControls.tsx`: Panel de controles
- `TimeNavigation.tsx`: Navegación temporal
- `CandlestickChart_WithCamera.tsx`: Componente principal

### Testing
- Probar en diferentes dispositivos
- Verificar gestos en iOS y Android
- Testear con datos históricos largos
- Validar performance con zoom extremo

### Debugging
- Logs detallados en modo desarrollo
- Indicadores visuales de estado
- Métricas de performance en tiempo real
- Error boundaries para fallos de gestos
