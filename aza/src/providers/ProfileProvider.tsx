import React, { createContext, useContext, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthProvider';
import { getMe, updateMe, uploadProfileImage, api, requestEmailChange as apiRequestEmailChange, verifyEmailChange as apiVerifyEmailChange, requestPhoneChange as apiRequestPhoneChange, verifyPhoneChange as apiVerifyPhoneChange, enablePasskeys as apiEnablePasskeys, disablePasskeys as apiDisablePasskeys } from "../services/api";
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';

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
  totpEnabled: boolean;
  smsTwoFactorEnabled: boolean;
  emailTwoFactorEnabled: boolean;
  appTwoFactorEnabled: boolean;
  passkeysEnabled: boolean;
  defaultTwoFactorMethod: string | null;
  notificationPreferences: Record<string, boolean> | null;
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
  totpEnabled: false,
  smsTwoFactorEnabled: false,
  emailTwoFactorEnabled: false,
  appTwoFactorEnabled: false,
  passkeysEnabled: false,
  defaultTwoFactorMethod: null,
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
  toggleSms2fa: (enabled: boolean) => Promise<void>;
  togglePasskeys: (enabled: boolean) => Promise<void>;
  updateProfile: (data: Partial<ProfileData>) => Promise<void>;
  updateNotificationPreferences: (prefs: Record<string, boolean>) => Promise<void>;
  fetchProfile: () => void;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

/** Shape of the object returned inside `data.data` by GET /api/v1/users/me. */
type UserApiResponse = {
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  homeAddress?: string | null;
  city?: string | null;
  nationality?: string | null;
  kycStatus?: string | null;
  profileImageUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  handle?: string | null;
  pronouns?: string | null;
  syncContacts?: boolean | null;
  billForwardingEnabled?: boolean | null;
  twoFactorEnabled?: boolean | null;
  totpEnabled?: boolean | null;
  smsTwoFactorEnabled?: boolean | null;
  emailTwoFactorEnabled?: boolean | null;
  appTwoFactorEnabled?: boolean | null;
  passkeysEnabled?: boolean | null;
  defaultTwoFactorMethod?: string | null;
  notificationPreferences?: string | Record<string, boolean> | null;
  findMeByPhone?: boolean | null;
  findMeByEmail?: boolean | null;
  findMeByHandle?: boolean | null;
  biometricData?: boolean | null;
  language?: string | null;
  theme?: string | null;
  homeBackground?: string | null;
  hubBackground?: string | null;
};

function mapUserData(userData: UserApiResponse): ProfileData {
  return {
    displayName: `${userData.firstName ?? ''} ${userData.lastName ?? ''}`.trim() || '',
    firstName: userData.firstName ?? null,
    lastName: userData.lastName ?? null,
    dateOfBirth: userData.dateOfBirth ?? null,
    homeAddress: userData.homeAddress ?? null,
    city: userData.city ?? null,
    nationality: userData.nationality ?? null,
    kycStatus: userData.kycStatus ?? null,
    profileImageUri: userData.profileImageUrl ?? null,
    email: userData.email ?? null,
    phone: userData.phone ?? null,
    handle: userData.handle ?? null,
    pronouns: userData.pronouns ?? null,
    syncContacts: userData.syncContacts ?? true,
    billForwardingEnabled: userData.billForwardingEnabled ?? false,
    twoFactorEnabled: userData.twoFactorEnabled ?? false,
    totpEnabled: userData.totpEnabled ?? false,
    smsTwoFactorEnabled: userData.smsTwoFactorEnabled ?? false,
    emailTwoFactorEnabled: userData.emailTwoFactorEnabled ?? false,
    appTwoFactorEnabled: userData.appTwoFactorEnabled ?? false,
    passkeysEnabled: userData.passkeysEnabled ?? false,
    defaultTwoFactorMethod: userData.defaultTwoFactorMethod ?? null,
    notificationPreferences: userData.notificationPreferences
      ? (typeof userData.notificationPreferences === 'string'
          ? JSON.parse(userData.notificationPreferences)
          : userData.notificationPreferences)
      : null,
    findMeByPhone: userData.findMeByPhone ?? true,
    findMeByEmail: userData.findMeByEmail ?? true,
    findMeByHandle: userData.findMeByHandle ?? true,
    biometricData: userData.biometricData ?? true,
    language: userData.language ?? 'English (US)',
    theme: userData.theme ?? 'System Default',
    homeBackground: userData.homeBackground ?? null,
    hubBackground: userData.hubBackground ?? null,
  };
}

function invalidateProfile() {
  queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
}

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userToken } = useAuth();

  const { data: profile = INITIAL_PROFILE } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: async () => {
      const { data } = await getMe();
      const userData = data.data;
      const mapped = mapUserData(userData);

      // Persist to AsyncStorage as seed for next cold launch
      AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(mapped)).catch(() => {});

      // Sync notification preferences
      if (userData.notificationPreferences && userToken) {
        AsyncStorage.setItem(`@notification_prefs_${userToken}`, userData.notificationPreferences).catch(() => {});
      }

      return mapped;
    },
    enabled: !!userToken,
    staleTime: 60_000,
    placeholderData: () => {
      // Seed from AsyncStorage on first load (synchronous-looking via placeholderData)
      return INITIAL_PROFILE;
    },
  });

  const fetchProfile = useCallback(() => {
    invalidateProfile();
  }, []);

  const setUsername = useCallback(async (username: string) => {
    try {
      await updateMe({ handle: username });
      invalidateProfile();
    } catch (e) {
      console.error('Failed to save username', e);
      throw e;
    }
  }, []);

  const setAvatarUrl = useCallback(async (url: string) => {
    await updateMe({ profileImageUrl: url });
    invalidateProfile();
  }, []);

  const setProfileImage = useCallback(async (uri: string | null) => {
    try {
      if (uri) {
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        await uploadProfileImage({ uri, name: filename, type } as any);
      }
      invalidateProfile();
    } catch (e) {
      console.error('Failed to upload profile image', e);
      throw e;
    }
  }, []);

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
      invalidateProfile();
    } catch (e) {
      console.error('Failed to verify email change', e);
      throw e;
    }
  }, []);

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
      invalidateProfile();
    } catch (e) {
      console.error('Failed to verify phone change', e);
      throw e;
    }
  }, []);

  const setHandle = useCallback(async (handle: string | null) => {
    try {
      await updateMe({ ...(handle != null ? { handle } : {}) });
      invalidateProfile();
    } catch (e) {
      console.error('Failed to save handle', e);
      throw e;
    }
  }, []);

  const setSyncContacts = useCallback(async (enabled: boolean) => {
    try {
      await api.put("/api/v1/users/me/privacy", { syncContacts: enabled });
      invalidateProfile();
    } catch (e) {
      console.error('Failed to save syncContacts setting', e);
      throw e;
    }
  }, []);

  const setBillForwardingEnabled = useCallback(async (enabled: boolean) => {
    try {
      await api.put("/api/v1/users/me/privacy", { billForwardingEnabled: enabled });
      invalidateProfile();
    } catch (e) {
      console.error('Failed to save billForwardingEnabled setting', e);
      throw e;
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<ProfileData>) => {
    try {
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
        requests.push(updateMe(profileData as Parameters<typeof updateMe>[0]));
      }

      await Promise.all(requests);
      invalidateProfile();
    } catch (e) {
      console.error('Failed to update profile', e);
      throw e;
    }
  }, []);

  const updateNotificationPreferencesInProvider = useCallback(async (prefs: Record<string, boolean>) => {
    try {
      await api.put("/api/v1/users/me/notifications", prefs);
      if (userToken) {
        await AsyncStorage.setItem(`@notification_prefs_${userToken}`, JSON.stringify(prefs));
      }
      invalidateProfile();
    } catch (e) {
      console.error('Failed to update notification preferences', e);
      throw e;
    }
  }, [userToken]);

  const toggleApp2fa = useCallback(async (enabled: boolean) => {
    try {
      await api.post(`/api/v1/auth/2fa/app/toggle?enabled=${enabled}`);
      invalidateProfile();
    } catch (e) {
      console.error('Failed to toggle App 2FA', e);
      throw e;
    }
  }, []);

  const toggleSms2fa = useCallback(async (enabled: boolean) => {
    try {
      invalidateProfile();
    } catch (e) {
      console.error('Failed to toggle SMS 2FA', e);
    }
  }, []);

  const togglePasskeys = useCallback(async (enabled: boolean) => {
    try {
      if (enabled) {
        await apiEnablePasskeys();
      } else {
        await apiDisablePasskeys();
      }
      invalidateProfile();
    } catch (e) {
      console.error('Failed to toggle Passkeys', e);
      throw e;
    }
  }, []);

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
      toggleSms2fa,
      togglePasskeys,
      updateProfile,
      updateNotificationPreferences: updateNotificationPreferencesInProvider,
      fetchProfile,
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
