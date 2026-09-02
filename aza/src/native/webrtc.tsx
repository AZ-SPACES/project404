import React from 'react';
import { View } from 'react-native';

import { loadOptionalModule, NativeModuleUnavailableError } from './optional';

type WebRTCModule = typeof import('react-native-webrtc');

/** `undefined` = not tried yet, `null` = not in this binary. */
let cached: WebRTCModule | null | undefined;

function load(): WebRTCModule | null {
  if (cached === undefined) {
    cached = loadOptionalModule(() => require('react-native-webrtc') as WebRTCModule);
  }
  return cached;
}

/**
 * Whether 1:1 calling can run at all. Callers that can offer a graceful
 * alternative should check this first rather than catching the throw below.
 */
export function isWebRTCAvailable(): boolean {
  return load() !== null;
}

/**
 * The library, or a `NativeModuleUnavailableError` explaining why not.
 *
 * Every call path already funnels its failures through the call store's
 * try/catch, so throwing here ends the call attempt with a logged reason
 * instead of crashing the app.
 */
export function requireWebRTC(): WebRTCModule {
  const mod = load();
  if (!mod) throw new NativeModuleUnavailableError('Voice and video calls');
  return mod;
}

type RTCViewProps = React.ComponentProps<WebRTCModule['RTCView']>;

/**
 * The video surface, degrading to an empty view of the same size.
 *
 * The call screens lay themselves out around this — a null return would
 * collapse the frame and take the controls with it — so the placeholder keeps
 * the box and simply shows nothing in it.
 */
export function RTCView(props: RTCViewProps) {
  const mod = load();
  if (!mod) {
    // Only `style` carries over: the rest of RTCView's props (streamURL,
    // objectFit, zOrder…) mean nothing to a plain View.
    return <View style={[{ backgroundColor: '#000' }, props.style]} />;
  }
  const NativeRTCView = mod.RTCView;
  return <NativeRTCView {...props} />;
}
