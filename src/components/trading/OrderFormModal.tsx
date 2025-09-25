import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { OrderForm } from './OrderForm';
import { OrderCreationParams } from '../../types/trading';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface OrderFormModalProps {
  visible: boolean;
  onClose: () => void;
  onCreateOrder: (params: OrderCreationParams) => Promise<{ success: boolean; order?: any; errors?: string[] }>;
  isLoading: boolean;
  defaultSymbol?: string;
  defaultTakeProfitPrice?: number | null;
  defaultStopLossPrice?: number | null;
}

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  visible,
  onClose,
  onCreateOrder,
  isLoading,
  defaultSymbol,
  defaultTakeProfitPrice,
  defaultStopLossPrice,
}) => {
  const handleCreateOrder = async (params: OrderCreationParams) => {
    const result = await onCreateOrder(params);
    if (result.success) {
      onClose();
    }
    return result;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nueva Orden</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <OrderForm 
            onCreateOrder={handleCreateOrder}
            isLoading={isLoading}
            defaultSymbol={defaultSymbol}
            defaultTakeProfitPrice={defaultTakeProfitPrice}
            defaultStopLossPrice={defaultStopLossPrice}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 50, // Account for status bar
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#1a1a1a',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSpacer: {
    width: 32,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
});