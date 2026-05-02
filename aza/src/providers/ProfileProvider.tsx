import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthProvider';
import { api } from '../services/api';

const PROFILE_STORAGE_KEY = 'aza_profile';

type ProfileData = {
  displayName: string;
  profileImageUri: string | null;
  email: string | null;
  phone: string | null;
  handle: string | null;
  syncContacts: boolean;
  billForwardingEnabled: boolean;
};

const INITIAL_PROFILE: ProfileData = {
  displayName: '',
  profileImageUri: null,
  email: null,
  phone: null,
  handle: null,
  syncContacts: true,
  billForwardingEnabled: false,
};

type ProfileContextType = ProfileData & {
  setDisplayName: (name: string) => Promise<void>;
  setProfileImage: (uri: string | null) => Promise<void>;
  setEmail: (email: string | null) => Promise<void>;
  setPhone: (phone: string | null) => Promise<void>;
  setHandle: (handle: string | null) => Promise<void>;
  setSyncContacts: (enabled: boolean) => Promise<void>;
  setBillForwardingEnabled: (enabled: boolean) => Promise<void>;
  fetchProfile: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<ProfileData>(INITIAL_PROFILE);
  const { userToken } = useAuth();

  // Load persisted profile on mount
  useEffect(() => {
    AsyncStorage.getItem(PROFILE_STORAGE_KEY)
      .then((raw) => {
        if (raw) setProfile(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  // Clear profile data when the user logs out
  useEffect(() => {
    if (userToken === null) {
      setProfile(INITIAL_PROFILE);
      AsyncStorage.removeItem(PROFILE_STORAGE_KEY).catch(() => {});
    }
  }, [userToken]);

  const fetchProfile = useCallback(async () => {
    if (!userToken) return;
    try {
      const { data } = await api.get('/api/v1/users/me');
      const userData = data.data;
      const updated = {
        displayName: userData.displayName || `${userData.firstName} ${userData.lastName}`,
        profileImageUri: userData.profileImageUrl,
        email: userData.email,
        phone: userData.phone,
        handle: userData.handle,
        syncContacts: userData.syncContacts ?? true,
        billForwardingEnabled: userData.billForwardingEnabled ?? false,
      };
      setProfile(updated);
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));

      // Also sync notification preferences if available
      if (userData.notificationPreferences) {
        try {
          const prefsKey = `@notification_prefs_${userToken}`;
          await AsyncStorage.setItem(prefsKey, userData.notificationPreferences);
        } catch (e) {
          console.warn('Failed to sync notification preferences from profile', e);
        }
      }
    } catch (error) {
      console.error('Failed to fetch profile', error);
    }
  }, [userToken]);

  useEffect(() => {
    if (userToken) {
      fetchProfile();
    }
  }, [userToken, fetchProfile]);

  const setDisplayName = useCallback(async (name: string) => {
    const updated = { ...profile, displayName: name };
    setProfile(updated);
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save display name', e);
    }
  }, [profile]);

  const setProfileImage = useCallback(async (uri: string | null) => {
    const updated = { ...profile, profileImageUri: uri };
    setProfile(updated);
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save profile image', e);
    }
  }, [profile]);

  const setEmail = useCallback(async (email: string | null) => {
    const updated = { ...profile, email };
    setProfile(updated);
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save email', e);
    }
  }, [profile]);

  const setPhone = useCallback(async (phone: string | null) => {
    const updated = { ...profile, phone };
    setProfile(updated);
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save phone', e);
    }
  }, [profile]);

  const setHandle = useCallback(async (handle: string | null) => {
    const updated = { ...profile, handle };
    setProfile(updated);
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save handle', e);
    }
  }, [profile]);

  const setSyncContacts = useCallback(async (enabled: boolean) => {
    const updated = { ...profile, syncContacts: enabled };
    setProfile(updated);
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save syncContacts setting', e);
    }
  }, [profile]);
  const setBillForwardingEnabled = useCallback(async (enabled: boolean) => {
    const updated = { ...profile, billForwardingEnabled: enabled };
    setProfile(updated);
    try {
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save billForwardingEnabled setting', e);
    }
  }, [profile]);

  return (
    <ProfileContext.Provider value={{ ...profile, setDisplayName, setProfileImage, setEmail, setPhone, setHandle, setSyncContacts, setBillForwardingEnabled, fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};

export function useProfile(): ProfileContextType {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
