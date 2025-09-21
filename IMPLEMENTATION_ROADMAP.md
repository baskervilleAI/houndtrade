# HoundTrade Implementation Roadmap

## Development Timeline (10 Weeks)

### Week 1-2: Foundation & Setup
**Goal**: Establish development environment and core architecture

#### Week 1: Project Setup
- [ ] Initialize Expo project with TypeScript
- [ ] Configure Tamagui theming system
- [ ] Set up Zustand store architecture
- [ ] Implement basic navigation structure
- [ ] Create environment configuration
- [ ] Set up development tools (ESLint, Prettier, Husky)

#### Week 2: Authentication Foundation
- [ ] Design authentication screens (Login, Signup, Reset)
- [ ] Implement AWS Cognito integration
- [ ] Set up secure storage for tokens
- [ ] Create basic onboarding flow
- [ ] Implement social login (Google/Apple)

### Week 3-4: Core Trading Features
**Goal**: Build fundamental trading functionality

#### Week 3: Market Data Integration
- [ ] Implement Binance REST API client
- [ ] Set up WebSocket connection for real-time data
- [ ] Create crypto pair management system
- [ ] Build basic price ticker components
- [ ] Implement data caching and offline handling

#### Week 4: Paper Trading Engine
- [ ] Design and implement paper trading engine
- [ ] Create order validation system
- [ ] Build portfolio management logic
- [ ] Implement commission calculation
- [ ] Add account reset functionality

### Week 5-6: Advanced Trading & Charts
**Goal**: Implement sophisticated trading tools

#### Week 5: Chart Implementation
- [ ] Build candlestick chart component with WebGL
- [ ] Implement zoom and pan functionality
- [ ] Add multiple timeframe support
- [ ] Create basic technical indicators (MA, RSI)
- [ ] Optimize chart performance for 60fps

#### Week 6: Advanced Trading Features
- [ ] Implement market and limit orders
- [ ] Add advanced order types (stop-loss, trailing stops)
- [ ] Build TP/SL drag handles on charts
- [ ] Create order book visualization
- [ ] Add drawing tools for chart analysis

### Week 7-8: Social Features & Backend
**Goal**: Build community features and robust backend

#### Week 7: Leaderboard System
- [ ] Design leaderboard UI components
- [ ] Implement ranking calculation logic
- [ ] Create user profile screens
- [ ] Add real-time leaderboard updates
- [ ] Build performance analytics

#### Week 8: AWS Backend Deployment
- [ ] Set up AWS infrastructure (CloudFormation)
- [ ] Deploy Lambda functions for API endpoints
- [ ] Configure DynamoDB tables and indexes
- [ ] Implement WebSocket server for real-time updates
- [ ] Set up monitoring and logging

### Week 9-10: Polish & Launch
**Goal**: Finalize app for production release

#### Week 9: Telemetry & Analytics
- [ ] Implement comprehensive telemetry system
- [ ] Add opt-in event logging for RLHF
- [ ] Create analytics dashboard
- [ ] Set up crash reporting and monitoring
- [ ] Implement privacy controls

#### Week 10: Testing & Deployment
- [ ] Comprehensive testing (unit, integration, E2E)
- [ ] Performance optimization and bundle analysis
- [ ] App store preparation and assets
- [ ] CI/CD pipeline setup
- [ ] Production deployment and monitoring

## Technical Implementation Details

### Phase 1: Foundation (Weeks 1-2)

#### 1.1 Project Dependencies Setup
```bash
# Core dependencies
npm install @tamagui/core @tamagui/config @tamagui/animations-react-native
npm install zustand @tanstack/react-query
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npm install react-native-reanimated moti react-native-gesture-handler
npm install react-native-safe-area-context react-native-screens

# Authentication & Storage
npm install amazon-cognito-identity-js @react-native-async-storage/async-storage
npm install expo-secure-store expo-local-authentication
npm install @react-native-google-signin/google-signin
npm install @invertase/react-native-apple-authentication

# Charts & Visualization
npm install react-native-svg react-native-skia victory-native d3

# WebSocket & Networking
npm install ws axios react-native-url-polyfill

# Development dependencies
npm install --save-dev @types/react @types/react-native @types/ws @types/d3
npm install --save-dev typescript jest @testing-library/react-native detox
npm install --save-dev eslint @typescript-eslint/eslint-plugin prettier husky lint-staged
```

