import React, { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Platform, StatusBar, ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView,
  Alert, GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import * as ImagePicker from 'expo-image-picker';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { useChatThemeStore, ChatWallpaper, ChatFontSize } from '../../../store/chatThemeStore';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Color utilities ─────────────────────────────────────────────────────────

function hsbToHex(h: number, s: number, b: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return b - b * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${hex(f(5))}${hex(f(3))}${hex(f(1))}`;
}

function hexToHsb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  if (c.length !== 6) return [200, 0.65, 0.85];
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [Math.round(h), max === 0 ? 0 : d / max, max];
}

// ─── Pattern background ───────────────────────────────────────────────────────

type PatternId = 'dots' | 'grid' | 'diagonal' | 'waves';

function PatternBackground({ patternId, color }: { patternId: PatternId; color: string }) {
  const TILE = 24;
  const cols = Math.ceil(SCREEN_WIDTH / TILE) + 1;
  const rows = 14;

  if (patternId === 'dots') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {Array.from({ length: cols }).map((_, c) => (
              <View key={c} style={{ width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, opacity: 0.35 }} />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }
  if (patternId === 'grid') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {Array.from({ length: cols }).map((_, c) => (
              <View key={c} style={{ width: TILE, height: TILE, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: color, opacity: 0.2 }} />
            ))}
          </View>
        ))}
      </View>
    );
  }
  if (patternId === 'diagonal') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: rows }).map((_, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {Array.from({ length: cols }).map((_, c) => (
              <View key={c} style={{ width: TILE, height: TILE, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', top: 0, left: TILE / 2 - 0.5, width: 1, height: TILE * 1.5, backgroundColor: color, opacity: 0.2, transform: [{ rotate: '45deg' }] }} />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }
  // waves — horizontal wavy rows
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: rows }).map((_, r) => (
        <View key={r} style={{ flexDirection: 'row', height: TILE, alignItems: 'center' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <View key={c} style={{
              width: TILE, height: 2,
              backgroundColor: color,
              opacity: 0.18,
              borderRadius: 1,
              marginTop: c % 2 === 0 ? -4 : 4,
            }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Draggable gradient slider ────────────────────────────────────────────────

const ColorSlider = memo(function ColorSlider({
  gradientColors,
  value,
  onChange,
}: {
  gradientColors: string[];
  value: number;
  onChange: (v: number) => void;
}) {
  const barRef = useRef<View>(null);
  const update = useCallback((e: GestureResponderEvent) => {
    barRef.current?.measure((_x, _y, w, _h, px) => {
      const ratio = Math.max(0, Math.min(1, (e.nativeEvent.pageX - px) / w));
      onChange(ratio);
    });
  }, [onChange]);
  return (
    <View
      ref={barRef}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={update}
      onResponderMove={update}
      style={{ height: 36, borderRadius: 18, overflow: 'visible', marginBottom: 20 }}
    >
      <LinearGradient
        colors={gradientColors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', inset: 0, borderRadius: 18 }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 4, width: 28, height: 28, borderRadius: 14,
          left: `${value * 100}%` as any,
          transform: [{ translateX: -14 }],
          backgroundColor: '#fff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          elevation: 4,
          borderWidth: 0.5,
          borderColor: 'rgba(0,0,0,0.12)',
        }}
      />
    </View>
  );
});

// ─── Theme packs ─────────────────────────────────────────────────────────────

type ThemePack = {
  id: string;
  label: string;
  bubble: string | null;
  wallpaper: ChatWallpaper;
  preview: [string, string]; // [bubbleHex, bgHex]
};

const THEME_PACKS: ThemePack[] = [
  { id: 'default',  label: 'Default',  bubble: null,      wallpaper: { type: 'none',  value: ''        }, preview: ['#22C55E', '#F8FAFC'] },
  { id: 'forest',   label: 'Forest',   bubble: '#166534', wallpaper: { type: 'solid', value: '#DDE8D9' }, preview: ['#166534', '#DDE8D9'] },
  { id: 'ocean',    label: 'Ocean',    bubble: '#0D9488', wallpaper: { type: 'solid', value: '#E8F0FE' }, preview: ['#0D9488', '#E8F0FE'] },
  { id: 'sunset',   label: 'Sunset',   bubble: '#EA580C', wallpaper: { type: 'solid', value: '#FCE4EC' }, preview: ['#EA580C', '#FCE4EC'] },
  { id: 'grape',    label: 'Grape',    bubble: '#7C3AED', wallpaper: { type: 'solid', value: '#F3E8FF' }, preview: ['#7C3AED', '#F3E8FF'] },
  { id: 'midnight', label: 'Midnight', bubble: '#2563EB', wallpaper: { type: 'solid', value: '#0F172A' }, preview: ['#2563EB', '#0F172A'] },
  { id: 'rose',     label: 'Rose',     bubble: '#E11D48', wallpaper: { type: 'solid', value: '#FFF1F2' }, preview: ['#E11D48', '#FFF1F2'] },
  { id: 'desert',   label: 'Desert',   bubble: '#B45309', wallpaper: { type: 'solid', value: '#FEF3C7' }, preview: ['#B45309', '#FEF3C7'] },
];

// ─── Presets ─────────────────────────────────────────────────────────────────

const BUBBLE_PRESETS: Array<{ id: string; color: string | null; label: string }> = [
  { id: 'default', color: null,      label: 'Default' },
  { id: 'blue',    color: '#2563EB', label: 'Blue'    },
  { id: 'teal',    color: '#0D9488', label: 'Teal'    },
  { id: 'forest',  color: '#166534', label: 'Forest'  },
  { id: 'grape',   color: '#7C3AED', label: 'Grape'   },
  { id: 'rose',    color: '#E11D48', label: 'Rose'    },
  { id: 'amber',   color: '#D97706', label: 'Amber'   },
  { id: 'slate',   color: '#475569', label: 'Slate'   },
];

const WALLPAPER_PRESETS: Array<{ id: string; type: ChatWallpaper['type']; value: string; label: string }> = [
  { id: 'none',     type: 'none',  value: '',        label: 'None'     },
  { id: 'sage',     type: 'solid', value: '#DDE8D9', label: 'Sage'     },
  { id: 'cream',    type: 'solid', value: '#F5F0E8', label: 'Cream'    },
  { id: 'sky',      type: 'solid', value: '#E8F0FE', label: 'Sky'      },
  { id: 'blush',    type: 'solid', value: '#FCE4EC', label: 'Blush'    },
  { id: 'mint',     type: 'solid', value: '#DCFCE7', label: 'Mint'     },
  { id: 'lavender', type: 'solid', value: '#F3E8FF', label: 'Lavender' },
  { id: 'sand',     type: 'solid', value: '#FEF3C7', label: 'Sand'     },
  { id: 'night',    type: 'solid', value: '#0F172A', label: 'Night'    },
  { id: 'charcoal', type: 'solid', value: '#1E293B', label: 'Charcoal' },
];

const PATTERN_PRESETS: Array<{ id: PatternId; label: string; icon: string }> = [
  { id: 'dots',     label: 'Dots',     icon: '⠿' },
  { id: 'grid',     label: 'Grid',     icon: '⊞' },
  { id: 'diagonal', label: 'Diagonal', icon: '╱' },
  { id: 'waves',    label: 'Waves',    icon: '〰' },
];

const FONT_SIZES: Array<{ id: ChatFontSize; label: string; size: number }> = [
  { id: 'small',  label: 'A',  size: 12 },
  { id: 'medium', label: 'A',  size: 16 },
  { id: 'large',  label: 'A',  size: 21 },
];

// ─── Preview ─────────────────────────────────────────────────────────────────

type PreviewProps = {
  bubbleColor: string;
  wallpaper: ChatWallpaper;
  pattern: PatternId | null;
  fontSize: ChatFontSize;
  Colors: ThemeColors;
  isDark: boolean;
};

function ChatPreview({ bubbleColor, wallpaper, pattern, fontSize, Colors, isDark }: PreviewProps) {
  const sentColor = bubbleColor || Colors.primary;
  const receivedBg = isDark ? Colors.surface : '#FFFFFF';
  const bgColor = wallpaper.type === 'solid' ? wallpaper.value : (isDark ? '#121212' : Colors.background);
  const fs = fontSize === 'small' ? 12 : fontSize === 'large' ? 17 : 14;
  const patternColor = isDark ? '#FFFFFF' : '#000000';

  const mockSent = (text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', marginBottom: 4 }}>
      <View style={{ backgroundColor: sentColor, borderRadius: 16, borderBottomRightRadius: 0, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '72%' }}>
        <Text style={{ fontSize: fs, color: '#fff', lineHeight: fs * 1.4 }}>{text}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 2, marginTop: 2 }}>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>10:31</Text>
          <Feather name="check" size={10} color="#53BDEB" />
          <Feather name="check" size={10} color="#53BDEB" style={{ marginLeft: -6 }} />
        </View>
      </View>
      <View style={{ width: 0, height: 0, borderTopWidth: 9, borderLeftWidth: 8, borderTopColor: sentColor, borderLeftColor: 'transparent' }} />
    </View>
  );

  const mockReceived = (text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 }}>
      <View style={{ width: 0, height: 0, borderTopWidth: 9, borderRightWidth: 8, borderTopColor: receivedBg, borderRightColor: 'transparent' }} />
      <View style={{ backgroundColor: receivedBg, borderRadius: 16, borderBottomLeftRadius: 0, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '72%' }}>
        <Text style={{ fontSize: fs, color: Colors.textPrimary, lineHeight: fs * 1.4 }}>{text}</Text>
        <Text style={{ fontSize: 10, color: Colors.textSecondary, alignSelf: 'flex-end', marginTop: 2 }}>10:30</Text>
      </View>
    </View>
  );

  return (
    <View style={{ height: 240, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border }}>
      {wallpaper.type === 'image' && wallpaper.value ? (
        <Image source={{ uri: wallpaper.value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]} />
      )}
      {pattern && <PatternBackground patternId={pattern} color={patternColor} />}
      <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 12, justifyContent: 'flex-end' }}>
        {mockReceived('Hey! How are you? 👋')}
        {mockSent("I'm great, thanks! 😊")}
        {mockSent('What about you? 🎉')}
      </View>
      <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
        <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: '#fff' }}>PREVIEW</Text>
      </View>
    </View>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label, Colors }: { label: string; Colors: ThemeColors }) {
  return (
    <Text style={{ ...Typography.caption, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm }}>
      {label}
    </Text>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChatThemeScreen() {
  const { colors: Colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
  const route = useRoute<RouteProp<RootStackParamList, 'ChatThemeScreen'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { chatId, name } = route.params;

  const load          = useChatThemeStore(s => s.load);
  const setBubbleColor  = useChatThemeStore(s => s.setBubbleColor);
  const setWallpaper  = useChatThemeStore(s => s.setWallpaper);
  const setFontSizeStore = useChatThemeStore(s => s.setFontSize);
  const getBubbleColor = useChatThemeStore(s => s.getBubbleColor);
  const getWallpaper  = useChatThemeStore(s => s.getWallpaper);
  const getFontSize   = useChatThemeStore(s => s.getFontSize);
  const resetTheme    = useChatThemeStore(s => s.resetTheme);

  const [bubbleColor, setBubbleColorLocal] = useState('');
  const [wallpaper, setWallpaperLocal] = useState<ChatWallpaper>({ type: 'none', value: '' });
  const [fontSize, setFontSizeLocal] = useState<ChatFontSize>('medium');
  const [pattern, setPattern] = useState<PatternId | null>(null);

  const [hexVisible, setHexVisible] = useState(false);
  const [hue, setHue] = useState(200);
  const [sat, setSat] = useState(0.65);
  const [bri, setBri] = useState(0.85);
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const previewColor = useMemo(() => hsbToHex(hue, sat, bri), [hue, sat, bri]);
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => {
    load().then(() => {
      setBubbleColorLocal(getBubbleColor(chatId));
      setWallpaperLocal(getWallpaper(chatId));
      setFontSizeLocal(getFontSize(chatId));
    });
  }, [chatId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: hexVisible ? 0 : SCREEN_HEIGHT, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: hexVisible ? 1 : 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [hexVisible]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleApplyPack = useCallback((pack: ThemePack) => {
    const color = pack.bubble ?? '';
    setBubbleColorLocal(color);
    setWallpaperLocal(pack.wallpaper);
    setPattern(null);
    setBubbleColor(chatId, color).catch(() => {});
    setWallpaper(chatId, pack.wallpaper).catch(() => {});
  }, [chatId, setBubbleColor, setWallpaper]);

  const handleSelectBubble = useCallback((color: string | null) => {
    const c = color ?? '';
    setBubbleColorLocal(c);
    setBubbleColor(chatId, c).catch(() => {});
  }, [chatId, setBubbleColor]);

  const handleOpenCustom = useCallback(() => {
    if (bubbleColor && /^#[0-9a-f]{6}$/i.test(bubbleColor)) {
      const [h, s, b] = hexToHsb(bubbleColor);
      setHue(h); setSat(s); setBri(b);
    } else {
      setHue(200); setSat(0.65); setBri(0.85);
    }
    setHexVisible(true);
  }, [bubbleColor]);

  const handleApplyColor = useCallback(() => {
    const hex = hsbToHex(hue, sat, bri);
    setBubbleColorLocal(hex);
    setBubbleColor(chatId, hex).catch(() => {});
    setHexVisible(false);
  }, [hue, sat, bri, chatId, setBubbleColor]);

  const handleSelectWallpaper = useCallback((wp: ChatWallpaper) => {
    setWallpaperLocal(wp);
    setPattern(null);
    setWallpaper(chatId, wp).catch(() => {});
  }, [chatId, setWallpaper]);

  const handleTogglePattern = useCallback((pid: PatternId) => {
    setPattern(prev => prev === pid ? null : pid);
  }, []);

  const handleSelectFontSize = useCallback((size: ChatFontSize) => {
    setFontSizeLocal(size);
    setFontSizeStore(chatId, size).catch(() => {});
  }, [chatId, setFontSizeStore]);

  const handlePickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    setPickerLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.9, allowsEditing: false });
      if (!result.canceled && result.assets[0]) {
        const wp: ChatWallpaper = { type: 'image', value: result.assets[0].uri };
        setWallpaperLocal(wp);
        setPattern(null);
        setWallpaper(chatId, wp).catch(() => {});
      }
    } finally {
      setPickerLoading(false);
    }
  }, [chatId, setWallpaper]);

  const handleReset = useCallback(() => {
    Alert.alert('Reset Theme', 'Remove all custom styling for this chat?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => {
        setBubbleColorLocal('');
        setWallpaperLocal({ type: 'none', value: '' });
        setFontSizeLocal('medium');
        setPattern(null);
        resetTheme(chatId).catch(() => {});
      }},
    ]);
  }, [chatId, resetTheme]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const isWallpaperSelected = (preset: typeof WALLPAPER_PRESETS[0]) => {
    if (preset.type === 'none' && wallpaper.type === 'none') return true;
    if (preset.type === 'solid' && wallpaper.type === 'solid' && wallpaper.value === preset.value) return true;
    return false;
  };

  const selectedBubbleId = (() => {
    if (!bubbleColor) return 'default';
    const match = BUBBLE_PRESETS.find(p => p.color === bubbleColor);
    return match ? match.id : 'custom';
  })();

  const activePackId = (() => {
    return THEME_PACKS.find(p =>
      (p.bubble ?? '') === bubbleColor &&
      p.wallpaper.type === wallpaper.type &&
      p.wallpaper.value === wallpaper.value &&
      !pattern,
    )?.id ?? null;
  })();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Chat Theme</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{name}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Live Preview ── */}
        <View style={styles.section}>
          <ChatPreview
            bubbleColor={bubbleColor}
            wallpaper={wallpaper}
            pattern={pattern}
            fontSize={fontSize}
            Colors={Colors}
            isDark={isDark}
          />
        </View>

        {/* ── Theme Packs ── */}
        <View style={styles.section}>
          <SectionLabel label="Theme Packs" Colors={Colors} />
          <View style={styles.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md, paddingVertical: 4 }}>
              {THEME_PACKS.map(pack => {
                const active = activePackId === pack.id;
                return (
                  <TouchableOpacity
                    key={pack.id}
                    style={[styles.packItem, active && { borderColor: Colors.primary }]}
                    onPress={() => handleApplyPack(pack)}
                    activeOpacity={0.75}
                  >
                    {/* Mini preview */}
                    <View style={[styles.packPreview, { backgroundColor: pack.preview[1] }]}>
                      <View style={[styles.packBubble, { backgroundColor: pack.preview[0] }]} />
                      <View style={[styles.packBubbleReceived, { backgroundColor: isDark ? '#333' : '#fff' }]} />
                    </View>
                    <Text style={[styles.packLabel, active && { color: Colors.primary, fontWeight: '700' }]}>{pack.label}</Text>
                    {active && (
                      <View style={[styles.packCheck, { backgroundColor: Colors.primary }]}>
                        <Feather name="check" size={9} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* ── Bubble Color ── */}
        <View style={styles.section}>
          <SectionLabel label="Bubble Color" Colors={Colors} />
          <View style={styles.card}>
            <View style={styles.swatchRow}>
              {BUBBLE_PRESETS.map(preset => {
                const swatchColor = preset.color ?? Colors.primary;
                const selected = selectedBubbleId === preset.id;
                return (
                  <TouchableOpacity key={preset.id} style={styles.swatchItem} onPress={() => handleSelectBubble(preset.color)} activeOpacity={0.75}>
                    <View style={[styles.swatch, { backgroundColor: swatchColor }, selected && styles.swatchSelected]}>
                      {selected && <Feather name="check" size={14} color="#FFF" />}
                    </View>
                    <Text style={[styles.swatchLabel, selected && { color: Colors.textPrimary, fontWeight: '600' }]}>{preset.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.swatchItem} onPress={handleOpenCustom} activeOpacity={0.75}>
                <View style={[styles.swatch, styles.swatchCustom, selectedBubbleId === 'custom' && { borderColor: Colors.primary, borderWidth: 2 }]}>
                  {selectedBubbleId === 'custom' && bubbleColor ? (
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: bubbleColor }} />
                  ) : (
                    <Feather name="plus" size={20} color={Colors.textSecondary} />
                  )}
                </View>
                <Text style={styles.swatchLabel}>Custom</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Chat Wallpaper ── */}
        <View style={styles.section}>
          <SectionLabel label="Chat Wallpaper" Colors={Colors} />
          <View style={styles.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wallpaperScroll}>
              {WALLPAPER_PRESETS.map(preset => {
                const selected = isWallpaperSelected(preset) && !pattern;
                return (
                  <TouchableOpacity key={preset.id} style={styles.wallpaperItem} onPress={() => handleSelectWallpaper({ type: preset.type, value: preset.value })} activeOpacity={0.75}>
                    <View style={[styles.wallpaperSwatch, selected && styles.wallpaperSwatchSelected]}>
                      {preset.type === 'none' ? (
                        <View style={styles.wallpaperNoneInner}>
                          <View style={styles.wallpaperNoneLine} />
                        </View>
                      ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: preset.value, borderRadius: 10 }]} />
                      )}
                      {selected && (
                        <View style={styles.wallpaperCheck}>
                          <Feather name="check" size={11} color="#fff" />
                        </View>
                      )}
                    </View>
                    <Text style={[styles.wallpaperLabel, selected && { color: Colors.textPrimary, fontWeight: '600' }]}>{preset.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.wallpaperItem} onPress={handlePickPhoto} disabled={pickerLoading} activeOpacity={0.75}>
                <View style={[styles.wallpaperSwatch, wallpaper.type === 'image' && !pattern && styles.wallpaperSwatchSelected, styles.wallpaperPhotoBtn]}>
                  {wallpaper.type === 'image' && wallpaper.value ? (
                    <>
                      <Image source={{ uri: wallpaper.value }} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} resizeMode="cover" />
                      {!pattern && <View style={styles.wallpaperCheck}><Feather name="check" size={11} color="#fff" /></View>}
                    </>
                  ) : pickerLoading ? (
                    <ActivityIndicator size="small" color={Colors.textSecondary} />
                  ) : (
                    <Feather name="image" size={22} color={Colors.textSecondary} />
                  )}
                </View>
                <Text style={[styles.wallpaperLabel, wallpaper.type === 'image' && !pattern && { color: Colors.textPrimary, fontWeight: '600' }]}>
                  {wallpaper.type === 'image' ? 'Custom' : 'Photos'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

        {/* ── Patterns ── */}
        <View style={styles.section}>
          <SectionLabel label="Background Pattern" Colors={Colors} />
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              {PATTERN_PRESETS.map(p => {
                const active = pattern === p.id;
                return (
                  <TouchableOpacity key={p.id} style={[styles.patternItem, active && { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' }]} onPress={() => handleTogglePattern(p.id)} activeOpacity={0.75}>
                    <Text style={[styles.patternIcon, { color: active ? Colors.primary : Colors.textSecondary }]}>{p.icon}</Text>
                    <Text style={[styles.patternLabel, { color: active ? Colors.primary : Colors.textSecondary, fontWeight: active ? '700' : '400' }]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.patternHint, { color: Colors.textSecondary }]}>
              Overlays on top of the selected wallpaper. Tap again to remove.
            </Text>
          </View>
        </View>

        {/* ── Font Size ── */}
        <View style={styles.section}>
          <SectionLabel label="Message Font Size" Colors={Colors} />
          <View style={[styles.card, { flexDirection: 'row', gap: Spacing.sm }]}>
            {FONT_SIZES.map(f => {
              const active = fontSize === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.fontBtn, active && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                  onPress={() => handleSelectFontSize(f.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.fontBtnLetter, { fontSize: f.size, color: active ? '#fff' : Colors.textSecondary }]}>{f.label}</Text>
                  <Text style={[styles.fontBtnSub, { color: active ? 'rgba(255,255,255,0.8)' : Colors.textSecondary }]}>
                    {f.id.charAt(0).toUpperCase() + f.id.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Reset ── */}
        <View style={[styles.section, { paddingBottom: Spacing.xl }]}>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
            <Feather name="rotate-ccw" size={16} color={Colors.error} />
            <Text style={[styles.resetBtnText, { color: Colors.error }]}>Reset to Default</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Custom hex color sheet */}
      <View style={StyleSheet.absoluteFill} pointerEvents={hexVisible ? 'auto' : 'none'}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropAnim }]}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setHexVisible(false)} />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetOverlay} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Custom Bubble Color</Text>
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={[styles.colorPreviewCircle, { backgroundColor: previewColor, shadowColor: previewColor }]} />
              <Text style={[styles.colorPreviewHex, { color: Colors.textSecondary }]}>{previewColor.toUpperCase()}</Text>
            </View>
            <Text style={[styles.sliderLabel, { color: Colors.textSecondary }]}>Hue</Text>
            <ColorSlider gradientColors={['#FF0000','#FFFF00','#00FF00','#00FFFF','#0000FF','#FF00FF','#FF0000']} value={hue / 360} onChange={(v) => setHue(Math.round(v * 360))} />
            <Text style={[styles.sliderLabel, { color: Colors.textSecondary }]}>Saturation</Text>
            <ColorSlider gradientColors={[hsbToHex(hue, 0, bri), hsbToHex(hue, 1, bri)]} value={sat} onChange={setSat} />
            <Text style={[styles.sliderLabel, { color: Colors.textSecondary }]}>Brightness</Text>
            <ColorSlider gradientColors={['#000000', hsbToHex(hue, sat, 1)]} value={bri} onChange={setBri} />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetBtnCancel} onPress={() => setHexVisible(false)} activeOpacity={0.8}>
                <Text style={styles.sheetBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetBtnApply} onPress={handleApplyColor} activeOpacity={0.8}>
                <Text style={styles.sheetBtnApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(Colors: ThemeColors, isDark: boolean) {
  const cardBg = isDark ? Colors.surface : '#F9FAFB';
  const mainBg = isDark ? Colors.background : Colors.white;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: mainBg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: mainBg },
    headerText: { flex: 1, alignItems: 'center' },
    headerTitle: { ...Typography.bodyLg, fontWeight: '700', color: Colors.textPrimary },
    headerSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
    scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
    section: { marginBottom: Spacing.xl },
    card: { backgroundColor: cardBg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },

    // Theme packs
    packItem: {
      width: 72, alignItems: 'center', borderRadius: Radius.md,
      borderWidth: 2, borderColor: 'transparent', padding: 4, position: 'relative',
    },
    packPreview: {
      width: 64, height: 80, borderRadius: 10, overflow: 'hidden',
      justifyContent: 'flex-end', paddingBottom: 8, paddingHorizontal: 6, marginBottom: 5,
    },
    packBubble: { height: 14, borderRadius: 7, width: '80%', alignSelf: 'flex-end', marginBottom: 4 },
    packBubbleReceived: { height: 14, borderRadius: 7, width: '65%' },
    packLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', fontSize: 10 },
    packCheck: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

    // Bubble swatches
    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    swatchItem: { alignItems: 'center', width: 60, paddingVertical: 6 },
    swatch: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
    swatchSelected: { borderWidth: 3, borderColor: Colors.textPrimary },
    swatchCustom: { backgroundColor: isDark ? Colors.background : '#F3F4F6', borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' },
    swatchLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', fontSize: 10 },

    // Wallpaper
    wallpaperScroll: { gap: Spacing.sm, paddingVertical: 4 },
    wallpaperItem: { alignItems: 'center', width: 72 },
    wallpaperSwatch: { width: 68, height: 100, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', marginBottom: 5, position: 'relative' },
    wallpaperSwatchSelected: { borderColor: Colors.primary },
    wallpaperNoneInner: { flex: 1, backgroundColor: isDark ? Colors.surface : '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
    wallpaperNoneLine: { width: 30, height: 2, backgroundColor: Colors.border, transform: [{ rotate: '45deg' }] },
    wallpaperCheck: { position: 'absolute', bottom: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    wallpaperPhotoBtn: { backgroundColor: isDark ? Colors.surface : '#F3F4F6', borderStyle: 'dashed', borderColor: Colors.border },
    wallpaperLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', fontSize: 10 },

    // Patterns
    patternItem: {
      flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
      borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    },
    patternIcon: { fontSize: 20, marginBottom: 4 },
    patternLabel: { ...Typography.caption, fontSize: 11 },
    patternHint: { ...Typography.caption, fontSize: 11, marginTop: Spacing.sm, textAlign: 'center' },

    // Font size
    fontBtn: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: Spacing.md, borderRadius: Radius.md,
      borderWidth: 1.5, borderColor: Colors.border,
    },
    fontBtnLetter: { fontWeight: '700', lineHeight: 28 },
    fontBtnSub: { ...Typography.caption, fontSize: 10, marginTop: 2 },

    // Reset
    resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
    resetBtnText: { ...Typography.body, fontWeight: '600' },

    // Color picker sheet
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
    sheet: { backgroundColor: mainBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: 48 },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
    sheetTitle: { ...Typography.h3, color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.xl },
    colorPreviewCircle: { width: 72, height: 72, borderRadius: 36, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 8 },
    colorPreviewHex: { fontSize: 13, fontWeight: '600', marginTop: 8, letterSpacing: 1 },
    sliderLabel: { ...Typography.caption, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    sheetActions: { flexDirection: 'row', gap: Spacing.md, marginTop: 8 },
    sheetBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: isDark ? Colors.surface : '#F3F4F6', alignItems: 'center' },
    sheetBtnCancelText: { ...Typography.button, color: Colors.textPrimary },
    sheetBtnApply: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
    sheetBtnApplyText: { ...Typography.button, color: Colors.white },
  });
}
