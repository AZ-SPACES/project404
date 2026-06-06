import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Image, Platform, StatusBar, ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import * as ImagePicker from 'expo-image-picker';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { BackButton } from '../../../components/ui/BackButton';
import { useChatThemeStore, ChatWallpaper } from '../../../store/chatThemeStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Presets ─────────────────────────────────────────────────────────────────

const BUBBLE_PRESETS: Array<{ id: string; color: string | null; label: string }> = [
  { id: 'default',   color: null,      label: 'Default'  },
  { id: 'blue',      color: '#2563EB', label: 'Blue'     },
  { id: 'teal',      color: '#0D9488', label: 'Teal'     },
  { id: 'forest',    color: '#166534', label: 'Forest'   },
  { id: 'grape',     color: '#7C3AED', label: 'Grape'    },
  { id: 'rose',      color: '#F43F5E', label: 'Rose'     },
  { id: 'amber',     color: '#D97706', label: 'Amber'    },
  { id: 'slate',     color: '#475569', label: 'Slate'    },
];

const WALLPAPER_PRESETS: Array<{ id: string; type: ChatWallpaper['type']; value: string; label: string }> = [
  { id: 'none',      type: 'none',  value: '',        label: 'None'     },
  { id: 'sage',      type: 'solid', value: '#DDE8D9', label: 'Sage'     },
  { id: 'cream',     type: 'solid', value: '#F5F0E8', label: 'Cream'    },
  { id: 'sky',       type: 'solid', value: '#E8F0FE', label: 'Sky'      },
  { id: 'blush',     type: 'solid', value: '#FCE4EC', label: 'Blush'    },
  { id: 'mint',      type: 'solid', value: '#DCFCE7', label: 'Mint'     },
  { id: 'lavender',  type: 'solid', value: '#F3E8FF', label: 'Lavender' },
  { id: 'sand',      type: 'solid', value: '#FEF3C7', label: 'Sand'     },
  { id: 'night',     type: 'solid', value: '#0F172A', label: 'Night'    },
  { id: 'charcoal',  type: 'solid', value: '#1E293B', label: 'Charcoal' },
];

// ─── Preview ─────────────────────────────────────────────────────────────────

type PreviewProps = {
  bubbleColor: string;
  wallpaper: ChatWallpaper;
  Colors: ThemeColors;
  isDark: boolean;
};

