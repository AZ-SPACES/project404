import React, { memo, useState, useCallback, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@react-native-vector-icons/feather';
import { useAppTheme } from '../../theme';

const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY || '';
const COLS = 3;
const { width: W } = Dimensions.get('window');
const TILE = (W - 48) / COLS;

type StickerItem = { id: string; url: string; preview: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
};

export const StickerPickerModal = memo(function StickerPickerModal({ visible, onClose, onSelect }: Props) {
  const { colors: Colors, isDark } = useAppTheme();
  const [query, setQuery] = useState('');
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const endpoint = q.trim()
        ? `https://api.giphy.com/v1/stickers/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g`
        : `https://api.giphy.com/v1/stickers/trending?api_key=${GIPHY_KEY}&limit=24&rating=g`;
      const res = await fetch(endpoint);
      const json = await res.json();
      const items: StickerItem[] = (json.data ?? []).map((g: any) => ({
        id: g.id,
        url: g.images?.original?.url ?? '',
        preview: g.images?.fixed_height_small?.url ?? g.images?.original?.url ?? '',
      }));
      setStickers(items);
    } catch {
      setStickers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 400);
  }, [search]);

  const handleOpen = useCallback(() => {
    setQuery('');
    search('');
  }, [search]);

  const renderItem = useCallback(({ item }: { item: StickerItem }) => (
    <TouchableOpacity
      onPress={() => { onSelect(item.url); onClose(); }}
      activeOpacity={0.8}
      style={styles.tile}
    >
      <Image
        source={{ uri: item.preview }}
        style={styles.sticker}
        resizeMode="contain"
      />
    </TouchableOpacity>
  ), [onSelect, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View style={[styles.sheet, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors.textPrimary }]}>Stickers</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={[styles.searchRow, { backgroundColor: isDark ? Colors.surface : '#F3F4F6', borderColor: Colors.border }]}>
          <Feather name="search" size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.input, { color: Colors.textPrimary }]}
            placeholder="Search stickers…"
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={handleChangeText}
            autoCapitalize="none"
          />
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
        ) : (
          <FlatList
            data={stickers}
            keyExtractor={(item) => item.id}
            numColumns={COLS}
            renderItem={renderItem}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: Colors.textSecondary }]}>
                {query ? 'No stickers found' : 'Start typing to search'}
              </Text>
            }
          />
        )}
        <Text style={[styles.powered, { color: Colors.textSecondary }]}>Powered by GIPHY</Text>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    marginTop: 80,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 17, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 15 },
  grid: { paddingHorizontal: 12, paddingBottom: 24, gap: 4 },
  tile: { flex: 1, margin: 4, borderRadius: 8, overflow: 'hidden', aspectRatio: 1 },
  sticker: { width: TILE - 8, height: TILE - 8 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  powered: { textAlign: 'center', fontSize: 11, paddingBottom: 12 },
});
