import { useEffect, useRef, useCallback } from 'react';
import { binanceService } from '../services/binanceService';

interface UseWebSocketOptimizedOptions {
  onUpdate?: (data: any) => void;
  onError?: (error: Error) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

/**
 * Optimized WebSocket hook for ultra-fast updates
 * Manages connection lifecycle and provides efficient reconnection
 */
export const useWebSocketOptimized = (
  streamKey: string,
  isActive: boolean = true,
  options: UseWebSocketOptimizedOptions = {}
) => {
  const {
    onUpdate,
    onError,
    reconnectDelay = 1000,
    maxReconnectAttempts = 5
  } = options;

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isConnectedRef = useRef<boolean>(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stable callback references
  const onUpdateRef = useRef(onUpdate);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onErrorRef.current = onError;
  }, [onUpdate, onError]);

  const connect = useCallback(() => {
    if (!isActive || isConnectedRef.current) return;

    console.log(`🚀 Connecting to stream: ${streamKey}`);

    try {
      // Parse stream key to determine subscription type
      if (streamKey.includes('@kline_')) {
        const [symbol, intervalPart] = streamKey.split('@kline_');
        unsubscribeRef.current = binanceService.subscribeToKlines(
          symbol.toUpperCase(),
          intervalPart,
          (data) => {
            onUpdateRef.current?.(data);
            reconnectAttemptsRef.current = 0; // Reset on successful data
          },
          (error) => {
            console.error(`❌ WebSocket error for ${streamKey}:`, error);
            onErrorRef.current?.(error);
            isConnectedRef.current = false;
            scheduleReconnect();
          }
        );
      } else if (streamKey.includes('@ticker')) {
        const symbol = streamKey.split('@')[0];
        unsubscribeRef.current = binanceService.subscribeToTicker(
          symbol.toUpperCase(),
          (data) => {
            onUpdateRef.current?.(data);
            reconnectAttemptsRef.current = 0; // Reset on successful data
          },
          (error) => {
            console.error(`❌ Ticker WebSocket error for ${streamKey}:`, error);
            onErrorRef.current?.(error);
            isConnectedRef.current = false;
            scheduleReconnect();
          }
        );
      }

      isConnectedRef.current = true;
      console.log(`✅ Connected to stream: ${streamKey}`);
    } catch (error) {
      console.error(`❌ Failed to connect to ${streamKey}:`, error);
      onErrorRef.current?.(error as Error);
      scheduleReconnect();
    }
  }, [streamKey, isActive]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error(`❌ Max reconnect attempts reached for ${streamKey}`);
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttemptsRef.current += 1;
    const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1); // Exponential backoff

    console.log(`🔄 Scheduling reconnect for ${streamKey} in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (isActive) {
        isConnectedRef.current = false;
        connect();
      }
    }, delay);
  }, [streamKey, maxReconnectAttempts, reconnectDelay, connect, isActive]);

  const disconnect = useCallback(() => {
    console.log(`🔌 Disconnecting from stream: ${streamKey}`);

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    isConnectedRef.current = false;
    reconnectAttemptsRef.current = 0;
  }, [streamKey]);

  // Connect/disconnect based on isActive
  useEffect(() => {
    if (isActive) {
      connect();
    } else {
      disconnect();
    }

    return disconnect;
  }, [isActive, connect, disconnect]);

  return {
    isConnected: isConnectedRef.current,
    reconnectAttempts: reconnectAttemptsRef.current,
    forceReconnect: () => {
      disconnect();
      setTimeout(connect, 100);
    },
    disconnect
  };
};

/**
 * Specialized hook for chart data WebSocket connections
 */
export const useChartWebSocket = (
  symbol: string,
  interval: string,
  isActive: boolean = true,
  onCandleUpdate?: (candle: any) => void
) => {
  const streamKey = `${symbol.toLowerCase()}@kline_${interval}`;
  
  return useWebSocketOptimized(streamKey, isActive, {
    onUpdate: onCandleUpdate,
    onError: (error) => {
      console.error(`Chart WebSocket error for ${symbol} ${interval}:`, error);
    },
    reconnectDelay: 500, // Faster reconnect for chart data
    maxReconnectAttempts: 10
  });
};

/**
 * Specialized hook for ticker data WebSocket connections
 */
export const useTickerWebSocket = (
  symbol: string,
  isActive: boolean = true,
  onTickerUpdate?: (ticker: any) => void
) => {
  const streamKey = `${symbol.toLowerCase()}@ticker`;
  
  return useWebSocketOptimized(streamKey, isActive, {
    onUpdate: onTickerUpdate,
    onError: (error) => {
      console.error(`Ticker WebSocket error for ${symbol}:`, error);
    },
    reconnectDelay: 1000,
    maxReconnectAttempts: 5
  });
};
