import { useColorScheme, Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'auto',
      isDark: false,
      
      setMode: (mode: ThemeMode) => {
        const systemColorScheme = useColorScheme();
        const isDark = mode === 'dark' || (mode === 'auto' && systemColorScheme === 'dark');
        
        set({ mode, isDark });
      },
      
      toggleMode: () => {
        const { mode } = get();
        const newMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light';
        get().setMode(newMode);
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Theme colors for consistent usage across the app
export const THEME_COLORS = {
  // Trading colors
  GREEN: '#00ff88',
  RED: '#ff4444',
  BLUE: '#0088ff',
  YELLOW: '#ffaa00',
  PURPLE: '#aa44ff',
  ORANGE: '#ff6600',
  
  // Neutral colors
  WHITE: '#ffffff',
  BLACK: '#000000',
  GRAY_50: '#f9fafb',
  GRAY_100: '#f3f4f6',
  GRAY_200: '#e5e7eb',
  GRAY_300: '#d1d5db',
  GRAY_400: '#9ca3af',
  GRAY_500: '#6b7280',
  GRAY_600: '#4b5563',
  GRAY_700: '#374151',
  GRAY_800: '#1f2937',
  GRAY_900: '#111827',
  
  // Brand colors
  PRIMARY: '#0a0a0a',
  SECONDARY: '#ffffff',
  ACCENT: '#00ff88',
  
  // Status colors
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',
} as const;

// Spacing scale
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// Typography scale
export const TYPOGRAPHY = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
  },
} as const;

// Border radius scale
export const RADIUS = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

// Shadow presets - React Native Web compatible
export const SHADOWS = {
  sm: Platform.OS === 'web' ? {
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  } : {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: Platform.OS === 'web' ? {
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  } : {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: Platform.OS === 'web' ? {
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
  } : {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  xl: Platform.OS === 'web' ? {
    boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.2)',
  } : {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Animation durations
export const ANIMATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 800,
} as const;

// Z-index scale
export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modal: 40,
  popover: 50,
  tooltip: 60,
  toast: 70,
  overlay: 80,
  max: 9999,
} as const;

// Breakpoints for responsive design
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
} as const;

// Hook to get current theme values
export const useTheme = () => {
  const { mode, isDark } = useThemeStore();
  const systemColorScheme = useColorScheme();
  
  const resolvedIsDark = mode === 'dark' || (mode === 'auto' && systemColorScheme === 'dark');
  
  return {
    mode,
    isDark: resolvedIsDark,
    colors: THEME_COLORS,
    spacing: SPACING,
    typography: TYPOGRAPHY,
    radius: RADIUS,
    shadows: SHADOWS,
    animations: ANIMATIONS,
    zIndex: Z_INDEX,
    breakpoints: BREAKPOINTS,
  };
};

// Helper function to get theme-aware colors
export const getThemeColor = (lightColor: string, darkColor: string, isDark: boolean) => {
  return isDark ? darkColor : lightColor;
};

// Helper function to get trading color based on value
export const getTradingColor = (value: number, neutralColor?: string) => {
  if (value > 0) return THEME_COLORS.GREEN;
  if (value < 0) return THEME_COLORS.RED;
  return neutralColor || THEME_COLORS.GRAY_500;
};

// Helper function to format percentage with color
export const formatPercentageWithColor = (value: number) => {
  const color = getTradingColor(value);
  const sign = value > 0 ? '+' : '';
  return {
    text: `${sign}${value.toFixed(2)}%`,
    color,
  };
};