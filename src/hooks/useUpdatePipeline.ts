import { useEffect, useCallback, useState } from 'react';
import { updatePipelineService, PanelUpdateEvent } from '../services/updatePipelineService';

interface UseUpdatePipelineOptions {
  symbols: string[];
  updateInterval?: number; // milliseconds
  enableRealTime?: boolean;
  autoStart?: boolean;
}

interface UpdatePipelineState {
  isRunning: boolean;
  lastUpdates: { [symbol: string]: Date };
  errorCount: number;
  stats: any;
}

export const useUpdatePipeline = (options: UseUpdatePipelineOptions) => {
  const {
    symbols,
    updateInterval = 5000, // 5 seconds default
    enableRealTime = true,
    autoStart = true
  } = options;

  const [state, setState] = useState<UpdatePipelineState>({
    isRunning: false,
    lastUpdates: {},
    errorCount: 0,
    stats: null,
  });

  const [events, setEvents] = useState<PanelUpdateEvent[]>([]);

  // Handle pipeline updates
  const handleUpdate = useCallback((event: PanelUpdateEvent) => {
    // Add to events history (keep last 100)
    setEvents(prev => {
      const newEvents = [...prev, event];
      if (newEvents.length > 100) {
        newEvents.splice(0, newEvents.length - 100);
      }
      return newEvents;
    });

    // Update state
    setState(prev => {
      const newLastUpdates = { ...prev.lastUpdates };
      newLastUpdates[event.symbol] = event.timestamp;

      return {
        ...prev,
        lastUpdates: newLastUpdates,
        stats: updatePipelineService.getStats(),
      };
    });
  }, []);

  // Handle pipeline errors
  const handleError = useCallback((error: Error) => {
    console.error('Pipeline error:', error);
    setState(prev => ({
      ...prev,
      errorCount: prev.errorCount + 1,
      stats: updatePipelineService.getStats(),
    }));
  }, []);

  // Start pipeline
  const startPipeline = useCallback(() => {
    if (symbols.length === 0) return;

    updatePipelineService.startPipeline({
      symbols,
      updateInterval,
      enableRealTime,
      onUpdate: handleUpdate,
      onError: handleError,
    });

    setState(prev => ({
      ...prev,
      isRunning: true,
      errorCount: 0,
      stats: updatePipelineService.getStats(),
    }));
  }, [symbols, updateInterval, enableRealTime, handleUpdate, handleError]);

  // Stop pipeline
  const stopPipeline = useCallback(() => {
    updatePipelineService.stopPipeline();
    setState(prev => ({
      ...prev,
      isRunning: false,
      stats: updatePipelineService.getStats(),
    }));
  }, []);

  // Force refresh all data
  const forceRefreshAll = useCallback(async () => {
    try {
      await updatePipelineService.forceRefreshAll();
      setState(prev => ({
        ...prev,
        stats: updatePipelineService.getStats(),
      }));
    } catch (error) {
      console.error('Error forcing refresh:', error);
      handleError(error as Error);
    }
  }, [handleError]);

  // Clear cache and restart
  const clearCacheAndRestart = useCallback(async () => {
    try {
      await updatePipelineService.clearCacheAndRestart();
      setState(prev => ({
        ...prev,
        errorCount: 0,
        stats: updatePipelineService.getStats(),
      }));
      
      // Clear local events
      setEvents([]);
    } catch (error) {
      console.error('Error clearing cache:', error);
      handleError(error as Error);
    }
  }, [handleError]);

  // Add symbol to pipeline
  const addSymbol = useCallback((symbol: string) => {
    updatePipelineService.addSymbol(symbol);
    setState(prev => ({
      ...prev,
      stats: updatePipelineService.getStats(),
    }));
  }, []);

  // Remove symbol from pipeline
  const removeSymbol = useCallback((symbol: string) => {
    updatePipelineService.removeSymbol(symbol);
    setState(prev => ({
      ...prev,
      stats: updatePipelineService.getStats(),
    }));
  }, []);

  // Get events for a specific symbol
  const getEventsForSymbol = useCallback((symbol: string, type?: string) => {
    return events.filter(event => 
      event.symbol === symbol && 
      (type ? event.type === type : true)
    );
  }, [events]);

  // Get latest event for a symbol
  const getLatestEventForSymbol = useCallback((symbol: string, type?: string) => {
    const symbolEvents = getEventsForSymbol(symbol, type);
    return symbolEvents.length > 0 ? symbolEvents[symbolEvents.length - 1] : null;
  }, [getEventsForSymbol]);

  // Auto-start effect
  useEffect(() => {
    if (autoStart && symbols.length > 0) {
      startPipeline();
    }

    return () => {
      stopPipeline();
    };
  }, [autoStart, symbols]); // Restart when symbols change

  // Update stats periodically
  useEffect(() => {
    if (!state.isRunning) return;

    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        stats: updatePipelineService.getStats(),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isRunning]);

  return {
    // State
    ...state,
    events,
    
    // Actions
    startPipeline,
    stopPipeline,
    forceRefreshAll,
    clearCacheAndRestart,
    addSymbol,
    removeSymbol,
    
    // Data queries
    getEventsForSymbol,
    getLatestEventForSymbol,
    
    // Computed values
    hasData: events.length > 0,
    recentEvents: events.slice(-10), // Last 10 events
    symbolCount: symbols.length,
  };
};
