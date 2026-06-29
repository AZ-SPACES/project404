import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView,
  DeviceEventEmitter, Image, Alert, FlatList, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme, ThemeColors, Typography, Spacing, Radius } from '../../../theme';
import { formatBytes, StorageDetails, Message, CategoryStats } from '../../../components/chat/chatTypes';
import { RootStackParamList } from '../../../navigation/types';
import { BackButton } from '../../../components/ui/BackButton';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 6;
const GRID_COLS = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

type SortKey = 'date' | 'size';
type ViewMode = 'list' | 'grid';
type CategoryKey = 'photos' | 'videos' | 'docs' | 'audio';

type ManageStorageRouteProp = RouteProp<RootStackParamList, 'ManageStorage'> & {
  params: { storageStats?: StorageDetails };
};

// ─── Recursive directory size ─────────────────────────────────────────────────

async function getDirSize(dirUri: string | null): Promise<number> {
  if (!dirUri) return 0;
  try {
    const children = await FileSystem.readDirectoryAsync(dirUri);
    const uri = dirUri.endsWith('/') ? dirUri : `${dirUri}/`;
    const sizes = await Promise.all(
      children.map(async (name) => {
        const childUri = `${uri}${name}`;
        const info = await FileSystem.getInfoAsync(childUri);
        if (!info.exists) return 0;
        if (info.isDirectory) return getDirSize(`${childUri}/`);
        return info.size;
      }),
    );
    return sizes.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManageStorageScreen() {
  const { colors: Colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(Colors, isDark), [Colors, isDark]);
  const navigation = useNavigation();
  const route = useRoute<ManageStorageRouteProp>();

  // ── Device / app storage state ──────────────────────────────────────────────
  const [deviceTotal, setDeviceTotal] = useState(0);
  const [deviceFree, setDeviceFree] = useState(0);
  const [docSize, setDocSize] = useState(0);
  const [cacheSize, setCacheSize] = useState(0);
  const [loadingDevice, setLoadingDevice] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    Promise.all([
      FileSystem.getTotalDiskCapacityAsync(),
      FileSystem.getFreeDiskStorageAsync(),
      getDirSize(FileSystem.documentDirectory),
      getDirSize(FileSystem.cacheDirectory),
    ])
      .then(([total, free, doc, cache]) => {
        setDeviceTotal(total);
        setDeviceFree(free);
        setDocSize(doc);
        setCacheSize(cache);
      })
      .catch(() => {})
      .finally(() => setLoadingDevice(false));
  }, []);

  const appTotal = docSize + cacheSize;
  const deviceUsed = deviceTotal - deviceFree;
  const otherUsed = Math.max(0, deviceUsed - appTotal);
  const appPct = deviceTotal > 0 ? (appTotal / deviceTotal) * 100 : 0;
  const otherPct = deviceTotal > 0 ? (otherUsed / deviceTotal) * 100 : 0;
  const freePct = Math.max(0, 100 - appPct - otherPct);

  const handleClearCache = useCallback(async () => {
    if (!FileSystem.cacheDirectory) return;
    Alert.alert(
      'Clear cache',
      `Free up ${formatBytes(cacheSize)} of temporary files? The app will re-download them when needed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearingCache(true);
            try {
              const children = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory!);
              await Promise.all(
                children.map(name =>
                  FileSystem.deleteAsync(`${FileSystem.cacheDirectory!}${name}`, { idempotent: true }),
                ),
              );
              setCacheSize(0);
            } catch {
              Alert.alert('Error', 'Could not fully clear the cache.');
            } finally {
              setClearingCache(false);
            }
          },
        },
      ],
    );
  }, [cacheSize]);

  // ── Chat media state ─────────────────────────────────────────────────────────
  const [chatStats, setChatStats] = useState<StorageDetails>(
    route.params?.storageStats ?? {
      photos: { size: 0, messages: [] },
      videos: { size: 0, messages: [] },
      docs:   { size: 0, messages: [] },
      audio:  { size: 0, messages: [] },
      totalSize: 0,
    },
  );
  const hasChatMedia = chatStats.totalSize > 0;

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const STORAGE_DATA = useMemo(() => [
    { key: 'photos' as CategoryKey, label: 'Photos',      category: chatStats.photos, color: '#6366F1' },
    { key: 'videos' as CategoryKey, label: 'Videos',      category: chatStats.videos, color: '#0EA5E9' },
    { key: 'docs'   as CategoryKey, label: 'Documents',   category: chatStats.docs,   color: '#F59E0B' },
    { key: 'audio'  as CategoryKey, label: 'Voice Notes', category: chatStats.audio,  color: '#10B981' },
  ], [chatStats]);

  const sortMessages = useCallback((msgs: Message[]) => {
    return [...msgs].sort((a, b) =>
      sortKey === 'size'
        ? ((b.resolvedSize ?? b.fileSize ?? 0) - (a.resolvedSize ?? a.fileSize ?? 0))
        : (b.timestamp - a.timestamp),
    );
  }, [sortKey]);

  // ── Chat media delete helpers ─────────────────────────────────────────────────
  const removeIds = useCallback((ids: string[]) => {
    DeviceEventEmitter.emit('clear_media_messages', ids);
    setChatStats(prev => {
      const next = { ...prev };
      let removedTotal = 0;
      for (const k of ['photos', 'videos', 'docs', 'audio'] as CategoryKey[]) {
        const before = next[k].messages;
        const after = before.filter(m => !ids.includes(m.id));
        const removedSize = before
          .filter(m => ids.includes(m.id))
          .reduce((s, m) => s + (m.resolvedSize ?? m.fileSize ?? 0), 0);
        removedTotal += removedSize;
        next[k] = { size: Math.max(0, next[k].size - removedSize), messages: after };
      }
      return { ...next, totalSize: Math.max(0, next.totalSize - removedTotal) };
    });
    setSelected(new Set());
    setSelectMode(false);
  }, []);

  const handleDeleteFile = useCallback((msgId: string) => removeIds([msgId]), [removeIds]);

  const handleClearCategory = useCallback((key: CategoryKey, cat: CategoryStats) => {
    if (cat.messages.length === 0) return;
    const label = key === 'docs' ? 'Documents' : key.charAt(0).toUpperCase() + key.slice(1);
    Alert.alert(
      `Clear ${label}`,
      `Delete all ${cat.messages.length} file${cat.messages.length !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          removeIds(cat.messages.map(m => m.id));
          if (expandedCategory === key) setExpandedCategory(null);
        }},
      ],
    );
  }, [removeIds, expandedCategory]);

  const handleClearAllChatMedia = useCallback(() => {
    const count = STORAGE_DATA.reduce((s, d) => s + d.category.messages.length, 0);
    if (count === 0) return;
    Alert.alert(
      'Clear all chat media',
      `Delete all ${count} file${count !== 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => {
          removeIds(STORAGE_DATA.flatMap(d => d.category.messages.map(m => m.id)));
          setExpandedCategory(null);
        }},
      ],
    );
  }, [STORAGE_DATA, removeIds]);

  const handleBulkDelete = useCallback(() => {
    if (selected.size === 0) return;
    Alert.alert(
      `Delete ${selected.size} file${selected.size !== 1 ? 's' : ''}`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeIds([...selected]) },
      ],
    );
  }, [selected, removeIds]);

  const handleDownload = useCallback(async (msg: Message) => {
    if (!msg.uri) return;
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Allow media access to save files.');
      return;
    }
    try {
      await MediaLibrary.saveToLibraryAsync(msg.uri);
      Alert.alert('Saved', 'File saved to your photo library.');
    } catch {
      Alert.alert('Failed', 'Could not save the file.');
    }
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }, []);

  const enterSelectMode = useCallback((id: string) => {
    setSelectMode(true);
    setSelected(new Set([id]));
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────────
  const renderThumb = (msg: Message, size = 40) => {
    if ((msg.type === 'image' || msg.type === 'video') && msg.uri) {
      return (
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: msg.uri }} style={{ width: size, height: size, borderRadius: Radius.md }} />
          {msg.type === 'video' && (
            <View style={styles.videoOverlay}>
              <Feather name="play" size={9} color="#fff" />
            </View>
          )}
        </View>
      );
    }
    const icon = msg.type === 'audio' ? 'mic' : 'file-text';
    return (
      <View style={{ width: size, height: size, borderRadius: Radius.md, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon as any} size={size * 0.4} color={Colors.primary} />
      </View>
    );
  };

  const renderListRow = (msg: Message, key: CategoryKey) => {
    const isSel = selected.has(msg.id);
    const canDl = (msg.type === 'image' || msg.type === 'video') && !!msg.uri;
    return (
      <TouchableOpacity
        key={msg.id}
        style={[styles.fileRow, isSel && styles.fileRowSelected]}
        onPress={() => selectMode ? toggleSelect(msg.id) : undefined}
        onLongPress={() => !selectMode && enterSelectMode(msg.id)}
        activeOpacity={0.7}
      >
        {selectMode && (
          <View style={[styles.checkbox, isSel && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
            {isSel && <Feather name="check" size={12} color="#fff" />}
          </View>
        )}
        {renderThumb(msg)}
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {msg.fileName || msg.text || `${key.charAt(0).toUpperCase() + key.slice(1)} file`}
          </Text>
          <Text style={styles.fileMeta}>
            {new Date(msg.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}{formatBytes(msg.resolvedSize ?? msg.fileSize ?? 0)}
          </Text>
        </View>
        {!selectMode && (
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {canDl && (
              <TouchableOpacity onPress={() => handleDownload(msg)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.fileBtn}>
                <Feather name="download" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => handleDeleteFile(msg.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.fileBtn}>
              <Feather name="trash-2" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderGridItem = useCallback(({ item: msg }: { item: Message }) => {
    const isSel = selected.has(msg.id);
    return (
      <TouchableOpacity
        style={[styles.gridItem, isSel && styles.gridItemSel]}
        onPress={() => selectMode ? toggleSelect(msg.id) : undefined}
        onLongPress={() => !selectMode && enterSelectMode(msg.id)}
        activeOpacity={0.85}
      >
        {renderThumb(msg, GRID_ITEM_SIZE)}
        {isSel && (
          <View style={styles.gridCheck}>
            <Feather name="check" size={13} color="#fff" />
          </View>
        )}
        <Text style={styles.gridSize} numberOfLines={1}>
          {formatBytes(msg.resolvedSize ?? msg.fileSize ?? 0)}
        </Text>
      </TouchableOpacity>
    );
  }, [selected, selectMode, toggleSelect, enterSelectMode, styles]);

  const mediaMessages = useMemo(() =>
    sortMessages([...chatStats.photos.messages, ...chatStats.videos.messages]),
  [chatStats.photos.messages, chatStats.videos.messages, sortMessages]);

  const showGrid = viewMode === 'grid' && mediaMessages.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={Colors.background} />

      {/* Header */}
      {selectMode ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setSelectMode(false); setSelected(new Set()); }} style={styles.hBtn}>
            <Feather name="x" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selected.size} selected</Text>
          <TouchableOpacity onPress={handleBulkDelete} disabled={selected.size === 0} style={styles.hBtn}>
            <Feather name="trash-2" size={20} color={selected.size > 0 ? '#EF4444' : Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Storage</Text>
          <View style={{ width: 44 }} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Device storage ─────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>DEVICE STORAGE</Text>
        <View style={styles.card}>
          {loadingDevice ? (
            <View style={{ paddingVertical: Spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={[styles.hint, { marginTop: Spacing.sm }]}>Reading storage…</Text>
            </View>
          ) : (
            <>
              {/* Numbers row */}
              <View style={styles.storageNumbers}>
                <View style={styles.storageNumItem}>
                  <Text style={styles.storageNumVal}>{formatBytes(deviceTotal)}</Text>
                  <Text style={styles.storageNumLabel}>Total</Text>
                </View>
                <View style={styles.storageNumItem}>
                  <Text style={[styles.storageNumVal, { color: Colors.primary }]}>{formatBytes(deviceFree)}</Text>
                  <Text style={styles.storageNumLabel}>Available</Text>
                </View>
                <View style={styles.storageNumItem}>
                  <Text style={[styles.storageNumVal, { color: '#F59E0B' }]}>{formatBytes(deviceUsed)}</Text>
                  <Text style={styles.storageNumLabel}>Used</Text>
                </View>
              </View>

              {/* Segmented bar */}
              {deviceTotal > 0 && (
                <View style={styles.storageBar}>
                  {appPct > 0.5 && (
                    <View style={[styles.barSeg, { width: `${appPct}%`, backgroundColor: Colors.primary, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
                  )}
                  {otherPct > 0.5 && (
                    <View style={[styles.barSeg, { width: `${otherPct}%`, backgroundColor: isDark ? '#475569' : '#94A3B8' }]} />
                  )}
                  {freePct > 0.5 && (
                    <View style={[styles.barSeg, { width: `${freePct}%`, backgroundColor: isDark ? '#1E293B' : '#E2E8F0', borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
                  )}
                </View>
              )}

              {/* Legend */}
              <View style={styles.barLegend}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                  <Text style={styles.legendText}>AZA  </Text>
                  <Text style={styles.legendVal}>{formatBytes(appTotal)}</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: isDark ? '#475569' : '#94A3B8' }]} />
                  <Text style={styles.legendText}>System & other  </Text>
                  <Text style={styles.legendVal}>{formatBytes(otherUsed)}</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: isDark ? '#334155' : '#E2E8F0', borderWidth: 1, borderColor: Colors.border }]} />
                  <Text style={styles.legendText}>Free  </Text>
                  <Text style={styles.legendVal}>{formatBytes(deviceFree)}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── App storage breakdown ───────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>AZA STORAGE</Text>
        <View style={styles.card}>
          {/* Documents */}
          <View style={styles.appRow}>
            <View style={[styles.appIcon, { backgroundColor: '#6366F122' }]}>
              <Feather name="folder" size={18} color="#6366F1" />
            </View>
            <View style={styles.appRowInfo}>
              <Text style={styles.appRowLabel}>Documents & data</Text>
              <Text style={styles.appRowSub}>Messages, contacts, settings</Text>
            </View>
            <Text style={styles.appRowSize}>{formatBytes(docSize)}</Text>
          </View>

          <View style={styles.rowDivider} />

          {/* Cache */}
          <View style={styles.appRow}>
            <View style={[styles.appIcon, { backgroundColor: '#F59E0B22' }]}>
              <Feather name="archive" size={18} color="#F59E0B" />
            </View>
            <View style={styles.appRowInfo}>
              <Text style={styles.appRowLabel}>Cache</Text>
              <Text style={styles.appRowSub}>Temporary files, media previews</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.appRowSize}>{formatBytes(cacheSize)}</Text>
              {cacheSize > 0 && (
                <TouchableOpacity onPress={handleClearCache} disabled={clearingCache}>
                  {clearingCache
                    ? <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 2 }} />
                    : <Text style={[styles.clearLink, { color: Colors.primary }]}>Clear</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.rowDivider} />

          {/* Total */}
          <View style={[styles.appRow, { paddingBottom: 0 }]}>
            <View style={[styles.appIcon, { backgroundColor: Colors.primary + '22' }]}>
              <Feather name="smartphone" size={18} color={Colors.primary} />
            </View>
            <View style={styles.appRowInfo}>
              <Text style={[styles.appRowLabel, { fontWeight: '700' }]}>Total app size</Text>
            </View>
            <Text style={[styles.appRowSize, { fontWeight: '700', color: Colors.textPrimary }]}>
              {formatBytes(appTotal)}
            </Text>
          </View>
        </View>

        {/* ── Chat media (from passed storageStats) ───────────────────────── */}
        {(hasChatMedia || route.params?.storageStats !== undefined) && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>CHAT MEDIA</Text>
              {hasChatMedia && (
                <TouchableOpacity onPress={handleClearAllChatMedia}>
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>

            {!hasChatMedia ? (
              <View style={styles.card}>
                <View style={styles.emptyRow}>
                  <Feather name="image" size={28} color={Colors.textSecondary} />
                  <Text style={styles.emptyRowText}>No media in this chat</Text>
                </View>
              </View>
            ) : (
              <>
                {/* Toolbar */}
                <View style={styles.toolbar}>
                  <View style={styles.sortRow}>
                    <Text style={styles.toolbarLabel}>Sort</Text>
                    {(['date', 'size'] as SortKey[]).map(s => (
                      <TouchableOpacity key={s} style={[styles.chip, sortKey === s && styles.chipActive]} onPress={() => setSortKey(s)}>
                        <Text style={[styles.chipText, sortKey === s && { color: Colors.secondary }]}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.viewToggle}>
                    {(['list', 'grid'] as ViewMode[]).map(m => (
                      <TouchableOpacity key={m} style={[styles.viewBtn, viewMode === m && styles.viewBtnActive]} onPress={() => setViewMode(m)}>
                        <Feather name={m as any} size={16} color={viewMode === m ? Colors.primary : Colors.textSecondary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Photo/Video grid */}
                {showGrid && (
                  <View style={[styles.card, { marginBottom: Spacing.md }]}>
                    <FlatList
                      data={mediaMessages}
                      renderItem={renderGridItem}
                      keyExtractor={m => m.id}
                      numColumns={GRID_COLS}
                      columnWrapperStyle={{ gap: GRID_GAP }}
                      ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
                      scrollEnabled={false}
                    />
                  </View>
                )}

                {/* Category list */}
                <View style={styles.listCard}>
                  {STORAGE_DATA.map((item, idx) => {
                    const open = expandedCategory === item.key;
                    const sorted = sortMessages(item.category.messages);
                    return (
                      <React.Fragment key={item.key}>
                        <TouchableOpacity
                          style={styles.catRow}
                          activeOpacity={0.7}
                          onPress={() => setExpandedCategory(prev => prev === item.key ? null : item.key)}
                        >
                          <View style={styles.catLeft}>
                            <View style={[styles.catDot, { backgroundColor: item.color }]} />
                            <View>
                              <Text style={styles.catLabel}>{item.label}</Text>
                              <Text style={styles.catCount}>{item.category.messages.length} file{item.category.messages.length !== 1 ? 's' : ''}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                            <Text style={styles.catSize}>{formatBytes(item.category.size)}</Text>
                            {item.category.messages.length > 0 && (
                              <Feather name={open ? 'chevron-up' : 'chevron-down'} size={17} color={Colors.textSecondary} />
                            )}
                          </View>
                        </TouchableOpacity>

                        {open && sorted.length > 0 && (
                          <View style={styles.expandedContent}>
                            {sorted.map(msg => renderListRow(msg, item.key))}
                            <TouchableOpacity
                              style={styles.clearCatBtn}
                              onPress={() => handleClearCategory(item.key, item.category)}
                            >
                              <Feather name="trash-2" size={14} color="#EF4444" style={{ marginRight: 6 }} />
                              <Text style={styles.clearCatText}>Clear {item.label}</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {idx < STORAGE_DATA.length - 1 && <View style={styles.divider} />}
                      </React.Fragment>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (Colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerTitle: { ...Typography.bodyLg, fontWeight: '600', color: Colors.textPrimary },
  hBtn: { padding: 4, width: 44, alignItems: 'center' },
  scroll: { paddingHorizontal: Spacing.lg },

  sectionLabel: {
    ...Typography.caption, fontWeight: '700', color: Colors.textSecondary,
    letterSpacing: 0.6, marginBottom: Spacing.sm, marginTop: Spacing.lg, marginLeft: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.lg, marginBottom: Spacing.sm },
  clearAllText: { ...Typography.caption, fontWeight: '600', color: '#EF4444' },

  card: {
    backgroundColor: isDark ? Colors.surface : Colors.white,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: 2,
  },

  // Device storage numbers
  storageNumbers: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.lg },
  storageNumItem: { alignItems: 'center' },
  storageNumVal: { ...Typography.h3, fontWeight: '700', color: Colors.textPrimary },
  storageNumLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  // Storage bar
  storageBar: {
    height: 14, borderRadius: 7, flexDirection: 'row',
    overflow: 'hidden', backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
    marginBottom: Spacing.md,
  },
  barSeg: { height: '100%' },
  barLegend: { gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  legendVal: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600' },

  // App rows
  appRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  appIcon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  appRowInfo: { flex: 1 },
  appRowLabel: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  appRowSub: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
  appRowSize: { ...Typography.body, color: Colors.textSecondary, fontWeight: '500' },
  rowDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  clearLink: { ...Typography.caption, fontWeight: '600', marginTop: 2 },
  hint: { ...Typography.caption, color: Colors.textSecondary },

  // Toolbar
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  toolbarLabel: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.caption, fontWeight: '600', color: Colors.textSecondary, fontSize: 12 },
  viewToggle: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  viewBtn: { padding: 7 },
  viewBtnActive: { backgroundColor: Colors.primary + '22' },

  // Grid
  gridItem: { width: GRID_ITEM_SIZE, borderRadius: Radius.md, overflow: 'hidden', position: 'relative' },
  gridItemSel: { borderWidth: 2.5, borderColor: Colors.primary },
  gridCheck: {
    position: 'absolute', top: 5, right: 5,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  gridSize: { ...Typography.caption, fontSize: 10, color: Colors.textSecondary, textAlign: 'center', marginTop: 3 },
  videoOverlay: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 3,
  },

  // Category list
  listCard: {
    backgroundColor: isDark ? Colors.surface : Colors.white,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  catLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  catDot: { width: 12, height: 12, borderRadius: 6 },
  catLabel: { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  catCount: { ...Typography.caption, color: Colors.textSecondary, fontSize: 11, marginTop: 1 },
  catSize: { ...Typography.body, color: Colors.textSecondary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: Spacing.md + 12 + Spacing.md },

  expandedContent: {
    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  fileRowSelected: { backgroundColor: Colors.primary + '12' },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  fileInfo: { flex: 1, marginLeft: Spacing.sm },
  fileName: { ...Typography.body, fontSize: 14, color: Colors.textPrimary },
  fileMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  fileBtn: { padding: 4 },
  clearCatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md, paddingVertical: Spacing.sm, backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)', borderRadius: Radius.md },
  clearCatText: { ...Typography.body, fontSize: 14, fontWeight: '600', color: '#EF4444' },

  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  emptyRowText: { ...Typography.body, color: Colors.textSecondary },
});
