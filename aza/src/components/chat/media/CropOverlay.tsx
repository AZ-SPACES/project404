import React, { memo, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Dimensions, ActivityIndicator, LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PREVIEW_PADDING = 24;
const PREVIEW_MAX_W = SCREEN_W - PREVIEW_PADDING * 2;
const PREVIEW_MAX_H = SCREEN_H * 0.50;
const MIN_CROP_SIZE = 40;
const HANDLE_SIZE = 24;
const HANDLE_HIT = 40; // larger hit area

type CropOverlayProps = {
  imageUri: string;
  onApply: (newUri: string) => void;
  onCancel: () => void;
};

type CropBox = { x: number; y: number; w: number; h: number };

// ---------------------------------------------------------------------------
// Corner handle component
// ---------------------------------------------------------------------------
type HandlePosition = 'tl' | 'tr' | 'bl' | 'br';

function CropHandle({
  position,
  cropBox,
  imageDisplayW,
  imageDisplayH,
  onUpdate,
}: {
  position: HandlePosition;
  cropBox: CropBox;
  imageDisplayW: number;
  imageDisplayH: number;
  onUpdate: (box: CropBox) => void;
}) {
  const startBox = useSharedValue<CropBox>(cropBox);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startBox.value = { ...cropBox };
    })
    .onUpdate((e) => {
      const sb = startBox.value;
      let { x, y, w, h } = sb;

      switch (position) {
        case 'tl': {
          const newX = Math.max(0, Math.min(sb.x + e.translationX, sb.x + sb.w - MIN_CROP_SIZE));
          const newY = Math.max(0, Math.min(sb.y + e.translationY, sb.y + sb.h - MIN_CROP_SIZE));
          w = sb.w + (sb.x - newX);
          h = sb.h + (sb.y - newY);
          x = newX;
          y = newY;
          break;
        }
        case 'tr': {
          const newW = Math.max(MIN_CROP_SIZE, Math.min(sb.w + e.translationX, imageDisplayW - sb.x));
          const newY = Math.max(0, Math.min(sb.y + e.translationY, sb.y + sb.h - MIN_CROP_SIZE));
          h = sb.h + (sb.y - newY);
          w = newW;
          y = newY;
          break;
        }
        case 'bl': {
          const newX = Math.max(0, Math.min(sb.x + e.translationX, sb.x + sb.w - MIN_CROP_SIZE));
          const newH = Math.max(MIN_CROP_SIZE, Math.min(sb.h + e.translationY, imageDisplayH - sb.y));
          w = sb.w + (sb.x - newX);
          x = newX;
          h = newH;
          break;
        }
        case 'br': {
          const newW = Math.max(MIN_CROP_SIZE, Math.min(sb.w + e.translationX, imageDisplayW - sb.x));
          const newH = Math.max(MIN_CROP_SIZE, Math.min(sb.h + e.translationY, imageDisplayH - sb.y));
          w = newW;
          h = newH;
          break;
        }
      }

      runOnJS(onUpdate)({ x, y, w, h });
    });

  // Position the handle
  let left = 0;
  let top = 0;
  switch (position) {
    case 'tl': left = cropBox.x - HANDLE_SIZE / 2; top = cropBox.y - HANDLE_SIZE / 2; break;
    case 'tr': left = cropBox.x + cropBox.w - HANDLE_SIZE / 2; top = cropBox.y - HANDLE_SIZE / 2; break;
    case 'bl': left = cropBox.x - HANDLE_SIZE / 2; top = cropBox.y + cropBox.h - HANDLE_SIZE / 2; break;
    case 'br': left = cropBox.x + cropBox.w - HANDLE_SIZE / 2; top = cropBox.y + cropBox.h - HANDLE_SIZE / 2; break;
  }

  // Corner line styling
  const borderStyle = useMemo(() => {
    const base = { borderColor: '#fff', borderWidth: 2.5 };
    switch (position) {
      case 'tl': return { ...base, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 };
      case 'tr': return { ...base, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 };
      case 'bl': return { ...base, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 };
      case 'br': return { ...base, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 };
    }
  }, [position]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.handle,
          { left, top },
        ]}
        hitSlop={{ top: HANDLE_HIT / 2, bottom: HANDLE_HIT / 2, left: HANDLE_HIT / 2, right: HANDLE_HIT / 2 }}
      >
        <View style={[styles.handleCorner, borderStyle]} />
      </Animated.View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------
