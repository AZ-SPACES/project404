import React, { createContext, useContext, useState, ReactNode } from "react";

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
};

const DisplayContext = createContext<DisplayContextType | undefined>(undefined);

export function DisplayProvider({ children }: { children: ReactNode }) {
  const defaultBg = BACKGROUND_IMAGES[0]?.uri ?? "";
  const [theme, setTheme] = useState<ThemeOption>("Light");
  const [language, setLanguage] = useState<LanguageOption>("English (US)");
  const [homeBackground, setHomeBackground] = useState<string>(defaultBg);

  return (
    <DisplayContext.Provider
      value={{
        theme,
        setTheme,
        language,
        setLanguage,
        homeBackground,
        setHomeBackground,
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
