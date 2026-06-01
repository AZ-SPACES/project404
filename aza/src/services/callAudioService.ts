// react-native-incall-manager is not supported in Expo Go — all methods are no-ops.
export const callAudioService = {
  startOutgoing(_type: 'VOICE' | 'VIDEO') {},
  startIncoming() {},
  connected(_type: 'VOICE' | 'VIDEO') {},
  setSpeaker(_on: boolean) {},
  stop() {},
};
