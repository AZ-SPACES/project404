import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { TOKEN_KEY, REFRESH_TOKEN_KEY, api } from '../services/api';

interface AuthState {
  isAuthenticated: boolean;
  isHydrating: boolean;
  user: any | null; // Replace 'any' with your actual User type if you have one
  
  // Actions
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isHydrating: true,
  user: null,

  setTokens: async (accessToken: string, refreshToken: string) => {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      set({ isAuthenticated: true });
    } catch (error) {
      console.error('Failed to save tokens securely', error);
    }
  },

  hydrate: async () => {
    try {
      set({ isHydrating: true });
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        // Optionally, you can verify the token validity or fetch user profile here
        set({ isAuthenticated: true });
      } else {
        set({ isAuthenticated: false });
      }
    } catch (error) {
      console.error('Failed to hydrate auth state', error);
      set({ isAuthenticated: false });
    } finally {
      set({ isHydrating: false });
    }
  },

  logout: async () => {
    try {
      // Optional: Call backend logout to invalidate sessions
      // await api.post('/api/v1/auth/logout');
    } catch (e) {
      console.error('Backend logout failed', e);
    } finally {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      set({ isAuthenticated: false, user: null });
    }
  },
}));
