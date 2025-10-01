import { TradingOrder, OrderSide } from '../types/trading';

export interface OverlayPosition {
  id: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  quantity: number;
  unrealizedPnL: number;
  isVisible: boolean;
  colors: {
    upper: string; // Verde para arriba del entry
    lower: string; // Rojo para abajo del entry
    entry: string; // Color de la línea de entrada
    tp: string;    // Color del take profit
    sl: string;    // Color del stop loss
  };
}

export interface OverlayControls {
  tpBar: {
    id: string;
    price: number;
    isDraggable: boolean;
    position: { x: number; y: number };
  } | null;
  slBar: {
    id: string;
    price: number;
    isDraggable: boolean;
    position: { x: number; y: number };
  } | null;
}

export interface OverlayState {
  isActive: boolean;
  activePositionId: string | null;
  positions: Map<string, OverlayPosition>;
  controls: OverlayControls;
  chartDimensions: {
    width: number;
    height: number;
    x: number;
    y: number;
  } | null;
  priceScale: {
    min: number;
    max: number;
    pixelsPerPrice: number;
  } | null;
}

class OverlayManagerService {
  private static instance: OverlayManagerService;
  private state: OverlayState;
  private listeners: Set<(state: OverlayState) => void> = new Set();

  private constructor() {
    this.state = {
      isActive: false,
      activePositionId: null,
      positions: new Map(),
      controls: {
        tpBar: null,
        slBar: null,
      },
      chartDimensions: null,
      priceScale: null,
    };
  }

  public static getInstance(): OverlayManagerService {
    if (!OverlayManagerService.instance) {
      OverlayManagerService.instance = new OverlayManagerService();
    }
    return OverlayManagerService.instance;
  }

