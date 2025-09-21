import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthTokens, AuthState } from '../types/auth';

interface AuthStore extends AuthState {
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  termsAccepted: boolean;
  telemetryOptIn: boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Implement actual login API call
          // const response = await authService.login(email, password);
          
          // Mock successful login for now
          const mockUser: User = {
            id: 'user_123',
            email,
            displayName: email.split('@')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            emailVerified: true,
            phoneVerified: false,
            subscriptionTier: 'free',
          };

          const mockTokens: AuthTokens = {
            accessToken: 'mock_access_token',
            refreshToken: 'mock_refresh_token',
            expiresIn: 3600,
            tokenType: 'Bearer',
          };

          set({
            user: mockUser,
            tokens: mockTokens,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Implement actual registration API call
          // await authService.register(data);
          
          // Mock successful registration
          console.log('Registration data:', data);
          set({ isLoading: false });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Registration failed',
          });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          error: null,
        });
      },

      refreshAuth: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          // TODO: Implement actual token refresh API call
          // const response = await authService.refresh(tokens.refreshToken);
          
          // Mock token refresh
          const newTokens: AuthTokens = {
            ...tokens,
            accessToken: 'new_mock_access_token',
            expiresIn: 3600,
          };

          set({ tokens: newTokens });
        } catch (error) {
          get().logout();
          throw error;
        }
      },

      updateProfile: async (data: Partial<User>) => {
        const { user } = get();
        if (!user) {
          throw new Error('No user logged in');
        }

        set({ isLoading: true, error: null });
        try {
          // TODO: Implement actual profile update API call
          // const updatedUser = await authService.updateProfile(data);
          
          // Mock profile update
          const updatedUser: User = {
            ...user,
            ...data,
            updatedAt: new Date().toISOString(),
          };

          set({
            user: updatedUser,
            isLoading: false,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Profile update failed',
          });
          throw error;
        }
      },

      // Utility actions
      setUser: (user: User | null) => set({ user }),
      setTokens: (tokens: AuthTokens | null) => set({ tokens }),
      setLoading: (isLoading: boolean) => set({ isLoading }),
      setError: (error: string | null) => set({ error }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selectors for better performance
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);