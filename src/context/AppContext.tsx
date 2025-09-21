import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// Types
interface User {
  id: string;
  email: string;
  displayName: string;
}

interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  openedAt: string;
}

interface Order {
  id: string;
  symbol: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  quantity: number;
  price?: number;
  status: 'pending' | 'filled';
  createdAt: string;
}

interface TickerData {
  symbol: string;
  price: number;
  changePercent24h: number;
}

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  
  // Trading
  balance: number;
  equity: number;
  totalPnl: number;
  pnlPercentage: number;
  positions: Position[];
  orders: Order[];
  
  // Market
  selectedPair: string;
  tickers: Record<string, TickerData>;
}

type AppAction = 
  | { type: 'LOGIN'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_TICKER'; payload: TickerData }
  | { type: 'SET_SELECTED_PAIR'; payload: string }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'ADD_POSITION'; payload: Position }
  | { type: 'UPDATE_POSITIONS'; payload: Record<string, number> }
  | { type: 'CLOSE_POSITION'; payload: string };

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  balance: 1000000,
  equity: 1000000,
  totalPnl: 0,
  pnlPercentage: 0,
  positions: [],
  orders: [],
  selectedPair: 'BTCUSDT',
  tickers: {},
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOGIN':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
      };
    
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
      };
    
    case 'UPDATE_TICKER':
      return {
        ...state,
        tickers: {
          ...state.tickers,
          [action.payload.symbol]: action.payload,
        },
      };
    
    case 'SET_SELECTED_PAIR':
      return {
        ...state,
        selectedPair: action.payload,
      };
    
    case 'ADD_ORDER':
      return {
        ...state,
        orders: [...state.orders, action.payload],
      };
    
    case 'ADD_POSITION':
      return {
        ...state,
        positions: [...state.positions, action.payload],
      };
    
    case 'UPDATE_POSITIONS':
      const updatedPositions = state.positions.map(position => {
        const currentPrice = action.payload[position.symbol];
        if (!currentPrice) return position;

        const priceDiff = currentPrice - position.entryPrice;
        const unrealizedPnl = position.side === 'long' 
          ? priceDiff * position.quantity
          : -priceDiff * position.quantity;

        return {
          ...position,
          currentPrice,
          unrealizedPnl,
        };
      });

      const totalUnrealizedPnl = updatedPositions.reduce(
        (sum, pos) => sum + pos.unrealizedPnl, 0
      );

      const equity = state.balance + totalUnrealizedPnl;
      const pnlPercentage = (totalUnrealizedPnl / 1000000) * 100;

      return {
        ...state,
        positions: updatedPositions,
        equity,
        totalPnl: totalUnrealizedPnl,
        pnlPercentage,
      };
    
    case 'CLOSE_POSITION':
      return {
        ...state,
        positions: state.positions.filter(p => p.id !== action.payload),
      };
    
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

// Helper hooks
export const useAuth = () => {
  const { state, dispatch } = useAppContext();
  
  const login = async (email: string, password: string) => {
    // Hardcoded login logic
    if (email === 'baskerville@houndtrade.com' && password === '444binance') {
      const user: User = {
        id: 'user_baskerville',
        email,
        displayName: 'Baskerville',
      };
      dispatch({ type: 'LOGIN', payload: user });
    } else {
      throw new Error('Invalid credentials');
    }
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT' });
  };

  return {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    login,
    logout,
  };
};

export const useTrading = () => {
  const { state, dispatch } = useAppContext();
  
  const placeOrder = async (orderData: {
    symbol: string;
    type: 'market' | 'limit';
    side: 'buy' | 'sell';
    quantity: number;
    price?: number;
  }) => {
    const orderId = `order_${Date.now()}`;
    const currentPrice = state.tickers[orderData.symbol]?.price || 45000;
    const executionPrice = orderData.type === 'market' ? currentPrice : (orderData.price || currentPrice);
    
    // Check balance
    const orderValue = orderData.quantity * executionPrice;
    if (orderData.side === 'buy' && orderValue > state.balance) {
      throw new Error('Insufficient balance');
    }

    const order: Order = {
      id: orderId,
      symbol: orderData.symbol,
      type: orderData.type,
      side: orderData.side,
      quantity: orderData.quantity,
      price: orderData.price,
      status: 'filled',
      createdAt: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_ORDER', payload: order });

    // Create position
    const positionId = `pos_${Date.now()}`;
    const position: Position = {
      id: positionId,
      symbol: orderData.symbol,
      side: orderData.side === 'buy' ? 'long' : 'short',
      quantity: orderData.quantity,
      entryPrice: executionPrice,
      currentPrice: executionPrice,
      unrealizedPnl: 0,
      openedAt: new Date().toISOString(),
    };

    dispatch({ type: 'ADD_POSITION', payload: position });
    return orderId;
  };

  return {
    balance: state.balance,
    equity: state.equity,
    totalPnl: state.totalPnl,
    pnlPercentage: state.pnlPercentage,
    positions: state.positions,
    orders: state.orders,
    placeOrder,
  };
};

export const useMarket = () => {
  const { state, dispatch } = useAppContext();
  
  const updateTicker = (ticker: TickerData) => {
    dispatch({ type: 'UPDATE_TICKER', payload: ticker });
  };

  const setSelectedPair = (symbol: string) => {
    dispatch({ type: 'SET_SELECTED_PAIR', payload: symbol });
  };

  const updatePositions = (prices: Record<string, number>) => {
    dispatch({ type: 'UPDATE_POSITIONS', payload: prices });
  };

  return {
    selectedPair: state.selectedPair,
    tickers: state.tickers,
    updateTicker,
    setSelectedPair,
    updatePositions,
  };
};