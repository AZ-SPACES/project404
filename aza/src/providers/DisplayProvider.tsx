import React, { createContext, useCallback, useContext, useState, ReactNode, useEffect, useMemo, useRef } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme, Appearance } from "react-native";
import { useAuth } from "./AuthProvider";
import { useProfile } from "./ProfileProvider";
import { uploadHomeBackground, uploadHubBackground, updateMe, api } from "../services/api";
import { computeImageLuminance } from "../utils/wallpaperContrast";
import { queryKeys } from "../lib/queryKeys";
import { queryClient } from "../lib/queryClient";

export type ThemeOption = "Light" | "Dark" | "System Default";
export type LanguageOption = "English" | "French" | "Twi";
export type BalanceCardStyle = 'flat' | 'glass' | 'card';
export type TabBarStyle = 'labeled' | 'minimal';
export type TransactionDensity = 'comfortable' | 'compact';
export type HomeLayout = 'default' | 'minimal';
export type CornerRadiusScale = 'sharp' | 'rounded' | 'pill';
export type TabIconStyle = 'outline' | 'filled';
export type MainTabNav = 'custom' | 'default' | 'native';
export type TransactionGrouping = 'date' | 'flat';
export type QuickActionId = 'send' | 'request' | 'details' | 'withdraw' | 'topup' | 'statement' | 'akyede' | 'bills' | 'split';

export const QUICK_ACTIONS_REGISTRY: { id: QuickActionId; icon: string; label: string }[] = [
  { id: 'send',      icon: 'arrow-up',    label: 'Send'      },
  { id: 'request',   icon: 'arrow-down',  label: 'Request'   },
  { id: 'details',   icon: 'credit-card', label: 'Details'   },
  { id: 'withdraw',  icon: 'log-out',     label: 'Withdraw'  },
  { id: 'topup',     icon: 'plus-circle', label: 'Top Up'    },
  { id: 'statement', icon: 'file-text',   label: 'Statement' },
  { id: 'akyede',    icon: 'gift',        label: 'Akyede'    },
  { id: 'bills',     icon: 'file-text',   label: 'Pay bills' },
  { id: 'split',     icon: 'users',       label: 'Split'     },
];

export type TabId = 'home' | 'contacts' | 'chat' | 'hub';
export const TAB_REGISTRY: { id: TabId; label: string }[] = [
  { id: 'home',     label: 'Home'     },
  { id: 'contacts', label: 'Contacts' },
  { id: 'chat',     label: 'Chat'     },
  { id: 'hub',      label: 'Hub'      },
];
const DEFAULT_TAB_ORDER: TabId[] = ['home', 'contacts', 'chat', 'hub'];

export const THEMES: ThemeOption[] = ["Light", "Dark", "System Default"];
export const LANGUAGES: LanguageOption[] = ["English", "French", "Twi"];

export const ACCENT_PALETTES = [
  { id: 'forest',  label: 'Forest',  primary: '#174717', secondary: '#B7EE7A', gradientEnd: '#2D6A4F' },
  { id: 'ocean',   label: 'Ocean',   primary: '#1A56A0', secondary: '#93C5FD', gradientEnd: '#0F2027' },
  { id: 'royal',   label: 'Royal',   primary: '#6D28D9', secondary: '#C4B5FD', gradientEnd: '#4C1D95' },
  { id: 'rose',    label: 'Rose',    primary: '#BE185D', secondary: '#FBCFE8', gradientEnd: '#9D174D' },
  { id: 'amber',   label: 'Amber',   primary: '#B45309', secondary: '#FDE68A', gradientEnd: '#92400E' },
  { id: 'teal',    label: 'Teal',    primary: '#0F766E', secondary: '#99F6E4', gradientEnd: '#134E4A' },
  { id: 'slate',   label: 'Slate',   primary: '#374151', secondary: '#D1D5DB', gradientEnd: '#1F2937' },
  { id: 'crimson', label: 'Crimson', primary: '#991B1B', secondary: '#FECACA', gradientEnd: '#7F1D1D' },
] as const;

