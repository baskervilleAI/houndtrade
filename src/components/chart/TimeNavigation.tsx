import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';

interface TimeNavigationProps {
  isVisible: boolean;
  onClose: () => void;
  onGoToDate: (date: Date) => void;
  onGoToTimestamp: (timestamp: number) => void;
  currentTimeframe: string;
  isHistoricalMode: boolean;
  onToggleHistoricalMode: () => void;
}

export const TimeNavigation: React.FC<TimeNavigationProps> = ({
  isVisible,
  onClose,
  onGoToDate,
  onGoToTimestamp,
  currentTimeframe,
  isHistoricalMode,
  onToggleHistoricalMode,
}) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [relativeValue, setRelativeValue] = useState('');
  const [relativeUnit, setRelativeUnit] = useState<'minutes' | 'hours' | 'days' | 'weeks'>('hours');

  // Quick navigation presets
  const quickPresets = [
    { label: '1 hora atrás', value: 1, unit: 'hours' },
    { label: '6 horas atrás', value: 6, unit: 'hours' },
    { label: '12 horas atrás', value: 12, unit: 'hours' },
    { label: '1 día atrás', value: 1, unit: 'days' },
    { label: '3 días atrás', value: 3, unit: 'days' },
    { label: '1 semana atrás', value: 7, unit: 'days' },
    { label: '1 mes atrás', value: 30, unit: 'days' },
    { label: '3 meses atrás', value: 90, unit: 'days' },
  ];

  // Market event presets
  const marketEvents = [
    { label: 'Inicio del día UTC', time: '00:00' },
    { label: 'Apertura NYSE (9:30 EST)', time: '14:30' }, // UTC
    { label: 'Cierre NYSE (16:00 EST)', time: '21:00' }, // UTC
    { label: 'Apertura Tokio (9:00 JST)', time: '00:00' }, // UTC next day
    { label: 'Mediodía UTC', time: '12:00' },
  ];

  const handleDateTimeGo = useCallback(() => {
    if (!selectedDate) {
      Alert.alert('Error', 'Por favor selecciona una fecha');
      return;
    }

    try {
      const dateTimeString = selectedTime 
        ? `${selectedDate}T${selectedTime}:00`
        : `${selectedDate}T00:00:00`;
      
      const date = new Date(dateTimeString);
      
      if (isNaN(date.getTime())) {
        Alert.alert('Error', 'Fecha o hora inválida');
        return;
      }

      onGoToDate(date);
      setSelectedDate('');
      setSelectedTime('');
      Alert.alert('Éxito', `Navegando a ${date.toLocaleString()}`);
    } catch (error) {
      Alert.alert('Error', 'Error al procesar la fecha');
    }
  }, [selectedDate, selectedTime, onGoToDate]);

  const handleRelativeGo = useCallback(() => {
    const value = parseInt(relativeValue);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Error', 'Por favor ingresa un valor válido');
      return;
    }

    const now = new Date();
    let targetDate = new Date(now);

    switch (relativeUnit) {
      case 'minutes':
        targetDate.setMinutes(now.getMinutes() - value);
        break;
      case 'hours':
        targetDate.setHours(now.getHours() - value);
        break;
      case 'days':
        targetDate.setDate(now.getDate() - value);
        break;
      case 'weeks':
        targetDate.setDate(now.getDate() - (value * 7));
        break;
    }

    onGoToDate(targetDate);
    setRelativeValue('');
    Alert.alert('Éxito', `Navegando ${value} ${relativeUnit} atrás`);
  }, [relativeValue, relativeUnit, onGoToDate]);

  const handleQuickPreset = useCallback((preset: typeof quickPresets[0]) => {
    const now = new Date();
    let targetDate = new Date(now);

    if (preset.unit === 'hours') {
      targetDate.setHours(now.getHours() - preset.value);
    } else if (preset.unit === 'days') {
      targetDate.setDate(now.getDate() - preset.value);
    }

    onGoToDate(targetDate);
    Alert.alert('Éxito', `Navegando a ${preset.label}`);
  }, [onGoToDate]);

  const handleMarketEvent = useCallback((event: typeof marketEvents[0]) => {
    const today = new Date();
    const eventTime = event.time.split(':');
    const targetDate = new Date(today);
    
    targetDate.setHours(parseInt(eventTime[0]), parseInt(eventTime[1]), 0, 0);
    
    // If the time has passed today, go to yesterday's time
    if (targetDate > today) {
      targetDate.setDate(today.getDate() - 1);
    }

    onGoToDate(targetDate);
    Alert.alert('Éxito', `Navegando a ${event.label}`);
  }, [onGoToDate]);

  const getCurrentDateTime = () => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().slice(0, 5);
    return { date, time };
  };

  const setCurrentDateTime = () => {
    const { date, time } = getCurrentDateTime();
    setSelectedDate(date);
    setSelectedTime(time);
  };

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
            <Text style={styles.title}>🕒 Navegación Temporal</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Mode Toggle */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Modo de Datos</Text>
              <TouchableOpacity 
                style={[styles.modeButton, isHistoricalMode && styles.activeModeButton]}
                onPress={onToggleHistoricalMode}
              >
                <Text style={[styles.modeButtonText, isHistoricalMode && styles.activeModeButtonText]}>
                  {isHistoricalMode ? '📊 Modo Histórico Activo' : '⚡ Cambiar a Modo Histórico'}
                </Text>
              </TouchableOpacity>
              
              {!isHistoricalMode && (
                <Text style={styles.warningText}>
                  ⚠️ Para navegar por fechas específicas, cambia al modo histórico
                </Text>
              )}
            </View>

            {/* Quick Presets */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚡ Navegación Rápida</Text>
              <View style={styles.presetGrid}>
                {quickPresets.map((preset, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.presetButton}
                    onPress={() => handleQuickPreset(preset)}
                    disabled={!isHistoricalMode}
                  >
                    <Text style={[
                      styles.presetButtonText,
                      !isHistoricalMode && styles.disabledText
                    ]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Market Events */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📈 Eventos de Mercado</Text>
              <Text style={styles.subTitle}>Ir a horarios importantes del mercado (hoy o ayer)</Text>
              <View style={styles.eventGrid}>
                {marketEvents.map((event, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.eventButton}
                    onPress={() => handleMarketEvent(event)}
                    disabled={!isHistoricalMode}
                  >
                    <Text style={[
                      styles.eventButtonText,
                      !isHistoricalMode && styles.disabledText
                    ]}>
                      {event.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Specific Date & Time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📅 Fecha y Hora Específica</Text>
              
              <View style={styles.dateTimeContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Fecha (YYYY-MM-DD):</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.textInput, !isHistoricalMode && styles.disabledInput]}
                      placeholder="2024-01-15"
                      placeholderTextColor="#666"
                      value={selectedDate}
                      onChangeText={setSelectedDate}
                      editable={isHistoricalMode}
                    />
                    <TouchableOpacity 
                      style={styles.helperButton} 
                      onPress={setCurrentDateTime}
                      disabled={!isHistoricalMode}
                    >
                      <Text style={styles.helperButtonText}>Hoy</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Hora (HH:mm) - Opcional:</Text>
                  <TextInput
                    style={[styles.textInput, !isHistoricalMode && styles.disabledInput]}
                    placeholder="14:30"
                    placeholderTextColor="#666"
                    value={selectedTime}
                    onChangeText={setSelectedTime}
                    editable={isHistoricalMode}
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.actionButton, !isHistoricalMode && styles.disabledButton]}
                  onPress={handleDateTimeGo}
                  disabled={!isHistoricalMode}
                >
                  <Text style={styles.actionButtonText}>📅 Ir a Fecha/Hora</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Relative Time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⏰ Navegación Relativa</Text>
              
              <View style={styles.relativeContainer}>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.numberInput, !isHistoricalMode && styles.disabledInput]}
                    placeholder="24"
                    placeholderTextColor="#666"
                    value={relativeValue}
                    onChangeText={setRelativeValue}
                    keyboardType="numeric"
                    editable={isHistoricalMode}
                  />
                  
                  <View style={styles.unitSelector}>
                    {['minutes', 'hours', 'days', 'weeks'].map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitButton,
                          relativeUnit === unit && styles.selectedUnit,
                          !isHistoricalMode && styles.disabledButton
                        ]}
                        onPress={() => setRelativeUnit(unit as any)}
                        disabled={!isHistoricalMode}
                      >
                        <Text style={[
                          styles.unitButtonText,
                          relativeUnit === unit && styles.selectedUnitText,
                          !isHistoricalMode && styles.disabledText
                        ]}>
                          {unit === 'minutes' ? 'min' : unit === 'hours' ? 'h' : unit === 'days' ? 'd' : 'sem'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.actionButton, !isHistoricalMode && styles.disabledButton]}
                  onPress={handleRelativeGo}
                  disabled={!isHistoricalMode}
                >
                  <Text style={styles.actionButtonText}>⏰ Ir Atrás en el Tiempo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Current Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ℹ️ Información Actual</Text>
              <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                  Timeframe: {currentTimeframe}
                </Text>
                <Text style={styles.infoText}>
                  Modo: {isHistoricalMode ? 'Histórico' : 'En Vivo'}
                </Text>
                <Text style={styles.infoText}>
                  Zona horaria: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </Text>
                <Text style={styles.infoText}>
                  Ahora: {new Date().toLocaleString()}
                </Text>
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
    width: '95%',
    maxHeight: '85%',
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
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  modeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  activeModeButton: {
    backgroundColor: '#00ff88',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  activeModeButtonText: {
    color: '#000',
  },
  warningText: {
    fontSize: 12,
    color: '#ff9500',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#444',
    borderRadius: 6,
    minWidth: '30%',
    alignItems: 'center',
  },
  presetButtonText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '500',
    textAlign: 'center',
  },
  eventGrid: {
    gap: 8,
  },
  eventButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#444',
    borderRadius: 6,
    alignItems: 'center',
  },
  eventButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    textAlign: 'center',
  },
  dateTimeContainer: {
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    color: '#ccc',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
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
  numberInput: {
    width: 80,
    height: 40,
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  disabledInput: {
    backgroundColor: '#222',
    color: '#666',
  },
  helperButton: {
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#555',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  actionButton: {
    paddingVertical: 12,
    backgroundColor: '#00ff88',
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#444',
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  relativeContainer: {
    gap: 12,
  },
  unitSelector: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  unitButton: {
    flex: 1,
    height: 40,
    backgroundColor: '#333',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedUnit: {
    backgroundColor: '#00ff88',
  },
  unitButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  selectedUnitText: {
    color: '#000',
  },
  disabledText: {
    color: '#666',
  },
  infoContainer: {
    backgroundColor: '#222',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  infoText: {
    fontSize: 11,
    color: '#ccc',
  },
});

export default TimeNavigation;
