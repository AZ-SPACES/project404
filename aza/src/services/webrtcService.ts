import {
  RTCPeerConnection,
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCSessionDescription,
  Configuration,
} from 'react-native-webrtc';
import { Platform } from 'react-native';

export type WebRTCCallbacks = {
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onTrack: (stream: MediaStream) => void;
  onConnectionStateChange: (state: string) => void;
};

export const webrtcService = {
  createPeerConnection(
    iceServers: any[],
    callbacks: WebRTCCallbacks
  ): RTCPeerConnection {
    const configuration: Configuration = {
      iceServers: iceServers.length > 0 ? iceServers : [{ urls: 'stun:stun.l.google.com:19302' }],
      // Add optional standard options if needed
    };

    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        callbacks.onIceCandidate(event.candidate);
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        callbacks.onTrack(event.streams[0]);
      } else {
        // Fallback for older spec
        const stream = new MediaStream([event.track]);
        callbacks.onTrack(stream);
      }
    };

    pc.onconnectionstatechange = () => {
      callbacks.onConnectionStateChange(pc.connectionState);
    };

    return pc;
  },

  async acquireLocalMedia(type: 'VOICE' | 'VIDEO', isFrontCamera: boolean = true): Promise<MediaStream | null> {
    try {
      const isVideo = type === 'VIDEO';
      
      let videoConstraints: any = false;
      if (isVideo) {
        // Find front or back camera
        let sourceId;
        try {
          const devices = await mediaDevices.enumerateDevices();
          const videoInfo = devices.filter((d: any) => d.kind === 'videoinput');
          const cameraInfo = videoInfo.find((d: any) => 
             d.facing === (isFrontCamera ? 'front' : 'environment')
          );
          if (cameraInfo) {
            sourceId = cameraInfo.deviceId;
          }
        } catch (err) {
          console.log('Error enumerating devices', err);
        }

        videoConstraints = {
          mandatory: {
            minWidth: 500,
            minHeight: 300,
            minFrameRate: 30,
          },
          facingMode: isFrontCamera ? 'user' : 'environment',
          optional: sourceId ? [{ sourceId }] : [],
        };
      }

      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: videoConstraints,
      });

      return stream;
    } catch (error) {
      console.error('Error acquiring local media:', error);
      return null;
    }
  },

  async createOffer(pc: RTCPeerConnection): Promise<RTCSessionDescription> {
    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    return offer;
  },

  async createAnswer(pc: RTCPeerConnection, remoteSdp: RTCSessionDescription): Promise<RTCSessionDescription> {
    await pc.setRemoteDescription(remoteSdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  },

  async setRemoteDescription(pc: RTCPeerConnection, sdp: RTCSessionDescription): Promise<void> {
    await pc.setRemoteDescription(sdp);
  },

  async addIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidate): Promise<void> {
    await pc.addIceCandidate(candidate);
  },

  teardown(pc: RTCPeerConnection | null, stream: MediaStream | null) {
    if (stream) {
      stream.getTracks().forEach((track: any) => {
        track.stop();
        stream.removeTrack(track);
      });
    }
    
    if (pc) {
      // pc.getSenders() is not fully supported in older RNWebRTC versions,
      // but closing the PC stops all streams implicitly.
      pc.close();
    }
  },
};
