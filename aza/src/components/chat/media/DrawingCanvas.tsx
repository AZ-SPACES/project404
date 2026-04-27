import React, { memo, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, runOnJS } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';

export type DrawnPath = {
  d: string;
  color: string;
  width: number;
};

type DrawingCanvasProps = {
  strokeColor: string;
  strokeWidth?: number;
  paths: DrawnPath[];
  onPathsChange: (paths: DrawnPath[]) => void;
};

function DrawingCanvasInner({
  strokeColor,
  strokeWidth = 3,
  paths,
  onPathsChange,
}: DrawingCanvasProps) {
  // Track the in-progress path on the UI thread via a shared value
  // and mirror it to JS state for SVG rendering.
  const currentPathSV = useSharedValue('');
  const [currentPath, setCurrentPathJS] = React.useState('');

  // Cache the current props in refs so gesture worklets can access them
  const colorRef = useRef(strokeColor);
  colorRef.current = strokeColor;
  const widthRef = useRef(strokeWidth);
  widthRef.current = strokeWidth;
  const pathsRef = useRef(paths);
  pathsRef.current = paths;
  const onChangeRef = useRef(onPathsChange);
  onChangeRef.current = onPathsChange;

  const commitPath = useCallback((d: string) => {
    if (d) {
      onChangeRef.current([...pathsRef.current, { d, color: colorRef.current, width: widthRef.current }]);
    }
    setCurrentPathJS('');
  }, []);

  const updatePath = useCallback((d: string) => {
    setCurrentPathJS(d);
  }, []);

  const panGesture = Gesture.Pan()
    .minDistance(1)
    .onStart((event) => {
      'worklet';
      const d = `M${event.x.toFixed(1)},${event.y.toFixed(1)}`;
      currentPathSV.value = d;
      runOnJS(updatePath)(d);
    })
    .onUpdate((event) => {
      'worklet';
      const d = `${currentPathSV.value} L${event.x.toFixed(1)},${event.y.toFixed(1)}`;
      currentPathSV.value = d;
      runOnJS(updatePath)(d);
    })
    .onEnd(() => {
      'worklet';
      const d = currentPathSV.value;
      currentPathSV.value = '';
      runOnJS(commitPath)(d);
    });

  const handleUndo = useCallback(() => {
    if (paths.length > 0) {
      onPathsChange(paths.slice(0, -1));
    }
  }, [paths, onPathsChange]);

  const completedPaths = useMemo(() =>
    paths.map((p, i) => (
      <Path
        key={`path-${i}`}
        d={p.d}
        stroke={p.color}
        strokeWidth={p.width}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )),
    [paths],
  );

  return (
    <View style={styles.container} pointerEvents="box-none">
      <GestureDetector gesture={panGesture}>
        <Animated.View style={styles.canvasArea}>
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            {completedPaths}
            {currentPath ? (
              <Path
                d={currentPath}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </Svg>
        </Animated.View>
      </GestureDetector>

      {/* Undo button */}
      {paths.length > 0 && (
        <TouchableOpacity
          style={styles.undoBtn}
          onPress={handleUndo}
          activeOpacity={0.7}
          accessibilityLabel="Undo last stroke"
        >
          <Feather name="corner-up-left" size={20} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export const DrawingCanvas = memo(DrawingCanvasInner);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
  },
  canvasArea: {
    flex: 1,
  },
  undoBtn: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
});
