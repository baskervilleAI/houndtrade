import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Platform } from 'react-native';

interface ChartControlsProps {
  isVisible?: boolean;
  onClose?: () => void;
}

export const ChartControlsHelp: React.FC<ChartControlsProps> = ({ 
  isVisible = false, 
  onClose 
}) => {
  const isWeb = Platform.select({ web: true, default: false });

  const webControls = [
    { category: '🖱️ Mouse', controls: [
      'Rueda del mouse: Pan horizontal/vertical',
      'Ctrl + Rueda: Zoom in/out',
      'Shift + Rueda: Pan horizontal',
      'Click y arrastrar: Mover por el gráfico',
      'Doble click: Zoom inteligente',
      'Click derecho: Menú contextual (futuro)',
    ]},
    { category: '⌨️ Teclado', controls: [
      '+/= : Zoom in',
      '-/_ : Zoom out',
      'R : Reset zoom y posición',
      'End : Ir a las últimas velas',
      'Home : Ir al inicio',
      '← → : Pan izquierda/derecha',
      '↑ ↓ : Pan arriba/abajo',
      'Espacio : Alternar zoom 1x/2x',
      'Escape : Reset completo',
      'Ctrl+0-5 : Niveles de zoom preestablecidos',
    ]},
    { category: '🎯 Gestos Avanzados', controls: [
      'Shift + ← → : Pan rápido (50 velas)',
      'Shift + +/- : Zoom rápido (2x)',
      'Doble click en zona específica: Zoom centrado',
      'Ctrl+Rueda cerca del borde: Zoom asimétrico',
    ]},
  ];

  const mobileControls = [
    { category: '👆 Touch', controls: [
      'Pellizcar: Zoom in/out',
      'Arrastrar con 1 dedo: Pan/mover',
      'Doble tap: Zoom inteligente',
      'Arrastrar con 2 dedos: Pan vertical',
    ]},
  ];

  const controls = isWeb ? webControls : mobileControls;

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>
              📚 Controles del Gráfico {isWeb ? '(Web)' : '(Mobile)'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            {controls.map((section, index) => (
              <View key={index} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.category}</Text>
                {section.controls.map((control, controlIndex) => (
                  <View key={controlIndex} style={styles.controlItem}>
                    <Text style={styles.controlText}>• {control}</Text>
                  </View>
                ))}
              </View>
            ))}
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💡 Consejos</Text>
              <View style={styles.tipContainer}>
                <Text style={styles.tipText}>
                  • El zoom se centra en la posición del cursor
                </Text>
                <Text style={styles.tipText}>
                  • El pan mantiene momentum para navegación fluida
                </Text>
                <Text style={styles.tipText}>
                  • Los controles responden en tiempo real
                </Text>
                <Text style={styles.tipText}>
                  • Usa 'R' para resetear rápidamente
                </Text>
                {isWeb && (
                  <Text style={styles.tipText}>
                    • Enfoca el gráfico haciendo click para usar teclado
                  </Text>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export const ChartControlsButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  return (
    <TouchableOpacity style={styles.helpButton} onPress={onPress}>
      <Text style={styles.helpButtonText}>❓</Text>
    </TouchableOpacity>
  );
};

const ChartControlsComponent: React.FC = () => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <ChartControlsButton onPress={() => setShowHelp(true)} />
      <ChartControlsHelp 
        isVisible={showHelp} 
        onClose={() => setShowHelp(false)} 
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    maxWidth: 500,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#333333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 10,
  },
  controlItem: {
    marginBottom: 5,
  },
  controlText: {
    fontSize: 13,
    color: '#cccccc',
    lineHeight: 18,
  },
  tipContainer: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00ff88',
  },
  tipText: {
    fontSize: 12,
    color: '#ffffff',
    marginBottom: 5,
    lineHeight: 16,
  },
  helpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555555',
  },
  helpButtonText: {
    fontSize: 16,
    color: '#ffffff',
  },
});

export default ChartControlsComponent;
