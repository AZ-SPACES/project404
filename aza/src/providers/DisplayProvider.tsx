import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme, Appearance } from "react-native";
import { useProfile } from "./ProfileProvider";
import { useAuth } from "./AuthProvider";

export type ThemeOption = "Light" | "Dark" | "System Default";
export type LanguageOption = "English (US)" | "French" | "Spanish";

export const THEMES: ThemeOption[] = ["Light", "Dark", "System Default"];
export const LANGUAGES: LanguageOption[] = [
  "English (US)",
  "French",
  "Spanish",
];

export const BACKGROUND_IMAGES = [
  {
    id: "1",
    uri: "https://images.pexels.com/photos/3609832/pexels-photo-3609832.jpeg",
  },
  { id: "2", uri: "https://images.pexels.com/photos/15286/pexels-photo.jpg" },
  { id: "3", uri: "https://images.pexels.com/photos/34950/pexels-photo.jpg" },
  {
    id: "4",
    uri: "https://images.pexels.com/photos/1037992/pexels-photo-1037992.jpeg",
  },
];

export type DisplayContextType = {
  theme: ThemeOption;
  setTheme: (theme: ThemeOption) => void;
  language: LanguageOption;
  setLanguage: (lang: LanguageOption) => void;
  homeBackground: string;
  setHomeBackground: (uri: string) => void;
  hubBackground: string;
  setHubBackground: (uri: string) => void;
  customBackgrounds: string[];
  addCustomBackground: (uri: string) => void;
  activeColorScheme: "light" | "dark";
};

const DisplayContext = createContext<DisplayContextType | undefined>(undefined);

export function DisplayProvider({ children }: { children: ReactNode }) {
  const defaultBg = BACKGROUND_IMAGES[0]?.uri ?? "";
  const [theme, setThemeState] = useState<ThemeOption>("System Default");
  const [language, setLanguageState] = useState<LanguageOption>("English (US)");
  const [homeBackground, setHomeBackgroundState] = useState<string>(defaultBg);
  const [hubBackground, setHubBackgroundState] = useState<string>(defaultBg);
  const [customBackgrounds, setCustomBackgroundsState] = useState<string[]>([]);
  
  const { userToken } = useAuth();
  const profile = useProfile();
  const colorScheme = useColorScheme();
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const activeColorScheme = 
    theme === "System Default" 
      ? ((colorScheme || systemScheme) === "dark" ? "dark" : "light")
      : theme === "Dark" ? "dark" : "light";

  useEffect(() => {
    // Load all settings on mount
    const loadSettings = async () => {
      try {
        const [savedTheme, savedLang, savedBg, savedHubBg, savedCustomBgs] = await Promise.all([
          AsyncStorage.getItem('AppTheme'),
          AsyncStorage.getItem('AppLanguage'),
          AsyncStorage.getItem('AppHomeBackground'),
          AsyncStorage.getItem('AppHubBackground'),
          AsyncStorage.getItem('AppCustomBackgrounds')
        ]);

        if (savedTheme && THEMES.includes(savedTheme as ThemeOption)) {
          setThemeState(savedTheme as ThemeOption);
        }
        if (savedLang && LANGUAGES.includes(savedLang as LanguageOption)) {
          setLanguageState(savedLang as LanguageOption);
        }
        if (savedBg) {
          setHomeBackgroundState(savedBg);
        }
        if (savedHubBg) {
          setHubBackgroundState(savedHubBg);
        }
        if (savedCustomBgs) {
          try {
            setCustomBackgroundsState(JSON.parse(savedCustomBgs));
          } catch (e) {}
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, []);

  // Sync with profile changes
  useEffect(() => {
    if (userToken && profile.language) {
      if (profile.language !== language && LANGUAGES.includes(profile.language as LanguageOption)) {
        setLanguageState(profile.language as LanguageOption);
      }
      if (profile.theme !== theme && THEMES.includes(profile.theme as ThemeOption)) {
        setThemeState(profile.theme as ThemeOption);
      }
      if (profile.homeBackground && profile.homeBackground !== homeBackground) {
        setHomeBackgroundState(profile.homeBackground);
      }
      if (profile.hubBackground && profile.hubBackground !== hubBackground) {
        setHubBackgroundState(profile.hubBackground);
      }
    }
  }, [profile.language, profile.theme, profile.homeBackground, profile.hubBackground, userToken]);

  const setTheme = (newTheme: ThemeOption) => {
    setThemeState(newTheme);
    AsyncStorage.setItem('AppTheme', newTheme).catch(() => {});
    if (userToken) {
      profile.updateProfile({ theme: newTheme }).catch(err => {
        console.error("Failed to sync theme to backend", err);
      });
    }
  };

  const setLanguage = (newLang: LanguageOption) => {
    setLanguageState(newLang);
    AsyncStorage.setItem('AppLanguage', newLang).catch(() => {});
    if (userToken) {
      profile.updateProfile({ language: newLang }).catch(err => {
        console.error("Failed to sync language to backend", err);
      });
    }
  };

  const setHomeBackground = (uri: string) => {
    setHomeBackgroundState(uri);
    AsyncStorage.setItem('AppHomeBackground', uri).catch(() => {});
    if (userToken) {
      profile.updateProfile({ homeBackground: uri }).catch(err => {
        console.error("Failed to sync home background to backend", err);
      });
    }
  };

  const setHubBackground = (uri: string) => {
    setHubBackgroundState(uri);
    AsyncStorage.setItem('AppHubBackground', uri).catch(() => {});
    if (userToken) {
      profile.updateProfile({ hubBackground: uri }).catch(err => {
        console.error("Failed to sync hub background to backend", err);
      });
    }
  };

  const addCustomBackground = (uri: string) => {
    setCustomBackgroundsState((prev: string[]) => {
      const updated = [uri, ...prev.filter((bg: string) => bg !== uri)].slice(0, 3);
      AsyncStorage.setItem('AppCustomBackgrounds', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  return (
    <DisplayContext.Provider
      value={{
        theme,
        setTheme,
        language,
        setLanguage,
        homeBackground,
        setHomeBackground,
        hubBackground,
        setHubBackground,
        customBackgrounds,
        addCustomBackground,
        activeColorScheme,
      }}
    >
      {children}
    </DisplayContext.Provider>
  );
}

export function useDisplayContext() {
  const context = useContext(DisplayContext);
  if (context === undefined) {
    throw new Error("useDisplayContext must be used within a DisplayProvider");
  }
  return context;
}
