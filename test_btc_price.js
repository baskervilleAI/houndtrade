// Quick test to check actual BTC price from Binance API
const testBTCPrice = async () => {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
    const data = await response.json();
    
    console.log('🔍 Raw Binance API Response for BTCUSDT:');
    console.log('- Symbol:', data.symbol);
    console.log('- Last Price:', data.lastPrice);
    console.log('- Parsed Price:', parseFloat(data.lastPrice));
    console.log('- Price Change:', data.priceChange);
    console.log('- Price Change %:', data.priceChangePercent);
    console.log('- High 24h:', data.highPrice);
    console.log('- Low 24h:', data.lowPrice);
    console.log('- Volume:', data.volume);
    
    const price = parseFloat(data.lastPrice);
    if (price > 200000 || price < 15000) {
      console.warn('⚠️ SUSPICIOUS BTC PRICE:', price);
    } else {
      console.log('✅ BTC price looks normal:', price);
    }
    
  } catch (error) {
    console.error('❌ Error testing BTC price:', error);
  }
};

testBTCPrice();