#### 1.2 Tamagui Configuration
```typescript
// tamagui.config.ts
import { config } from '@tamagui/config/v3'
import { createTamagui } from '@tamagui/core'

const houndTradeConfig = createTamagui({
  ...config,
  themes: {
    ...config.themes,
    dark_hound: {
      background: '#0a0a0a',
      backgroundHover: '#151515',
      backgroundPress: '#1a1a1a',
      backgroundStrong: '#262626',
      backgroundTransparent: 'rgba(0,0,0,0.7)',
      color: '#ffffff',
      colorHover: '#f0f0f0',
      colorPress: '#e0e0e0',
      colorTransparent: 'rgba(255,255,255,0.9)',
      borderColor: '#333333',
      borderColorHover: '#444444',
      borderColorPress: '#555555',
      placeholderColor: '#888888',
      green: '#00ff88',
      greenTransparent: 'rgba(0,255,136,0.2)',
      red: '#ff4444',
      redTransparent: 'rgba(255,68,68,0.2)',
      blue: '#0088ff',
      blueTransparent: 'rgba(0,136,255,0.2)',
      yellow: '#ffaa00',
      yellowTransparent: 'rgba(255,170,0,0.2)',
      purple: '#aa44ff',
      purpleTransparent: 'rgba(170,68,255,0.2)',
    },
    light_hound: {
      background: '#ffffff',
      backgroundHover: '#f5f5f5',
      backgroundPress: '#eeeeee',
      backgroundStrong: '#e0e0e0',
      backgroundTransparent: 'rgba(255,255,255,0.9)',
      color: '#000000',
      colorHover: '#333333',
      colorPress: '#666666',
      colorTransparent: 'rgba(0,0,0,0.9)',
      borderColor: '#e0e0e0',
      borderColorHover: '#d0d0d0',
      borderColorPress: '#c0c0c0',
      placeholderColor: '#999999',
      green: '#00cc66',
      greenTransparent: 'rgba(0,204,102,0.2)',
      red: '#cc3333',
      redTransparent: 'rgba(204,51,51,0.2)',
      blue: '#0066cc',
      blueTransparent: 'rgba(0,102,204,0.2)',
      yellow: '#cc8800',
      yellowTransparent: 'rgba(204,136,0,0.2)',
      purple: '#8833cc',
      purpleTransparent: 'rgba(136,51,204,0.2)',
    },
  },
  tokens: {
    ...config.tokens,
    space: {
      ...config.tokens.space,
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 48,
    },
    radius: {
      ...config.tokens.radius,
      xs: 2,
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    },
  },
})

export default houndTradeConfig
```

#### 1.3 Zustand Store Architecture
```typescript
// src/stores/authStore.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface User {
  id: string
  email: string
  displayName: string
  avatar?: string
  createdAt: string
  emailVerified: boolean
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  refreshAuth: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      
      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await authService.login(email, password)
          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      
      register: async (data: RegisterData) => {
        set({ isLoading: true })
        try {
          await authService.register(data)
          set({ isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      
      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },
      
      refreshAuth: async () => {
        const { refreshToken } = get()
        if (!refreshToken) throw new Error('No refresh token')
        
        try {
          const response = await authService.refresh(refreshToken)
          set({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          })
        } catch (error) {
          get().logout()
          throw error
        }
      },
      
      updateProfile: async (data: Partial<User>) => {
        const { user } = get()
        if (!user) throw new Error('No user logged in')
        
        const updatedUser = await authService.updateProfile(data)
        set({ user: updatedUser })
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
```

### Phase 2: Core Trading (Weeks 3-4)

