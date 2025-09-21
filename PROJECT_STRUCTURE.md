# HoundTrade - Project Structure

## Directory Structure
```
houndtrade/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SignupForm.tsx
│   │   │   └── SocialLoginButtons.tsx
│   │   ├── chart/
│   │   │   ├── CandlestickChart.tsx
│   │   │   ├── TechnicalIndicators.tsx
│   │   │   ├── DrawingTools.tsx
│   │   │   ├── OrderHandles.tsx
│   │   │   ├── TimeframeSelector.tsx
│   │   │   └── ChartControls.tsx
│   │   ├── trading/
│   │   │   ├── OrderForm.tsx
│   │   │   ├── AdvancedOrders.tsx
│   │   │   ├── PositionsList.tsx
│   │   │   ├── OrderBook.tsx
│   │   │   └── TradingPair.tsx
│   │   ├── portfolio/
│   │   │   ├── PortfolioSummary.tsx
│   │   │   ├── EquityCurve.tsx
│   │   │   ├── AssetAllocation.tsx
│   │   │   └── PerformanceMetrics.tsx
│   │   ├── leaderboard/
│   │   │   ├── LeaderboardList.tsx
│   │   │   ├── UserRankCard.tsx
│   │   │   ├── FilterTabs.tsx
│   │   │   └── ProfileModal.tsx
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── SafeAreaWrapper.tsx
│   │   └── onboarding/
│   │       ├── WelcomeSlide.tsx
│   │       ├── FeaturesSlide.tsx
│   │       ├── TradingSlide.tsx
│   │       └── PermissionsSlide.tsx
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── SignupScreen.tsx
│   │   │   ├── ResetPasswordScreen.tsx
│   │   │   └── OnboardingScreen.tsx
│   │   ├── trading/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── ChartTradeScreen.tsx
│   │   │   └── OrderHistoryScreen.tsx
│   │   ├── portfolio/
│   │   │   ├── PortfolioScreen.tsx
│   │   │   └── EquityCurveScreen.tsx
│   │   ├── social/
│   │   │   ├── LeaderboardScreen.tsx
│   │   │   └── ProfileScreen.tsx
│   │   └── settings/
│   │       ├── SettingsScreen.tsx
│   │       └── TelemetryScreen.tsx
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── tradingStore.ts
│   │   ├── marketStore.ts
│   │   ├── portfolioStore.ts
│   │   ├── leaderboardStore.ts
│   │   ├── settingsStore.ts
│   │   └── telemetryStore.ts
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── trading.ts
│   │   │   ├── market.ts
│   │   │   ├── leaderboard.ts
│   │   │   └── telemetry.ts
│   │   ├── websocket/
│   │   │   ├── binanceWS.ts
│   │   │   ├── appWS.ts
│   │   │   └── reconnection.ts
│   │   ├── storage/
│   │   │   ├── secureStorage.ts
│   │   │   └── asyncStorage.ts
│   │   ├── auth/
│   │   │   ├── cognito.ts
│   │   │   ├── socialAuth.ts
│   │   │   └── biometric.ts
│   │   ├── trading/
│   │   │   ├── paperEngine.ts
│   │   │   ├── orderValidation.ts
│   │   │   └── commission.ts
│   │   ├── chart/
│   │   │   ├── indicators.ts
│   │   │   ├── drawingTools.ts
│   │   │   └── chartUtils.ts
│   │   └── telemetry/
│   │       ├── eventLogger.ts
│   │       ├── analytics.ts
│   │       └── privacy.ts
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   ├── MainNavigator.tsx
│   │   └── types.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useWebSocket.ts
│   │   ├── useMarketData.ts
│   │   ├── useTradingEngine.ts
│   │   ├── usePortfolio.ts
│   │   ├── useLeaderboard.ts
│   │   ├── useTelemetry.ts
│   │   └── useTheme.ts
│   ├── utils/
│   │   ├── constants.ts
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── calculations.ts
│   │   ├── dateUtils.ts
│   │   └── errorHandling.ts
│   ├── types/
│   │   ├── auth.ts
│   │   ├── trading.ts
│   │   ├── market.ts
│   │   ├── portfolio.ts
│   │   ├── leaderboard.ts
│   │   ├── telemetry.ts
│   │   └── api.ts
│   └── config/
│       ├── env.ts
│       ├── theme.ts
│       ├── navigation.ts
│       └── constants.ts
├── backend/
│   ├── infrastructure/
│   │   ├── cloudformation/
│   │   │   ├── api-gateway.yml
│   │   │   ├── lambda.yml
│   │   │   ├── dynamodb.yml
│   │   │   ├── cognito.yml
│   │   │   └── websocket.yml
│   │   ├── terraform/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── modules/
│   │   └── scripts/
│   │       ├── deploy.sh
│   │       ├── setup-env.sh
│   │       └── cleanup.sh
│   ├── lambdas/
│   │   ├── auth/
│   │   │   ├── login.ts
│   │   │   ├── register.ts
│   │   │   ├── refresh.ts
│   │   │   └── resetPassword.ts
│   │   ├── trading/
│   │   │   ├── getPortfolio.ts
│   │   │   ├── placeOrder.ts
│   │   │   ├── getOrders.ts
│   │   │   └── resetAccount.ts
│   │   ├── market/
│   │   │   ├── getPairs.ts
│   │   │   ├── getOHLCV.ts
│   │   │   └── websocketHandler.ts
│   │   ├── leaderboard/
│   │   │   ├── getRankings.ts
│   │   │   ├── getProfile.ts
│   │   │   └── updateRankings.ts
│   │   └── telemetry/
│   │       ├── logEvents.ts
│   │       └── getSettings.ts
│   ├── shared/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── constants/
│   │   └── middleware/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── e2e/
├── assets/
│   ├── images/
│   │   ├── onboarding/
│   │   ├── icons/
│   │   └── logos/
│   ├── fonts/
│   └── animations/
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   ├── TESTING.md
│   └── CONTRIBUTING.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-staging.yml
│       └── deploy-production.yml
├── __tests__/
│   ├── components/
│   ├── screens/
│   ├── services/
│   └── utils/
├── .env.example
├── .env.development
├── .env.staging
├── .env.production
├── app.json
├── babel.config.js
├── metro.config.js
├── jest.config.js
├── detox.config.js
├── eas.json
└── README.md
```

