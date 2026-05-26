import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthProvider';
import { getMe, updateMe, uploadProfileImage, api,requestEmailChange as apiRequestEmailChange, verifyEmailChange as apiVerifyEmailChange, requestPhoneChange as apiRequestPhoneChange, verifyPhoneChange as apiVerifyPhoneChange, } from "../services/api";

const PROFILE_STORAGE_KEY = 'aza_profile';

type ProfileData = {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  homeAddress: string | null;
  city: string | null;
  nationality: string | null;
  kycStatus: string | null;
  profileImageUri: string | null;
  email: string | null;
  phone: string | null;
  handle: string | null;
  pronouns: string | null;
  syncContacts: boolean;
  billForwardingEnabled: boolean;
  twoFactorEnabled: boolean;
  smsTwoFactorEnabled: boolean;
  emailTwoFactorEnabled: boolean;
  appTwoFactorEnabled: boolean;
  passkeysEnabled: boolean;
  notificationPreferences: Record<string, any> | null;
  findMeByPhone: boolean;
  findMeByEmail: boolean;
  findMeByHandle: boolean;
  biometricData: boolean;
  language: string;
  theme: string;
  homeBackground: string | null;
  hubBackground: string | null;
};

const INITIAL_PROFILE: ProfileData = {
  displayName: '',
  firstName: null,
  lastName: null,
  dateOfBirth: null,
  homeAddress: null,
  city: null,
  nationality: null,
  kycStatus: null,
  profileImageUri: null,
  email: null,
  phone: null,
  handle: null,
  pronouns: null,
  syncContacts: true,
  billForwardingEnabled: false,
  twoFactorEnabled: false,
  smsTwoFactorEnabled: false,
  emailTwoFactorEnabled: false,
  appTwoFactorEnabled: false,
  passkeysEnabled: false,
  notificationPreferences: null,
  findMeByPhone: true,
  findMeByEmail: true,
  findMeByHandle: true,
  biometricData: true,
  language: 'English (US)',
  theme: 'System Default',
  homeBackground: null,
  hubBackground: null,
};

