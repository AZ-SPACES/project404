/**
 * Thin wrapper around react-native-incall-manager.
 *
 * Centralizes audio routing (earpiece vs speaker vs Bluetooth), ringtone /
 * ringback playback, and proximity-sensor handling for the call feature.
 * The store calls into these helpers on call-state transitions; UI just
 * toggles speaker.
 */

import InCallManager from 'react-native-incall-manager';

let started = false;

export const callAudioService = {
  /**
   * Caller side. Starts audio session and plays the local ringback tone
   * until the callee picks up. Defaults to earpiece for voice, speaker for
   * video.
   */
  startOutgoing(type: 'VOICE' | 'VIDEO') {
    InCallManager.start({ media: type === 'VIDEO' ? 'video' : 'audio' });
    InCallManager.setSpeakerphoneOn(type === 'VIDEO');
    InCallManager.setKeepScreenOn(true);
    InCallManager.startRingback('_DTMF_');
    started = true;
  },

  /**
   * Callee side. Plays the OS ringtone with vibration. The audio session
   * is started in `connected()` once the user accepts, so we don't grab
   * the mic while just ringing.
   */
  startIncoming() {
    InCallManager.startRingtone('_BUNDLE_');
    started = true;
  },

  /**
   * Both sides — call is now active. Stop any ring/ringback tones and lock
   * in the routing for the call type.
   */
  connected(type: 'VOICE' | 'VIDEO') {
    InCallManager.stopRingtone();
    InCallManager.stopRingback();
    // For incoming calls the session wasn't started yet.
    if (!started) {
      InCallManager.start({ media: type === 'VIDEO' ? 'video' : 'audio' });
      started = true;
    }
    InCallManager.setSpeakerphoneOn(type === 'VIDEO');
    InCallManager.setKeepScreenOn(true);
  },

  setSpeaker(on: boolean) {
    InCallManager.setSpeakerphoneOn(on);
  },

  /**
   * Call has ended or was declined/missed. Releases the audio session and
   * restores normal screen/volume behavior.
   */
  stop() {
    if (!started) return;
    InCallManager.stopRingtone();
    InCallManager.stopRingback();
    InCallManager.setKeepScreenOn(false);
    InCallManager.stop();
    started = false;
  },
};
