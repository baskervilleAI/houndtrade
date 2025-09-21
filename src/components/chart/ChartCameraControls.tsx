import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { CameraControls } from '../../hooks/useChartCamera';

interface ChartCameraControlsProps {
  cameraControls: CameraControls;
  isVisible: boolean;
  onClose: () => void;
  candleCount: number;
  currentTimestamp?: number;
  onGoToDate?: (date: Date) => void;
}

export const ChartCameraControls: React.FC<ChartCameraControlsProps> = ({
  cameraControls,
  isVisible,
  onClose,
  candleCount,
  currentTimestamp,
  onGoToDate,
}) => {
  const [customZoom, setCustomZoom] = React.useState('');
  const [gotoIndex, setGotoIndex] = React.useState('');
  const [gotoDate, setGotoDate] = React.useState('');

  const { camera } = cameraControls;
  const visibleRange = cameraControls.getVisibleRange();

  const handleCustomZoom = () => {
    const zoom = parseFloat(customZoom);
    if (isNaN(zoom) || zoom <= 0) {
      Alert.alert('Error', 'Por favor ingresa un valor de zoom válido (mayor a 0)');
      return;
    }
    cameraControls.setZoom(zoom);
    setCustomZoom('');
  };

  const handleGotoIndex = () => {
    const index = parseInt(gotoIndex);
    if (isNaN(index) || index < 0 || index >= candleCount) {
      Alert.alert('Error', `Por favor ingresa un índice válido (0 - ${candleCount - 1})`);
      return;
    }
    cameraControls.goToIndex(index);
    setGotoIndex('');
  };

  const handleGotoDate = () => {
    try {
      const date = new Date(gotoDate);
      if (isNaN(date.getTime())) {
        Alert.alert('Error', 'Por favor ingresa una fecha válida (YYYY-MM-DD HH:mm)');
        return;
      }
      onGoToDate?.(date);
      setGotoDate('');
    } catch (error) {
      Alert.alert('Error', 'Formato de fecha inválido');
    }
  };

  const zoomPresets = [0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0];

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>🎥 Controles de Cámara</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Camera Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Estado Actual</Text>
              <View style={styles.infoGrid}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Zoom:</Text>
                  <Text style={styles.infoValue}>{camera.zoomLevel.toFixed(2)}x</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Posición X:</Text>
                  <Text style={styles.infoValue}>{(camera.offsetX * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Velas Visibles:</Text>
                  <Text style={styles.infoValue}>{visibleRange.count}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Rango:</Text>
                  <Text style={styles.infoValue}>
                    {visibleRange.start} - {visibleRange.end}
                  </Text>
                </View>
              </View>
            </View>

            {/* Zoom Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔍 Control de Zoom</Text>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.actionButton} onPress={cameraControls.zoomOut}>
                  <Text style={styles.buttonText}>🔍- Alejar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={cameraControls.zoomIn}>
                  <Text style={styles.buttonText}>🔍+ Acercar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={cameraControls.resetZoom}>
                  <Text style={styles.buttonText}>↻ Reset</Text>
                </TouchableOpacity>
              </View>

              {/* Zoom Presets */}
              <Text style={styles.subTitle}>Presets de Zoom:</Text>
              <View style={styles.presetGrid}>
                {zoomPresets.map((zoom) => (
                  <TouchableOpacity
                    key={zoom}
                    style={[
                      styles.presetButton,
                      Math.abs(camera.zoomLevel - zoom) < 0.1 && styles.activePreset
                    ]}
                    onPress={() => cameraControls.setZoom(zoom)}
                  >
                    <Text style={[
                      styles.presetText,
                      Math.abs(camera.zoomLevel - zoom) < 0.1 && styles.activePresetText
                    ]}>
                      {zoom}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Zoom */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Zoom personalizado (ej: 3.5)"
                  placeholderTextColor="#666"
                  value={customZoom}
                  onChangeText={setCustomZoom}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.inputButton} onPress={handleCustomZoom}>
                  <Text style={styles.buttonText}>Aplicar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Pan Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔄 Control de Paneo</Text>
              
              <View style={styles.panControls}>
                <TouchableOpacity style={styles.panButton} onPress={cameraControls.panUp}>
                  <Text style={styles.panButtonText}>⬆️</Text>
                </TouchableOpacity>
                <View style={styles.panRow}>
                  <TouchableOpacity style={styles.panButton} onPress={cameraControls.panLeft}>
                    <Text style={styles.panButtonText}>⬅️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.centerButton} onPress={() => cameraControls.setPan(0.5, 0)}>
                    <Text style={styles.panButtonText}>⭕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.panButton} onPress={cameraControls.panRight}>
                    <Text style={styles.panButtonText}>➡️</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.panButton} onPress={cameraControls.panDown}>
                  <Text style={styles.panButtonText}>⬇️</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Navigation Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🧭 Navegación</Text>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.actionButton} onPress={cameraControls.goToStart}>
                  <Text style={styles.buttonText}>⏮️ Inicio</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={cameraControls.goToEnd}>
                  <Text style={styles.buttonText}>⏭️ Final</Text>
                </TouchableOpacity>
              </View>

              {/* Go to Index */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder={`Ir a índice (0-${candleCount - 1})`}
                  placeholderTextColor="#666"
                  value={gotoIndex}
                  onChangeText={setGotoIndex}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={styles.inputButton} onPress={handleGotoIndex}>
                  <Text style={styles.buttonText}>Ir</Text>
                </TouchableOpacity>
              </View>

              {/* Go to Date */}
              {onGoToDate && (
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ir a fecha (YYYY-MM-DD HH:mm)"
                    placeholderTextColor="#666"
                    value={gotoDate}
                    onChangeText={setGotoDate}
                  />
                  <TouchableOpacity style={styles.inputButton} onPress={handleGotoDate}>
                    <Text style={styles.buttonText}>Ir</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Fit Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📐 Ajuste Automático</Text>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.actionButton} onPress={cameraControls.fitAll}>
                  <Text style={styles.buttonText}>📊 Ajustar Todo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={cameraControls.fitVisible}>
                  <Text style={styles.buttonText}>👁️ Ajustar Visible</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚡ Acciones Rápidas</Text>
              
              <View style={styles.buttonGrid}>
                <TouchableOpacity 
                  style={styles.quickButton} 
                  onPress={() => {
                    cameraControls.setZoom(1);
                    cameraControls.goToEnd();
                  }}
                >
                  <Text style={styles.quickButtonText}>🏠 Vista Principal</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.quickButton} 
                  onPress={() => {
                    cameraControls.setZoom(5);
                    cameraControls.goToEnd();
                  }}
                >
                  <Text style={styles.quickButtonText}>🔬 Vista Detalle</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.quickButton} 
                  onPress={() => {
                    cameraControls.setZoom(0.5);
                    cameraControls.setPan(0.5, 0);
                  }}
                >
                  <Text style={styles.quickButtonText}>🌐 Vista General</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.quickButton} 
                  onPress={() => {
                    cameraControls.setZoom(2);
                    cameraControls.goToEnd();
                  }}
                >
                  <Text style={styles.quickButtonText}>📈 Trading View</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    maxHeight: '100%',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ccc',
    marginTop: 12,
    marginBottom: 8,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    color: '#888',
    fontSize: 12,
  },
  infoValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#333',
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  activePreset: {
    backgroundColor: '#00ff88',
  },
  presetText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  activePresetText: {
    color: '#000',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  textInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 14,
  },
  inputButton: {
    paddingHorizontal: 16,
    height: 40,
    backgroundColor: '#00ff88',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panControls: {
    alignItems: 'center',
    gap: 8,
  },
  panRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  panButton: {
    width: 48,
    height: 48,
    backgroundColor: '#333',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerButton: {
    width: 48,
    height: 48,
    backgroundColor: '#555',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panButtonText: {
    fontSize: 20,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickButton: {
    width: '48%',
    padding: 12,
    backgroundColor: '#444',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ChartCameraControls;
