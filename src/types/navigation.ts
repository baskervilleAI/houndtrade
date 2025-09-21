import type { NavigatorScreenParams } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// Root Stack Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Onboarding: undefined;
  Modal: {
    screen: string;
    params?: any;
  };
};

// Auth Stack Navigator
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ResetPassword: undefined;
  SocialLogin: {
    provider: 'google' | 'apple';
  };
};

// Main Tab Navigator
export type MainTabParamList = {
  Home: undefined;
  Trading: NavigatorScreenParams<TradingStackParamList>;
  Portfolio: NavigatorScreenParams<PortfolioStackParamList>;
  Leaderboard: NavigatorScreenParams<LeaderboardStackParamList>;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
};

// Trading Stack Navigator
export type TradingStackParamList = {
  ChartTrade: {
    symbol?: string;
    timeframe?: string;
  };
  OrderHistory: undefined;
  PairSelector: undefined;
  OrderForm: {
    symbol: string;
    type?: 'market' | 'limit';
    side?: 'buy' | 'sell';
  };
};

// Portfolio Stack Navigator
export type PortfolioStackParamList = {
  Overview: undefined;
  EquityCurve: undefined;
  Positions: undefined;
  Performance: {
    period?: '7d' | '30d' | '90d' | '1y' | 'all';
  };
};

// Leaderboard Stack Navigator
export type LeaderboardStackParamList = {
  Rankings: {
    period?: '7d' | '30d' | 'all';
  };
  UserProfile: {
    userId: string;
  };
  MyProfile: undefined;
};

// Settings Stack Navigator
export type SettingsStackParamList = {
  Main: undefined;
  Account: undefined;
  Trading: undefined;
  Notifications: undefined;
  Privacy: undefined;
  Telemetry: undefined;
  About: undefined;
  Support: undefined;
};

// Screen Props Types
export type RootStackScreenProps<T extends keyof RootStackParamList> = StackScreenProps<
  RootStackParamList,
  T
>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = StackScreenProps<
  AuthStackParamList,
  T
>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  T
>;

export type TradingStackScreenProps<T extends keyof TradingStackParamList> = StackScreenProps<
  TradingStackParamList,
  T
>;

export type PortfolioStackScreenProps<T extends keyof PortfolioStackParamList> = StackScreenProps<
  PortfolioStackParamList,
  T
>;

export type LeaderboardStackScreenProps<T extends keyof LeaderboardStackParamList> = StackScreenProps<
  LeaderboardStackParamList,
  T
>;

export type SettingsStackScreenProps<T extends keyof SettingsStackParamList> = StackScreenProps<
  SettingsStackParamList,
  T
>;

// Navigation State
export interface NavigationState {
  currentRoute: string;
  previousRoute?: string;
  params?: Record<string, any>;
  history: string[];
}

// Deep Link Types
export interface DeepLinkConfig {
  screens: {
    Auth: {
      screens: {
        Login: 'login';
        Signup: 'signup';
        ResetPassword: 'reset-password';
      };
    };
    Main: {
      screens: {
        Home: 'home';
        Trading: {
          screens: {
            ChartTrade: 'trade/:symbol?';
            OrderHistory: 'orders';
          };
        };
        Portfolio: {
          screens: {
            Overview: 'portfolio';
            Performance: 'portfolio/performance/:period?';
          };
        };
        Leaderboard: {
          screens: {
            Rankings: 'leaderboard/:period?';
            UserProfile: 'profile/:userId';
          };
        };
        Settings: 'settings';
      };
    };
  };
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}