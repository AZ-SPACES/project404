/**
 * WebRTC media layer for 1:1 voice and video calls.
 *
 * Everything that touches react-native-webrtc lives here, so the call store
 * deals only in plain data: peer-connection setup, ICE plumbing, media
 * acquisition and teardown. Signaling — who to offer, where to send the SDP —
 * is the store's job; this module never talks to the network.
 */

import type {
  MediaStream,
  MediaStreamTrack,
  RTCIceCandidate,
  RTCPeerConnection,
} from 'react-native-webrtc';

// The library is reached through this wrapper rather than imported directly:
// it touches its native module as it evaluates, which crashes the bundle on
// start in any binary without WebRTC compiled in (Expo Go, or a build that
// predates the call feature). See src/native/optional.ts.
import { requireWebRTC } from '../native/webrtc';

/**
 * react-native-webrtc declares RTCConfiguration, RTCIceServer and
 * RTCSessionDescriptionInit internally but re-exports none of them from its
 * entry point, so mirror the shapes we actually use. Keep these structurally
 * identical to the library's own — they are checked against it at every call.
 */
export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type SessionDescriptionInit = {
  sdp: string;
  type: string | null;
};

export type IceCandidateInit = {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
};

export type WebRTCCallbacks = {
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onTrack: (stream: MediaStream) => void;
  onConnectionStateChange: (state: string) => void;
};

/**
 * react-native-webrtc 124 derives RTCPeerConnection from an EventTarget it
 * imports as 'event-target-shim/index' — a subpath that package's `exports`
 * map does not expose. Under Expo's moduleResolution:"bundler" the base class
 * fails to resolve, so the peer connection appears to have none of its
 * inherited event methods, even though they are present at runtime.
 *
 * Declaring the three events this module listens for keeps the listener
 * payloads type-checked, which a cast to `any` would throw away. A tsconfig
 * `paths` entry would fix resolution wholesale but has to name the nested
 * install path, and breaks the next time npm hoists the dependency elsewhere.
 */
type PeerConnectionEvents = {
  addEventListener(
    type: 'icecandidate',
    listener: (event: { candidate: RTCIceCandidate | null }) => void,
  ): void;
  addEventListener(
    type: 'track',
    listener: (event: { streams: MediaStream[]; track: MediaStreamTrack | null }) => void,
  ): void;
  addEventListener(type: 'connectionstatechange', listener: () => void): void;
};

const listenersOf = (pc: RTCPeerConnection) => pc as unknown as PeerConnectionEvents;

/**
 * Used only when the backend hands back no ICE servers — a TURN
 * misconfiguration or an unreachable coturn. STUN alone connects same-network
 * and simple-NAT calls; symmetric NAT (most mobile carriers) still needs TURN,
 * so this is a degraded fallback, not a substitute for it.
 */
const FALLBACK_ICE_SERVERS: IceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export const webrtcService = {
  createPeerConnection(iceServers: IceServer[], callbacks: WebRTCCallbacks): RTCPeerConnection {
    const { RTCPeerConnection: PeerConnection, MediaStream: Stream } = requireWebRTC();

    const pc = new PeerConnection({
      iceServers: iceServers.length > 0 ? iceServers : FALLBACK_ICE_SERVERS,
      // One transport carrying audio+video with multiplexed RTCP: fewer ports
      // to punch through, fewer candidates to gather, faster setup.
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // addEventListener rather than the onicecandidate/ontrack attributes:
    // react-native-webrtc installs those on the prototype at runtime via
    // defineEventAttribute and never declares them in its types, so assigning
    // them does not compile under `strict`.
    const events = listenersOf(pc);

    events.addEventListener('icecandidate', (event) => {
      if (event.candidate) callbacks.onIceCandidate(event.candidate);
    });

    events.addEventListener('track', (event) => {
      // `streams` is populated on the normal addTrack/unified-plan path; fall
      // back to wrapping the bare track for peers that offer without one.
      const stream = event.streams[0];
      if (stream) {
        callbacks.onTrack(stream);
      } else if (event.track) {
        callbacks.onTrack(new Stream([event.track]));
      }
    });

    events.addEventListener('connectionstatechange', () => {
      callbacks.onConnectionStateChange(pc.connectionState);
    });

    return pc;
  },

  async acquireLocalMedia(
    type: 'VOICE' | 'VIDEO',
    isFrontCamera: boolean = true,
  ): Promise<MediaStream | null> {
    try {
      // facingMode picks the camera; the old enumerateDevices/sourceId dance
      // was redundant and enumerateDevices is typed `Promise<unknown>` here.
      return await requireWebRTC().mediaDevices.getUserMedia({
        audio: true,
        video:
          type === 'VIDEO'
            ? {
                facingMode: isFrontCamera ? 'user' : 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
              }
            : false,
      });
    } catch (error) {
      console.error('Error acquiring local media:', error);
      return null;
    }
  },

  async createOffer(pc: RTCPeerConnection): Promise<SessionDescriptionInit> {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
  },

  async createAnswer(
    pc: RTCPeerConnection,
    remoteSdp: SessionDescriptionInit,
  ): Promise<SessionDescriptionInit> {
    await pc.setRemoteDescription(remoteSdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  },

  async setRemoteDescription(pc: RTCPeerConnection, sdp: SessionDescriptionInit): Promise<void> {
    await pc.setRemoteDescription(sdp);
  },

  async addIceCandidate(pc: RTCPeerConnection, candidate: IceCandidateInit): Promise<void> {
    const { RTCIceCandidate: IceCandidate } = requireWebRTC();
    await pc.addIceCandidate(new IceCandidate(candidate));
  },

  teardown(pc: RTCPeerConnection | null, stream: MediaStream | null) {
    if (stream) {
      // Copy first: removeTrack mutates the array getTracks() returns a view of.
      stream.getTracks().slice().forEach((track: MediaStreamTrack) => {
        track.stop();
        stream.removeTrack(track);
      });
    }

    if (pc) {
      // Detach senders before closing so the OS camera/mic indicator clears
      // promptly; close() alone can leave it lit for a beat on iOS.
      pc.getSenders().forEach((sender) => {
        try {
          pc.removeTrack(sender);
        } catch {
          /* sender already detached — closing below covers it */
        }
      });
      pc.close();
    }
  },
};
