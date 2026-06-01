// react-native-webrtc is not supported in Expo Go — all operations are no-ops.

export type WebRTCCallbacks = {
  onIceCandidate: (candidate: any) => void;
  onTrack: (stream: any) => void;
  onConnectionStateChange: (state: string) => void;
};

export const webrtcService = {
  createPeerConnection(_iceServers: any[], _callbacks: WebRTCCallbacks): any {
    return null;
  },

  async acquireLocalMedia(_type: 'VOICE' | 'VIDEO', _isFrontCamera: boolean = true): Promise<any> {
    return null;
  },

  async createOffer(_pc: any): Promise<any> {
    return null;
  },

  async createAnswer(_pc: any, _remoteSdp: any): Promise<any> {
    return null;
  },

  async setRemoteDescription(_pc: any, _sdp: any): Promise<void> {},

  async addIceCandidate(_pc: any, _candidate: any): Promise<void> {},

  teardown(_pc: any, _stream: any) {},
};