type ProfileContextType = ProfileData & {
  setUsername: (username: string) => Promise<void>;
  setProfileImage: (uri: string | null) => Promise<void>;
  setAvatarUrl: (url: string) => Promise<void>;
  requestEmailChange: (email: string) => Promise<void>;
  verifyEmailChange: (email: string, code: string) => Promise<void>;
  requestPhoneChange: (phone: string) => Promise<void>;
  verifyPhoneChange: (phone: string, code: string) => Promise<void>;
  setHandle: (handle: string | null) => Promise<void>;
  setSyncContacts: (enabled: boolean) => Promise<void>;
  setBillForwardingEnabled: (enabled: boolean) => Promise<void>;
  toggleApp2fa: (enabled: boolean) => Promise<void>;
  updateProfile: (data: Partial<ProfileData>) => Promise<void>;
  updateNotificationPreferences: (prefs: Record<string, any>) => Promise<void>;
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
      const { data } = await getMe();
      const userData = data.data;
      const updated: ProfileData = {
        displayName: `${userData.firstName ?? ''} ${userData.lastName ?? ''}`.trim() || '',
        firstName: userData.firstName,
        lastName: userData.lastName,
        dateOfBirth: userData.dateOfBirth,
        homeAddress: userData.homeAddress,
        city: userData.city,
        nationality: userData.nationality,
        kycStatus: userData.kycStatus,
        profileImageUri: userData.profileImageUrl,
        email: userData.email,
        phone: userData.phone,
        handle: userData.handle,
        pronouns: userData.pronouns,
        syncContacts: userData.syncContacts ?? true,
        billForwardingEnabled: userData.billForwardingEnabled ?? false,
        twoFactorEnabled: userData.twoFactorEnabled ?? false,
        smsTwoFactorEnabled: userData.smsTwoFactorEnabled ?? false,
        emailTwoFactorEnabled: userData.emailTwoFactorEnabled ?? false,
        appTwoFactorEnabled: userData.appTwoFactorEnabled ?? false,
        passkeysEnabled: userData.passkeysEnabled ?? false,
        notificationPreferences: userData.notificationPreferences ? JSON.parse(userData.notificationPreferences) : null,
        findMeByPhone: userData.findMeByPhone ?? true,
        findMeByEmail: userData.findMeByEmail ?? true,
        findMeByHandle: userData.findMeByHandle ?? true,
        biometricData: userData.biometricData ?? true,
        language: userData.language ?? 'English (US)',
        theme: userData.theme ?? 'System Default',
        homeBackground: userData.homeBackground,
        hubBackground: userData.hubBackground,
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

  const setUsername = useCallback(async (username: string) => {
    try {
      await updateMe({ handle: username });
      await fetchProfile();
    } catch (e) {
      console.error('Failed to save username', e);
      throw e;
    }
  }, [fetchProfile]);

  const setAvatarUrl = useCallback(async (url: string) => {
    await updateMe({ profileImageUrl: url });
    await fetchProfile();
  }, [fetchProfile]);

  const setProfileImage = useCallback(async (uri: string | null) => {
    try {
      if (uri) {
        // Upload to backend
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        
        const photo = {
          uri,
          name: filename,
          type,
        } as any;

        await uploadProfileImage(photo);
      } else {
        // Handle removal if backend supports it (optional)
        // For now, just clear locally
      }
      await fetchProfile();
    } catch (e) {
      console.error('Failed to upload profile image', e);
      throw e;
    }
  }, [fetchProfile]);

  const requestEmailChangeAction = useCallback(async (email: string) => {
    try {
      await apiRequestEmailChange(email);
    } catch (e) {
      console.error('Failed to request email change', e);
      throw e;
    }
  }, []);

  const verifyEmailChangeAction = useCallback(async (email: string, code: string) => {
    try {
      await apiVerifyEmailChange(email, code);
      await fetchProfile();
    } catch (e) {
      console.error('Failed to verify email change', e);
      throw e;
    }
  }, [fetchProfile]);

  const requestPhoneChangeAction = useCallback(async (phone: string) => {
    try {
      await apiRequestPhoneChange(phone);
    } catch (e) {
      console.error('Failed to request phone change', e);
      throw e;
    }
  }, []);

  const verifyPhoneChangeAction = useCallback(async (phone: string, code: string) => {
    try {
      await apiVerifyPhoneChange(phone, code);
      await fetchProfile();
    } catch (e) {
      console.error('Failed to verify phone change', e);
      throw e;
    }
  }, [fetchProfile]);

  const setHandle = useCallback(async (handle: string | null) => {
    try {
      await updateMe({ handle });
      await fetchProfile();
    } catch (e) {
      console.error('Failed to save handle', e);
      throw e;
    }
  }, [fetchProfile]);

  const setSyncContacts = useCallback(async (enabled: boolean) => {
    try {
      await api.put("/api/v1/users/me/privacy", { syncContacts: enabled });
      await fetchProfile();
    } catch (e) {
      console.error('Failed to save syncContacts setting', e);
      throw e;
    }
  }, [fetchProfile]);
  const setBillForwardingEnabled = useCallback(async (enabled: boolean) => {
    try {
      await api.put("/api/v1/users/me/privacy", { billForwardingEnabled: enabled });
      await fetchProfile();
    } catch (e) {
      console.error('Failed to save billForwardingEnabled setting', e);
      throw e;
    }
  }, [fetchProfile]);

  const updateProfile = useCallback(async (data: Partial<ProfileData>) => {
    try {
      // Split fields by backend endpoint
      const PRIVACY_FIELDS = ['findMeByHandle', 'findMeByEmail', 'findMeByPhone', 'syncContacts', 'billForwardingEnabled', 'biometricData'] as const;
      type PrivacyKey = typeof PRIVACY_FIELDS[number];

      const privacyData: Partial<Record<PrivacyKey, boolean>> = {};
      const profileData: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(data)) {
        if ((PRIVACY_FIELDS as readonly string[]).includes(key)) {
          privacyData[key as PrivacyKey] = value as boolean;
        } else {
          profileData[key] = value;
        }
      }

      const requests: Promise<unknown>[] = [];
      if (Object.keys(privacyData).length > 0) {
        requests.push(api.put('/api/v1/users/me/privacy', privacyData));
      }
      if (Object.keys(profileData).length > 0) {
        requests.push(updateMe(profileData));
      }

      await Promise.all(requests);
      await fetchProfile();
    } catch (e) {
      console.error('Failed to update profile', e);
      throw e;
    }
  }, [fetchProfile]);

  const updateNotificationPreferencesInProvider = useCallback(async (prefs: Record<string, any>) => {
    try {
      await api.put("/api/v1/users/me/notifications", prefs);
      // Update local state immediately for responsiveness
      setProfile(prev => ({
        ...prev,
        notificationPreferences: prefs
      }));
      // Safely persist to AsyncStorage by reading the current value first
      const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        const currentProfile = JSON.parse(raw);
        currentProfile.notificationPreferences = prefs;
        await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(currentProfile));
      }
      
      // Update the specific notification prefs key for other parts of the app
      if (userToken) {
        await AsyncStorage.setItem(`@notification_prefs_${userToken}`, JSON.stringify(prefs));
      }
    } catch (e) {
      console.error('Failed to update notification preferences', e);
      throw e;
    }
  }, [userToken]);

  const toggleApp2fa = useCallback(async (enabled: boolean) => {
    const updated = { ...profile, appTwoFactorEnabled: enabled, twoFactorEnabled: enabled || profile.twoFactorEnabled };
    setProfile(updated);
    try {
      await api.post(`/api/v1/auth/2fa/app/toggle?enabled=${enabled}`);
      await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to toggle App 2FA', e);
    }
  }, [profile]);

  return (
    <ProfileContext.Provider value={{
      ...profile,
      setUsername,
      setProfileImage,
      setAvatarUrl,
      requestEmailChange: requestEmailChangeAction,
      verifyEmailChange: verifyEmailChangeAction,
      requestPhoneChange: requestPhoneChangeAction,
      verifyPhoneChange: verifyPhoneChangeAction,
      setHandle,
      setSyncContacts,
      setBillForwardingEnabled,
      toggleApp2fa,
      updateProfile,
      updateNotificationPreferences: updateNotificationPreferencesInProvider,
      fetchProfile
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export function useProfile(): ProfileContextType {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
