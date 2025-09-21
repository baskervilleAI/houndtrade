export interface User {
  id: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  subscriptionTier: 'free' | 'premium';
  subscriptionExpiry?: string;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  telemetryOptIn: boolean;
  defaultBalance: number;
  commissionRate: number;
  language: string;
  timezone: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  success: boolean;
  user: User;
  tokens: AuthTokens;
  message?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  termsAccepted: boolean;
  telemetryOptIn: boolean;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  userId?: string;
  verificationRequired: boolean;
}

export interface SocialLoginRequest {
  provider: 'google' | 'apple';
  idToken: string;
  accessToken?: string;
}

export interface SocialLoginResponse {
  success: boolean;
  user: User;
  tokens: AuthTokens;
  isNewUser: boolean;
  message?: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  tokens: AuthTokens;
  message?: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  biometryType?: 'TouchID' | 'FaceID' | 'Fingerprint' | 'FaceUnlock';
}