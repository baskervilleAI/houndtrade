export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M';

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades?: number;
  quoteVolume?: number;
  takerBuyBaseVolume?: number;
  takerBuyQuoteVolume?: number;
}

export interface TickerData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  trades24h: number;
  timestamp: string;
  openPrice: number;
  prevClosePrice: number;
  weightedAvgPrice: number;
}

export interface MarketDepth {
  symbol: string;
  bids: [number, number][]; // [price, quantity]
  asks: [number, number][]; // [price, quantity]
  lastUpdateId: number;
  timestamp: string;
}

export interface TradingPairInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: 'TRADING' | 'BREAK' | 'HALT';
  baseAssetPrecision: number;
  quotePrecision: number;
  quoteAssetPrecision: number;
  baseCommissionPrecision: number;
  quoteCommissionPrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  allowTrailingStop: boolean;
  cancelReplaceAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: PairFilter[];
  permissions: string[];
  defaultSelfTradePreventionMode: string;
  allowedSelfTradePreventionModes: string[];
}

export interface PairFilter {
  filterType: string;
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
  minQty?: string;
  maxQty?: string;
  stepSize?: string;
  minNotional?: string;
  applyToMarket?: boolean;
  avgPriceMins?: number;
  multiplierUp?: string;
  multiplierDown?: string;
  multiplierDecimal?: string;
}

export interface MarketStats {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  weightedAvgPrice: number;
  prevClosePrice: number;
  lastPrice: number;
  lastQty: number;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export interface OHLCVRequest {
  symbol: string;
  timeframe: Timeframe;
  limit?: number;
  startTime?: number;
  endTime?: number;
}

export interface OHLCVResponse {
  symbol: string;
  timeframe: Timeframe;
  data: CandleData[];
}

export interface MarketState {
  selectedPair: string;
  pairs: TradingPairInfo[];
  tickers: Record<string, TickerData>;
  candleData: Record<string, Record<Timeframe, CandleData[]>>;
  orderBooks: Record<string, MarketDepth>;
  isLoading: boolean;
  error: string | null;
  lastUpdate: string;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  targetPrice: number;
  currentPrice: number;
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
  message?: string;
}

export interface MarketFilter {
  category?: string;
  minVolume?: number;
  maxVolume?: number;
  minPrice?: number;
  maxPrice?: number;
  minChange?: number;
  maxChange?: number;
  search?: string;
  favorites?: boolean;
}

export interface MarketSortOptions {
  field: 'symbol' | 'price' | 'change' | 'volume' | 'marketCap';
  direction: 'asc' | 'desc';
}

export interface TechnicalIndicator {
  name: string;
  values: number[];
  timestamps: string[];
  parameters: Record<string, any>;
}

export interface ChartData {
  symbol: string;
  timeframe: Timeframe;
  candles: CandleData[];
  indicators: Record<string, TechnicalIndicator>;
  volume: number[];
  lastUpdate: string;
}