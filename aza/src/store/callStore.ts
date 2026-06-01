import { create } from 'zustand';
import { webrtcService } from '../services/webrtcService';
import { callAudioService } from '../services/callAudioService';

type RTCPeerConnection = any;
type MediaStream = any;
type RTCIceCandidate = any;
type RTCSessionDescription = any;
import { ensureCallPermissions } from '../services/callPermissions';
import { navigate } from '../navigation/navigationRef';
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

    // Surface the incoming-call UI. Without this the call arrives silently
    // unless the user already happens to be on a screen subscribed to
    // activeCall.
    navigate('IncomingCall');

    // Ringtone + vibration. Audio session is started on accept, not here,
    // so we don't grab the mic while just ringing.
    callAudioService.startIncoming();
  },

  initiateOutgoingCall: async (calleeId: string, type: CallType) => {
    try {
      // Ask for mic/camera up front so we can bail before talking to the
      // server if the user denies. ensureCallPermissions shows its own UI
      // when something is blocked.
      const ok = await ensureCallPermissions(type);
      if (!ok) return null;

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

      // Outgoing ringback + audio session. The ringback stops automatically
      // when the call transitions to ACTIVE via call.accept.
      callAudioService.startOutgoing(type);

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
      const ok = await ensureCallPermissions(activeCall.type);
      if (!ok) {
        await get().declineIncomingCall();
        return;
      }

      // Acquire the mic/camera BEFORE telling the backend we accepted.
      // Otherwise the caller's CALL_ACCEPT-triggered SDP offer can land on
      // this side before localStream exists, and we'd answer with no tracks
      // (→ one-way audio/video).
      const stream = await webrtcService.acquireLocalMedia(activeCall.type);
      set((state) => ({
        activeCall: state.activeCall ? { ...state.activeCall, localStream: stream } : null
      }));

      await acceptCall(activeCall.callId);

      // Stop the ringtone, start the audio session, lock in routing.
      callAudioService.connected(activeCall.type);

      set((state) => ({
        activeCall: state.activeCall ? { ...state.activeCall, status: 'ACTIVE', startedAt: Date.now() } : null
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

    callAudioService.stop();
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
          // Callee picked up — stop the ringback, lock in audio routing.
          callAudioService.connected(activeCall.type);
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
          callAudioService.stop();
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
            
            const offerDesc = JSON.parse(payload.data);
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
            const answerDesc = JSON.parse(payload.data);
            await webrtcService.setRemoteDescription(activeCall.peerConnection, answerDesc);
          } catch (e) {
            console.error("Error handling answer", e);
          }
        }
        break;

      case 'ice.candidate':
        if (activeCall?.peerConnection && payload.data) {
          try {
            const candidate = JSON.parse(payload.data);
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
    set((state) => {
      const next = !state.isSpeakerOn;
      callAudioService.setSpeaker(next);
      return { isSpeakerOn: next };
    });
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
          // Public API since react-native-webrtc 1.84. Fall back to the
          // older underscore variant for safety on legacy versions.
          const fn = track.switchCamera ?? track._switchCamera;
          if (typeof fn === 'function') fn.call(track);
        });
      }
      return { cameraFacing: newFacing };
    });
  },

}));
