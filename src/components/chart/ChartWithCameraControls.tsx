import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ChartJSFinancialChart } from './ChartJSFinancialChart';
import { useChartCamera } from '../../hooks/useChartCamera';
import { useChartJSIntegration } from '../../hooks/useChartJSIntegration';
import { useChartData } from '../../hooks/useChartData';
import { CandleData } from '../../services/binanceService';

interface ChartWithCameraControlsProps {
  symbol: string;
  interval: string;
  height?: number;
}

export const ChartWithCameraControls: React.FC<ChartWithCameraControlsProps> = ({
  symbol,
  interval,
  height = 500,
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('Following latest');
  
  // Hook para datos del gráfico
  const { 
    candles, 
    isLoading, 
    isStreaming: dataStreaming,
    lastUpdate,
    setupStreaming,
    stopStreaming,
  } = useChartData({ 
    symbol, 
    timeframe: interval,
    autoLoad: true,
    autoStream: true 
  });

  // Hook de cámara con configuración para 900 velas máximo
  const cameraControls = useChartCamera({
    candleCount: candles.length,
    chartWidth: 400,
    chartHeight: height,
    onCameraChange: (camera) => {
      console.log('📷 Camera state changed:', camera);
      
      // Actualizar el estado de la cámara para mostrar al usuario
      if (camera.isLocked) {
        setCameraStatus('🔒 Locked');
      } else if (camera.followLatest) {
        setCameraStatus('📍 Following latest');
      } else if (camera.manuallyAdjusted) {
        setCameraStatus('👤 Manual position');
      } else {
        setCameraStatus('🔄 Auto');
      }
    },
    onNewDataReceived: !!lastUpdate,
  });

  // Hook de integración con Chart.js
  const { 
    chartRef, 
    onChartAction, 
    isChartReady, 
    setChartRef 
  } = useChartJSIntegration({
    candleCount: candles.length,
    onCameraChange: cameraControls.camera ? (camera) => {
      console.log('📊 Chart.js camera update:', camera);
    } : undefined,
  });

  // Sincronizar estado de streaming
  useEffect(() => {
    setIsStreaming(dataStreaming);
  }, [dataStreaming]);

  // Manejar nuevos datos - ajustar cámara después de cada actualización
  useEffect(() => {
    if (lastUpdate && isChartReady) {
      console.log('📊 New data received, adjusting camera...');
      onChartAction('ADJUST_CAMERA_AFTER_UPDATE');
    }
  }, [lastUpdate, isChartReady, onChartAction]);

  // Configurar máximo de 900 velas al inicio
  useEffect(() => {
    if (isChartReady) {
      onChartAction('SET_MAX_CANDLES', { count: 900 });
      console.log('📊 Chart.js configured for maximum 900 candles');
    }
  }, [isChartReady, onChartAction]);

  // Handlers para los controles de cámara
  const handleResetCamera = useCallback(() => {
    console.log('📷 User reset camera');
    cameraControls.resetCameraToLatest();
    onChartAction('RESET_CAMERA');
    Alert.alert('Camera Reset', 'Camera position reset to show latest candles');
  }, [cameraControls, onChartAction]);

  const handleLockCamera = useCallback(() => {
    console.log('📷 User lock camera');
    cameraControls.lockCameraPosition();
    onChartAction('LOCK_CAMERA');
    Alert.alert('Camera Locked', 'Camera position locked. New candles will not affect view.');
  }, [cameraControls, onChartAction]);

  const handleUnlockCamera = useCallback(() => {
    console.log('📷 User unlock camera');
    cameraControls.unlockCamera();
    cameraControls.enableAutoFollow();
    onChartAction('RESET_CAMERA');
    Alert.alert('Camera Unlocked', 'Camera will now follow new candles automatically.');
  }, [cameraControls, onChartAction]);

  const handleToggleStreaming = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
      Alert.alert('Streaming Stopped', 'Live data streaming has been stopped.');
    } else {
      setupStreaming();
      Alert.alert('Streaming Started', 'Live data streaming has been started.');
    }
  }, [isStreaming, setupStreaming, stopStreaming]);

  const handleZoomControls = useCallback((action: string) => {
    onChartAction(action);
    console.log(`📊 Zoom action: ${action}`);
  }, [onChartAction]);

  // Filtrar a máximo 900 velas para mostrar al usuario el conteo correcto
  const displayCandles = candles.length > 900 ? candles.slice(-900) : candles;

  return (
    <View style={styles.container}>
      {/* Header con información del estado */}
      <View style={styles.header}>
        <Text style={styles.title}>{symbol} - {interval}</Text>
        <Text style={styles.subtitle}>
          📊 {displayCandles.length}/900 velas | 
          {isStreaming ? ' 🟢 LIVE' : ' 🔴 PAUSED'} | 
          📷 {cameraStatus}
        </Text>
      </View>

      {/* Controles de Cámara */}
      <View style={styles.cameraControls}>
        <Text style={styles.controlsTitle}>📷 Camera Controls</Text>
        <View style={styles.controlsRow}>
          <TouchableOpacity 
            style={[styles.controlButton, styles.resetButton]} 
            onPress={handleResetCamera}
          >
            <Text style={styles.buttonText}>🔄 Reset</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.controlButton, 
              cameraControls.camera.isLocked ? styles.lockedButton : styles.unlockButton
            ]} 
            onPress={cameraControls.camera.isLocked ? handleUnlockCamera : handleLockCamera}
          >
            <Text style={styles.buttonText}>
              {cameraControls.camera.isLocked ? '🔓 Unlock' : '🔒 Lock'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.streamButton]} 
            onPress={handleToggleStreaming}
          >
            <Text style={styles.buttonText}>
              {isStreaming ? '⏸️ Pause' : '▶️ Stream'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Controles de Zoom */}
      <View style={styles.zoomControls}>
        <Text style={styles.controlsTitle}>🔍 Zoom Controls</Text>
        <View style={styles.controlsRow}>
          <TouchableOpacity 
            style={[styles.controlButton, styles.zoomButton]} 
            onPress={() => handleZoomControls('ZOOM_IN')}
          >
            <Text style={styles.buttonText}>🔍+</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.zoomButton]} 
            onPress={() => handleZoomControls('ZOOM_OUT')}
          >
            <Text style={styles.buttonText}>🔍-</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.autoFitButton]} 
            onPress={() => handleZoomControls('AUTO_FIT')}
          >
            <Text style={styles.buttonText}>📏 Auto</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart */}
      <ChartJSFinancialChart
        candles={displayCandles}
        symbol={symbol}
        isStreaming={isStreaming}
        lastCandle={displayCandles[displayCandles.length - 1]}
        height={height}
        showVolume={true}
        enableControls={true}
        onWebViewReady={setChartRef}
        onZoom={(zoomLevel) => {
          console.log('📊 Chart zoom changed:', zoomLevel);
          cameraControls.setChartJsZoomState(null, null, zoomLevel);
        }}
        onPan={(panX, panY) => {
          console.log('📊 Chart pan changed:', { panX, panY });
          cameraControls.setChartJsZoomState(panX, panY);
        }}
      />

      {/* Status footer */}
      <View style={styles.footer}>
        <Text style={styles.statusText}>
          {isLoading ? '⏳ Loading...' : 
           isStreaming ? '📡 Live streaming active' : 
           '📊 Chart ready'}
        </Text>
        {lastUpdate && (
          <Text style={styles.updateText}>
            Last update: {lastUpdate.toLocaleTimeString()}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
  },
  cameraControls: {
    padding: 16,
    backgroundColor: '#252525',
  },
  zoomControls: {
    padding: 16,
    backgroundColor: '#252525',
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  controlsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    backgroundColor: '#4CAF50',
  },
  lockedButton: {
    backgroundColor: '#f44336',
  },
  unlockButton: {
    backgroundColor: '#2196F3',
  },
  streamButton: {
    backgroundColor: '#FF9800',
  },
  zoomButton: {
    backgroundColor: '#9C27B0',
  },
  autoFitButton: {
    backgroundColor: '#607D8B',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  statusText: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 4,
  },
  updateText: {
    fontSize: 12,
    color: '#aaa',
  },
});