## Key Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "expo": "~54.0.9",
    "react": "19.1.0",
    "react-native": "0.81.4",
    "@tamagui/core": "^1.95.0",
    "@tamagui/config": "^1.95.0",
    "@tamagui/animations-react-native": "^1.95.0",
    "zustand": "^4.4.7",
    "@tanstack/react-query": "^5.17.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/stack": "^6.3.20",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "react-native-reanimated": "~3.15.0",
    "moti": "^0.28.1",
    "react-native-gesture-handler": "~2.20.2",
    "react-native-safe-area-context": "4.14.0",
    "react-native-screens": "4.1.0"
  }
}
```

### Authentication & Storage
```json
{
  "dependencies": {
    "amazon-cognito-identity-js": "^6.3.12",
    "@react-native-async-storage/async-storage": "1.25.0",
    "expo-secure-store": "~14.0.0",
    "expo-local-authentication": "~15.0.0",
    "@react-native-google-signin/google-signin": "^11.0.0",
    "@invertase/react-native-apple-authentication": "^2.3.0"
  }
}
```

### Charts & Visualization
```json
{
  "dependencies": {
    "react-native-svg": "15.8.0",
    "react-native-skia": "^1.0.0",
    "victory-native": "^41.0.0",
    "d3": "^7.8.5"
  }
}
```

### WebSocket & Networking
```json
{
  "dependencies": {
    "ws": "^8.16.0",
    "axios": "^1.6.5",
    "react-native-url-polyfill": "^2.0.0"
  }
}
```

### Development Dependencies
```json
{
  "devDependencies": {
    "@types/react": "~19.1.0",
    "@types/react-native": "~0.81.0",
    "@types/ws": "^8.5.10",
    "@types/d3": "^7.4.3",
    "typescript": "~5.9.2",
    "jest": "^29.7.0",
    "@testing-library/react-native": "^12.4.3",
    "detox": "^20.18.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "prettier": "^3.2.4",
    "husky": "^8.0.3",
    "lint-staged": "^15.2.0"
  }
}
```

## Configuration Files

### Environment Configuration
```typescript
// src/config/env.ts
export const config = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  WS_BASE_URL: process.env.EXPO_PUBLIC_WS_BASE_URL,
  BINANCE_API_URL: process.env.EXPO_PUBLIC_BINANCE_API_URL,
  BINANCE_WS_URL: process.env.EXPO_PUBLIC_BINANCE_WS_URL,
  AWS_REGION: process.env.EXPO_PUBLIC_AWS_REGION,
  COGNITO_USER_POOL_ID: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID,
  COGNITO_CLIENT_ID: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID,
  GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  APPLE_CLIENT_ID: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID,
  TELEMETRY_ENDPOINT: process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT,
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
};
```

### Tamagui Configuration
```typescript
// tamagui.config.ts
import { config } from '@tamagui/config/v3'
import { createTamagui } from '@tamagui/core'

