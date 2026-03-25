import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme, Appearance } from "react-native";

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
  activeColorScheme: "light" | "dark";
};

const DisplayContext = createContext<DisplayContextType | undefined>(undefined);

export function DisplayProvider({ children }: { children: ReactNode }) {
  const defaultBg = BACKGROUND_IMAGES[0]?.uri ?? "";
  const [theme, setThemeState] = useState<ThemeOption>("System Default");
  const [language, setLanguageState] = useState<LanguageOption>("English (US)");
  const [homeBackground, setHomeBackgroundState] = useState<string>(defaultBg);
  
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
        const [savedTheme, savedLang, savedBg] = await Promise.all([
          AsyncStorage.getItem('AppTheme'),
          AsyncStorage.getItem('AppLanguage'),
          AsyncStorage.getItem('AppHomeBackground')
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
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();
  }, []);

  const setTheme = (newTheme: ThemeOption) => {
    setThemeState(newTheme);
    AsyncStorage.setItem('AppTheme', newTheme).catch(() => {});
  };

  const setLanguage = (newLang: LanguageOption) => {
    setLanguageState(newLang);
    AsyncStorage.setItem('AppLanguage', newLang).catch(() => {});
  };

  const setHomeBackground = (uri: string) => {
    setHomeBackgroundState(uri);
    AsyncStorage.setItem('AppHomeBackground', uri).catch(() => {});
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
