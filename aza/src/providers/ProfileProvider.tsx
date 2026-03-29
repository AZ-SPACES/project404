import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthProvider';

const PROFILE_STORAGE_KEY = 'aza_profile';

type ProfileData = {
  displayName: string;
  profileImageUri: string | null;
};

const INITIAL_PROFILE: ProfileData = {
  displayName: '',
  profileImageUri: null,
};

type ProfileContextType = ProfileData & {
  setDisplayName: (name: string) => Promise<void>;
  setProfileImage: (uri: string | null) => Promise<void>;
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

  return (
    <ProfileContext.Provider value={{ ...profile, setDisplayName, setProfileImage }}>
      {children}
    </ProfileContext.Provider>
  );
};

export function useProfile(): ProfileContextType {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
