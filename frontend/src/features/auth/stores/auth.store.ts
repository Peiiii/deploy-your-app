import { create } from 'zustand';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  // Loading current session (/me)
  isLoading: boolean;
  error: string | null;
  sessionError: string | null;
  // Email auth modal UI state
  modalOpen: boolean;
  mode: 'login' | 'signup';
  email: string;
  password: string;
  isSubmitting: boolean;
   confirmPassword: string;
   passwordVisible: boolean;
   confirmPasswordVisible: boolean;
}

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  isLoading: true,
  error: null,
  sessionError: null,
  modalOpen: false,
  mode: 'login',
  email: '',
  password: '',
  isSubmitting: false,
  confirmPassword: '',
  passwordVisible: false,
  confirmPasswordVisible: false,
}));
