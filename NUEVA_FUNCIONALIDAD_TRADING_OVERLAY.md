# Nueva Funcionalidad del Trading Overlay

## Resumen de Mejoras Implementadas

El `TradingOverlay` ahora incluye un sistema completo de configuración visual de órdenes de trading que permite crear y ejecutar órdenes de manera intuitiva con un click.

## Características Implementadas

### 1. **Sistema de Un Click para Activación**
- **Primer click**: Activa el modo de configuración de orden
  - Click en la mitad superior del gráfico = Orden BUY
  - Click en la mitad inferior del gráfico = Orden SELL
- **Segundo click**: Ejecuta la orden configurada

### 2. **Barras de TP/SL Visuales**
- **Barra Verde (TP)**: Aparece arriba del gráfico para Take Profit
- **Barra Roja (SL)**: Aparece abajo del gráfico para Stop Loss
- Ambas barras son arrastrables y actualizan el precio en tiempo real
- Por defecto: TP = ∞ (infinito), SL = 0

### 3. **Panel de Configuración de Cantidad**
- Aparece cuando se activa la configuración de orden
- Permite seleccionar cantidad por:
  - **Porcentaje del balance**: 1%, 2%, 5%, 10%
  - **Valor por defecto**: 1% del balance
- Muestra información en tiempo real:
  - Cantidad en USD
  - Porcentaje del balance utilizado
  - Balance total disponible

### 4. **Líneas Punteadas en el Gráfico**
- Cuando se configuran TP/SL aparecen líneas punteadas:
  - **Verde**: Nivel de Take Profit
  - **Roja**: Nivel de Stop Loss
- Se actualizan en tiempo real al arrastrar las barras

### 5. **Información de Orden en Tiempo Real**
- Muestra el lado de la orden (BUY/SELL)
- Precio de entrada actual
- Niveles de TP y SL configurados
- Cantidad calculada

## Uso del Componente

### Props Nuevas

```typescript
interface TradingOverlayProps {
  chartDimensions: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  isVisible: boolean;
  onOverlayClick?: (event: any) => void;
  onClose?: () => void;
  symbol?: string;                    // NUEVO: Símbolo del par de trading
  priceScale?: {                      // NUEVO: Escala de precios del gráfico
    min: number;
    max: number;
    pixelsPerPrice: number;
  };
  latestPrice?: number;               // NUEVO: Precio actual del par
}
```

### Ejemplo de Uso

```typescript
// En tu componente padre (ej: TradingScreen)
const [showTradingOverlay, setShowTradingOverlay] = useState(false);
const currentPrice = tickers[selectedPair]?.price || 0;

// Calcular escala de precios
const priceScale = React.useMemo(() => {
  if (!currentPrice) return undefined;
  
  const basePrice = currentPrice;
  const range = basePrice * 0.1; // 10% de rango
  
  return {
    min: basePrice - range,
    max: basePrice + range,
    pixelsPerPrice: chartDimensions.height / (range * 2)
  };
}, [currentPrice, chartDimensions.height]);

// Uso del componente
<TradingOverlay
  chartDimensions={chartDimensions}
  isVisible={showTradingOverlay}
  symbol={selectedPair}
  priceScale={priceScale}
  latestPrice={currentPrice}
  onOverlayClick={(event) => {
    console.log('Click en overlay detectado');
  }}
  onClose={() => {
    setShowTradingOverlay(false);
  }}
/>
```

## Flujo de Trabajo para el Usuario

### 1. **Activación**
1. El usuario hace click en "Configurar Orden" en el gráfico
2. Se muestra el overlay transparente sobre el gráfico
3. El título cambia a "Click para Configurar Orden"

### 2. **Configuración**
1. **Primer click** en el gráfico:
   - Arriba = BUY, Abajo = SELL
   - Aparecen las barras de TP/SL
   - Se muestra el panel de configuración de cantidad
   - Se calcula el precio de entrada basado en el precio actual

### 3. **Ajuste Visual**
1. **Arrastrar barra verde (TP)**: Configura Take Profit
   - Aparece línea verde punteada en el gráfico
   - Muestra el precio actualizado en tiempo real
   
2. **Arrastrar barra roja (SL)**: Configura Stop Loss
   - Aparece línea roja punteada en el gráfico
   - Muestra el precio actualizado en tiempo real

3. **Ajustar cantidad**: Selecciona entre 1%, 2%, 5%, 10% del balance

### 4. **Ejecución**
1. **Segundo click** en cualquier parte del gráfico o botón "Ejecutar"
2. Se envía la orden al sistema de trading
3. Se resetea la configuración
4. Se ocultan las barras y líneas

### 5. **Cancelación**
1. Botón "Cancelar" o "Cerrar Orden"
2. Se resetea toda la configuración
3. Vuelve al estado inicial

## Integración con el Sistema de Trading

### Estados Internos
```typescript
interface OrderConfig {
  isConfiguring: boolean;           // Modo de configuración activo
  entryPrice: number | null;        // Precio de entrada
  takeProfitPrice: number | null;   // Precio de TP (null = ∞)
  stopLossPrice: number | null;     // Precio de SL (null = 0)
  quantity: number;                 // Cantidad en USD
  quantityType: 'percentage' | 'amount';
  quantityPercentage: number;       // Porcentaje del balance
  quantityAmount: number;           // Cantidad fija en USD
  side: OrderSide;                  // BUY o SELL
}
```

### Conexión con useTrading
- Utiliza `createOrder` del hook `useTrading`
- Accede al `portfolio` para calcular cantidades
- Obtiene precios actuales del contexto del chart

## Estilos y UI

### Elementos Visuales
- **Barras arrastrables**: Con sombras y efectos visuales
- **Panel de cantidad**: Fondo oscuro con bordes verdes
- **Botones de porcentaje**: Estados activo/inactivo
- **Líneas punteadas**: Feedback visual en tiempo real
- **Botones de acción**: Ejecutar (verde), Cancelar (gris)

### Responsive Design
- Se adapta al tamaño del gráfico
- Posicionamiento absoluto relativo a `chartDimensions`
- Z-index apropiado para superposición

## Logging y Debug

El sistema incluye logging detallado para:
- Activación y configuración de órdenes
- Arrastre de barras TP/SL
- Ejecución y cancelación de órdenes
- Cambios de estado y configuración

## Funcionalidades Mantenidas

- **División de colores del gráfico** (funcionalidad existente)
- **Botón "Cerrar Orden"** para salir del overlay
- **Panel de debug** en modo desarrollo
- **Indicadores técnicos** y líneas de soporte/resistencia

## Próximas Mejoras Sugeridas

1. **Validación de niveles**: Evitar TP por debajo del precio en BUY
2. **Historial de configuraciones**: Recordar últimas configuraciones usadas
3. **Plantillas de orden**: Configuraciones predefinidas
4. **Arrastre desde el precio actual**: Iniciar TP/SL desde el nivel de entrada
5. **Sonidos de confirmación**: Feedback auditivo para acciones
6. **Animaciones mejoradas**: Transiciones más suaves para barras y líneas

---

Esta implementación convierte el trading en una experiencia visual e intuitiva, permitiendo a los usuarios configurar órdenes complejas con gestos simples y feedback visual en tiempo real.