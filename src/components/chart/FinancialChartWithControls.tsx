import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ChartJSFinancialChart } from './ChartJSFinancialChart';
import { ChartCameraControls } from './ChartCameraControls';
import { useChartJSIntegration } from '../../hooks/useChartCamera';
import { CandleData } from '../../services/binanceService';

interface FinancialChartWithControlsProps {
  candles: CandleData[];
  symbol: string;
  isStreaming: boolean;
  lastCandle?: CandleData;
  height?: number;
  showVolume?: boolean;
  enableControls?: boolean;
}

export const FinancialChartWithControls: React.FC<FinancialChartWithControlsProps> = ({
  candles,
  symbol,
  isStreaming,
  lastCandle,
  height = 500,
  showVolume = true,
  enableControls = true,
}) => {
  const [showCameraControls, setShowCameraControls] = useState(false);
  const [chartStatus, setChartStatus] = useState<string>('Inicializando...');

  // Usar el hook de integración
  const {
    cameraControls,
    chartRef,
    onChartAction,
    isChartReady,
    setChartRef,
  } = useChartJSIntegration({
    candleCount: candles.length,
    chartWidth: 400,
    chartHeight: height,
    onCameraChange: (camera: any) => {
      console.log('📊 Camera state changed:', camera);
    },
  });

  const handleWebViewReady = useCallback((webViewRef: any) => {
    console.log('📱 WebView ready, estableciendo referencia');
    setChartRef(webViewRef);
    setChartStatus('Chart.js cargado y listo');
  }, [setChartRef]);

  const handleZoom = useCallback((zoomLevel: number) => {
    console.log('🔍 Zoom changed:', zoomLevel);
  }, []);

  const handlePan = useCallback((panX: number, panY: number) => {
    console.log('🔄 Pan changed:', { panX, panY });
  }, []);

  return (
    <View style={styles.container}>
      {/* Header con controles básicos */}
      <View style={styles.header}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: isChartReady ? '#00ff88' : '#ff4444' }]} />
          <Text style={styles.statusText}>{chartStatus}</Text>
        </View>
        
        <View style={styles.quickControls}>
          <TouchableOpacity 
            style={styles.quickButton}
            onPress={() => onChartAction('RESET_ZOOM')}
          >
            <Text style={styles.quickButtonText}>🔄</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickButton}
            onPress={() => onChartAction('ZOOM_IN')}
          >
            <Text style={styles.quickButtonText}>🔍+</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickButton}
            onPress={() => onChartAction('ZOOM_OUT')}
          >
            <Text style={styles.quickButtonText}>🔍-</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickButton}
            onPress={() => onChartAction('GO_TO_LATEST')}
          >
            <Text style={styles.quickButtonText}>⏭️</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.quickButton, styles.cameraButton]}
            onPress={() => setShowCameraControls(true)}
          >
            <Text style={styles.quickButtonText}>🎥</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart principal */}
      <ChartJSFinancialChart
        candles={candles}
        symbol={symbol}
        isStreaming={isStreaming}
        lastCandle={lastCandle}
        onZoom={handleZoom}
        onPan={handlePan}
        onWebViewReady={handleWebViewReady}
        height={height}
        showVolume={showVolume}
        enableControls={enableControls}
      />

      {/* Controles de navegación rápida */}
      <View style={styles.navigationControls}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => onChartAction('PAN_LEFT')}
        >
          <Text style={styles.navButtonText}>⬅️ Anterior</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => onChartAction('AUTO_FIT')}
        >
          <Text style={styles.navButtonText}>📏 Auto-Fit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => onChartAction('PAN_RIGHT')}
        >
          <Text style={styles.navButtonText}>Siguiente ➡️</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de controles avanzados */}
      <ChartCameraControls
        cameraControls={cameraControls}
        isVisible={showCameraControls}
        onClose={() => setShowCameraControls(false)}
        candleCount={candles.length}
        currentTimestamp={lastCandle?.timestamp ? new Date(lastCandle.timestamp).getTime() : undefined}
        chartRef={chartRef}
        onChartAction={onChartAction}
      />

      {/* Footer con información */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          📊 {candles.length} velas • {symbol} • {isStreaming ? '🔴 LIVE' : '⏸️ PAUSED'}
        </Text>
        {isChartReady && (
          <Text style={styles.footerSubText}>
            ✅ Chart.js Financial integrado • Controles avanzados disponibles
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  quickControls: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    width: 32,
    height: 32,
    backgroundColor: '#333',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    backgroundColor: '#00ff88',
  },
  quickButtonText: {
    fontSize: 14,
  },
  navigationControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#333',
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    padding: 8,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  footerText: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
  },
  footerSubText: {
    color: '#00ff88',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
});

export default FinancialChartWithControls;