function ChatPreview({ bubbleColor, wallpaper, Colors, isDark }: PreviewProps) {
  const sentColor = bubbleColor || Colors.primary;
  const receivedBg = isDark ? Colors.surface : '#FFFFFF';
  const bgColor = wallpaper.type === 'solid'
    ? wallpaper.value
    : (isDark ? '#121212' : Colors.background);

  const mockSentBubble = (text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', marginBottom: 4 }}>
      <View style={{ backgroundColor: sentColor, borderRadius: 16, borderBottomRightRadius: 0, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '72%' }}>
        <Text style={{ fontSize: 13.5, color: '#FFFFFF', lineHeight: 19 }}>{text}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 2, marginTop: 2 }}>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>10:31</Text>
          <Feather name="check" size={10} color="#53BDEB" />
          <Feather name="check" size={10} color="#53BDEB" style={{ marginLeft: -6 }} />
        </View>
      </View>
      <View style={{ width: 0, height: 0, borderTopWidth: 9, borderLeftWidth: 8, borderTopColor: sentColor, borderLeftColor: 'transparent' }} />
    </View>
  );

  const mockReceivedBubble = (text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 }}>
      <View style={{ width: 0, height: 0, borderTopWidth: 9, borderRightWidth: 8, borderTopColor: receivedBg, borderRightColor: 'transparent' }} />
      <View style={{ backgroundColor: receivedBg, borderRadius: 16, borderBottomLeftRadius: 0, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '72%' }}>
        <Text style={{ fontSize: 13.5, color: Colors.textPrimary, lineHeight: 19 }}>{text}</Text>
        <Text style={{ fontSize: 10, color: Colors.textSecondary, alignSelf: 'flex-end', marginTop: 2 }}>10:30</Text>
      </View>
    </View>
  );

  return (
    <View style={{ height: 240, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border }}>
      {/* Background */}
      {wallpaper.type === 'image' && wallpaper.value ? (
        <Image source={{ uri: wallpaper.value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]} />
      )}

      {/* Messages */}
      <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 12, justifyContent: 'flex-end' }}>
        {mockReceivedBubble('Hey! How are you? 👋')}
        {mockSentBubble("I'm great, thanks! 😊")}
        {mockSentBubble('What about you? 🎉')}
      </View>

      {/* PREVIEW badge */}
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

  const load         = useChatThemeStore(s => s.load);
  const setBubbleColor = useChatThemeStore(s => s.setBubbleColor);
  const setWallpaper = useChatThemeStore(s => s.setWallpaper);
  const getBubbleColor = useChatThemeStore(s => s.getBubbleColor);
  const getWallpaper = useChatThemeStore(s => s.getWallpaper);
  const resetTheme   = useChatThemeStore(s => s.resetTheme);

  // Local state mirrors the store so preview is instant
  const [bubbleColor, setBubbleColorLocal] = useState('');
  const [wallpaper, setWallpaperLocal] = useState<ChatWallpaper>({ type: 'none', value: '' });

  // Custom hex input sheet
  const [hexVisible, setHexVisible] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => {
    load().then(() => {
      setBubbleColorLocal(getBubbleColor(chatId));
      setWallpaperLocal(getWallpaper(chatId));
    });
  }, [chatId]);

  // Sheet animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: hexVisible ? 0 : SCREEN_HEIGHT, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: hexVisible ? 1 : 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [hexVisible]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSelectBubble = useCallback((color: string | null) => {
    const c = color ?? '';
    setBubbleColorLocal(c);
    setBubbleColor(chatId, c).catch(() => {});
  }, [chatId, setBubbleColor]);

  const handleApplyHex = useCallback(() => {
    const hex = hexInput.trim().startsWith('#') ? hexInput.trim() : `#${hexInput.trim()}`;
    if (/^#([0-9A-Fa-f]{6})$/.test(hex)) {
      setBubbleColorLocal(hex);
      setBubbleColor(chatId, hex).catch(() => {});
      setHexVisible(false);
    }
  }, [hexInput, chatId, setBubbleColor]);

  const handleSelectWallpaper = useCallback((wp: ChatWallpaper) => {
    setWallpaperLocal(wp);
    setWallpaper(chatId, wp).catch(() => {});
  }, [chatId, setWallpaper]);

  const handlePickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    setPickerLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.9, allowsEditing: false });
      if (!result.canceled && result.assets[0]) {
        const wp: ChatWallpaper = { type: 'image', value: result.assets[0].uri };
        setWallpaperLocal(wp);
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Chat Theme</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{name}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Preview ── */}
        <View style={styles.section}>
          <ChatPreview bubbleColor={bubbleColor} wallpaper={wallpaper} Colors={Colors} isDark={isDark} />
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
                  <TouchableOpacity
                    key={preset.id}
                    style={styles.swatchItem}
                    onPress={() => handleSelectBubble(preset.color)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.swatch, { backgroundColor: swatchColor }, selected && styles.swatchSelected]}>
                      {selected && <Feather name="check" size={14} color="#FFF" />}
                    </View>
                    <Text style={[styles.swatchLabel, selected && { color: Colors.textPrimary, fontWeight: '600' }]}>{preset.label}</Text>
                  </TouchableOpacity>
                );
              })}
              {/* Custom color */}
              <TouchableOpacity style={styles.swatchItem} onPress={() => { setHexInput(bubbleColor.replace('#', '')); setHexVisible(true); }} activeOpacity={0.75}>
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
                const selected = isWallpaperSelected(preset);
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={styles.wallpaperItem}
                    onPress={() => handleSelectWallpaper({ type: preset.type, value: preset.value })}
                    activeOpacity={0.75}
                  >
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

              {/* Photo library */}
              <TouchableOpacity style={styles.wallpaperItem} onPress={handlePickPhoto} disabled={pickerLoading} activeOpacity={0.75}>
                <View style={[styles.wallpaperSwatch, wallpaper.type === 'image' && styles.wallpaperSwatchSelected, styles.wallpaperPhotoBtn]}>
                  {wallpaper.type === 'image' && wallpaper.value ? (
                    <>
                      <Image source={{ uri: wallpaper.value }} style={[StyleSheet.absoluteFill, { borderRadius: 10 }]} resizeMode="cover" />
                      <View style={styles.wallpaperCheck}>
                        <Feather name="check" size={11} color="#fff" />
                      </View>
                    </>
                  ) : pickerLoading ? (
                    <ActivityIndicator size="small" color={Colors.textSecondary} />
                  ) : (
                    <>
                      <Feather name="image" size={22} color={Colors.textSecondary} />
                    </>
                  )}
                </View>
                <Text style={[styles.wallpaperLabel, wallpaper.type === 'image' && { color: Colors.textPrimary, fontWeight: '600' }]}>
                  {wallpaper.type === 'image' ? 'Custom' : 'Photos'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
            <Text style={styles.sheetDesc}>Enter a hex color code (e.g. #6C63FF)</Text>
            <View style={styles.hexInputRow}>
              <Text style={styles.hexHash}>#</Text>
              <TextInput
                style={styles.hexInput}
                value={hexInput}
                onChangeText={v => setHexInput(v.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6))}
                placeholder="6C63FF"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="characters"
                maxLength={6}
                autoFocus={hexVisible}
              />
              {hexInput.length === 6 && (
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `#${hexInput}`, marginLeft: Spacing.sm }} />
              )}
            </View>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetBtnCancel} onPress={() => setHexVisible(false)} activeOpacity={0.8}>
                <Text style={styles.sheetBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetBtnApply, hexInput.length !== 6 && styles.sheetBtnDisabled]}
                onPress={handleApplyHex}
                disabled={hexInput.length !== 6}
                activeOpacity={0.8}
              >
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

    // Bubble swatches
    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    swatchItem: { alignItems: 'center', width: 60, paddingVertical: 6 },
    swatch: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
    swatchSelected: { borderWidth: 3, borderColor: Colors.textPrimary },
    swatchCustom: { backgroundColor: isDark ? Colors.background : '#F3F4F6', borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' },
    swatchLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', fontSize: 10 },

    // Wallpaper swatches
    wallpaperScroll: { gap: Spacing.sm, paddingVertical: 4 },
    wallpaperItem: { alignItems: 'center', width: 72 },
    wallpaperSwatch: { width: 68, height: 100, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', marginBottom: 5, position: 'relative' },
    wallpaperSwatchSelected: { borderColor: Colors.primary },
    wallpaperNoneInner: { flex: 1, backgroundColor: isDark ? Colors.surface : '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
    wallpaperNoneLine: { width: 30, height: 2, backgroundColor: Colors.border, transform: [{ rotate: '45deg' }] },
    wallpaperCheck: { position: 'absolute', bottom: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    wallpaperPhotoBtn: { backgroundColor: isDark ? Colors.surface : '#F3F4F6', borderStyle: 'dashed', borderColor: Colors.border },
    wallpaperLabel: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', fontSize: 10 },

    // Reset
    resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
    resetBtnText: { ...Typography.body, fontWeight: '600' },

    // Hex sheet
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
    sheet: { backgroundColor: mainBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: 48 },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
    sheetTitle: { ...Typography.h3, color: Colors.textPrimary, textAlign: 'center', marginBottom: 4 },
    sheetDesc: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
    hexInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? Colors.surface : '#F9FAFB', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, marginBottom: Spacing.xl },
    hexHash: { ...Typography.bodyLg, color: Colors.textSecondary, marginRight: 4 },
    hexInput: { flex: 1, ...Typography.bodyLg, color: Colors.textPrimary, paddingVertical: Platform.OS === 'ios' ? 14 : 10 },
    sheetActions: { flexDirection: 'row', gap: Spacing.md },
    sheetBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: isDark ? Colors.surface : '#F3F4F6', alignItems: 'center' },
    sheetBtnCancelText: { ...Typography.button, color: Colors.textPrimary },
    sheetBtnApply: { flex: 1, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
    sheetBtnDisabled: { opacity: 0.4 },
    sheetBtnApplyText: { ...Typography.button, color: Colors.white },
  });
}
