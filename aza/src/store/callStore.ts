import { create } from 'zustand';
import { RTCPeerConnection, MediaStream, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';
import { webrtcService } from '../services/webrtcService';
import {
  initiateCall,
  ringCall,
  acceptCall,
  declineCall,
  endCall,
  relaySdpOffer,
  relaySdpAnswer,
  relayIceCandidate,
  getTurnCredentials
} from '../services/api';

export type CallStatus = 'INITIATING' | 'RINGING' | 'ACTIVE' | 'RECONNECTING' | 'ENDED';
export type CallType = 'VOICE' | 'VIDEO';

export interface ActiveCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  calleeId: string;
  calleeName: string;
  calleeAvatar: string | null;
  type: CallType;
  status: CallStatus;
  isCaller: boolean;
  startedAt: number | null;
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

interface CallState {
  activeCall: ActiveCall | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isLocalVideoEnabled: boolean;
  cameraFacing: 'front' | 'back';

  // Actions
  setIncomingCall: (payload: any) => void;
  initiateOutgoingCall: (calleeId: string, type: CallType) => Promise<string | null>;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => Promise<void>;
  endCurrentCall: () => Promise<void>;
  handleCallSignal: (type: string, payload: any) => Promise<void>;

  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
  flipCamera: () => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  activeCall: null,
  isMuted: false,
  isSpeakerOn: false,
  isLocalVideoEnabled: true,
  cameraFacing: 'front',

  setIncomingCall: (payload: any) => {
    // Payload from WS call.initiate event
    // { callId, callerId, callerName, callerAvatar, type, status, ... }
    set({
      activeCall: {
        callId: payload.callId,
        callerId: payload.callerId,
        callerName: payload.callerName,
        callerAvatar: payload.callerAvatar,
        calleeId: payload.calleeId, // usually our own ID
        calleeName: payload.calleeName,
        calleeAvatar: payload.calleeAvatar,
        type: payload.type,
        status: 'RINGING',
        isCaller: false,
        startedAt: null,
        peerConnection: null,
        localStream: null,
        remoteStream: null,
      },
      isMuted: false,
      isSpeakerOn: payload.type === 'VIDEO',
      isLocalVideoEnabled: true,
      cameraFacing: 'front',
    });

    // Notify backend that we are ringing
    ringCall(payload.callId).catch(console.error);
  },

  initiateOutgoingCall: async (calleeId: string, type: CallType) => {
    try {
      // 1. Call API
      const res = await initiateCall(calleeId, type);
      const data = res.data?.data || res.data;
      
      if (!data?.callId) {
        throw new Error("No callId returned from server");
      }

      // 2. Set state
      set({
        activeCall: {
          callId: data.callId,
          callerId: data.callerId,
          callerName: data.callerName,
          callerAvatar: data.callerAvatar,
          calleeId: data.calleeId,
          calleeName: data.calleeName,
          calleeAvatar: data.calleeAvatar,
          type,
          status: 'INITIATING',
          isCaller: true,
          startedAt: null,
          peerConnection: null,
          localStream: null,
          remoteStream: null,
        },
        isMuted: false,
        isSpeakerOn: type === 'VIDEO',
        isLocalVideoEnabled: true,
        cameraFacing: 'front',
      });

      // 3. Acquire media and setup peer connection early for faster connection
      // Wait for ringing or accept to actually send the offer
      const stream = await webrtcService.acquireLocalMedia(type);
      if (stream) {
        set((state) => {
          if (!state.activeCall) return state;
          return { activeCall: { ...state.activeCall, localStream: stream } };
        });
      }

      return data.callId;
    } catch (error) {
      console.error('Failed to initiate call:', error);
      return null;
    }
  },

  acceptIncomingCall: async () => {
    const { activeCall } = get();
    if (!activeCall) return;

    try {
      await acceptCall(activeCall.callId);
      
      set((state) => ({
        activeCall: state.activeCall ? { ...state.activeCall, status: 'ACTIVE', startedAt: Date.now() } : null
      }));

      // Set up peer connection but DO NOT send offer (caller sends offer)
      const stream = await webrtcService.acquireLocalMedia(activeCall.type);
      set((state) => ({
        activeCall: state.activeCall ? { ...state.activeCall, localStream: stream } : null
      }));
      
    } catch (error) {
      console.error('Failed to accept call:', error);
      await get().endCurrentCall();
    }
  },

  declineIncomingCall: async () => {
    const { activeCall } = get();
    if (!activeCall) return;
    try {
      await declineCall(activeCall.callId);
    } catch (e) {}
    
    // Clear state
    get().endCurrentCall();
  },

  endCurrentCall: async () => {
    const { activeCall } = get();
    if (!activeCall) return;

    try {
      if (activeCall.status !== 'ENDED') {
        await endCall(activeCall.callId);
      }
    } catch (e) {}

    webrtcService.teardown(activeCall.peerConnection, activeCall.localStream);
    webrtcService.teardown(null, activeCall.remoteStream);

    set({ activeCall: null });
  },

  handleCallSignal: async (type: string, payload: any) => {
    const { activeCall } = get();
    
    // If callId doesn't match and it's not a new call initiate, ignore
    if (type !== 'call.initiate' && activeCall && payload.callId && payload.callId !== activeCall.callId) {
        return;
    }

    switch (type) {
      case 'call.initiate':
        if (!activeCall) {
          get().setIncomingCall(payload);
        }
        break;

      case 'call.ringing':
        if (activeCall && activeCall.status === 'INITIATING') {
          set({ activeCall: { ...activeCall, status: 'RINGING' } });
        }
        break;

      case 'call.accept':
        if (activeCall && activeCall.isCaller) {
          set({ activeCall: { ...activeCall, status: 'ACTIVE', startedAt: Date.now() } });
          
          // Caller creates the offer after the callee accepts
          try {
            // Get credentials
            const turnRes = await getTurnCredentials();
            const iceServers = turnRes.data?.data?.iceServers || turnRes.data?.iceServers || [];
            
            const callbacks = {
              onIceCandidate: (candidate: RTCIceCandidate) => {
                relayIceCandidate(activeCall.callId, JSON.stringify(candidate)).catch(() => {});
              },
              onTrack: (stream: MediaStream) => {
                set((state) => ({
                  activeCall: state.activeCall ? { ...state.activeCall, remoteStream: stream } : null
                }));
              },
              onConnectionStateChange: (state: string) => {
                if (state === 'failed' || state === 'disconnected') {
                  // handle reconnect logic later
                }
              }
            };
            
            const pc = webrtcService.createPeerConnection(iceServers, callbacks);
            
            const state = get();
            if (state.activeCall?.localStream) {
              state.activeCall.localStream.getTracks().forEach((track: any) => {
                pc.addTrack(track, state.activeCall!.localStream!);
              });
            }
            
            set((st) => ({ activeCall: st.activeCall ? { ...st.activeCall, peerConnection: pc } : null }));
            
            const offer = await webrtcService.createOffer(pc);
            await relaySdpOffer(activeCall.callId, JSON.stringify(offer));
          } catch (e) {
            console.error("Error creating offer", e);
            await get().endCurrentCall();
          }
        }
        break;

      case 'call.decline':
      case 'call.end':
      case 'call.missed':
        if (activeCall) {
          webrtcService.teardown(activeCall.peerConnection, activeCall.localStream);
          webrtcService.teardown(null, activeCall.remoteStream);
          set({ activeCall: null });
        }
        break;

      case 'sdp.offer':
        if (activeCall && !activeCall.isCaller) {
          try {
            const turnRes = await getTurnCredentials();
            const iceServers = turnRes.data?.data?.iceServers || turnRes.data?.iceServers || [];
            
            const callbacks = {
              onIceCandidate: (candidate: RTCIceCandidate) => {
                relayIceCandidate(activeCall.callId, JSON.stringify(candidate)).catch(() => {});
              },
              onTrack: (stream: MediaStream) => {
                set((state) => ({
                  activeCall: state.activeCall ? { ...state.activeCall, remoteStream: stream } : null
                }));
              },
              onConnectionStateChange: (state: string) => {
                if (state === 'failed' || state === 'disconnected') {
                  // handle reconnect logic later
                }
              }
            };
            
            const pc = webrtcService.createPeerConnection(iceServers, callbacks);
            
            if (activeCall.localStream) {
              activeCall.localStream.getTracks().forEach((track: any) => {
                pc.addTrack(track, activeCall.localStream!);
              });
            }
            
            set((st) => ({ activeCall: st.activeCall ? { ...st.activeCall, peerConnection: pc } : null }));
            
            const offerDesc = new RTCSessionDescription(JSON.parse(payload.data));
            const answer = await webrtcService.createAnswer(pc, offerDesc);
            await relaySdpAnswer(activeCall.callId, JSON.stringify(answer));
          } catch (e) {
            console.error("Error handling offer", e);
            await get().endCurrentCall();
          }
        }
        break;

      case 'sdp.answer':
        if (activeCall?.peerConnection) {
          try {
            const answerDesc = new RTCSessionDescription(JSON.parse(payload.data));
            await webrtcService.setRemoteDescription(activeCall.peerConnection, answerDesc);
          } catch (e) {
            console.error("Error handling answer", e);
          }
        }
        break;

      case 'ice.candidate':
        if (activeCall?.peerConnection && payload.data) {
          try {
            const candidate = new RTCIceCandidate(JSON.parse(payload.data));
            await webrtcService.addIceCandidate(activeCall.peerConnection, candidate);
          } catch (e) {
            console.error("Error adding ice candidate", e);
          }
        }
        break;
    }
  },

  toggleMute: () => {
    set((state) => {
      const newMuted = !state.isMuted;
      if (state.activeCall?.localStream) {
        state.activeCall.localStream.getAudioTracks().forEach(track => {
          track.enabled = !newMuted;
        });
      }
      return { isMuted: newMuted };
    });
  },

  toggleSpeaker: () => {
    // In React Native WebRTC, speaker routing is typically handled via third party libraries
    // (like react-native-incall-manager), but WebRTC handles default routing pretty well.
    // We'll update the state, but actual hardware routing might need IncallManager.
    set((state) => ({ isSpeakerOn: !state.isSpeakerOn }));
  },

  toggleVideo: () => {
    set((state) => {
      const newVideoEnabled = !state.isLocalVideoEnabled;
      if (state.activeCall?.localStream) {
        state.activeCall.localStream.getVideoTracks().forEach(track => {
          track.enabled = newVideoEnabled;
        });
      }
      return { isLocalVideoEnabled: newVideoEnabled };
    });
  },

  flipCamera: () => {
    set((state) => {
      const newFacing = state.cameraFacing === 'front' ? 'back' : 'front';
      if (state.activeCall?.localStream) {
        state.activeCall.localStream.getVideoTracks().forEach((track: any) => {
          if (track._switchCamera) {
            track._switchCamera();
          }
        });
      }
      return { cameraFacing: newFacing };
    });
  },

}));
