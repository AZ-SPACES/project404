import { create } from 'zustand';
import type { MediaStream, MediaStreamTrack, RTCPeerConnection } from 'react-native-webrtc';
import {
  webrtcService,
  type IceCandidateInit,
  type IceServer,
  type SessionDescriptionInit,
  type WebRTCCallbacks,
} from '../services/webrtcService';
import { callAudioService } from '../services/callAudioService';
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

/**
 * ICE candidates routinely arrive before we can use them. Both sides await
 * getTurnCredentials() before constructing the peer connection, and
 * addIceCandidate() rejects until a remote description is set — a candidate
 * landing in either window is lost. A dropped candidate is often the only
 * route that would have worked, so this shows up as calls that ring, connect,
 * then sit in silence. Buffer per call; flush once the connection can take them.
 */
const iceBuffer: { callId: string | null; candidates: IceCandidateInit[] } = {
  callId: null,
  candidates: [],
};

function resetIceBuffer(callId: string | null) {
  iceBuffer.callId = callId;
  iceBuffer.candidates = [];
}

async function flushIceBuffer(pc: RTCPeerConnection, callId: string) {
  if (iceBuffer.callId !== callId) return;
  const queued = iceBuffer.candidates;
  iceBuffer.candidates = [];
  for (const candidate of queued) {
    try {
      await webrtcService.addIceCandidate(pc, candidate);
    } catch (e) {
      console.warn('[call] discarding unusable buffered ICE candidate', e);
    }
  }
}

/**
 * Peer-connection callbacks. Caller and callee need exactly the same wiring,
 * so build it once. `callId` is captured rather than read from the store so a
 * late event from a finished call can't mutate its successor.
 */
function makePeerCallbacks(callId: string): WebRTCCallbacks {
  return {
    onIceCandidate: (candidate) => {
      relayIceCandidate(callId, JSON.stringify(candidate)).catch(() => {});
    },

    onTrack: (stream) => {
      useCallStore.setState((state) => ({
        activeCall: state.activeCall ? { ...state.activeCall, remoteStream: stream } : null,
      }));
    },

    onConnectionStateChange: (connectionState) => {
      const { activeCall } = useCallStore.getState();
      if (!activeCall || activeCall.callId !== callId) return;

      if (connectionState === 'connected') {
        // Recovered from a transient drop.
        if (activeCall.status === 'RECONNECTING') {
          useCallStore.setState({ activeCall: { ...activeCall, status: 'ACTIVE' } });
        }
      } else if (connectionState === 'disconnected') {
        // Not terminal — ICE often recovers on its own. Surface it, don't kill it.
        if (activeCall.status === 'ACTIVE') {
          useCallStore.setState({ activeCall: { ...activeCall, status: 'RECONNECTING' } });
        }
      } else if (connectionState === 'failed') {
        // Terminal: ICE gave up. Tear down instead of showing a dead call.
        void useCallStore.getState().endCurrentCall();
      }
    },
  };
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
    resetIceBuffer(payload.callId);
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
      resetIceBuffer(data.callId);
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
    resetIceBuffer(null);

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
            const iceServers: IceServer[] = turnRes.data?.data?.iceServers || turnRes.data?.iceServers || [];
            
            const pc = webrtcService.createPeerConnection(
              iceServers,
              makePeerCallbacks(activeCall.callId),
            );
            
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
          resetIceBuffer(null);
          set({ activeCall: null });
        }
        break;

      case 'sdp.offer':
        if (activeCall && !activeCall.isCaller) {
          try {
            const turnRes = await getTurnCredentials();
            const iceServers: IceServer[] = turnRes.data?.data?.iceServers || turnRes.data?.iceServers || [];
            
            const pc = webrtcService.createPeerConnection(
              iceServers,
              makePeerCallbacks(activeCall.callId),
            );
            
            if (activeCall.localStream) {
              activeCall.localStream.getTracks().forEach((track: any) => {
                pc.addTrack(track, activeCall.localStream!);
              });
            }
            
            set((st) => ({ activeCall: st.activeCall ? { ...st.activeCall, peerConnection: pc } : null }));
            
            const offerDesc: SessionDescriptionInit = JSON.parse(payload.data);
            const answer = await webrtcService.createAnswer(pc, offerDesc);
            // createAnswer set the remote description, so candidates that
            // arrived while we were fetching TURN credentials can go in now.
            await flushIceBuffer(pc, activeCall.callId);
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
            const answerDesc: SessionDescriptionInit = JSON.parse(payload.data);
            await webrtcService.setRemoteDescription(activeCall.peerConnection, answerDesc);
            await flushIceBuffer(activeCall.peerConnection, activeCall.callId);
          } catch (e) {
            console.error("Error handling answer", e);
          }
        }
        break;

      case 'ice.candidate':
        if (activeCall && payload.data) {
          try {
            const candidate: IceCandidateInit = JSON.parse(payload.data);
            const pc = activeCall.peerConnection;
            // addIceCandidate rejects until the remote description is set, and
            // the connection may not exist yet at all — buffer for the flush
            // that follows setRemoteDescription rather than dropping.
            if (pc && pc.remoteDescription) {
              await webrtcService.addIceCandidate(pc, candidate);
            } else {
              iceBuffer.candidates.push(candidate);
            }
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
        state.activeCall.localStream.getAudioTracks().forEach((track: MediaStreamTrack) => {
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
        state.activeCall.localStream.getVideoTracks().forEach((track: MediaStreamTrack) => {
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
