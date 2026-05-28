import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, TextInput,
  StatusBar, Dimensions, FlatList, Alert, Platform, KeyboardAvoidingView,
  DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@react-native-vector-icons/feather';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { formatTime } from '../../../components/chat/chatTypes';

import { ColorPalette } from '../../../components/chat/media/ColorPalette';
import { DrawingCanvas, DrawnPath } from '../../../components/chat/media/DrawingCanvas';
import { TextOverlay, TextLabel } from '../../../components/chat/media/TextOverlay';
import { CropOverlay } from '../../../components/chat/media/CropOverlay';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_W } = Dimensions.get('window');

type MediaItem = { uri: string; type: 'image' | 'video'; caption?: string };
type EditMode = null | 'draw' | 'text' | 'crop';

// Header tool definitions — "bold" removed per requirements
const TOOLS = [
  { icon: 'download', label: 'Save' },
  { icon: 'crop', label: 'Crop' },
  { icon: 'smile', label: 'Sticker' },
  { icon: 'type', label: 'Text' },
  { icon: 'edit-2', label: 'Draw' },
] as const;

// Per-image editing state
type ImageEdits = {
  drawPaths: DrawnPath[];
  textLabels: TextLabel[];
};

export default function MediaPreviewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'MediaPreview'>>();
  const { recipientName, chatId, source } = route.params;
  const insets = useSafeAreaInsets();

  const [media, setMedia] = useState<MediaItem[]>(
    route.params.media.map(m => ({ ...m, caption: '' })),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const compositeRef = useRef<View>(null);

  // Editing state
  const [activeMode, setActiveMode] = useState<EditMode>(null);
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [showTextInput, setShowTextInput] = useState(false);

  // Per-image edits map (keyed by index)
  const [editsMap, setEditsMap] = useState<Record<number, ImageEdits>>({});
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({ writeOnly: true });

  const currentEdits = useMemo<ImageEdits>(
    () => editsMap[activeIndex] ?? { drawPaths: [], textLabels: [] },
    [editsMap, activeIndex],
  );

  const updateEdits = useCallback((updater: (prev: ImageEdits) => ImageEdits) => {
    setEditsMap(prev => ({
      ...prev,
      [activeIndex]: updater(prev[activeIndex] ?? { drawPaths: [], textLabels: [] }),
    }));
  }, [activeIndex]);

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
  // Capture composited image (image + drawings + text)
  // ---------------------------------------------------------------------------
  const captureComposite = useCallback(async (): Promise<string | null> => {
    if (!compositeRef.current) return null;
    try {
      const uri = await captureRef(compositeRef, {
        format: 'jpg',
        quality: 0.92,
      });
      return uri;
    } catch {
      return null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Send all media back to chat
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(async () => {
    if (media.length === 0) return;

    // If the active image has edits, capture the composite
    const activeEdits = editsMap[activeIndex];
    let finalMedia = [...media];

    if (activeEdits && (activeEdits.drawPaths.length > 0 || activeEdits.textLabels.length > 0)) {
      const compositeUri = await captureComposite();
      if (compositeUri) {
        finalMedia = finalMedia.map((m, i) => i === activeIndex ? { ...m, uri: compositeUri } : m);
      }
    }

    const sentMedia = finalMedia.map(m => ({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      text: m.caption || (m.type === 'video' ? 'Video' : 'Photo'),
      sender: 'me' as const,
      time: formatTime(),
      timestamp: Date.now(),
      status: 'sent' as const,
      type: 'image' as const,
      uri: m.uri,
      caption: m.caption || undefined,
    }));

    DeviceEventEmitter.emit('chat_media_sent', sentMedia);
    navigation.goBack();
  }, [media, navigation, chatId, recipientName, editsMap, activeIndex, captureComposite]);

  // ---------------------------------------------------------------------------
  // Tool handlers
  // ---------------------------------------------------------------------------
  const handleToolTap = useCallback(async (label: string) => {
    switch (label) {
      case 'Save': {
        let perm = mediaPermission;
        if (!perm?.granted) {
          perm = await requestMediaPermission();
        }
        if (!perm?.granted) {
          Alert.alert('Permission Required', 'Allow access to save images to your gallery.');
          return;
        }
        const edits = editsMap[activeIndex];
        let uriToSave = media[activeIndex]?.uri;
        if (edits && (edits.drawPaths.length > 0 || edits.textLabels.length > 0)) {
          const compositeUri = await captureComposite();
          if (compositeUri) uriToSave = compositeUri;
        }
        if (uriToSave) {
          try {
            await MediaLibrary.Asset.create(uriToSave);
            Alert.alert('Saved', 'Image saved to your gallery.');
          } catch {
            Alert.alert('Error', 'Failed to save image.');
          }
        }
        break;
      }
      case 'Crop':
        setActiveMode(prev => prev === 'crop' ? null : 'crop');
        break;
      case 'Text':
        setActiveMode(prev => {
          if (prev === 'text') return null;
          return 'text';
        });
        setShowTextInput(true);
        break;
      case 'Draw':
        setActiveMode(prev => prev === 'draw' ? null : 'draw');
        break;
      case 'Sticker':
        Alert.alert('Stickers', 'Coming soon');
        break;
      default:
        break;
    }
  }, [editsMap, activeIndex, media, captureComposite]);

  // ---------------------------------------------------------------------------
  // Crop callbacks
  // ---------------------------------------------------------------------------
  const handleCropApply = useCallback((newUri: string) => {
    setMedia(prev => prev.map((m, i) => i === activeIndex ? { ...m, uri: newUri } : m));
    // Clear any edits since the base image changed
    setEditsMap(prev => {
      const copy = { ...prev };
      delete copy[activeIndex];
      return copy;
    });
    setActiveMode(null);
  }, [activeIndex]);

  const handleCropCancel = useCallback(() => {
    setActiveMode(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Drawing callbacks
  // ---------------------------------------------------------------------------
  const handlePathsChange = useCallback((paths: DrawnPath[]) => {
    updateEdits(prev => ({ ...prev, drawPaths: paths }));
  }, [updateEdits]);

  // ---------------------------------------------------------------------------
  // Text callbacks
  // ---------------------------------------------------------------------------
  const handleLabelsChange = useCallback((labels: TextLabel[]) => {
    updateEdits(prev => ({ ...prev, textLabels: labels }));
  }, [updateEdits]);

  const handleDismissTextInput = useCallback(() => {
    setShowTextInput(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Pager callback
  // ---------------------------------------------------------------------------
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const idx = viewableItems[0]?.index;
    if (idx != null) {
      setActiveIndex(idx);
      // Exit edit mode when switching images
      setActiveMode(null);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // ---------------------------------------------------------------------------
  // Render media item (with overlays for active item)
  // ---------------------------------------------------------------------------
  const renderMediaItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => {
    const edits = editsMap[index] ?? { drawPaths: [], textLabels: [] };
    const isActive = index === activeIndex;

    return (
      <View style={styles.mediaPage}>
        <View ref={isActive ? compositeRef : undefined} collapsable={false} style={styles.compositeView}>
          <Image source={{ uri: item.uri }} style={styles.mediaImage} resizeMode="contain" />

          {/* Render completed drawings (always visible, even outside draw mode) */}
          {edits.drawPaths.length > 0 && !isActive && (
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              {edits.drawPaths.map((p, i) => (
                <Path
                  key={`static-path-${i}`}
                  d={p.d}
                  stroke={p.color}
                  strokeWidth={p.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </Svg>
          )}

          {/* Render text labels (always visible) */}
          {!isActive && edits.textLabels.map(label => (
            <Text
              key={label.id}
              style={[
                styles.staticLabel,
                { color: label.color, left: label.x, top: label.y },
              ]}
            >
              {label.text}
            </Text>
          ))}
        </View>
      </View>
    );
  }, [editsMap, activeIndex]);

  const keyExtractor = useCallback((_: MediaItem, i: number) => `media-${i}`, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const showColorPalette = activeMode === 'draw' || activeMode === 'text';
  const currentImage = media[activeIndex];

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
        scrollEnabled={activeMode !== 'draw'}
      />

      {/* Drawing canvas overlay (only when in draw mode) */}
      {activeMode === 'draw' && (
        <DrawingCanvas
          strokeColor={selectedColor}
          strokeWidth={3}
          paths={currentEdits.drawPaths}
          onPathsChange={handlePathsChange}
        />
      )}

      {/* Text overlay (labels always draggable when in text mode) */}
      {activeMode === 'text' && (
        <TextOverlay
          labels={currentEdits.textLabels}
          onLabelsChange={handleLabelsChange}
          textColor={selectedColor}
          showInput={showTextInput}
          onDismissInput={handleDismissTextInput}
        />
      )}

      {/* Color palette (visible in draw + text modes) */}
      {showColorPalette && (
        <ColorPalette
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
        />
      )}

      {/* Crop overlay */}
      {activeMode === 'crop' && currentImage && (
        <CropOverlay
          imageUri={currentImage.uri}
          onApply={handleCropApply}
          onCancel={handleCropCancel}
        />
      )}

      {/* Header tools */}
      {activeMode !== 'crop' && (
        <View style={[styles.headerBar, { paddingTop: Math.max(insets.top, 20) + 12 }]}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.toolsRow}>
            {TOOLS.map(tool => {
              const isActiveTool =
                (tool.label === 'Draw' && activeMode === 'draw') ||
                (tool.label === 'Text' && activeMode === 'text');

              return (
                <TouchableOpacity
                  key={tool.label}
                  style={[styles.headerBtn, isActiveTool && styles.headerBtnActive]}
                  onPress={() => handleToolTap(tool.label)}
                  activeOpacity={0.7}
                >
                  <Feather name={tool.icon as any} size={22} color="#fff" />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Add text button (when in text mode and no input showing) */}
      {activeMode === 'text' && !showTextInput && (
        <TouchableOpacity
          style={[styles.addTextBtn, { bottom: Math.max(insets.bottom, 16) + 130 }]}
          onPress={() => setShowTextInput(true)}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.addTextLabel}>Add Text</Text>
        </TouchableOpacity>
      )}

      {/* Footer */}
      {activeMode !== 'crop' && (
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
      )}
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
  compositeView: {
    width: SCREEN_W,
    flex: 1,
  },
  mediaImage: {
    width: SCREEN_W,
    height: '100%',
  },
  staticLabel: {
    position: 'absolute',
    fontSize: 22,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
    zIndex: 30,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnActive: {
    backgroundColor: 'rgba(183,238,122,0.35)',
    borderWidth: 1,
    borderColor: '#B7EE7A',
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
    zIndex: 30,
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

  // Add text button
  addTextBtn: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 25,
  },
  addTextLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
