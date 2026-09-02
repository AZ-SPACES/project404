/**
 * Optional native modules.
 *
 * Everything in this folder wraps a dependency whose native code only exists in
 * a build of our own — not in Expo Go, and not in an older build that shipped
 * before the dependency was added. Each wrapper resolves its module lazily and
 * degrades to a documented no-op or a descriptive error, so importing one is
 * always safe at module-evaluation time. See ./optional.ts for why that matters.
 */

export { isNativeModuleUnavailable, NativeModuleUnavailableError } from './optional';
export { InCallManager, isInCallManagerAvailable } from './incallManager';
export { captureRef, isViewShotAvailable } from './viewShot';
export { isWebRTCAvailable, requireWebRTC, RTCView } from './webrtc';