const appConfig = createTamagui({
  ...config,
  themes: {
    ...config.themes,
    dark_hound: {
      background: '#0a0a0a',
      backgroundHover: '#151515',
      backgroundPress: '#1a1a1a',
      color: '#ffffff',
      colorHover: '#f0f0f0',
      green: '#00ff88',
      red: '#ff4444',
      blue: '#0088ff',
      yellow: '#ffaa00',
    },
    light_hound: {
      background: '#ffffff',
      backgroundHover: '#f5f5f5',
      backgroundPress: '#eeeeee',
      color: '#000000',
      colorHover: '#333333',
      green: '#00cc66',
      red: '#cc3333',
      blue: '#0066cc',
      yellow: '#cc8800',
    },
  },
})

export default appConfig
```

### EAS Build Configuration
```json
{
  "expo": {
    "name": "HoundTrade",
    "slug": "houndtrade",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#000000"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.houndtrade.app",
      "buildNumber": "1"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#000000"
      },
      "package": "com.houndtrade.app",
      "versionCode": 1
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-secure-store",
      "expo-local-authentication",
      "@react-native-google-signin/google-signin",
      "@invertase/react-native-apple-authentication"
    ]
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

## Development Phases

### Phase 1: Foundation (Weeks 1-2)
- Project setup and dependencies
- Basic navigation structure
- Authentication screens and flow
- Tamagui theming system
- Zustand store architecture

### Phase 2: Core Trading (Weeks 3-4)
- Binance API integration
- Basic chart implementation
- Paper trading engine
- Order placement system
- Portfolio management

### Phase 3: Advanced Features (Weeks 5-6)
- Advanced chart features
- Technical indicators
- Complex order types
- Real-time WebSocket integration
- Performance optimizations

### Phase 4: Social Features (Weeks 7-8)
- Leaderboard implementation
- User profiles
- Real-time updates
- Telemetry system
- Analytics integration

### Phase 5: Polish & Deploy (Weeks 9-10)
- UI/UX refinements
- Animations and micro-interactions
- Testing and bug fixes
- AWS deployment
- App store preparation

## Testing Strategy

### Unit Tests
- Store logic testing
- Utility function testing
- Component prop testing
- API service testing

### Integration Tests
- Authentication flow
- Trading operations
- WebSocket connections
- Data synchronization

### E2E Tests
- Complete user journeys
- Cross-platform compatibility
- Performance benchmarks
- Accessibility compliance

## Performance Targets

### App Performance
- Cold start time: < 3 seconds
- Chart rendering: 60 FPS
- WebSocket latency: < 100ms
- Memory usage: < 150MB

### User Experience
- Touch response: < 16ms
- Screen transitions: < 300ms
- Data loading: < 2 seconds
- Offline functionality: Core features available