// Main CropOverlay
// ---------------------------------------------------------------------------
function CropOverlayInner({ imageUri, onApply, onCancel }: CropOverlayProps) {
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Actual image dimensions from source
  const [imageNativeW, setImageNativeW] = useState(0);
  const [imageNativeH, setImageNativeH] = useState(0);

  // Display dimensions (fitted into preview box)
  const [imageDisplayW, setImageDisplayW] = useState(PREVIEW_MAX_W);
  const [imageDisplayH, setImageDisplayH] = useState(PREVIEW_MAX_H);
  const [imageOffsetX, setImageOffsetX] = useState(0);
  const [imageOffsetY, setImageOffsetY] = useState(0);

  // Crop rectangle (in display coordinates, relative to image)
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0, y: 0, w: 0, h: 0 });

  // Load native image size
  useEffect(() => {
    Image.getSize(
      imageUri,
      (w, h) => {
        setImageNativeW(w);
        setImageNativeH(h);

        // Calculate display size (contain mode)
        const scaleW = PREVIEW_MAX_W / w;
        const scaleH = PREVIEW_MAX_H / h;
        const scale = Math.min(scaleW, scaleH);
        const dw = Math.round(w * scale);
        const dh = Math.round(h * scale);
        setImageDisplayW(dw);
        setImageDisplayH(dh);
        setImageOffsetX((PREVIEW_MAX_W - dw) / 2);
        setImageOffsetY((PREVIEW_MAX_H - dh) / 2);

        // Initial crop = full image
        setCropBox({ x: 0, y: 0, w: dw, h: dh });
      },
      () => {
        // fallback
        setCropBox({ x: 0, y: 0, w: PREVIEW_MAX_W, h: PREVIEW_MAX_H });
      },
    );
  }, [imageUri]);

  // Move crop box (drag the center area)
  const startBox = useSharedValue<CropBox>({ x: 0, y: 0, w: 0, h: 0 });

  const movePan = Gesture.Pan()
    .onStart(() => {
      startBox.value = { ...cropBox };
    })
    .onUpdate((e) => {
      const sb = startBox.value;
      const newX = Math.max(0, Math.min(sb.x + e.translationX, imageDisplayW - sb.w));
      const newY = Math.max(0, Math.min(sb.y + e.translationY, imageDisplayH - sb.h));
      runOnJS(setCropBox)({ ...sb, x: newX, y: newY });
    });

  const handleCropUpdate = useCallback((box: CropBox) => {
    setCropBox(box);
  }, []);

  // Rotation & flip
  const handleRotateLeft = useCallback(() => setRotation(prev => (prev - 90 + 360) % 360), []);
  const handleRotateRight = useCallback(() => setRotation(prev => (prev + 90) % 360), []);
  const handleFlipH = useCallback(() => setFlipH(prev => !prev), []);
  const handleFlipV = useCallback(() => setFlipV(prev => !prev), []);

  // Reset crop to full image
  const handleReset = useCallback(() => {
    setCropBox({ x: 0, y: 0, w: imageDisplayW, h: imageDisplayH });
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  }, [imageDisplayW, imageDisplayH]);

  // Apply crop + rotation + flip
  const handleApply = useCallback(async () => {
    const isFullCrop = cropBox.x === 0 && cropBox.y === 0 &&
      cropBox.w === imageDisplayW && cropBox.h === imageDisplayH;
    const hasRotation = rotation !== 0 || flipH || flipV;

    if (isFullCrop && !hasRotation) {
      onApply(imageUri);
      return;
    }

    setProcessing(true);
    try {
      const actions: ImageManipulator.Action[] = [];

      // Crop (convert display coords to native image coords)
      if (!isFullCrop && imageNativeW > 0 && imageDisplayW > 0) {
        const scaleX = imageNativeW / imageDisplayW;
        const scaleY = imageNativeH / imageDisplayH;
        actions.push({
          crop: {
            originX: Math.round(cropBox.x * scaleX),
            originY: Math.round(cropBox.y * scaleY),
            width: Math.round(cropBox.w * scaleX),
            height: Math.round(cropBox.h * scaleY),
          },
        });
      }

      if (rotation !== 0) actions.push({ rotate: rotation });
      if (flipH) actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      if (flipV) actions.push({ flip: ImageManipulator.FlipType.Vertical });

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        actions,
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      onApply(result.uri);
    } catch {
      onApply(imageUri);
    } finally {
      setProcessing(false);
    }
  }, [imageUri, cropBox, imageDisplayW, imageDisplayH, imageNativeW, imageNativeH, rotation, flipH, flipV, onApply]);

  const previewTransform = useMemo(() => {
    const transforms: { rotate?: string; scaleX?: number; scaleY?: number }[] = [];
    if (rotation !== 0) transforms.push({ rotate: `${rotation}deg` });
    if (flipH) transforms.push({ scaleX: -1 });
    if (flipV) transforms.push({ scaleY: -1 });
    return transforms;
  }, [rotation, flipH, flipV]);

  const hasCrop = !(cropBox.x === 0 && cropBox.y === 0 &&
    cropBox.w === imageDisplayW && cropBox.h === imageDisplayH);
  const hasChanges = hasCrop || rotation !== 0 || flipH || flipV;

  // Dimension label for the crop area
  const cropDimensionLabel = useMemo(() => {
    if (imageNativeW === 0) return '';
    const scaleX = imageNativeW / imageDisplayW;
    const scaleY = imageNativeH / imageDisplayH;
    const pw = Math.round(cropBox.w * scaleX);
    const ph = Math.round(cropBox.h * scaleY);
    return `${pw} × ${ph}`;
  }, [cropBox, imageNativeW, imageNativeH, imageDisplayW, imageDisplayH]);

  return (
    <View style={styles.container}>
      {/* Image + crop area */}
      <View style={[styles.previewBox]}>
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.previewImage,
            {
              width: imageDisplayW,
              height: imageDisplayH,
              marginLeft: imageOffsetX,
              marginTop: imageOffsetY,
              transform: previewTransform as any,
            },
          ]}
          resizeMode="contain"
        />

        {/* Darkened overlays outside crop area */}
        {cropBox.w > 0 && (
          <>
            {/* Top */}
            <View style={[styles.dimOverlay, {
              left: imageOffsetX, top: imageOffsetY,
              width: imageDisplayW, height: cropBox.y,
            }]} />
            {/* Bottom */}
            <View style={[styles.dimOverlay, {
              left: imageOffsetX, top: imageOffsetY + cropBox.y + cropBox.h,
              width: imageDisplayW, height: imageDisplayH - cropBox.y - cropBox.h,
            }]} />
            {/* Left */}
            <View style={[styles.dimOverlay, {
              left: imageOffsetX, top: imageOffsetY + cropBox.y,
              width: cropBox.x, height: cropBox.h,
            }]} />
            {/* Right */}
            <View style={[styles.dimOverlay, {
              left: imageOffsetX + cropBox.x + cropBox.w, top: imageOffsetY + cropBox.y,
              width: imageDisplayW - cropBox.x - cropBox.w, height: cropBox.h,
            }]} />

            {/* Crop border */}
            <View style={[styles.cropBorder, {
              left: imageOffsetX + cropBox.x,
              top: imageOffsetY + cropBox.y,
              width: cropBox.w,
              height: cropBox.h,
            }]}>
              {/* Grid lines (rule of thirds) */}
              <View style={[styles.gridLineH, { top: '33.3%' }]} />
              <View style={[styles.gridLineH, { top: '66.6%' }]} />
              <View style={[styles.gridLineV, { left: '33.3%' }]} />
              <View style={[styles.gridLineV, { left: '66.6%' }]} />
            </View>

            {/* Draggable center */}
            <GestureDetector gesture={movePan}>
              <Animated.View style={[styles.cropDragArea, {
                left: imageOffsetX + cropBox.x + HANDLE_SIZE,
                top: imageOffsetY + cropBox.y + HANDLE_SIZE,
                width: Math.max(cropBox.w - HANDLE_SIZE * 2, 20),
                height: Math.max(cropBox.h - HANDLE_SIZE * 2, 20),
              }]} />
            </GestureDetector>

            {/* Corner handles */}
            <View style={{ position: 'absolute', left: imageOffsetX, top: imageOffsetY }}>
              {(['tl', 'tr', 'bl', 'br'] as HandlePosition[]).map(pos => (
                <CropHandle
                  key={pos}
                  position={pos}
                  cropBox={cropBox}
                  imageDisplayW={imageDisplayW}
                  imageDisplayH={imageDisplayH}
                  onUpdate={handleCropUpdate}
                />
              ))}
            </View>
          </>
        )}
      </View>

      {/* Dimension indicator */}
      {cropDimensionLabel ? (
        <Text style={styles.dimensionLabel}>{cropDimensionLabel}</Text>
      ) : null}

      {/* Controls row */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn} onPress={handleRotateLeft} activeOpacity={0.7}>
          <Feather name="rotate-ccw" size={20} color="#fff" />
          <Text style={styles.controlLabel}>-90°</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={handleRotateRight} activeOpacity={0.7}>
          <Feather name="rotate-cw" size={20} color="#fff" />
          <Text style={styles.controlLabel}>+90°</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, flipH && styles.controlBtnActive]}
          onPress={handleFlipH}
          activeOpacity={0.7}
        >
          <Feather name="minimize-2" size={20} color="#fff" />
          <Text style={styles.controlLabel}>Flip H</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, flipV && styles.controlBtnActive]}
          onPress={handleFlipV}
          activeOpacity={0.7}
        >
          <Feather name="minimize-2" size={20} color="#fff" style={{ transform: [{ rotate: '90deg' }] }} />
          <Text style={styles.controlLabel}>Flip V</Text>
        </TouchableOpacity>

        {hasChanges && (
          <TouchableOpacity style={styles.controlBtn} onPress={handleReset} activeOpacity={0.7}>
            <Feather name="refresh-cw" size={20} color="#F97316" />
            <Text style={[styles.controlLabel, { color: '#F97316' }]}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.applyBtn, processing && { opacity: 0.5 }]}
          onPress={handleApply}
          activeOpacity={0.7}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#174717" />
          ) : (
            <Text style={styles.applyText}>Apply</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const CropOverlay = memo(CropOverlayInner);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.95)',
    zIndex: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: PREVIEW_PADDING,
  },
  previewBox: {
    width: PREVIEW_MAX_W,
    height: PREVIEW_MAX_H,
    overflow: 'visible',
    position: 'relative',
  },
  previewImage: {
    position: 'absolute',
  },
  // Darkened area outside crop
  dimOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  // Crop rectangle border
  cropBorder: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 5,
  },
  // Rule of thirds grid lines
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  // Drag area in center of crop
  cropDragArea: {
    position: 'absolute',
    zIndex: 6,
  },
  // Corner handles
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleCorner: {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
  },
  // Dimension label
  dimensionLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
  // Controls
  controls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    gap: 3,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(183,238,122,0.25)',
    borderWidth: 1,
    borderColor: '#B7EE7A',
  },
  controlLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '500',
  },
  // Actions
  actionBar: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  cancelBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  applyBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#B7EE7A',
    minWidth: 100,
    alignItems: 'center',
  },
  applyText: {
    color: '#174717',
    fontSize: 15,
    fontWeight: '700',
  },
});