export const BANNER_GRADIENTS = [
  { id: 'accent',   label: 'Accent',   colors: null },
  { id: 'dusk',     label: 'Dusk',     colors: ['#0f0c29', '#302b63'] },
  { id: 'sunset',   label: 'Sunset',   colors: ['#fc4a1a', '#f7b733'] },
  { id: 'aurora',   label: 'Aurora',   colors: ['#00b09b', '#96c93d'] },
  { id: 'midnight', label: 'Midnight', colors: ['#2c3e50', '#4ca1af'] },
  { id: 'ember',    label: 'Ember',    colors: ['#c31432', '#240b36'] },
  { id: 'ocean',    label: 'Ocean',    colors: ['#1a1a2e', '#0f3460'] },
] as const;

export const BACKGROUND_IMAGES = [
  { id: "1", uri: "https://images.pexels.com/photos/3609832/pexels-photo-3609832.jpeg" },
  { id: "2", uri: "https://images.pexels.com/photos/15286/pexels-photo.jpg" },
  { id: "3", uri: "https://images.pexels.com/photos/34950/pexels-photo.jpg" },
  { id: "4", uri: "https://images.pexels.com/photos/1037992/pexels-photo-1037992.jpeg" },
];

export type DisplayContextType = {
  theme: ThemeOption;
  setTheme: (theme: ThemeOption) => void;
  language: LanguageOption;
  setLanguage: (lang: LanguageOption) => void;
  // Accent
  accentId: string;
  setAccentId: (id: string) => void;
  // Backgrounds
  homeBackground: string;
  setHomeBackground: (uri: string) => void;
  hubBackground: string;
  setHubBackground: (uri: string) => void;
  homeCustomBackgrounds: string[];
  hubCustomBackgrounds: string[];
  addHomeCustomBackground: (uri: string) => void;
  addHubCustomBackground: (uri: string) => void;
  removeHomeCustomBackground: (uri: string) => void;
  removeHubCustomBackground: (uri: string) => void;
  // Dim + Blur
  homeDim: number;
  setHomeDim: (val: number) => void;
  hubDim: number;
  setHubDim: (val: number) => void;
  homeBlur: number;
  setHomeBlur: (val: number) => void;
  hubBlur: number;
  setHubBlur: (val: number) => void;
  // Average luminance (0..1) of the home wallpaper image, null if none/unknown
  homeBgLuminance: number | null;
  // Banner gradient (used when no background image)
  homeBannerGradient: string;
  setHomeBannerGradient: (id: string) => void;
  hubBannerGradient: string;
  setHubBannerGradient: (id: string) => void;
  // Interface
  balanceCardStyle: BalanceCardStyle;
  setBalanceCardStyle: (s: BalanceCardStyle) => void;
  tabBarStyle: TabBarStyle;
  setTabBarStyle: (s: TabBarStyle) => void;
  transactionDensity: TransactionDensity;
  setTransactionDensity: (d: TransactionDensity) => void;
  homeLayout: HomeLayout;
  setHomeLayout: (l: HomeLayout) => void;
  cornerRadiusScale: CornerRadiusScale;
  setCornerRadiusScale: (s: CornerRadiusScale) => void;
  tabIconStyle: TabIconStyle;
  setTabIconStyle: (s: TabIconStyle) => void;
  mainTabNav: MainTabNav;
  setMainTabNav: (s: MainTabNav) => void;
  balanceHiddenByDefault: boolean;
  setBalanceHiddenByDefault: (v: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
  quickActions: QuickActionId[];
  setQuickActions: (a: QuickActionId[]) => void;
  transactionGrouping: TransactionGrouping;
  setTransactionGrouping: (g: TransactionGrouping) => void;
  tabOrder: TabId[];
  setTabOrder: (order: TabId[]) => void;
  activeColorScheme: "light" | "dark";
};

const DisplayContext = createContext<DisplayContextType | undefined>(undefined);

export function DisplayProvider({ children }: { children: ReactNode }) {
  const defaultBg = BACKGROUND_IMAGES[0]?.uri ?? "";

  const [theme, setThemeState] = useState<ThemeOption>("System Default");
  const [language, setLanguageState] = useState<LanguageOption>("English");
  const [accentId, setAccentIdState] = useState<string>('forest');
  const [homeBackground, setHomeBackgroundState] = useState<string>(defaultBg);
  const [hubBackground, setHubBackgroundState] = useState<string>(defaultBg);
  const [homeCustomBackgrounds, setHomeCustomBgsState] = useState<string[]>([]);
  const [hubCustomBackgrounds, setHubCustomBgsState] = useState<string[]>([]);
  const [homeDim, setHomeDimState] = useState<number>(0);
  const [hubDim, setHubDimState] = useState<number>(0);
  const [homeBlur, setHomeBlurState] = useState<number>(0);
  const [hubBlur, setHubBlurState] = useState<number>(0);
  const [homeBgLuminance, setHomeBgLuminanceState] = useState<number | null>(null);
  const lumUriRef = useRef<string | null>(null);
  const [homeBannerGradient, setHomeBannerGradientState] = useState<string>('accent');
  const [hubBannerGradient, setHubBannerGradientState] = useState<string>('accent');
  const [balanceCardStyle, setBalanceCardStyleState] = useState<BalanceCardStyle>('flat');
  const [tabBarStyle, setTabBarStyleState] = useState<TabBarStyle>('labeled');
  const [transactionDensity, setTransactionDensityState] = useState<TransactionDensity>('comfortable');
  const [homeLayout, setHomeLayoutState] = useState<HomeLayout>('default');
  const [cornerRadiusScale, setCornerRadiusScaleState] = useState<CornerRadiusScale>('rounded');
  const [tabIconStyle, setTabIconStyleState] = useState<TabIconStyle>('outline');
  const [mainTabNav, setMainTabNavState] = useState<MainTabNav>('custom');
  const [balanceHiddenByDefault, setBalanceHiddenByDefaultState] = useState<boolean>(false);
  const [reducedMotion, setReducedMotionState] = useState<boolean>(false);
  const [quickActions, setQuickActionsState] = useState<QuickActionId[]>(['send', 'request', 'details']);
  const [transactionGrouping, setTransactionGroupingState] = useState<TransactionGrouping>('date');
  const [tabOrder, setTabOrderState] = useState<TabId[]>(DEFAULT_TAB_ORDER);

  const { userToken } = useAuth();
  const profile = useProfile();
  const colorScheme = useColorScheme();
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme());

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme: cs }) => setSystemScheme(cs));
    return () => sub.remove();
  }, []);

  const activeColorScheme =
    theme === "System Default"
      ? ((colorScheme || systemScheme) === "dark" ? "dark" : "light")
      : theme === "Dark" ? "dark" : "light";

  useEffect(() => {
    const load = async () => {
      try {
        const [
          savedTheme, savedLang, savedAccent,
          savedBg, savedHubBg,
          savedHomeCust, savedHubCust,
          savedHomeDim, savedHubDim,
          savedHomeBlur, savedHubBlur,
          savedHomeGrad, savedHubGrad,
          savedCardStyle, savedTabBar, savedDensity,
          savedHomeLayout, savedCornerRadius, savedTabIconStyle,
          savedBalanceHidden, savedReducedMotion,
          savedQuickActions, savedTxGrouping, savedTabOrder,
          savedMainTabNav,
        ] = await Promise.all([
          AsyncStorage.getItem('AppTheme'),
          AsyncStorage.getItem('AppLanguage'),
          AsyncStorage.getItem('AppAccentId'),
          AsyncStorage.getItem('AppHomeBackground'),
          AsyncStorage.getItem('AppHubBackground'),
          AsyncStorage.getItem('AppHomeCustomBackgrounds'),
          AsyncStorage.getItem('AppHubCustomBackgrounds'),
          AsyncStorage.getItem('AppHomeDim'),
          AsyncStorage.getItem('AppHubDim'),
          AsyncStorage.getItem('AppHomeBlur'),
          AsyncStorage.getItem('AppHubBlur'),
          AsyncStorage.getItem('AppHomeBannerGradient'),
          AsyncStorage.getItem('AppHubBannerGradient'),
          AsyncStorage.getItem('AppBalanceCardStyle'),
          AsyncStorage.getItem('AppTabBarStyle'),
          AsyncStorage.getItem('AppTransactionDensity'),
          AsyncStorage.getItem('AppHomeLayout'),
          AsyncStorage.getItem('AppCornerRadiusScale'),
          AsyncStorage.getItem('AppTabIconStyle'),
          AsyncStorage.getItem('AppBalanceHiddenByDefault'),
          AsyncStorage.getItem('AppReducedMotion'),
          AsyncStorage.getItem('AppQuickActions'),
          AsyncStorage.getItem('AppTransactionGrouping'),
          AsyncStorage.getItem('AppTabOrder'),
          AsyncStorage.getItem('AppMainTabNav'),
        ]);

        if (savedTheme && THEMES.includes(savedTheme as ThemeOption)) setThemeState(savedTheme as ThemeOption);
        if (savedLang && LANGUAGES.includes(savedLang as LanguageOption)) setLanguageState(savedLang as LanguageOption);
        if (savedAccent && ACCENT_PALETTES.some(p => p.id === savedAccent)) setAccentIdState(savedAccent);
        if (savedBg !== null) setHomeBackgroundState(savedBg);
        if (savedHubBg !== null) setHubBackgroundState(savedHubBg);
        if (savedHomeCust) { try { setHomeCustomBgsState(JSON.parse(savedHomeCust)); } catch {} }
        if (savedHubCust) { try { setHubCustomBgsState(JSON.parse(savedHubCust)); } catch {} }
        if (savedHomeDim !== null) setHomeDimState(parseFloat(savedHomeDim) || 0);
        if (savedHubDim !== null) setHubDimState(parseFloat(savedHubDim) || 0);
        if (savedHomeBlur !== null) setHomeBlurState(parseFloat(savedHomeBlur) || 0);
        if (savedHubBlur !== null) setHubBlurState(parseFloat(savedHubBlur) || 0);
        if (savedHomeGrad && BANNER_GRADIENTS.some(g => g.id === savedHomeGrad)) setHomeBannerGradientState(savedHomeGrad);
        if (savedHubGrad && BANNER_GRADIENTS.some(g => g.id === savedHubGrad)) setHubBannerGradientState(savedHubGrad);
        if (savedCardStyle && ['flat','glass','card'].includes(savedCardStyle)) setBalanceCardStyleState(savedCardStyle as BalanceCardStyle);
        if (savedTabBar && ['labeled','minimal'].includes(savedTabBar)) setTabBarStyleState(savedTabBar as TabBarStyle);
        if (savedDensity && ['comfortable','compact'].includes(savedDensity)) setTransactionDensityState(savedDensity as TransactionDensity);
        if (savedHomeLayout && ['default','minimal'].includes(savedHomeLayout)) setHomeLayoutState(savedHomeLayout as HomeLayout);
        if (savedCornerRadius && ['sharp','rounded','pill'].includes(savedCornerRadius)) setCornerRadiusScaleState(savedCornerRadius as CornerRadiusScale);
        if (savedTabIconStyle && ['outline','filled'].includes(savedTabIconStyle)) setTabIconStyleState(savedTabIconStyle as TabIconStyle);
        if (savedBalanceHidden !== null) setBalanceHiddenByDefaultState(savedBalanceHidden === 'true');
        if (savedReducedMotion !== null) setReducedMotionState(savedReducedMotion === 'true');
        if (savedQuickActions) { try { const p = JSON.parse(savedQuickActions); if (Array.isArray(p)) setQuickActionsState(p); } catch {} }
        if (savedTxGrouping && ['date','flat'].includes(savedTxGrouping)) setTransactionGroupingState(savedTxGrouping as TransactionGrouping);
        if (savedTabOrder) { try { const p = JSON.parse(savedTabOrder); if (Array.isArray(p) && p.length === 4) setTabOrderState(p as TabId[]); } catch {} }
        if (savedMainTabNav && ['custom','default','native'].includes(savedMainTabNav)) setMainTabNavState(savedMainTabNav as MainTabNav);
      } catch (e) {
        console.error("Error loading display settings:", e);
      }
    };
    load();
  }, []);

  // Restore the cached wallpaper luminance so we don't re-decode on every launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('AppHomeBgLum');
        if (stored && !cancelled) {
          const { uri, lum } = JSON.parse(stored) as { uri: string; lum: number };
          if (typeof lum === 'number') {
            lumUriRef.current = uri;
            setHomeBgLuminanceState(lum);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Recompute luminance whenever the home wallpaper changes to a new image.
  useEffect(() => {
    if (!homeBackground) {
      lumUriRef.current = null;
      setHomeBgLuminanceState(null);
      return;
    }
    if (homeBackground === lumUriRef.current) return; // already computed for this image
    let cancelled = false;
    computeImageLuminance(homeBackground).then((lum) => {
      if (cancelled || lum == null) return;
      lumUriRef.current = homeBackground;
      setHomeBgLuminanceState(lum);
      AsyncStorage.setItem('AppHomeBgLum', JSON.stringify({ uri: homeBackground, lum })).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [homeBackground]);

  // Sync profile → local
  useEffect(() => {
    if (userToken && profile.language) {
      if (profile.language !== language && LANGUAGES.includes(profile.language as LanguageOption)) setLanguageState(profile.language as LanguageOption);
      if (profile.theme !== theme && THEMES.includes(profile.theme as ThemeOption)) setThemeState(profile.theme as ThemeOption);
      if (profile.homeBackground && profile.homeBackground !== homeBackground) setHomeBackgroundState(profile.homeBackground);
      if (profile.hubBackground && profile.hubBackground !== hubBackground) setHubBackgroundState(profile.hubBackground);
    }
  }, [profile.language, profile.theme, profile.homeBackground, profile.hubBackground, userToken]);

  const setTheme = useCallback((t: ThemeOption) => {
    setThemeState(t);
    AsyncStorage.setItem('AppTheme', t).catch(() => {});
    if (userToken) {
      updateMe({ theme: t })
        .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.profile() }))
        .catch(() => {});
    }
  }, [userToken]);

  const setLanguage = useCallback((l: LanguageOption) => {
    setLanguageState(l);
    AsyncStorage.setItem('AppLanguage', l).catch(() => {});
    if (userToken) {
      updateMe({ language: l })
        .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.profile() }))
        .catch(() => {});
    }
  }, [userToken]);

  const setAccentId = useCallback((id: string) => {
    setAccentIdState(id);
    AsyncStorage.setItem('AppAccentId', id).catch(() => {});
  }, []);

  const setHomeBackground = useCallback(async (uri: string) => {
    setHomeBackgroundState(uri);
    AsyncStorage.setItem('AppHomeBackground', uri).catch(() => {});
    if (userToken) {
      try {
        if (uri.startsWith('file://') || uri.startsWith('content://')) {
          const filename = uri.split('/').pop() || 'background.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          await uploadHomeBackground({ uri, name: filename, type } as any);
        } else {
          await updateMe({ homeBackground: uri });
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      } catch (err) {
        console.error("Failed to sync home background", err);
      }
    }
  }, [userToken]);

  const setHubBackground = useCallback(async (uri: string) => {
    setHubBackgroundState(uri);
    AsyncStorage.setItem('AppHubBackground', uri).catch(() => {});
    if (userToken) {
      try {
        if (uri.startsWith('file://') || uri.startsWith('content://')) {
          const filename = uri.split('/').pop() || 'background.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;
          await uploadHubBackground({ uri, name: filename, type } as any);
        } else {
          await updateMe({ hubBackground: uri });
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      } catch (err) {
        console.error("Failed to sync hub background", err);
      }
    }
  }, [userToken]);

  const addHomeCustomBackground = useCallback((uri: string) => {
    setHomeCustomBgsState(prev => {
      const updated = [uri, ...prev.filter(b => b !== uri)].slice(0, 3);
      AsyncStorage.setItem('AppHomeCustomBackgrounds', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const addHubCustomBackground = useCallback((uri: string) => {
    setHubCustomBgsState(prev => {
      const updated = [uri, ...prev.filter(b => b !== uri)].slice(0, 3);
      AsyncStorage.setItem('AppHubCustomBackgrounds', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const removeHomeCustomBackground = useCallback((uri: string) => {
    setHomeCustomBgsState(prev => {
      const updated = prev.filter(b => b !== uri);
      AsyncStorage.setItem('AppHomeCustomBackgrounds', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    if (homeBackground === uri) setHomeBackground("");
  }, [homeBackground, setHomeBackground]);

  const removeHubCustomBackground = useCallback((uri: string) => {
    setHubCustomBgsState(prev => {
      const updated = prev.filter(b => b !== uri);
      AsyncStorage.setItem('AppHubCustomBackgrounds', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    if (hubBackground === uri) setHubBackground("");
  }, [hubBackground, setHubBackground]);

  const setHomeDim = useCallback((v: number) => { setHomeDimState(v); AsyncStorage.setItem('AppHomeDim', String(v)).catch(() => {}); }, []);
  const setHubDim = useCallback((v: number) => { setHubDimState(v); AsyncStorage.setItem('AppHubDim', String(v)).catch(() => {}); }, []);
  const setHomeBlur = useCallback((v: number) => { setHomeBlurState(v); AsyncStorage.setItem('AppHomeBlur', String(v)).catch(() => {}); }, []);
  const setHubBlur = useCallback((v: number) => { setHubBlurState(v); AsyncStorage.setItem('AppHubBlur', String(v)).catch(() => {}); }, []);

  const setHomeBannerGradient = useCallback((id: string) => { setHomeBannerGradientState(id); AsyncStorage.setItem('AppHomeBannerGradient', id).catch(() => {}); }, []);
  const setHubBannerGradient = useCallback((id: string) => { setHubBannerGradientState(id); AsyncStorage.setItem('AppHubBannerGradient', id).catch(() => {}); }, []);

  const setBalanceCardStyle = useCallback((s: BalanceCardStyle) => { setBalanceCardStyleState(s); AsyncStorage.setItem('AppBalanceCardStyle', s).catch(() => {}); }, []);
  const setTabBarStyle = useCallback((s: TabBarStyle) => { setTabBarStyleState(s); AsyncStorage.setItem('AppTabBarStyle', s).catch(() => {}); }, []);
  const setTransactionDensity = useCallback((d: TransactionDensity) => { setTransactionDensityState(d); AsyncStorage.setItem('AppTransactionDensity', d).catch(() => {}); }, []);
  const setHomeLayout = useCallback((l: HomeLayout) => { setHomeLayoutState(l); AsyncStorage.setItem('AppHomeLayout', l).catch(() => {}); }, []);
  const setCornerRadiusScale = useCallback((s: CornerRadiusScale) => { setCornerRadiusScaleState(s); AsyncStorage.setItem('AppCornerRadiusScale', s).catch(() => {}); }, []);
  const setTabIconStyle = useCallback((s: TabIconStyle) => { setTabIconStyleState(s); AsyncStorage.setItem('AppTabIconStyle', s).catch(() => {}); }, []);
  const setMainTabNav = useCallback((s: MainTabNav) => { setMainTabNavState(s); AsyncStorage.setItem('AppMainTabNav', s).catch(() => {}); }, []);
  const setBalanceHiddenByDefault = useCallback((v: boolean) => { setBalanceHiddenByDefaultState(v); AsyncStorage.setItem('AppBalanceHiddenByDefault', String(v)).catch(() => {}); }, []);
  const setReducedMotion = useCallback((v: boolean) => { setReducedMotionState(v); AsyncStorage.setItem('AppReducedMotion', String(v)).catch(() => {}); }, []);
  const setQuickActions = useCallback((a: QuickActionId[]) => { setQuickActionsState(a); AsyncStorage.setItem('AppQuickActions', JSON.stringify(a)).catch(() => {}); }, []);
  const setTransactionGrouping = useCallback((g: TransactionGrouping) => { setTransactionGroupingState(g); AsyncStorage.setItem('AppTransactionGrouping', g).catch(() => {}); }, []);
  const setTabOrder = useCallback((order: TabId[]) => { setTabOrderState(order); AsyncStorage.setItem('AppTabOrder', JSON.stringify(order)).catch(() => {}); }, []);

  // Memoised. This provider sits above the whole app, so an object literal here
  // re-rendered every consumer on any state change anywhere in it — a blur
  // slider drag re-rendered the transaction list. Every setter above is a
  // stable useCallback, so this now changes only when a setting actually does.
  const value = useMemo<DisplayContextType>(
    () => ({
      theme, setTheme,
      language, setLanguage,
      accentId, setAccentId,
      homeBackground, setHomeBackground,
      hubBackground, setHubBackground,
      homeCustomBackgrounds, hubCustomBackgrounds,
      addHomeCustomBackground, addHubCustomBackground,
      removeHomeCustomBackground, removeHubCustomBackground,
      homeDim, setHomeDim,
      hubDim, setHubDim,
      homeBlur, setHomeBlur,
      hubBlur, setHubBlur,
      homeBgLuminance,
      homeBannerGradient, setHomeBannerGradient,
      hubBannerGradient, setHubBannerGradient,
      balanceCardStyle, setBalanceCardStyle,
      tabBarStyle, setTabBarStyle,
      transactionDensity, setTransactionDensity,
      homeLayout, setHomeLayout,
      cornerRadiusScale, setCornerRadiusScale,
      tabIconStyle, setTabIconStyle,
      mainTabNav, setMainTabNav,
      balanceHiddenByDefault, setBalanceHiddenByDefault,
      reducedMotion, setReducedMotion,
      quickActions, setQuickActions,
      transactionGrouping, setTransactionGrouping,
      tabOrder, setTabOrder,
      activeColorScheme,
    }),
    [
      theme, setTheme,
      language, setLanguage,
      accentId, setAccentId,
      homeBackground, setHomeBackground,
      hubBackground, setHubBackground,
      homeCustomBackgrounds, hubCustomBackgrounds,
      addHomeCustomBackground, addHubCustomBackground,
      removeHomeCustomBackground, removeHubCustomBackground,
      homeDim, setHomeDim,
      hubDim, setHubDim,
      homeBlur, setHomeBlur,
      hubBlur, setHubBlur,
      homeBgLuminance,
      homeBannerGradient, setHomeBannerGradient,
      hubBannerGradient, setHubBannerGradient,
      balanceCardStyle, setBalanceCardStyle,
      tabBarStyle, setTabBarStyle,
      transactionDensity, setTransactionDensity,
      homeLayout, setHomeLayout,
      cornerRadiusScale, setCornerRadiusScale,
      tabIconStyle, setTabIconStyle,
      mainTabNav, setMainTabNav,
      balanceHiddenByDefault, setBalanceHiddenByDefault,
      reducedMotion, setReducedMotion,
      quickActions, setQuickActions,
      transactionGrouping, setTransactionGrouping,
      tabOrder, setTabOrder,
      activeColorScheme,
    ],
  );

  return <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>;
}

export function useDisplayContext() {
  const ctx = useContext(DisplayContext);
  if (!ctx) throw new Error("useDisplayContext must be used within a DisplayProvider");
  return ctx;
}
