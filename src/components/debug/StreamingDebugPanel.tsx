import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

export const StreamingDebugPanel: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug Panel</Text>
      <Text style={styles.text}>Streaming debug information will appear here</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: isTablet ? screenWidth * 0.7 : 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: isTablet ? 8 : 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
    maxHeight: isTablet ? 100 : 80,
  },
  title: {
    color: '#fff',
    fontSize: isTablet ? 12 : 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  text: {
    color: '#888',
    fontSize: isTablet ? 10 : 12,
  },
});
