import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type PronounOption = 'he/his' | 'she/her' | 'they/them' | 'custom' | null;
export type EmploymentOption =
  | 'Student'
  | 'Part-Time'
  | 'Full-Time'
  | 'Self-employed'
  | 'Retired'
  | 'Unemployed'
  | null;
export type YesNo = 'Yes' | 'No' | null;

export type SignUpData = {
  phoneNumber: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  homeAddress: string;
  city: string;
  nationality: string | null;
  otherNationality: string;
  isTaxResidentAbroad: YesNo;
  taxCountry: string;
  isUSPerson: YesNo;
  pronoun: PronounOption;
  customPronoun: string;
  employmentStatus: EmploymentOption;
  dateOfBirth: string;
};

const INITIAL_DATA: SignUpData = {
  phoneNumber: '',
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  homeAddress: '',
  city: '',
  nationality: null,
  otherNationality: '',
  isTaxResidentAbroad: null,
  taxCountry: '',
  isUSPerson: null,
  pronoun: null,
  customPronoun: '',
  employmentStatus: null,
  dateOfBirth: '',
};

// ─── Context ──────────────────────────────────────────────────────────────────

type SignUpContextType = {
  data: SignUpData;
  update: (fields: Partial<SignUpData>) => void;
  reset: () => void;
};

const SignUpContext = createContext<SignUpContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const SignUpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<SignUpData>(INITIAL_DATA);

  const update = useCallback((fields: Partial<SignUpData>) => {
    setData((prev) => ({ ...prev, ...fields }));
  }, []);

  const reset = useCallback(() => {
    setData(INITIAL_DATA);
  }, []);

  return (
    <SignUpContext.Provider value={{ data, update, reset }}>
      {children}
    </SignUpContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSignUp(): SignUpContextType {
  const ctx = useContext(SignUpContext);
  if (!ctx) throw new Error('useSignUp must be used within a SignUpProvider');
  return ctx;
}