#### 2.1 Binance WebSocket Client
```typescript
// src/services/websocket/binanceWS.ts
import { EventEmitter } from 'events'

interface BinanceWSConfig {
  baseURL: string
  reconnectInterval: number
  maxReconnectAttempts: number
}

export class BinanceWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null
  private config: BinanceWSConfig
  private subscriptions: Set<string> = new Set()
  private reconnectAttempts = 0
  private isConnecting = false
  
  constructor(config: BinanceWSConfig) {
    super()
    this.config = config
  }
  
  connect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return
    }
    
    this.isConnecting = true
    this.ws = new WebSocket(this.config.baseURL)
    
    this.ws.onopen = () => {
      console.log('Binance WebSocket connected')
      this.isConnecting = false
      this.reconnectAttempts = 0
      this.emit('connected')
      
      // Resubscribe to previous subscriptions
      this.subscriptions.forEach(subscription => {
        this.send(subscription)
      })
    }
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }
    
    this.ws.onclose = () => {
      console.log('Binance WebSocket disconnected')
      this.isConnecting = false
      this.emit('disconnected')
      this.scheduleReconnect()
    }
    
    this.ws.onerror = (error) => {
      console.error('Binance WebSocket error:', error)
      this.emit('error', error)
    }
  }
  
  private handleMessage(data: any): void {
    if (data.stream) {
      const [symbol, type] = data.stream.split('@')
      
      switch (type) {
        case 'ticker':
          this.emit('ticker', {
            symbol: symbol.toUpperCase(),
            price: parseFloat(data.data.c),
            change24h: parseFloat(data.data.P),
            volume24h: parseFloat(data.data.v),
            timestamp: new Date(data.data.E).toISOString(),
          })
          break
          
        case 'kline_1m':
        case 'kline_5m':
        case 'kline_1h':
        case 'kline_1d':
          const kline = data.data.k
          this.emit('kline', {
            symbol: kline.s,
            timeframe: type.split('_')[1],
            data: {
              timestamp: new Date(kline.t).toISOString(),
              open: parseFloat(kline.o),
              high: parseFloat(kline.h),
              low: parseFloat(kline.l),
              close: parseFloat(kline.c),
              volume: parseFloat(kline.v),
              isClosed: kline.x,
            },
          })
          break
      }
    }
  }
  
  subscribeTicker(symbol: string): void {
    const subscription = `${symbol.toLowerCase()}@ticker`
    this.subscriptions.add(subscription)
    this.send({
      method: 'SUBSCRIBE',
      params: [subscription],
      id: Date.now(),
    })
  }
  
  subscribeKline(symbol: string, interval: string): void {
    const subscription = `${symbol.toLowerCase()}@kline_${interval}`
    this.subscriptions.add(subscription)
    this.send({
      method: 'SUBSCRIBE',
      params: [subscription],
      id: Date.now(),
    })
  }
  
  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }
    
    this.reconnectAttempts++
    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`)
      this.connect()
    }, this.config.reconnectInterval)
  }
  
  disconnect(): void {
    this.subscriptions.clear()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
```

#### 2.2 Paper Trading Engine
```typescript
// src/services/trading/paperEngine.ts
import { create } from 'zustand'

interface Position {
  id: string
  symbol: string
  side: 'long' | 'short'
  quantity: number
  entryPrice: number
  currentPrice: number
  unrealizedPnl: number
  realizedPnl: number
  openedAt: string
  takeProfitPrice?: number
  stopLossPrice?: number
}

interface Order {
  id: string
  symbol: string
  type: 'market' | 'limit' | 'stop' | 'stop_limit'
  side: 'buy' | 'sell'
  quantity: number
  price?: number
  stopPrice?: number
  status: 'pending' | 'filled' | 'cancelled' | 'rejected'
  createdAt: string
  executedAt?: string
  executedPrice?: number
  commission: number
}

interface TradingState {
  balance: number
  equity: number
  positions: Position[]
  orders: Order[]
  trades: Order[]
  
  // Actions
  placeOrder: (orderData: PlaceOrderData) => Promise<string>
  cancelOrder: (orderId: string) => void
  updatePositions: (prices: Record<string, number>) => void
  resetAccount: () => void
}

export const useTradingStore = create<TradingState>((set, get) => ({
  balance: 1000000, // Default 1M USDT
  equity: 1000000,
  positions: [],
  orders: [],
  trades: [],
  
  placeOrder: async (orderData: PlaceOrderData) => {
    const orderId = generateOrderId()
    const commission = calculateCommission(orderData.quantity, orderData.price || 0)
    
    const order: Order = {
      id: orderId,
      symbol: orderData.symbol,
      type: orderData.type,
      side: orderData.side,
      quantity: orderData.quantity,
      price: orderData.price,
      stopPrice: orderData.stopPrice,
      status: 'pending',
      createdAt: new Date().toISOString(),
      commission,
    }
    
    set(state => ({
      orders: [...state.orders, order]
    }))
    
    // Simulate order execution for market orders
    if (orderData.type === 'market') {
      setTimeout(() => {
        get().executeOrder(orderId, getCurrentPrice(orderData.symbol))
      }, 100)
    }
    
    return orderId
  },
  
  executeOrder: (orderId: string, executionPrice: number) => {
    set(state => {
      const orderIndex = state.orders.findIndex(o => o.id === orderId)
      if (orderIndex === -1) return state
      
      const order = state.orders[orderIndex]
      const executedOrder = {
        ...order,
        status: 'filled' as const,
        executedAt: new Date().toISOString(),
        executedPrice: executionPrice,
      }
      
      // Update balance
      const cost = order.quantity * executionPrice + order.commission
      const newBalance = order.side === 'buy' 
        ? state.balance - cost 
        : state.balance + cost
      
      // Update or create position
      const existingPositionIndex = state.positions.findIndex(
        p => p.symbol === order.symbol
      )
      
      let newPositions = [...state.positions]
      
      if (existingPositionIndex >= 0) {
        // Update existing position
        const position = state.positions[existingPositionIndex]
        const newQuantity = order.side === 'buy' 
          ? position.quantity + order.quantity
          : position.quantity - order.quantity
        
        if (newQuantity === 0) {
          // Close position
          newPositions.splice(existingPositionIndex, 1)
        } else {
          // Update position
          const newAvgPrice = calculateAveragePrice(
            position.quantity, position.entryPrice,
            order.quantity, executionPrice,
            order.side
          )
          
          newPositions[existingPositionIndex] = {
            ...position,
            quantity: Math.abs(newQuantity),
            side: newQuantity > 0 ? 'long' : 'short',
            entryPrice: newAvgPrice,
          }
        }
      } else {
        // Create new position
        newPositions.push({
          id: generatePositionId(),
          symbol: order.symbol,
          side: order.side === 'buy' ? 'long' : 'short',
          quantity: order.quantity,
          entryPrice: executionPrice,
          currentPrice: executionPrice,
          unrealizedPnl: 0,
          realizedPnl: 0,
          openedAt: new Date().toISOString(),
        })
      }
      
      return {
        ...state,
        balance: newBalance,
        orders: [
          ...state.orders.slice(0, orderIndex),
          ...state.orders.slice(orderIndex + 1)
        ],
        trades: [...state.trades, executedOrder],
        positions: newPositions,
      }
    })
  },
  
  updatePositions: (prices: Record<string, number>) => {
    set(state => {
      const updatedPositions = state.positions.map(position => {
        const currentPrice = prices[position.symbol]
        if (!currentPrice) return position
        
        const priceDiff = currentPrice - position.entryPrice
        const unrealizedPnl = position.side === 'long' 
          ? priceDiff * position.quantity
          : -priceDiff * position.quantity
        
        return {
          ...position,
          currentPrice,
          unrealizedPnl,
        }
      })
      
      const totalUnrealizedPnl = updatedPositions.reduce(
        (sum, pos) => sum + pos.unrealizedPnl, 0
      )
      
      return {
        ...state,
        positions: updatedPositions,
        equity: state.balance + totalUnrealizedPnl,
      }
    })
  },
  
  resetAccount: () => {
    set({
      balance: 1000000,
      equity: 1000000,
      positions: [],
      orders: [],
      trades: [],
    })
  },
}))

// Helper functions
function generateOrderId(): string {
  return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function generatePositionId(): string {
  return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function calculateCommission(quantity: number, price: number): number {
  const COMMISSION_RATE = 0.001 // 0.1%
  return quantity * price * COMMISSION_RATE
}

function calculateAveragePrice(
  qty1: number, price1: number,
  qty2: number, price2: number,
  side: 'buy' | 'sell'
): number {
  if (side === 'buy') {
    return (qty1 * price1 + qty2 * price2) / (qty1 + qty2)
  } else {
    return (qty1 * price1 - qty2 * price2) / (qty1 - qty2)
  }
}

function getCurrentPrice(symbol: string): number {
  // This would be replaced with actual market data
  return Math.random() * 50000 + 25000 // Mock BTC price
}
```

### Phase 3: Advanced Features (Weeks 5-6)

#### 3.1 Candlestick Chart Component
```typescript
// src/components/chart/CandlestickChart.tsx
import React, { useEffect, useRef, useState } from 'react'
import { View, Dimensions } from 'react-native'
import { Canvas, useCanvasRef } from '@shopify/react-native-skia'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import Animated, { 
  useSharedValue, 
  useAnimatedStyle,
  runOnJS,
  withSpring 
} from 'react-native-reanimated'

interface CandleData {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface CandlestickChartProps {
  data: CandleData[]
  width?: number
  height?: number
  onPriceSelect?: (price: number) => void
  takeProfitPrice?: number
  stopLossPrice?: number
  onTakeProfitChange?: (price: number) => void
  onStopLossChange?: (price: number) => void
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  width = Dimensions.get('window').width,
  height = 400,
  onPriceSelect,
  takeProfitPrice,
  stopLossPrice,
  onTakeProfitChange,
  onStopLossChange,
}) => {
  const canvasRef = useCanvasRef()
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 100 })
  const [priceRange, setPriceRange] = useState({ min: 0, max: 0 })
  
  // Gesture handling
  const scale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const lastScale = useSharedValue(1)
  const lastTranslateX = useSharedValue(0)
  
  // Calculate price range for visible candles
  useEffect(() => {
    if (data.length === 0) return
    
    const visibleData = data.slice(visibleRange.start, visibleRange.end)
    const prices = visibleData.flatMap(candle => [candle.high, candle.low])
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const padding = (max - min) * 0.1
    
    setPriceRange({ min: min - padding, max: max + padding })
  }, [data, visibleRange])
  
  // Pan gesture for scrolling
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = lastTranslateX.value + event.translationX
    })
    .onEnd(() => {
      lastTranslateX.value = translateX.value
      
      // Update visible range based on translation
      runOnJS(updateVisibleRange)(translateX.value)
    })
  
  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(0.5, Math.min(lastScale.value * event.scale, 5))
    })
    .onEnd(() => {
      lastScale.value = scale.value
      runOnJS(updateVisibleRange)(translateX.value)
    })
  
  // Tap gesture for price selection
  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      const price = screenYToPrice(event.y)
      runOnJS(handlePriceSelect)(price)
    })
  
  const composedGesture = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    tapGesture
  )
  
  const updateVisibleRange = (translationX: number) => {
    const candleWidth = width / 100
    const offset = Math.floor(-translationX / candleWidth)
    const visibleCount = Math.floor(100 / scale.value)
    
    const start = Math.max(0, offset)
    const end = Math.min(data.length, start + visibleCount)
    
    setVisibleRange({ start, end })
  }
  
  const screenYToPrice = (screenY: number): number => {
    const ratio = (height - screenY) / height
    return priceRange.min + (priceRange.max - priceRange.min) * ratio
  }
  
  const priceToScreenY = (price: number): number => {
    const ratio = (price - priceRange.min) / (priceRange.max - priceRange.min)
    return height - (ratio * height)
  }
  
  const handlePriceSelect = (price: number) => {
    onPriceSelect?.(price)
  }
  
  // Animated style for canvas transformations
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }))
  
  // Draw candles on canvas
  const drawCandles = () => {
    if (!canvasRef.current || data.length === 0) return
    
    const ctx = canvasRef.current.getContext('2d')
    const visibleData = data.slice(visibleRange.start, visibleRange.end)
    const candleWidth = width / visibleData.length
    
    ctx.clearRect(0, 0, width, height)
    
    visibleData.forEach((candle, index) => {
      const x = index * candleWidth + candleWidth / 2
      const openY = priceToScreenY(candle.open)
      const closeY = priceToScreenY(candle.close)
      const highY = priceToScreenY(candle.high)
      const lowY = priceToScreenY(candle.low)
      
      const isGreen = candle.close > candle.open
      const color = isGreen ? '#00ff88' : '#ff4444'
      
      // Draw wick
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()
      
      // Draw body
      ctx.fillStyle = color
      const bodyTop = Math.min(openY, closeY)
      const bodyHeight = Math.abs(closeY - openY)
      const bodyWidth = candleWidth * 0.8
      
      ctx.fillRect(
        x - bodyWidth / 2,
        bodyTop,
        bodyWidth,
        Math.max(bodyHeight, 1)
      )
    })
    
    // Draw TP/SL lines
    if (takeProfitPrice) {
      const tpY = priceToScreenY(takeProfitPrice)
      ctx.strokeStyle = '#00ff88'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, tpY)
      ctx.lineTo(width, tpY)
      ctx.stroke()
      ctx.setLineDash([])
    }
    
    if (stopLossPrice) {
      const slY = priceToScreenY(stopLossPrice)
      ctx.strokeStyle = '#ff4444'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, slY)
      ctx.lineTo(width, slY)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
  
  useEffect(() => {
    drawCandles()
  }, [data, visibleRange, priceRange, takeProfitPrice, stopLossPrice])
  
  return (
    <View style={{ width, height }}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
          <Canvas
            ref={canvasRef}
            style={{ width, height }}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  )
}
```

This implementation roadmap provides a comprehensive guide for building the HoundTrade app with detailed technical specifications, code examples, and a realistic timeline. The modular approach ensures each phase builds upon the previous one while maintaining code quality and performance standards.