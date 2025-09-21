import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider, Theme } from '@tamagui/core';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import config from './tamagui.config';
import { useThemeStore } from './src/config/theme';
import { AppContent } from './src/components/AppContent';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

export default function App() {
  const { isDark } = useThemeStore();
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config}>
        <Theme name={isDark ? 'dark_hound' : 'light_hound'}>
          <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
              <AppContent />
              <StatusBar style={isDark ? 'light' : 'dark'} />
            </QueryClientProvider>
          </SafeAreaProvider>
        </Theme>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
