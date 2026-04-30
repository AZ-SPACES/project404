import { create } from 'zustand';
import { api } from '../services/api';

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

export type SignupData = {
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

const INITIAL_DATA: SignupData = {
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

interface SignupState {
  data: SignupData;
  isLoading: boolean;
  error: string | null;

  // Actions
  updateData: (partialData: Partial<SignupData>) => void;
  reset: () => void;
  submitSignup: () => Promise<any>; // Returns response or throws error
}

export const useSignupStore = create<SignupState>((set, get) => ({
  data: INITIAL_DATA,
  isLoading: false,
  error: null,

  updateData: (partialData) => {
    set((state) => ({
      data: { ...state.data, ...partialData },
      error: null,
    }));
  },

  reset: () => {
    set({ data: INITIAL_DATA, isLoading: false, error: null });
  },

  submitSignup: async () => {
    const { data } = get();
    
    // Quick validation before submitting
    if (!data.phoneNumber && !data.email) {
      throw new Error('Phone or email is required');
    }

    try {
      set({ isLoading: true, error: null });
      
      const payload = {
        phone: data.phoneNumber,
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: `${data.firstName} ${data.lastName}`.trim(),
        homeAddress: data.homeAddress,
        city: data.city,
        nationality: data.nationality === 'Other' ? data.otherNationality : data.nationality,
        employmentStatus: data.employmentStatus, 
        dateOfBirth: data.dateOfBirth,
      };

      const response = await api.post('/api/v1/auth/signup', payload);
      
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      console.error('Signup failed:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Signup failed';
      set({ isLoading: false, error: errorMsg });
      throw error;
    }
  },
}));
