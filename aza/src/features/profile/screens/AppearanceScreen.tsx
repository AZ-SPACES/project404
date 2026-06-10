import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Image,
  StatusBar,
  TextInput,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from '@react-native-vector-icons/feather';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../../navigation/types";
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from "../../../theme";
import { BackButton } from '../../../components/ui/BackButton';
import { searchUnsplash, triggerUnsplashDownload, UnsplashPhoto } from '../../../services/api';
import {
  useDisplayContext,
  BACKGROUND_IMAGES,
  ACCENT_PALETTES,
  BANNER_GRADIENTS,
  QUICK_ACTIONS_REGISTRY,
  TAB_REGISTRY,
  ThemeOption,
  THEMES,
  LanguageOption,
  LANGUAGES,
  BalanceCardStyle,
  TabBarStyle,
  TransactionDensity,
  HomeLayout,
  CornerRadiusScale,
  TabIconStyle,
  TransactionGrouping,
  QuickActionId,
  TabId,
} from "../../../providers/DisplayProvider";

const { width, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BANNER_W = width;
const BANNER_H = SCREEN_HEIGHT * 0.55;

const DIM_OPTIONS  = [{ label: "Off", value: 0 }, { label: "Light", value: 0.15 }, { label: "Medium", value: 0.30 }, { label: "Heavy", value: 0.50 }];
const BLUR_OPTIONS = [{ label: "Off", value: 0 }, { label: "Soft",  value: 8  }, { label: "Medium", value: 16  }, { label: "Heavy", value: 25  }];

async function cropToAspect(uri: string, tw: number, th: number): Promise<string> {
  const info = await manipulateAsync(uri, []);
  const { width: iw, height: ih } = info;
  const ta = tw / th, ia = iw / ih;
  let originX: number, originY: number, cw: number, ch: number;
  if (ia > ta) { ch = ih; cw = Math.floor(ih * ta); originX = Math.floor((iw - cw) / 2); originY = 0; }
  else          { cw = iw; ch = Math.floor(iw / ta); originX = 0; originY = Math.floor((ih - ch) / 2); }
  const r = await manipulateAsync(uri, [{ crop: { originX, originY, width: cw, height: ch } }], { compress: 0.9, format: SaveFormat.JPEG });
  return r.uri;
}

// ── Segmented control ─────────────────────────────────────────────────────────
function SegmentedRow<T extends string | number>({ label, options, value, onChange }: {
  label: string; options: { label: string; value: T }[]; value: T; onChange: (v: T) => void;
}) {
  const { colors: Colors } = useAppTheme();
  const s = React.useMemo(() => segStyles(Colors), [Colors]);
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <View style={s.control}>
        {options.map(o => {
          const active = o.value === value;
          return (
            <TouchableOpacity key={String(o.value)} style={[s.seg, active && s.segActive]} onPress={() => onChange(o.value)} activeOpacity={0.7}>
              <Text style={[s.segText, active && s.segTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
function segStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  const contentBg = isDark ? Colors.surface : Colors.white;
  return StyleSheet.create({
    row: { gap: 6 },
    label: { ...Typography.caption, color: Colors.textSecondary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
    control: { flexDirection: "row", backgroundColor: isDark ? Colors.border : "#E5E7EB", borderRadius: Radius.sm, padding: 2 },
    seg: { flex: 1, paddingVertical: 5, borderRadius: Radius.sm - 2, alignItems: "center" },
    segActive: { backgroundColor: contentBg, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 1, elevation: 1 },
    segText: { fontSize: 12, fontWeight: "500", color: Colors.textSecondary },
    segTextActive: { color: Colors.textPrimary, fontWeight: "600" },
  });
}

// ── Language card ─────────────────────────────────────────────────────────────
const LANGUAGE_META: Record<LanguageOption, { flag: string; subtitle: string }> = {
  "English": { flag: "🇬🇧", subtitle: "English — Ghana" },
  "French":  { flag: "🇫🇷", subtitle: "Français" },
  "Twi":     { flag: "🇬🇭", subtitle: "Akan · Twi" },
};

function LanguageCard({ language, isSelected, onSelect }: { language: LanguageOption; isSelected: boolean; onSelect: () => void }) {
  const { colors: Colors } = useAppTheme();
  const s = React.useMemo(() => createStyles(Colors), [Colors]);
  const meta = LANGUAGE_META[language];
  return (
    <TouchableOpacity style={[s.themeCard, isSelected && s.themeCardSelected]} onPress={onSelect} activeOpacity={0.8}>
      <View style={[s.thumbnailBase, { justifyContent: "center", alignItems: "center", backgroundColor: Colors.isDark ? Colors.surface : "#F9FAFB" }]}>
        <Text style={{ fontSize: 24 }}>{meta.flag}</Text>
      </View>
      <View style={s.themeCardTextContainer}>
        <Text style={[Typography.body, s.themeCardTitle]}>{language}</Text>
        <Text style={[Typography.caption, s.themeCardSubtitle]}>{meta.subtitle}</Text>
      </View>
      <View style={[s.checkCircle, isSelected && s.checkCircleSelected]}>
        {isSelected && <Ionicons name="checkmark" size={12} color={Colors.white} />}
      </View>
    </TouchableOpacity>
  );
}

// ── Theme card ────────────────────────────────────────────────────────────────
type ThemeCardProps = { theme: ThemeOption; isSelected: boolean; onSelect: () => void };

const ThemeThumbnail = ({ theme }: { theme: ThemeOption }) => {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  if (theme === "Light") return (
    <View style={[styles.thumbnailBase, { backgroundColor: "#F3F4F6" }]}>
      <View style={styles.thumbnailLightContent}><Text style={{ fontSize: 10, fontWeight: "bold", color: "#111827" }}>Aa</Text></View>
    </View>
  );
  if (theme === "Dark") return (
    <View style={[styles.thumbnailBase, { backgroundColor: "#1F2937" }]}>
      <View style={styles.thumbnailDarkContent}><Text style={{ fontSize: 10, fontWeight: "bold", color: "#FFFFFF" }}>Aa</Text></View>
    </View>
  );
  return (
    <View style={[styles.thumbnailBase, { flexDirection: "row" }]}>
      <View style={[styles.thumbnailSplitSide, { backgroundColor: "#FFFFFF" }]}><Text style={{ fontSize: 8, fontWeight: "bold", color: "#111827", marginLeft: 4, marginTop: 4 }}>Aa</Text></View>
      <View style={[styles.thumbnailSplitSide, { backgroundColor: "#1F2937" }]}><Text style={{ fontSize: 8, fontWeight: "bold", color: "#FFFFFF", marginLeft: 4, marginTop: 4 }}>Aa</Text></View>
    </View>
  );
};

const ThemeCard = ({ theme, isSelected, onSelect }: ThemeCardProps) => {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const subtitles: Record<ThemeOption, string> = { Light: "Always light mode", Dark: "Always dark mode", "System Default": "Follows operating system" };
  return (
    <TouchableOpacity style={[styles.themeCard, isSelected && styles.themeCardSelected]} onPress={onSelect} activeOpacity={0.8}>
      <ThemeThumbnail theme={theme} />
      <View style={styles.themeCardTextContainer}>
        <Text style={[Typography.body, styles.themeCardTitle]}>{theme === "System Default" ? "Automatic" : theme}</Text>
        <Text style={[Typography.caption, styles.themeCardSubtitle]}>{subtitles[theme]}</Text>
      </View>
      <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
        {isSelected && <Ionicons name="checkmark" size={12} color={Colors.white} />}
      </View>
    </TouchableOpacity>
  );
};

// ── Home Layout Preview ───────────────────────────────────────────────────────
function HomeLayoutPreview({ layout }: { layout: HomeLayout }) {
  const { colors: Colors } = useAppTheme();
  const isMinimal = layout === 'minimal';
  return (
    <View style={{ height: 100, borderRadius: Radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border }}>
      {/* Banner portion */}
      <View style={{ height: isMinimal ? 54 : 100, backgroundColor: Colors.primary, justifyContent: 'flex-end', padding: 8 }}>
        {isMinimal ? (
          <View style={{ gap: 3 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 8 }}>Good morning</Text>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>GH₵ 2,450.00</Text>
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 2 }}>
              {[0,1,2].map(i => (
                <View key={i} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 1.5, backgroundColor: '#fff', borderRadius: 1 }} />
                </View>
              ))}
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            </View>
          </View>
        ) : (
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>GH₵ 2,450.00</Text>
        )}
      </View>
      {/* Transaction skeleton (only visible in minimal where banner is short) */}
      {isMinimal && (
        <View style={{ flex: 1, backgroundColor: Colors.background, padding: 8, gap: 4 }}>
          {[1, 0.6].map((w, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.border }} />
              <View style={{ height: 5, flex: w, backgroundColor: Colors.border, borderRadius: 2 }} />
            </View>
          ))}
        </View>
      )}
      <View style={{ position: 'absolute', top: 6, right: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
        <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#fff' }}>PREVIEW</Text>
      </View>
    </View>
  );
}

// ── Corner Radius Preview ─────────────────────────────────────────────────────
function CornerRadiusPreview({ scale }: { scale: CornerRadiusScale }) {
  const { colors: Colors, radii } = useAppTheme();
  const items = [
    { label: 'Button', bg: Colors.primary + '22', border: Colors.primary + '66', r: radii.sm },
    { label: 'Input',  bg: Colors.surface,         border: Colors.border,         r: radii.md },
    { label: 'Card',   bg: Colors.surface,         border: Colors.border,         r: radii.lg },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map(item => (
        <View key={item.label} style={{ flex: 1, height: 40, backgroundColor: item.bg, borderRadius: item.r, borderWidth: 1.5, borderColor: item.border, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: Colors.textSecondary, fontWeight: '600' }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Accent Preview ────────────────────────────────────────────────────────────
function AccentPreview({ palette }: { palette: { primary: string; gradientEnd: string } }) {
  return (
    <View style={{ marginHorizontal: Spacing.lg, marginBottom: Spacing.md, height: 80, borderRadius: Radius.md, overflow: 'hidden' }}>
      <LinearGradient colors={[palette.primary, palette.gradientEnd]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: Spacing.lg }}>
        <View>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10 }}>Balance</Text>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>GH₵ 2,450</Text>
        </View>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 5 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Send</Text>
        </View>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>+GH₵ 120</Text>
        </View>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="checkmark" size={13} color="#fff" />
        </View>
      </View>
      <View style={{ position: 'absolute', top: 6, right: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
        <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#fff' }}>PREVIEW</Text>
      </View>
    </View>
  );
}

// ── Balance Card Preview ───────────────────────────────────────────────────────
function BalanceCardPreview({ cardStyle, gradColors }: { cardStyle: BalanceCardStyle; gradColors: string[] }) {
  const innerContent = (
    <>
      <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, marginBottom: 2 }}>Total Balance</Text>
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>GH₵ 2,450.00</Text>
    </>
  );
  return (
    <View style={{ height: 95, borderRadius: Radius.sm, overflow: 'hidden' }}>
      <LinearGradient colors={gradColors as [string, string]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.sm }}>
        {cardStyle === 'flat' && <View style={{ alignItems: 'center' }}>{innerContent}</View>}
        {cardStyle === 'glass' && (
          <BlurView intensity={22} tint="dark" style={{ borderRadius: 10, overflow: 'hidden', paddingHorizontal: 18, paddingVertical: 9, alignItems: 'center' }}>
            {innerContent}
          </BlurView>
        )}
        {cardStyle === 'card' && (
          <View style={{ borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.28)' }}>
            {innerContent}
          </View>
        )}
      </View>
      <View style={{ position: 'absolute', top: 6, right: 8, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
        <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#fff' }}>PREVIEW</Text>
      </View>
    </View>
  );
}

// ── Tab Bar Preview ────────────────────────────────────────────────────────────
const TAB_ICONS: Record<TabId, { outline: string; filled: string; feather?: true }> = {
  home:     { outline: 'home-outline',       filled: 'home'       },
  contacts: { outline: 'user',               filled: 'user',        feather: true },
  chat:     { outline: 'chatbubble-outline', filled: 'chatbubble' },
  hub:      { outline: 'apps-outline',       filled: 'apps'       },
};

function TabBarPreview({ showLabels, filled, tabOrder }: { showLabels: boolean; filled: boolean; tabOrder: TabId[] }) {
  const { colors: Colors } = useAppTheme();
  // Build the 5-slot bar: left2 + scan + right2
  const slots: Array<{ id: TabId | 'scan'; label: string }> = [
    { id: tabOrder[0]!, label: TAB_REGISTRY.find(t => t.id === tabOrder[0])?.label ?? '' },
    { id: tabOrder[1]!, label: TAB_REGISTRY.find(t => t.id === tabOrder[1])?.label ?? '' },
    { id: 'scan',        label: '' },
    { id: tabOrder[2]!, label: TAB_REGISTRY.find(t => t.id === tabOrder[2])?.label ?? '' },
    { id: tabOrder[3]!, label: TAB_REGISTRY.find(t => t.id === tabOrder[3])?.label ?? '' },
  ];
  return (
    <View style={{ flexDirection: 'row', backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.border, borderRadius: Radius.sm, paddingVertical: 8, overflow: 'hidden' }}>
      {slots.map((slot, i) => {
        const isCenter = slot.id === 'scan';
        const isActive = i === 0;
        const color = isActive ? Colors.primary : Colors.textSecondary;
        if (isCenter) return (
          <View key="scan" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name={filled ? 'qr-code' : 'qr-code-outline'} size={17} color="#fff" />
            </View>
          </View>
        );
        const iconDef = TAB_ICONS[slot.id as TabId];
        const iconName = filled ? iconDef.filled : iconDef.outline;
        return (
          <View key={slot.id} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {iconDef.feather
              ? <Feather name={iconName as any} size={20} color={color} />
              : <Ionicons name={iconName as any} size={20} color={color} />}
            {showLabels && <Text style={{ fontSize: 9, color, marginTop: 2, fontWeight: '500' }}>{slot.label}</Text>}
          </View>
        );
      })}
    </View>
  );
}

// ── Transaction Density Preview ────────────────────────────────────────────────
function TransactionDensityPreview({ compact, grouped }: { compact: boolean; grouped: boolean }) {
  const { colors: Colors } = useAppTheme();
  const rows = [
    { name: 'Kwame Mensah', sub: 'Mobile Money • 10:30 AM', amount: '+GH₵ 120.00', credit: true },
    { name: 'MTN Airtime', sub: 'Bills • 9:15 AM', amount: '-GH₵ 20.00', credit: false },
  ];
  const iconSize = compact ? 28 : 36;
  const featherSize = compact ? 12 : 16;
  const py = compact ? 8 : 13;
  const fontSize = compact ? 12 : 13;
  return (
    <View style={{ borderRadius: Radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border }}>
      {grouped && (
        <View style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.isDark ? Colors.surface : Colors.background }}>
          <Text style={{ fontSize: 10, color: Colors.textSecondary, fontWeight: '600' }}>Today</Text>
        </View>
      )}
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: py, paddingHorizontal: 12, borderTopWidth: i === 0 && grouped ? 1 : 0, borderBottomWidth: i === 0 ? 1 : 0, borderColor: Colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ width: iconSize, height: iconSize, borderRadius: 100, backgroundColor: row.credit ? 'rgba(183,238,122,0.2)' : 'rgba(234,67,53,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: compact ? 8 : 12 }}>
              <Feather name={row.credit ? 'arrow-down-left' : 'arrow-up-right'} size={featherSize} color={row.credit ? Colors.primary : Colors.error} />
            </View>
            <View>
              <Text style={{ fontSize, fontWeight: '500', color: Colors.textPrimary }}>{row.name}</Text>
              <Text style={{ fontSize: fontSize - 1, color: Colors.textSecondary, marginTop: 1 }}>{row.sub}</Text>
            </View>
          </View>
          <Text style={{ fontSize, fontWeight: '600', color: row.credit ? Colors.primary : Colors.textPrimary }}>{row.amount}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AppearanceScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const {
    theme: selectedTheme, setTheme,
    language: selectedLanguage, setLanguage,
    accentId, setAccentId,
    homeBackground, setHomeBackground,
    hubBackground, setHubBackground,
    homeCustomBackgrounds, hubCustomBackgrounds,
    addHomeCustomBackground, addHubCustomBackground,
    removeHomeCustomBackground, removeHubCustomBackground,
    homeDim, setHomeDim, hubDim, setHubDim,
    homeBlur, setHomeBlur, hubBlur, setHubBlur,
    homeBannerGradient, setHomeBannerGradient,
    hubBannerGradient, setHubBannerGradient,
    balanceCardStyle, setBalanceCardStyle,
    tabBarStyle, setTabBarStyle,
    transactionDensity, setTransactionDensity,
    homeLayout, setHomeLayout,
    cornerRadiusScale, setCornerRadiusScale,
    tabIconStyle, setTabIconStyle,
    balanceHiddenByDefault, setBalanceHiddenByDefault,
    reducedMotion, setReducedMotion,
    quickActions, setQuickActions,
    transactionGrouping, setTransactionGrouping,
    tabOrder, setTabOrder,
  } = useDisplayContext();

  const [linkPromptVisible, setLinkPromptVisible] = React.useState(false);
  const [linkInput, setLinkInput] = React.useState("");
  const [linkTarget, setLinkTarget] = React.useState<"home" | "hub" | null>(null);
  const [cropLoading, setCropLoading] = React.useState(false);

  // Unsplash picker state
  const [unsplashVisible, setUnsplashVisible] = React.useState(false);
  const [unsplashTarget, setUnsplashTarget] = React.useState<"home" | "hub" | null>(null);
  const [unsplashQuery, setUnsplashQuery] = React.useState("");
  const [unsplashResults, setUnsplashResults] = React.useState<UnsplashPhoto[]>([]);
  const [unsplashLoading, setUnsplashLoading] = React.useState(false);
  const [unsplashLoadingMore, setUnsplashLoadingMore] = React.useState(false);
  const [unsplashPage, setUnsplashPage] = React.useState(1);
  const [unsplashHasMore, setUnsplashHasMore] = React.useState(false);
  const [unsplashError, setUnsplashError] = React.useState<string | null>(null);
  const unsplashInputRef = React.useRef<TextInput>(null);

  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const animDuration = reducedMotion ? 0 : 300;

  useEffect(() => {
    if (linkPromptVisible) {
      Animated.parallel([
        Animated.timing(sheetAnim, { toValue: 0, duration: animDuration, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: animDuration, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(sheetAnim, { toValue: SCREEN_HEIGHT, duration: animDuration, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: animDuration, useNativeDriver: true }),
      ]).start();
    }
  }, [linkPromptVisible]);

  const handleLinkSubmit = () => {
    if (linkInput.trim()) {
      const uri = linkInput.trim();
      if (linkTarget === "home") { setHomeBackground(uri); addHomeCustomBackground(uri); }
      else if (linkTarget === "hub") { setHubBackground(uri); addHubCustomBackground(uri); }
    }
    setLinkPromptVisible(false);
  };

  React.useEffect(() => {
    if (!unsplashVisible) return;
    if (!unsplashQuery.trim()) { setUnsplashResults([]); setUnsplashError(null); return; }
    const t = setTimeout(() => doUnsplashSearch(unsplashQuery), 500);
    return () => clearTimeout(t);
  }, [unsplashQuery, unsplashVisible]);

  const openUnsplash = (target: "home" | "hub") => {
    setUnsplashTarget(target);
    setUnsplashQuery("");
    setUnsplashResults([]);
    setUnsplashPage(1);
    setUnsplashHasMore(false);
    setUnsplashError(null);
    setUnsplashVisible(true);
  };

  const doUnsplashSearch = async (query: string, page = 1) => {
    if (!query.trim()) return;
    setUnsplashError(null);
    if (page === 1) { setUnsplashLoading(true); setUnsplashResults([]); }
    else setUnsplashLoadingMore(true);
    try {
      const res = await searchUnsplash(query, page);
      const photos: UnsplashPhoto[] = res.data.data ?? [];
      setUnsplashResults(prev => page === 1 ? photos : [...prev, ...photos]);
      setUnsplashHasMore(photos.length === 20);
      setUnsplashPage(page);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) setUnsplashError("Invalid API key — check UNSPLASH_ACCESS_KEY on the server.");
      else if (status === 403) setUnsplashError("API key not authorised. Apply for production access on Unsplash.");
      else if (status === 404) setUnsplashError("Unsplash endpoint not found — has the backend been redeployed?");
      else setUnsplashError(`Search failed (${status ?? "network error"}). Check server logs.`);
    } finally {
      setUnsplashLoading(false);
      setUnsplashLoadingMore(false);
    }
  };

  const handleUnsplashSelect = (photo: UnsplashPhoto) => {
    const uri = photo.regularUrl;
    if (unsplashTarget === "home") { setHomeBackground(uri); addHomeCustomBackground(uri); }
    else if (unsplashTarget === "hub") { setHubBackground(uri); addHubCustomBackground(uri); }
    setUnsplashVisible(false);
    if (photo.downloadLocation) triggerUnsplashDownload(photo.downloadLocation).catch(() => {});
  };

  const pickAndCrop = async (onDone: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] as ImagePicker.MediaType[], allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets?.[0]) {
      setCropLoading(true);
      try { onDone(await cropToAspect(result.assets[0].uri, BANNER_W, BANNER_H)); }
      finally { setCropLoading(false); }
    }
  };

  // resolved accent palette
  const palette = ACCENT_PALETTES.find(p => p.id === accentId) ?? ACCENT_PALETTES[0];

  // helper: get gradient colors for a given gradient id
  const resolveGradient = (gradId: string): string[] => {
    if (gradId === 'accent') return [palette.primary, palette.gradientEnd];
    const found = BANNER_GRADIENTS.find(g => g.id === gradId)?.colors;
    return found ? [...found] : [palette.primary, palette.gradientEnd];
  };

  // ── Background section renderer ─────────────────────────────────────────────
  const renderBgSection = (
    title: string,
    bg: string, setBg: (u: string) => void,
    customBgs: string[], removeCust: (u: string) => void,
    dim: number, setDim: (v: number) => void,
    blur: number, setBlur: (v: number) => void,
    bannerGradient: string, setBannerGradient: (id: string) => void,
    target: "home" | "hub",
  ) => {
    const gradColors = resolveGradient(bannerGradient);
    return (
      <View style={styles.section}>
        <Text style={[Typography.h3, styles.sectionTitle]}>{title}</Text>

        {/* Preview */}
        <View style={styles.previewCard}>
          {bg ? (
            <Image source={{ uri: bg }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={gradColors as [string, string]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          )}
          {blur > 0 && <BlurView intensity={blur} tint="default" style={StyleSheet.absoluteFill} />}
          {dim > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${dim})` }]} />}
          <View style={styles.previewBadge}><Text style={styles.previewBadgeText}>PREVIEW</Text></View>
        </View>

        {/* Controls */}
        <View style={styles.bgControls}>
          <SegmentedRow label="Dim overlay" options={DIM_OPTIONS} value={dim} onChange={setDim} />
          <SegmentedRow label="Blur" options={BLUR_OPTIONS} value={blur} onChange={setBlur} />
        </View>

        {/* Banner gradient row */}
        <Text style={[styles.sectionSubLabel, { paddingHorizontal: Spacing.lg, marginBottom: 6 }]}>Gradient (when no image)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gradientScrollContainer}>
          {BANNER_GRADIENTS.map(g => {
            const gc: string[] = g.colors ? [...g.colors] : [palette.primary, palette.gradientEnd];
            const active = bannerGradient === g.id;
            return (
              <TouchableOpacity key={g.id} style={[styles.gradSwatch, active && styles.gradSwatchActive]} onPress={() => setBannerGradient(g.id)} activeOpacity={0.8}>
                <LinearGradient colors={gc as [string, string]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                {active && <View style={styles.gradCheck}><Feather name="check" size={10} color="#fff" /></View>}
                <Text style={styles.gradLabel}>{g.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Thumbnail scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.backgroundsScrollContainer}>
          {/* None */}
          <TouchableOpacity style={[styles.bgThumbnailContainer, !bg && styles.bgThumbnailSelected]} onPress={() => setBg("")} activeOpacity={0.8}>
            <View style={styles.bgNoneInner}>
              <View style={styles.bgNoneLine} />
              <Text style={[Typography.caption, styles.bgNoneLabel]}>None</Text>
            </View>
            {!bg && <View style={styles.bgCheckCircle}><Feather name="check" size={12} color={Colors.white} /></View>}
          </TouchableOpacity>

          {/* Upload */}
          <TouchableOpacity style={styles.bgUploadButton} onPress={() => pickAndCrop(u => { setBg(u); (target === 'home' ? addHomeCustomBackground : addHubCustomBackground)(u); })} activeOpacity={0.7} disabled={cropLoading}>
            {cropLoading ? <ActivityIndicator size="small" color={Colors.textSecondary} /> : <Feather name="plus" size={24} color={Colors.textSecondary} />}
            <Text style={[Typography.caption, styles.uploadText]}>Upload</Text>
          </TouchableOpacity>

          {/* Link */}
          <TouchableOpacity style={styles.bgUploadButton} onPress={() => { setLinkTarget(target); setLinkInput(""); setLinkPromptVisible(true); }} activeOpacity={0.7}>
            <Feather name="link" size={24} color={Colors.textSecondary} />
            <Text style={[Typography.caption, styles.uploadText]}>Link</Text>
          </TouchableOpacity>

          {/* Unsplash search */}
          <TouchableOpacity style={styles.bgUploadButton} onPress={() => openUnsplash(target)} activeOpacity={0.7}>
            <Feather name="search" size={24} color={Colors.textSecondary} />
            <Text style={[Typography.caption, styles.uploadText]}>Unsplash</Text>
          </TouchableOpacity>

          {/* Custom */}
          {customBgs.map(bgUri => {
            const sel = bg === bgUri;
            return (
              <View key={`cust-${bgUri}`} style={styles.bgThumbnailWrapper}>
                <TouchableOpacity style={[styles.bgThumbnailContainer, sel && styles.bgThumbnailSelected]} onPress={() => setBg(bgUri)} activeOpacity={0.8}>
                  <Image source={{ uri: bgUri }} style={styles.bgThumbnailImage} />
                  {sel && <View style={styles.bgCheckCircle}><Feather name="check" size={12} color={Colors.white} /></View>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.bgDeleteButton} onPress={() => removeCust(bgUri)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={10} color={Colors.white} />
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Presets */}
          {BACKGROUND_IMAGES.map(bg_ => {
            const sel = bg === bg_.uri;
            return (
              <TouchableOpacity key={bg_.id} style={[styles.bgThumbnailContainer, sel && styles.bgThumbnailSelected]} onPress={() => setBg(bg_.uri)} activeOpacity={0.8}>
                <Image source={{ uri: bg_.uri }} style={styles.bgThumbnailImage} />
                {sel && <View style={styles.bgCheckCircle}><Feather name="check" size={12} color={Colors.white} /></View>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle={Colors.isDark ? "light-content" : "dark-content"} backgroundColor={Colors.white} />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[Typography.h3, styles.headerTitle]}>Language & Appearance</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Language ── */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Language</Text>
          <View style={styles.cardContainer}>
            {LANGUAGES.map(lang => (
              <LanguageCard key={lang} language={lang} isSelected={selectedLanguage === lang} onSelect={() => setLanguage(lang)} />
            ))}
          </View>
        </View>

        {/* ── Theme ── */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Theme</Text>
          <View style={styles.cardContainer}>
            {THEMES.map(t => <ThemeCard key={t} theme={t} isSelected={selectedTheme === t} onSelect={() => setTheme(t)} />)}
          </View>
        </View>

        {/* ── Accent Color ── */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Accent Color</Text>
          <AccentPreview palette={palette} />
          <View style={styles.accentGrid}>
            {ACCENT_PALETTES.map(p => {
              const active = accentId === p.id;
              return (
                <TouchableOpacity key={p.id} style={styles.accentItem} onPress={() => setAccentId(p.id)} activeOpacity={0.75}>
                  <View style={[styles.accentSwatch, { backgroundColor: p.primary }, active && styles.accentSwatchActive]}>
                    {active && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                  <Text style={[styles.accentLabel, active && { color: Colors.primary }]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Interface ── */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Interface</Text>

          {/* Home screen */}
          <View style={[styles.cardContainer, { padding: Spacing.md, gap: Spacing.md }]}>
            <SegmentedRow
              label="Home layout"
              options={[{ label: "Default", value: "default" as HomeLayout }, { label: "Minimal", value: "minimal" as HomeLayout }]}
              value={homeLayout}
              onChange={setHomeLayout}
            />
            <SegmentedRow
              label="Balance on open"
              options={[{ label: "Visible", value: false as any }, { label: "Hidden", value: true as any }]}
              value={balanceHiddenByDefault as any}
              onChange={(v: any) => setBalanceHiddenByDefault(v === true || v === 'true')}
            />
            <HomeLayoutPreview layout={homeLayout} />
          </View>

          {/* Balance card */}
          <View style={[styles.cardContainer, { padding: Spacing.md, gap: Spacing.md, marginTop: Spacing.sm }]}>
            <SegmentedRow
              label="Balance card"
              options={[{ label: "Flat", value: "flat" as BalanceCardStyle }, { label: "Glass", value: "glass" as BalanceCardStyle }, { label: "Raised", value: "card" as BalanceCardStyle }]}
              value={balanceCardStyle}
              onChange={setBalanceCardStyle}
            />
            <BalanceCardPreview cardStyle={balanceCardStyle} gradColors={resolveGradient(homeBannerGradient)} />
          </View>

          {/* Tab bar */}
          <View style={[styles.cardContainer, { padding: Spacing.md, gap: Spacing.md, marginTop: Spacing.sm }]}>
            <SegmentedRow
              label="Tab bar"
              options={[{ label: "Labeled", value: "labeled" as TabBarStyle }, { label: "Minimal", value: "minimal" as TabBarStyle }]}
              value={tabBarStyle}
              onChange={setTabBarStyle}
            />
            <SegmentedRow
              label="Tab icons"
              options={[{ label: "Outline", value: "outline" as TabIconStyle }, { label: "Filled", value: "filled" as TabIconStyle }]}
              value={tabIconStyle}
              onChange={setTabIconStyle}
            />
            <TabBarPreview showLabels={tabBarStyle === 'labeled'} filled={tabIconStyle === 'filled'} tabOrder={tabOrder} />
            {/* Tab order */}
            <Text style={styles.sectionSubLabel}>Tab order  •  Scan is always center</Text>
            {tabOrder.map((id, idx) => {
              const tab = TAB_REGISTRY.find(t => t.id === id)!;
              const isLeft = idx < 2;
              const moveUp = () => {
                if (idx === 0) return;
                const arr = [...tabOrder];
                const t = arr[idx - 1]!; arr[idx - 1] = arr[idx]!; arr[idx] = t;
                setTabOrder(arr);
              };
              const moveDown = () => {
                if (idx === tabOrder.length - 1) return;
                const arr = [...tabOrder];
                const t = arr[idx + 1]!; arr[idx + 1] = arr[idx]!; arr[idx] = t;
                setTabOrder(arr);
              };
              return (
                <View key={id} style={styles.tabOrderRow}>
                  <View style={styles.tabOrderLeft}>
                    <Text style={styles.tabOrderPos}>{idx < 2 ? `L${idx + 1}` : `R${idx - 1}`}</Text>
                    <Text style={styles.tabOrderLabel}>{tab.label}</Text>
                  </View>
                  <View style={styles.tabOrderArrows}>
                    <TouchableOpacity onPress={moveUp} disabled={idx === 0} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="chevron-up" size={16} color={idx === 0 ? Colors.border : Colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={moveDown} disabled={idx === tabOrder.length - 1} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="chevron-down" size={16} color={idx === tabOrder.length - 1 ? Colors.border : Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Corner radius */}
          <View style={[styles.cardContainer, { padding: Spacing.md, gap: Spacing.md, marginTop: Spacing.sm }]}>
            <SegmentedRow
              label="Corner radius"
              options={[{ label: "Sharp", value: "sharp" as CornerRadiusScale }, { label: "Rounded", value: "rounded" as CornerRadiusScale }, { label: "Pill", value: "pill" as CornerRadiusScale }]}
              value={cornerRadiusScale}
              onChange={setCornerRadiusScale}
            />
            <CornerRadiusPreview scale={cornerRadiusScale} />
          </View>

          {/* Transactions */}
          <View style={[styles.cardContainer, { padding: Spacing.md, gap: Spacing.md, marginTop: Spacing.sm }]}>
            <SegmentedRow
              label="Transaction density"
              options={[{ label: "Comfortable", value: "comfortable" as TransactionDensity }, { label: "Compact", value: "compact" as TransactionDensity }]}
              value={transactionDensity}
              onChange={setTransactionDensity}
            />
            <SegmentedRow
              label="Transaction grouping"
              options={[{ label: "By date", value: "date" as TransactionGrouping }, { label: "Flat list", value: "flat" as TransactionGrouping }]}
              value={transactionGrouping}
              onChange={setTransactionGrouping}
            />
            <TransactionDensityPreview compact={transactionDensity === 'compact'} grouped={transactionGrouping === 'date'} />
          </View>

          {/* Animations */}
          <View style={[styles.cardContainer, { padding: Spacing.md, marginTop: Spacing.sm }]}>
            <SegmentedRow
              label="Animations"
              options={[{ label: "Enabled", value: false as any }, { label: "Reduced", value: true as any }]}
              value={reducedMotion as any}
              onChange={(v: any) => setReducedMotion(v === true || v === 'true')}
            />
          </View>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Quick Actions</Text>
          <Text style={styles.sectionHint}>Choose up to 3 actions shown on the home screen. More is always last.</Text>
          <View style={[styles.cardContainer, { padding: Spacing.md }]}>
            {QUICK_ACTIONS_REGISTRY.map(action => {
              const isActive = quickActions.includes(action.id as QuickActionId);
              const position = quickActions.indexOf(action.id as QuickActionId);
              const maxReached = quickActions.length >= 3;

              const toggle = () => {
                if (isActive) {
                  setQuickActions(quickActions.filter(a => a !== action.id));
                } else if (!maxReached) {
                  setQuickActions([...quickActions, action.id as QuickActionId]);
                }
              };
              const move = (dir: 'up' | 'down') => {
                const arr = [...quickActions];
                const idx = arr.indexOf(action.id as QuickActionId);
                if (dir === 'up' && idx > 0) { const t = arr[idx - 1]!; arr[idx - 1] = arr[idx]!; arr[idx] = t; }
                if (dir === 'down' && idx < arr.length - 1) { const t = arr[idx + 1]!; arr[idx + 1] = arr[idx]!; arr[idx] = t; }
                setQuickActions(arr);
              };

              return (
                <View key={action.id} style={styles.actionRow}>
                  <View style={styles.actionRowLeft}>
                    <View style={[styles.actionRowIcon, isActive && { backgroundColor: Colors.primary + '18' }]}>
                      <Feather name={action.icon as any} size={16} color={isActive ? Colors.primary : Colors.textSecondary} />
                    </View>
                    <Text style={[styles.actionRowLabel, isActive && { color: Colors.textPrimary, fontWeight: '600' }]}>{action.label}</Text>
                    {isActive && (
                      <View style={styles.orderBadge}>
                        <Text style={[styles.orderBadgeText, { color: Colors.primary }]}>{position + 1}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.actionRowRight}>
                    {isActive && (
                      <>
                        <TouchableOpacity onPress={() => move('up')} disabled={position === 0} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Feather name="chevron-up" size={16} color={position === 0 ? Colors.border : Colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => move('down')} disabled={position >= quickActions.length - 1} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Feather name="chevron-down" size={16} color={position >= quickActions.length - 1 ? Colors.border : Colors.textSecondary} />
                        </TouchableOpacity>
                      </>
                    )}
                    <TouchableOpacity onPress={toggle} disabled={!isActive && maxReached} style={styles.toggleBtn}>
                      <View style={[styles.toggleTrack, isActive && { backgroundColor: Colors.primary }]}>
                        <View style={[styles.toggleThumb, isActive && styles.toggleThumbOn]} />
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Home background ── */}
        {renderBgSection(
          "Home Screen Background",
          homeBackground, setHomeBackground,
          homeCustomBackgrounds, removeHomeCustomBackground,
          homeDim, setHomeDim,
          homeBlur, setHomeBlur,
          homeBannerGradient, setHomeBannerGradient,
          "home",
        )}

        {/* ── Hub background ── */}
        {renderBgSection(
          "Hub Screen Background",
          hubBackground, setHubBackground,
          hubCustomBackgrounds, removeHubCustomBackground,
          hubDim, setHubDim,
          hubBlur, setHubBlur,
          hubBannerGradient, setHubBannerGradient,
          "hub",
        )}

      </ScrollView>

      {/* ── Link sheet ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents={linkPromptVisible ? "auto" : "none"}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setLinkPromptVisible(false)} />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetOverlay} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Enter Image URL</Text>
            <Text style={styles.modalDesc}>Paste a direct link to an image (e.g., from Pexels, Unsplash)</Text>
            <TextInput style={styles.modalInput} value={linkInput} onChangeText={setLinkInput} placeholder="https://..." placeholderTextColor={Colors.textSecondary} autoCapitalize="none" autoCorrect={false} keyboardType="url" autoFocus={linkPromptVisible} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setLinkPromptVisible(false)} activeOpacity={0.8}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, !linkInput.trim() && styles.btnDisabled]} onPress={handleLinkSubmit} disabled={!linkInput.trim()} activeOpacity={0.8}>
                <Text style={styles.btnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
      {/* ── Unsplash picker modal ── */}
      <Modal visible={unsplashVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setUnsplashVisible(false)}>
        <SafeAreaView style={[styles.safeArea, { flex: 1 }]} edges={["top", "bottom"]}>
          {/* Header */}
          <View style={styles.unsplashHeader}>
            <TouchableOpacity onPress={() => setUnsplashVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.unsplashSearchRow}>
              <TextInput
                ref={unsplashInputRef}
                style={styles.unsplashInput}
                value={unsplashQuery}
                onChangeText={setUnsplashQuery}
                placeholder="Search photos…"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="search"
                onSubmitEditing={() => doUnsplashSearch(unsplashQuery)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.unsplashSearchBtn, !unsplashQuery.trim() && { opacity: 0.4 }]}
                onPress={() => doUnsplashSearch(unsplashQuery)}
                disabled={!unsplashQuery.trim()}
                activeOpacity={0.8}
              >
                <Feather name="search" size={16} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Results */}
          {unsplashLoading ? (
            <View style={styles.unsplashCenter}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : unsplashResults.length === 0 ? (
            <View style={styles.unsplashCenter}>
              <Feather name={unsplashError ? "alert-circle" : "image"} size={40} color={unsplashError ? Colors.error : Colors.border} />
              <Text style={[styles.unsplashEmptyText, unsplashError ? { color: Colors.error } : null]}>
                {unsplashError ?? (unsplashQuery.trim() ? "No results found" : "Search for a photo to use as background")}
              </Text>
            </View>
          ) : (
            <FlatList
              data={unsplashResults}
              keyExtractor={item => item.id}
              numColumns={2}
              contentContainerStyle={styles.unsplashGrid}
              columnWrapperStyle={{ gap: 8 }}
              onEndReached={() => {
                if (unsplashHasMore && !unsplashLoadingMore) {
                  doUnsplashSearch(unsplashQuery, unsplashPage + 1);
                }
              }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={unsplashLoadingMore ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 16 }} />
              ) : null}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.unsplashPhotoCard} onPress={() => handleUnsplashSelect(item)} activeOpacity={0.85}>
                  <Image source={{ uri: item.thumbUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={styles.unsplashPhotoOverlay}>
                    <Text style={styles.unsplashPhotoCreditText} numberOfLines={1}>
                      {"Photo by "}
                      <Text
                        onPress={e => {
                          e.stopPropagation?.();
                          if (item.photographerUrl) {
                            Linking.openURL(`${item.photographerUrl}?utm_source=aza&utm_medium=referral`);
                          }
                        }}
                        style={styles.unsplashPhotoCreditLink}
                      >
                        {item.photographerName}
                      </Text>
                      {" on "}
                      <Text
                        onPress={e => {
                          e.stopPropagation?.();
                          Linking.openURL("https://unsplash.com/?utm_source=aza&utm_medium=referral");
                        }}
                        style={styles.unsplashPhotoCreditLink}
                      >
                        Unsplash
                      </Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Attribution — required by Unsplash API guidelines */}
          <View style={styles.unsplashFooter}>
            <Text style={styles.unsplashFooterText}>
              Photos by{" "}
              <Text
                style={{ color: Colors.primary }}
                onPress={() => Linking.openURL("https://unsplash.com/?utm_source=aza&utm_medium=referral")}
              >
                Unsplash
              </Text>
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  const mainBg = isDark ? Colors.background : Colors.white;
  const contentBg = isDark ? Colors.surface : Colors.white;

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: mainBg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md, backgroundColor: mainBg },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? Colors.border : Colors.surface, justifyContent: "center", alignItems: "center" },
    headerTitle: { color: Colors.textPrimary },
    headerRightPlaceholder: { width: 40 },
    scrollContent: { paddingVertical: Spacing.lg },
    section: { marginBottom: Spacing.xl },
    sectionTitle: { color: Colors.textSecondary, marginBottom: Spacing.md, paddingHorizontal: Spacing.lg, fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5 },
    sectionSubLabel: { ...Typography.caption, color: Colors.textSecondary, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },

    cardContainer: { backgroundColor: isDark ? Colors.surface : "#F9FAFB", marginHorizontal: Spacing.lg, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },

    // Theme cards
    themeCard: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.sm, backgroundColor: "transparent", borderWidth: 2, borderColor: "transparent" },
    themeCardSelected: { backgroundColor: contentBg, borderColor: Colors.primary, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    thumbnailBase: { width: 60, height: 50, borderRadius: Radius.sm, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, backgroundColor: "#F3F4F6" },
    thumbnailLightContent: { flex: 1, backgroundColor: "#FFFFFF", borderTopLeftRadius: 4, marginTop: 8, marginLeft: 8, padding: 4 },
    thumbnailDarkContent: { flex: 1, backgroundColor: "#111827", borderTopLeftRadius: 4, marginTop: 8, marginLeft: 8, padding: 4 },
    thumbnailSplitSide: { flex: 1 },
    themeCardTextContainer: { flex: 1, marginLeft: Spacing.md },
    themeCardTitle: { fontWeight: "600", color: Colors.textPrimary },
    themeCardSubtitle: { color: Colors.textSecondary, marginTop: 2 },
    checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, justifyContent: "center", alignItems: "center", backgroundColor: "transparent" },
    checkCircleSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },

    // Accent
    accentGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: Spacing.lg, gap: 0 },
    accentItem: { width: "25%", alignItems: "center", paddingVertical: Spacing.sm },
    accentSwatch: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 4 },
    accentSwatchActive: { borderWidth: 3, borderColor: Colors.textPrimary },
    accentLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: "center" },

    // Preview card
    previewCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, height: 140, borderRadius: Radius.md, overflow: "hidden", backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    previewBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
    previewBadgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8, color: "#fff" },

    // Controls
    bgControls: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: isDark ? Colors.surface : "#F9FAFB", borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },

    // Gradient swatches
    gradientScrollContainer: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, marginBottom: Spacing.sm },
    gradSwatch: { width: 72, height: 44, borderRadius: Radius.sm, marginRight: Spacing.sm, overflow: "hidden", borderWidth: 2, borderColor: "transparent", justifyContent: "flex-end", alignItems: "flex-start", paddingLeft: 6, paddingBottom: 4 },
    gradSwatchActive: { borderColor: Colors.textPrimary },
    gradCheck: { position: "absolute", top: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
    gradLabel: { fontSize: 9, fontWeight: "600", color: "#fff", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

    // Bg thumbnails
    backgroundsScrollContainer: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    bgThumbnailContainer: { width: 100, height: 160, borderRadius: Radius.sm, marginRight: Spacing.md, overflow: "hidden", borderWidth: 2, borderColor: "transparent", position: "relative" },
    bgThumbnailSelected: { borderColor: Colors.primary },
    bgThumbnailImage: { flex: 1 },
    bgCheckCircle: { position: "absolute", bottom: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
    bgUploadButton: { width: 100, height: 160, borderRadius: Radius.sm, marginRight: Spacing.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderStyle: "dashed", justifyContent: "center", alignItems: "center" },
    uploadText: { color: Colors.textSecondary, marginTop: Spacing.xs },
    bgThumbnailWrapper: { position: "relative" },
    bgDeleteButton: { position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", zIndex: 10 },
    bgNoneInner: { flex: 1, backgroundColor: Colors.surface, justifyContent: "center", alignItems: "center", gap: 6 },
    bgNoneLine: { width: 36, height: 2, borderRadius: 1, backgroundColor: Colors.border, transform: [{ rotate: "45deg" }] },
    bgNoneLabel: { color: Colors.textSecondary },

    // Section hint
    sectionHint: { ...Typography.caption, color: Colors.textSecondary, paddingHorizontal: Spacing.lg, marginTop: -Spacing.sm, marginBottom: Spacing.md },

    // Tab order rows
    tabOrderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border },
    tabOrderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    tabOrderPos: { fontSize: 10, fontWeight: '700', color: Colors.primary, width: 20, textAlign: 'center' },
    tabOrderLabel: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
    tabOrderArrows: { flexDirection: 'row', gap: Spacing.md },

    // Quick action rows
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
    actionRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    actionRowIcon: { width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: isDark ? Colors.background : Colors.surface, justifyContent: 'center', alignItems: 'center' },
    actionRowLabel: { ...Typography.body, color: Colors.textSecondary },
    actionRowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    orderBadge: { backgroundColor: Colors.primary + '18', borderRadius: Radius.full, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' },
    orderBadgeText: { fontSize: 10, fontWeight: '700' },
    toggleBtn: { padding: 2 },
    toggleTrack: { width: 38, height: 22, borderRadius: 11, backgroundColor: Colors.border, justifyContent: 'center', paddingHorizontal: 2 },
    toggleThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 1, elevation: 1 },
    toggleThumbOn: { alignSelf: 'flex-end' },

    // Sheet
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
    sheetOverlay: { flex: 1, justifyContent: "flex-end" },
    sheet: { backgroundColor: mainBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: 48 },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.15)", alignSelf: "center", marginBottom: Spacing.lg },
    modalTitle: { ...Typography.h2, color: Colors.textPrimary, marginBottom: Spacing.xs, textAlign: "center" },
    modalDesc: { ...Typography.body, color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg },
    modalInput: { ...Typography.body, backgroundColor: isDark ? Colors.surface : "#F9FAFB", borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, marginBottom: Spacing.xl },
    modalActions: { flexDirection: "row", gap: Spacing.md, width: "100%" },
    btnCancel: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: isDark ? Colors.surface : "#F3F4F6", alignItems: "center" },
    btnCancelText: { ...Typography.button, color: Colors.textPrimary },
    btnPrimary: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: "center" },
    btnDisabled: { opacity: 0.5 },
    btnPrimaryText: { ...Typography.button, color: Colors.white, fontWeight: "600" },

    // Unsplash picker
    unsplashHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: isDark ? Colors.border : "#E5E7EB" },
    unsplashSearchRow: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: isDark ? Colors.surface : "#F3F4F6", borderRadius: Radius.md, paddingHorizontal: Spacing.sm, gap: Spacing.xs },
    unsplashInput: { flex: 1, ...Typography.body, color: Colors.textPrimary, paddingVertical: Spacing.sm },
    unsplashSearchBtn: { width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" },
    unsplashGrid: { padding: Spacing.md, gap: 8 },
    unsplashPhotoCard: { flex: 1, aspectRatio: 0.75, borderRadius: Radius.md, overflow: "hidden", backgroundColor: Colors.surface },
    unsplashPhotoOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 6, paddingVertical: 4 },
    unsplashPhotoCreditText: { fontSize: 10, color: "rgba(255,255,255,0.85)", fontWeight: "400" },
    unsplashPhotoCreditLink: { color: "#fff", fontWeight: "600", textDecorationLine: "underline" },
    unsplashCenter: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md, padding: Spacing.xl },
    unsplashEmptyText: { ...Typography.body, color: Colors.textSecondary, textAlign: "center" },
    unsplashFooter: { paddingVertical: Spacing.sm, alignItems: "center", borderTopWidth: 1, borderTopColor: isDark ? Colors.border : "#E5E7EB" },
    unsplashFooterText: { ...Typography.caption, color: Colors.textSecondary },
  });
}
