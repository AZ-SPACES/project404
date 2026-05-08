import React from 'react';
import { useSignupStore, SignupData, PronounOption, EmploymentOption, YesNo } from '../store/signupStore';
import { useShallow } from 'zustand/react/shallow';

// ─── Shared types (re-exported for backward compatibility) ────
export type { PronounOption, EmploymentOption, YesNo };
export type SignUpData = SignupData;

// ─── Provider (No-op now, just passing children) ──────────────
export const SignUpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// ─── Selector-based hooks ─────────────────────────────────────
// These use Zustand selectors so components only re-render when
// the specific slice they read actually changes.

/** Subscribe to signup form data only. */
export function useSignupData() {
  return useSignupStore((s) => s.data);
}

/**
 * Returns stable action references — never triggers a re-render
 * because the selector output is shallow-compared and actions are
 * referentially stable in Zustand.
 */
export function useSignupActions() {
  return useSignupStore(
    useShallow((s) => ({
      update: s.updateData,
      reset: s.reset,
      submitSignup: s.submitSignup,
    }))
  );
}

/** Subscribe to isLoading only. */
export function useSignupLoading() {
  return useSignupStore((s) => s.isLoading);
}

// ─── Legacy hook (backward compat) ────────────────────────────
// Components that haven't been migrated can still call useSignUp().
// It subscribes to everything — prefer the granular hooks above.
export function useSignUp() {
  const data = useSignupData();
  const { update, reset, submitSignup } = useSignupActions();
  const isLoading = useSignupLoading();

  return { data, update, reset, submitSignup, isLoading };
}
