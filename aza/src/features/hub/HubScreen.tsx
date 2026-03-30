import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Image,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../theme';
import { useDisplayContext } from '../../providers/DisplayProvider';
import { RootStackParamList } from '../../navigation/types';
import { MINI_APP_REGISTRY, getMiniApp } from './miniapps/registry';
import { MiniAppCategory, MiniAppEntry } from './miniapps/types';

type HubNavProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

const { width } = Dimensions.get('window');
const GRID_PADDING = Spacing.lg;
const GRID_GAP = Spacing.sm;
const TILE_SIZE = (width - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

const ALL_CATEGORIES: ('All' | MiniAppCategory)[] = [
  'All',
  'Finance',
  'Bills & Utilities',
  'Entertainment',
];

// Simulated recently used — first two apps in registry
const RECENTLY_USED_IDS = ['airtime_data', 'exchange_rates'];

export default function HubScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(Colors), [Colors]);
  const { hubBackground } = useDisplayContext();
  const navigation = useNavigation<HubNavProp>();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | MiniAppCategory>('All');

  const openApp = useCallback((appId: string) => {
    navigation.navigate('MiniApp', { appId });
  }, [navigation]);

  const filteredApps = React.useMemo(() => {
    return MINI_APP_REGISTRY.filter((app) => {
      const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || app.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  const recentlyUsed = React.useMemo(
    () => RECENTLY_USED_IDS.map((id) => getMiniApp(id)).filter(Boolean) as MiniAppEntry[],
    [],
  );

  const showRecently = searchQuery.length === 0 && activeCategory === 'All';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Hero background */}
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={{ uri: hubBackground }}
          style={[StyleSheet.absoluteFill, { height: '55%' }]}
          resizeMode="cover"
        />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header title over the image */}
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>Mini Apps</Text>
          <Text style={styles.heroSubtitle}>Services built into Aza</Text>
        </View>

        {/* Card sheet */}
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Search */}
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                placeholder="Search mini apps..."
                placeholderTextColor={Colors.textSecondary}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search mini apps"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
                  <Feather name="x-circle" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {ALL_CATEGORIES.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setActiveCategory(cat)}
                    accessibilityRole="radio"
                    accessibilityLabel={cat}
                    accessibilityState={{ checked: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Recently used */}
            {showRecently && recentlyUsed.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Recently Used</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentRow}
                >
                  {recentlyUsed.map((app) => (
                    <TouchableOpacity
                      key={app.id}
                      style={styles.recentItem}
                      onPress={() => openApp(app.id)}
                      accessibilityRole="button"
                      accessibilityLabel={app.name}
                    >
                      <View style={[styles.recentIcon, { backgroundColor: app.color }]}>
                        <Text style={styles.recentEmoji}>{app.icon}</Text>
                      </View>
                      <Text style={styles.recentName} numberOfLines={1}>{app.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* All apps grid */}
            <Text style={styles.sectionLabel}>
              {activeCategory === 'All' ? 'All Apps' : activeCategory}
            </Text>

            {filteredApps.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="search" size={32} color={Colors.textSecondary} />
                <Text style={styles.emptyText}>No apps found</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {filteredApps.map((app) => (
                  <AppTile key={app.id} app={app} onPress={openApp} styles={styles} Colors={Colors} />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ── Tile component ── */
interface TileProps {
  app: MiniAppEntry;
  onPress: (id: string) => void;
  styles: ReturnType<typeof createStyles>;
  Colors: ThemeColors;
}

function AppTile({ app, onPress, styles, Colors }: TileProps) {
  return (
    <TouchableOpacity
      style={styles.tile}
      activeOpacity={0.75}
      onPress={() => onPress(app.id)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${app.name}`}
    >
      <View style={[styles.tileIcon, { backgroundColor: app.color }]}>
        <Text style={styles.tileEmoji}>{app.icon}</Text>
      </View>
      <Text style={styles.tileName} numberOfLines={2}>{app.name}</Text>
    </TouchableOpacity>
  );
}

function createStyles(Colors: ThemeColors) {
  const isDark = Colors.isDark;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#174717',
    },
    safeArea: {
      flex: 1,
    },
    heroHeader: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    heroSubtitle: {
      ...Typography.body,
      color: 'rgba(255,255,255,0.75)',
    },
    sheet: {
      flex: 1,
      backgroundColor: isDark ? Colors.background : Colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden',
    },
    scrollContent: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xl * 3,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? Colors.surface : Colors.white,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      height: 48,
      marginBottom: Spacing.md,
    },
    searchIcon: { marginRight: Spacing.sm },
    searchInput: {
      flex: 1,
      ...Typography.body,
      color: Colors.textPrimary,
    },
    chipRow: {
      gap: Spacing.sm,
      paddingBottom: Spacing.sm,
    },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: Colors.border,
      backgroundColor: Colors.surface,
    },
    chipActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    chipText: {
      ...Typography.caption,
      color: Colors.textSecondary,
      fontWeight: '600',
    },
    chipTextActive: {
      color: Colors.secondary,
    },
    sectionLabel: {
      ...Typography.body,
      fontWeight: '700',
      color: Colors.textPrimary,
      marginTop: Spacing.lg,
      marginBottom: Spacing.md,
    },
    recentRow: {
      gap: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    recentItem: {
      alignItems: 'center',
      width: 68,
    },
    recentIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    recentEmoji: { fontSize: 26 },
    recentName: {
      ...Typography.caption,
      color: Colors.textSecondary,
      textAlign: 'center',
      fontWeight: '600',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
    },
    tile: {
      width: TILE_SIZE,
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    tileIcon: {
      width: TILE_SIZE - Spacing.lg,
      height: TILE_SIZE - Spacing.lg,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xs,
    },
    tileEmoji: { fontSize: 32 },
    tileName: {
      ...Typography.caption,
      color: Colors.textPrimary,
      textAlign: 'center',
      fontWeight: '600',
      lineHeight: 16,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing.xl * 2,
      gap: Spacing.md,
    },
    emptyText: {
      ...Typography.body,
      color: Colors.textSecondary,
    },
  });
}
