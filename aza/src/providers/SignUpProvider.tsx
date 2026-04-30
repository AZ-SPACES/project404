import React from 'react';
import { useSignupStore, SignupData, PronounOption, EmploymentOption, YesNo } from '../store/signupStore';

// ─── Shared types (re-exported for backward compatibility) ────
export type { PronounOption, EmploymentOption, YesNo };
export type SignUpData = SignupData;

// ─── Provider (No-op now, just passing children) ──────────────
export const SignUpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// ─── Hook (Wrapper around Zustand) ────────────────────────────
export function useSignUp() {
  const store = useSignupStore();
  
  return {
    data: store.data,
    update: store.updateData,
    reset: store.reset,
    submitSignup: store.submitSignup,
    isLoading: store.isLoading,
  };
}
