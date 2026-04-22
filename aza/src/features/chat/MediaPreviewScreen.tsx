import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, TextInput,
  StatusBar, Dimensions, FlatList, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { formatTime } from '../../components/chat/chatTypes';

const { width: SCREEN_W } = Dimensions.get('window');

type MediaItem = { uri: string; type: 'image' | 'video'; caption?: string };

// Header tool icons — visual placeholders
const TOOLS = [
  { icon: 'download', label: 'Save' },
  { icon: 'type', label: 'HD' },
  { icon: 'crop', label: 'Crop' },
  { icon: 'smile', label: 'Sticker' },
  { icon: 'bold', label: 'Text' },
  { icon: 'edit-2', label: 'Draw' },
] as const;

export function MediaPreviewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MediaPreview'>>();
  const { recipientName, chatId, source } = route.params;
  const insets = useSafeAreaInsets();

  const [media, setMedia] = useState<MediaItem[]>(
    route.params.media.map(m => ({ ...m, caption: '' })),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const activeCaption = media[activeIndex]?.caption ?? '';

  // ---------------------------------------------------------------------------
  // Caption per image
  // ---------------------------------------------------------------------------
  const updateCaption = useCallback((text: string) => {
    setMedia(prev => prev.map((m, i) => (i === activeIndex ? { ...m, caption: text } : m)));
  }, [activeIndex]);

  // ---------------------------------------------------------------------------
  // Add more images
  // ---------------------------------------------------------------------------
  const handleAddMore = useCallback(async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos', 'livePhotos'] as ImagePicker.MediaType[],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 10,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newItems: MediaItem[] = result.assets.map(a => ({
        uri: a.uri,
        type: (a.type === 'video' ? 'video' : 'image') as 'image' | 'video',
        caption: '',
      }));
      setMedia(prev => [...prev, ...newItems]);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Send all media back to chat
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(() => {
    if (media.length === 0) return;
    // Navigate back to ChatScreen with the media payload via params
    navigation.navigate('ChatScreen', {
      id: chatId,
      name: recipientName,
      avatar: '',
      online: false,
      // @ts-expect-error — extending params for media return
      sentMedia: media.map(m => ({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
        text: m.caption || (m.type === 'video' ? 'Video' : 'Photo'),
        sender: 'me' as const,
        time: formatTime(),
        timestamp: Date.now(),
        status: 'sent' as const,
        type: 'image' as const,
        uri: m.uri,
        caption: m.caption || undefined,
      })),
    });
  }, [media, navigation, chatId, recipientName]);

  // ---------------------------------------------------------------------------
  // Tool tap — placeholder
  // ---------------------------------------------------------------------------
  const handleToolTap = useCallback((label: string) => {
    Alert.alert(label, 'Coming soon');
  }, []);

  // ---------------------------------------------------------------------------
  // Pager callback
  // ---------------------------------------------------------------------------
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const idx = viewableItems[0]?.index;
    if (idx != null) setActiveIndex(idx);
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // ---------------------------------------------------------------------------
  // Render media item
  // ---------------------------------------------------------------------------
  const renderMediaItem = useCallback(({ item }: { item: MediaItem }) => (
    <View style={styles.mediaPage}>
      <Image source={{ uri: item.uri }} style={styles.mediaImage} resizeMode="contain" />
    </View>
  ), []);

  const keyExtractor = useCallback((_: MediaItem, i: number) => `media-${i}`, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const content = (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

      {/* Media pager */}
      <FlatList
        ref={flatListRef}
        data={media}
        renderItem={renderMediaItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.pager}
      />

      {/* Header tools */}
      <View style={[styles.headerBar, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Feather name="x" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.toolsRow}>
          {TOOLS.map(tool => (
            <TouchableOpacity
              key={tool.label}
              style={styles.headerBtn}
              onPress={() => handleToolTap(tool.label)}
              activeOpacity={0.7}
            >
              <Feather name={tool.icon as any} size={22} color="#fff" />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        {/* Page indicator dots */}
        {media.length > 1 && (
          <View style={styles.dotsRow}>
            {media.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeIndex && styles.dotActive]}
              />
            ))}
          </View>
        )}

        {/* Caption input */}
        <View style={styles.captionRow}>
          <TouchableOpacity style={styles.addMoreBtn} onPress={handleAddMore} activeOpacity={0.7}>
            <Feather name="plus-square" size={22} color="#aaa" />
          </TouchableOpacity>
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption..."
            placeholderTextColor="#888"
            value={activeCaption}
            onChangeText={updateCaption}
            multiline
            maxLength={500}
          />
          {media.length > 1 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{activeIndex + 1}/{media.length}</Text>
            </View>
          )}
        </View>

        {/* Recipient + Send */}
        <View style={styles.sendRow}>
          <View style={styles.recipientPill}>
            <Text style={styles.recipientText} numberOfLines={1}>{recipientName}</Text>
          </View>
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.8}>
            <Feather name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        {content}
      </KeyboardAvoidingView>
    );
  }

  return content;
}

// =============================================================================
// Styles
// =============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Pager
  pager: {
    flex: 1,
  },
  mediaPage: {
    width: SCREEN_W,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaImage: {
    width: SCREEN_W,
    height: '100%',
  },

  // Page dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Header
  headerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },

  // Caption row
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  addMoreBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    maxHeight: 80,
    paddingVertical: 0,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Send row
  sendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipientPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: SCREEN_W * 0.6,
  },
  recipientText: {
    color: '#ddd',
    fontSize: 14,
    fontWeight: '500',
  },
  sendBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#174717',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
