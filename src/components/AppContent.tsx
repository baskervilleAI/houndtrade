import React from 'react';
import { View, Text } from '@tamagui/core';
import { useTheme } from '../config/theme';

export const AppContent: React.FC = () => {
  const { isDark, colors } = useTheme();
  
  return (
    <View
      flex={1}
      backgroundColor="$background"
      alignItems="center"
      justifyContent="center"
      padding="$md"
    >
      <Text
        fontSize="$xl"
        fontWeight="bold"
        color="$color"
        marginBottom="$md"
      >
        🐕 HoundTrade
      </Text>
      
      <Text
        fontSize="$md"
        color="$color"
        textAlign="center"
        marginBottom="$lg"
      >
        Crypto Paper Trading Platform
      </Text>
      
      <View
        backgroundColor={isDark ? colors.GRAY_800 : colors.GRAY_100}
        padding="$md"
        borderRadius="$md"
        marginBottom="$md"
      >
        <Text fontSize="$sm" color="$color">
          Theme: {isDark ? 'Dark' : 'Light'} Mode
        </Text>
      </View>
      
      <Text
        fontSize="$sm"
        color="$placeholderColor"
        textAlign="center"
      >
        Setting up the foundation...
      </Text>
    </View>
  );
};