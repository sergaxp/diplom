import { create } from 'zustand';
import { User } from '../lib/auth';

interface AuthState {
  user: User | null;
  ready: boolean; // true когда проверка токена завершена
  setUser: (user: User | null) => void;
  setReady: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user, ready: true }),
  setReady: () => set({ ready: true }),
  logout: () => set({ user: null, ready: true }),
}));
