# HoundTrade - Crypto Paper Trading App

A sophisticated React Native (Expo) application for cryptocurrency paper trading with advanced charting, real-time data, and social features.

## 🎯 Project Overview

HoundTrade is designed to provide an intuitive and powerful paper trading experience for crypto enthusiasts, featuring:

- **Minimalist UX**: Clean, responsive design with dark/light mode support
- **Advanced Trading**: Market/limit orders, TP/SL placement, complex order types
- **Real-time Data**: Live crypto prices and OHLCV candles from Binance API
- **Interactive Charts**: Candlestick charts with technical indicators and drawing tools
- **Social Features**: Global leaderboard with performance rankings
- **Analytics**: Comprehensive telemetry for RLHF analysis
- **AWS Backend**: Scalable serverless architecture

## 📋 Key Features

### Trading Features
- Paper account with configurable starting balance (default 1M USDT)
- Market and limit orders with commission simulation
- Take Profit/Stop Loss placement directly on charts (drag handles)
- Advanced order types: trailing stops, OCO orders
- Multi-asset portfolio management
- Account reset functionality

### Chart Features
- Real-time candlestick charts with smooth zoom/pan
- Multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
- Technical indicators: MA, RSI, MACD, Bollinger Bands
- Drawing tools for technical analysis
- WebGL rendering for 60fps performance

### Social Features
- Global leaderboard by PnL percentage
- Time-based filters (7d, 30d, all-time)
- User profiles with trading history
- Equity curve visualization
- Real-time ranking updates

### Authentication
- Email/password registration and login
- Google and Apple social login
- AWS Cognito integration
- Biometric authentication support
- Password reset functionality

## 🏗️ Architecture

### Frontend Stack
- **React Native** with Expo SDK 54
- **TypeScript** for type safety
- **Zustand** for state management
- **Tamagui** for theming and UI components
- **React Navigation** for navigation
- **Reanimated 3 + Moti** for animations
- **React Query** for data fetching
- **WebSocket** for real-time updates

### Backend Stack (AWS)
- **API Gateway** for REST and WebSocket APIs
- **Lambda Functions** for serverless compute
- **DynamoDB** for data storage
- **Cognito** for authentication
- **CloudWatch** for monitoring
- **S3** for static assets

### External APIs
- **Binance WebSocket** for real-time price data
- **Binance REST API** for historical OHLCV data

## 📁 Project Structure

```
houndtrade/
├── src/
│   ├── components/          # Reusable UI components
│   ├── screens/            # Screen components
│   ├── stores/             # Zustand state stores
│   ├── services/           # API clients and business logic
│   ├── navigation/         # Navigation configuration
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript type definitions
│   └── config/             # App configuration
├── backend/
│   ├── infrastructure/     # AWS CloudFormation/Terraform
│   ├── lambdas/           # Lambda function code
│   ├── shared/            # Shared utilities and types
│   └── tests/             # Backend tests
├── assets/                # Images, fonts, animations
├── docs/                  # Documentation
└── __tests__/             # Frontend tests
```

## 🚀 Development Timeline

### Phase 1: Foundation (Weeks 1-2)
- Project setup and dependencies
- Tamagui theming system
- Authentication screens and AWS Cognito integration
- Basic navigation structure

### Phase 2: Core Trading (Weeks 3-4)
- Binance API integration
- Paper trading engine
- Basic chart implementation
- Portfolio management

### Phase 3: Advanced Features (Weeks 5-6)
- Advanced chart features and indicators
- Complex order types
- Real-time WebSocket integration
- Performance optimizations

### Phase 4: Social Features (Weeks 7-8)
- Leaderboard implementation
- User profiles and analytics
- Telemetry system
- AWS backend deployment

### Phase 5: Polish & Launch (Weeks 9-10)
- UI/UX refinements and animations
- Comprehensive testing
- App store preparation
- Production deployment

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- AWS CLI (for backend deployment)
- iOS Simulator / Android Emulator

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/houndtrade.git
cd houndtrade

# Install dependencies
npm install

# Start development server
npm run start
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env.development

# Configure your environment variables
# - Binance API endpoints
# - AWS Cognito settings
# - Google/Apple OAuth credentials
```

## 📱 Screens Overview

### Authentication Flow
- **Login Screen**: Email/password + social login options
- **Signup Screen**: Registration with terms acceptance
- **Onboarding**: Welcome slides and feature introduction
- **Reset Password**: Password recovery flow

### Main Application
- **Home Screen**: Portfolio overview and quick actions
- **Chart/Trade Screen**: Advanced charting with trading interface
- **Portfolio Screen**: Detailed portfolio analysis and equity curve
- **Leaderboard Screen**: Global rankings and user profiles
- **Settings Screen**: App preferences and telemetry controls

## 🔧 Key Technologies

### State Management
- **Zustand**: Lightweight state management with persistence
- **React Query**: Server state management and caching
- **AsyncStorage**: Local data persistence

### Real-time Features
- **WebSocket**: Binance price streams and app notifications
- **Optimistic Updates**: Immediate UI feedback
- **Background Sync**: Data synchronization when app becomes active

### Performance
- **WebGL Charts**: Hardware-accelerated rendering
- **Code Splitting**: Lazy loading of screens and components
- **Image Optimization**: Compressed assets and lazy loading
- **Bundle Analysis**: Regular bundle size monitoring

## 🧪 Testing Strategy

### Frontend Testing
- **Unit Tests**: Jest + React Native Testing Library
- **Integration Tests**: API integration and store testing
- **E2E Tests**: Detox for complete user journey testing
- **Performance Tests**: Flipper integration for profiling

### Backend Testing
- **Unit Tests**: Lambda function testing
- **Integration Tests**: DynamoDB and API Gateway testing
- **Load Tests**: WebSocket connection and API performance

## 🚀 Deployment

### Development
```bash
npm run start          # Start Expo development server
npm run ios           # Run on iOS simulator
npm run android       # Run on Android emulator
```

### Production
```bash
# Build and deploy backend
cd backend
./scripts/deploy.sh prod

# Build mobile app
eas build --platform all --profile production

# Submit to app stores
eas submit --platform all
```

## 📊 Monitoring & Analytics

### Application Monitoring
- **Sentry**: Crash reporting and error tracking
- **Flipper**: Development debugging and profiling
- **AWS CloudWatch**: Backend monitoring and logging

### Business Analytics
- **Custom Telemetry**: User behavior tracking (opt-in)
- **Trading Metrics**: Volume, frequency, and performance analytics
- **Retention Analysis**: User engagement and churn metrics

## 🔒 Security & Privacy

### Data Protection
- **JWT Tokens**: Secure authentication with rotation
- **Encrypted Storage**: Sensitive data encryption at rest
- **HTTPS/WSS**: All network communication encrypted
- **Input Validation**: Comprehensive server-side validation

### Privacy Controls
- **Opt-in Telemetry**: User consent for data collection
- **Data Anonymization**: Personal data protection
- **GDPR Compliance**: European privacy regulation compliance
- **Transparent Policies**: Clear privacy and terms of service

## 📈 Performance Targets

- **Cold Start**: < 3 seconds
- **Chart Rendering**: 60 FPS
- **WebSocket Latency**: < 100ms
- **Memory Usage**: < 150MB
- **Bundle Size**: < 50MB

## 🤝 Contributing

Please read our [Contributing Guide](docs/CONTRIBUTING.md) for development guidelines and code standards.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Email: support@houndtrade.com
- Discord: [HoundTrade Community](https://discord.gg/houndtrade)

---

**HoundTrade** - Empowering crypto traders with advanced paper trading tools and social features.