  // Suscribirse a cambios de estado
  public subscribe(listener: (state: OverlayState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notificar cambios
  private notify(): void {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  // Obtener estado actual
  public getState(): OverlayState {
    return { ...this.state };
  }

  // Configurar dimensiones del gráfico
  public setChartDimensions(dimensions: { width: number; height: number; x: number; y: number }): void {
    const current = this.state.chartDimensions;
    // Solo actualizar si las dimensiones realmente cambiaron
    if (!current || 
        current.width !== dimensions.width || 
        current.height !== dimensions.height || 
        current.x !== dimensions.x || 
        current.y !== dimensions.y) {
      this.state.chartDimensions = dimensions;
      this.notify();
    }
  }

  // Configurar escala de precios
  public setPriceScale(scale: { min: number; max: number; pixelsPerPrice: number }): void {
    const current = this.state.priceScale;
    // Solo actualizar si la escala realmente cambió
    if (!current ||
        current.min !== scale.min ||
        current.max !== scale.max ||
        current.pixelsPerPrice !== scale.pixelsPerPrice) {
      this.state.priceScale = scale;
      this.notify();
    }
  }

  // Agregar o actualizar posición
  public updatePosition(order: TradingOrder, currentPrice: number): void {
    const unrealizedPnL = this.calculateUnrealizedPnL(order, currentPrice);
    
    const colors = this.generatePositionColors(order.side);
    
    const position: OverlayPosition = {
      id: order.id,
      symbol: order.symbol,
      side: order.side,
      entryPrice: order.entryPrice,
      takeProfitPrice: order.takeProfitPrice || undefined,
      stopLossPrice: order.stopLossPrice || undefined,
      quantity: order.quantity,
      unrealizedPnL,
      isVisible: false, // Por defecto no visible hasta activar
      colors,
    };

    this.state.positions.set(order.id, position);
    this.notify();
  }

  // Remover posición
  public removePosition(positionId: string): void {
    this.state.positions.delete(positionId);
    
    // Si era la posición activa, desactivar overlay
    if (this.state.activePositionId === positionId) {
      this.deactivateOverlay();
    }
    
    this.notify();
  }

  // Toggle de overlay para una posición específica
  public togglePositionOverlay(positionId: string): boolean {
    const position = this.state.positions.get(positionId);
    if (!position) return false;

    // Si esta posición ya está activa, desactivar todo
    if (this.state.activePositionId === positionId && this.state.isActive) {
      this.deactivateOverlay();
      return false;
    }

    // Activar overlay para esta posición
    this.activateOverlayForPosition(positionId);
    return true;
  }

  // Activar overlay para posición específica
  private activateOverlayForPosition(positionId: string): void {
    const position = this.state.positions.get(positionId);
    if (!position) return;

    // Desactivar todas las posiciones
    this.state.positions.forEach(pos => {
      pos.isVisible = false;
    });

    // Activar solo la posición seleccionada
    position.isVisible = true;
    this.state.activePositionId = positionId;
    this.state.isActive = true;

    // Crear barras TP/SL si existen
    this.createTPSLControls(position);

    this.notify();
  }

  // Desactivar overlay completamente
  public deactivateOverlay(): void {
    // Desactivar todas las posiciones
    this.state.positions.forEach(pos => {
      pos.isVisible = false;
    });

    this.state.isActive = false;
    this.state.activePositionId = null;
    this.state.controls.tpBar = null;
    this.state.controls.slBar = null;

    this.notify();
  }

  // Crear controles TP/SL para la posición activa
  private createTPSLControls(position: OverlayPosition): void {
    const leftMargin = 20; // Espacio desde la izquierda
    
    // Crear barra TP si existe
    if (position.takeProfitPrice) {
      const tpY = this.priceToPixels(position.takeProfitPrice) || 100;
      this.state.controls.tpBar = {
        id: `tp-${position.id}`,
        price: position.takeProfitPrice,
        isDraggable: true,
        position: { x: leftMargin, y: tpY },
      };
    }

    // Crear barra SL si existe
    if (position.stopLossPrice) {
      const slY = this.priceToPixels(position.stopLossPrice) || 200;
      this.state.controls.slBar = {
        id: `sl-${position.id}`,
        price: position.stopLossPrice,
        isDraggable: true,
        position: { x: leftMargin, y: slY },
      };
    }
  }

  // Actualizar posición de barra TP/SL
  public updateTPSLBarPosition(type: 'tp' | 'sl', newY: number): void {
    if (!this.state.activePositionId || !this.state.priceScale) return;

    const newPrice = this.pixelsToPrice(newY);
    if (newPrice === null) return;

    if (type === 'tp' && this.state.controls.tpBar) {
      this.state.controls.tpBar.price = newPrice;
      this.state.controls.tpBar.position.y = newY;
    } else if (type === 'sl' && this.state.controls.slBar) {
      this.state.controls.slBar.price = newPrice;
      this.state.controls.slBar.position.y = newY;
    }

    // Actualizar también en la posición
    const activePosition = this.state.positions.get(this.state.activePositionId);
    if (activePosition) {
      if (type === 'tp') {
        activePosition.takeProfitPrice = newPrice;
      } else {
        activePosition.stopLossPrice = newPrice;
      }
    }

    this.notify();
  }

  // Conversión de precio a píxeles
  private priceToPixels(price: number): number | null {
    if (!this.state.priceScale || !this.state.chartDimensions) return null;

    const { min, max } = this.state.priceScale;
    const { height } = this.state.chartDimensions;
    
    const clampedPrice = Math.min(Math.max(price, min), max);
    const ratio = (max - clampedPrice) / (max - min);
    
    return ratio * height;
  }

  // Conversión de píxeles a precio
  private pixelsToPrice(pixels: number): number | null {
    if (!this.state.priceScale || !this.state.chartDimensions) return null;

    const { min, max } = this.state.priceScale;
    const { height } = this.state.chartDimensions;
    
    const ratio = pixels / height;
    const price = max - (ratio * (max - min));
    
    return Math.min(Math.max(price, min), max);
  }

  // Generar colores para la posición basados en el side
  private generatePositionColors(side: OrderSide): OverlayPosition['colors'] {
    const isLong = side === OrderSide.BUY;
    
    return {
      upper: '#00ff88',  // Verde para zona ganadora
      lower: '#ff4444',  // Rojo para zona perdedora
      entry: isLong ? '#00ff88' : '#ff4444', // Verde para BUY, rojo para SELL
      tp: '#00ff88',     // Verde para take profit
      sl: '#ff4444',     // Rojo para stop loss
    };
  }

  // Calcular PnL no realizado
  private calculateUnrealizedPnL(order: TradingOrder, currentPrice: number): number {
    if (!currentPrice || currentPrice === 0) return 0;
    
    const priceChange = currentPrice - order.entryPrice;
    const pnl = order.side === OrderSide.BUY 
      ? priceChange * order.quantity 
      : -priceChange * order.quantity;
    
    return pnl;
  }

  // Obtener posición activa
  public getActivePosition(): OverlayPosition | null {
    if (!this.state.activePositionId) return null;
    return this.state.positions.get(this.state.activePositionId) || null;
  }

  // Obtener todas las posiciones visibles
  public getVisiblePositions(): OverlayPosition[] {
    return Array.from(this.state.positions.values()).filter(pos => pos.isVisible);
  }

  // Verificar si el overlay está activo
  public isOverlayActive(): boolean {
    return this.state.isActive;
  }

  // Obtener controles TP/SL
  public getTPSLControls(): OverlayControls {
    return { ...this.state.controls };
  }

  // Actualizar precios en tiempo real
  public updatePrices(priceUpdates: { [symbol: string]: number }): void {
    let hasUpdates = false;

    this.state.positions.forEach(position => {
      const newPrice = priceUpdates[position.symbol];
      if (newPrice && newPrice !== 0) {
        const oldPnL = position.unrealizedPnL;
        position.unrealizedPnL = this.calculateUnrealizedPnL({
          id: position.id,
          symbol: position.symbol,
          side: position.side,
          entryPrice: position.entryPrice,
          quantity: position.quantity,
        } as TradingOrder, newPrice);

        if (oldPnL !== position.unrealizedPnL) {
          hasUpdates = true;
        }
      }
    });

    if (hasUpdates) {
      this.notify();
    }
  }
}

export default OverlayManagerService;