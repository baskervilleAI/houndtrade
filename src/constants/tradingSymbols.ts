// Lista unificada de criptomonedas para trading
export const TRADING_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT',
  'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
  'LINKUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'FILUSDT',
  'TRXUSDT', 'ETCUSDT', 'XLMUSDT', 'BCHUSDT', 'VETUSDT',
  'ICPUSDT', 'APTUSDT', 'NEARUSDT', 'OPUSDT', 'ARBUSDT'
];

// Lista de pares populares para mostrar en la barra superior (primeros 8)
export const POPULAR_PAIRS = TRADING_SYMBOLS.slice(0, 8);