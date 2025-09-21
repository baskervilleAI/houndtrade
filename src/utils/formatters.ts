// Utility function to format prices consistently across the app
export const formatPrice = (price: number | undefined | null, symbol: string): string => {
  // Validate price input
  if (price === undefined || price === null || isNaN(price) || !isFinite(price)) {
    return '0.00';
  }

  // Ensure price is a valid number
  const validPrice = Number(price);
  if (isNaN(validPrice) || !isFinite(validPrice)) {
    return '0.00';
  }

  if (symbol === 'BTCUSDT' || symbol === 'ETHUSDT') {
    return validPrice.toFixed(0);
  } else if (symbol === 'BNBUSDT' || symbol === 'SOLUSDT') {
    return validPrice.toFixed(1);
  } else if (symbol === 'ADAUSDT') {
    return validPrice.toFixed(4);
  } else {
    // Default fallback
    return validPrice.toFixed(2);
  }
};

// Format percentage change consistently
export const formatPercentage = (percentage: number | undefined | null): string => {
  // Validate percentage input
  if (percentage === undefined || percentage === null || isNaN(percentage) || !isFinite(percentage)) {
    return '0.00%';
  }

  // Ensure percentage is a valid number
  const validPercentage = Number(percentage);
  if (isNaN(validPercentage) || !isFinite(validPercentage)) {
    return '0.00%';
  }

  return `${validPercentage >= 0 ? '+' : ''}${validPercentage.toFixed(2)}%`;
};

// Format volume consistently
export const formatVolume = (volume: number | undefined | null): string => {
  // Validate volume input
  if (volume === undefined || volume === null || isNaN(volume) || !isFinite(volume)) {
    return '0';
  }

  // Ensure volume is a valid number
  const validVolume = Number(volume);
  if (isNaN(validVolume) || !isFinite(validVolume)) {
    return '0';
  }

  if (validVolume >= 1e9) {
    return `${(validVolume / 1e9).toFixed(1)}B`;
  } else if (validVolume >= 1e6) {
    return `${(validVolume / 1e6).toFixed(1)}M`;
  } else if (validVolume >= 1e3) {
    return `${(validVolume / 1e3).toFixed(1)}K`;
  } else {
    return validVolume.toString();
  }
};

// Format currency values consistently 
export const formatCurrency = (amount: number | undefined | null, decimals: number = 2): string => {
  // Validate amount input
  if (amount === undefined || amount === null || isNaN(amount) || !isFinite(amount)) {
    return '0.00';
  }

  // Ensure amount is a valid number
  const validAmount = Number(amount);
  if (isNaN(validAmount) || !isFinite(validAmount)) {
    return '0.00';
  }

  return validAmount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};
