/**
 * Thin wrapper around react-native-incall-manager.
 *
 * Centralizes audio routing (earpiece vs speaker vs Bluetooth), ringtone /
 * ringback playback, and screen-wake handling for the call feature. The store
 * calls into these helpers on call-state transitions; UI just toggles speaker.
 */

import InCallManager from 'react-native-incall-manager';

/**
 * Two independent flags, deliberately. The audio *session* (which grabs the
 * mic and owns routing) and the *ringing* tones have different lifetimes: the
 * callee rings without a session, then starts one only on accept. Collapsing
 * both into a single `started` flag makes `connected()` skip
 * InCallManager.start() on the incoming path — the callee gets no audio
 * session and the call is one-way.
 */
let sessionStarted = false;
let ringing = false;

// Matches CALL_TIMEOUT_SECONDS in the backend's CallService: past this the
// server marks the call missed, so there is nothing left to ring for.
const RING_TIMEOUT_SECONDS = 30;

/** Pause, buzz, pause — the conventional incoming-call cadence. */
const RING_VIBRATE_PATTERN = [0, 1000, 1000];

function startSession(type: 'VOICE' | 'VIDEO') {
  InCallManager.start({ media: type === 'VIDEO' ? 'video' : 'audio' });
  sessionStarted = true;
}

export const callAudioService = {
  /**
   * Caller side. Starts the audio session and plays the local ringback tone
   * until the callee picks up. Earpiece for voice, speaker for video.
   */
  startOutgoing(type: 'VOICE' | 'VIDEO') {
    startSession(type);
    InCallManager.setSpeakerphoneOn(type === 'VIDEO');
    InCallManager.setKeepScreenOn(true);
    InCallManager.startRingback('_DTMF_');
    ringing = true;
  },

  /**
   * Callee side. Plays the OS ringtone with vibration. No audio session yet —
   * `connected()` starts one on accept, so we don't hold the mic while merely
   * ringing. '_DEFAULT_' rather than '_BUNDLE_': the app ships no
   * incallmanager_ringtone asset, and _BUNDLE_ would find nothing to play.
   */
  startIncoming() {
    InCallManager.startRingtone(
      '_DEFAULT_',
      RING_VIBRATE_PATTERN,
      'playback',
      RING_TIMEOUT_SECONDS,
    );
    ringing = true;
  },

  /**
   * Both sides — the call is now active. Stops any ring/ringback tone and
   * locks in routing for the call type, starting the session first if this is
   * the callee (who was only ringing until now).
   */
  connected(type: 'VOICE' | 'VIDEO') {
    if (ringing) {
      InCallManager.stopRingtone();
      InCallManager.stopRingback();
      ringing = false;
    }
    if (!sessionStarted) startSession(type);
    InCallManager.setSpeakerphoneOn(type === 'VIDEO');
    InCallManager.setKeepScreenOn(true);
  },

  setSpeaker(on: boolean) {
    InCallManager.setSpeakerphoneOn(on);
  },

  /**
   * Call ended, declined or missed. Releases the audio session and restores
   * normal screen behavior. Safe to call more than once — endCurrentCall and
   * the call.end signal handler can both land.
   */
  stop() {
    if (ringing) {
      InCallManager.stopRingtone();
      InCallManager.stopRingback();
      ringing = false;
    }
    if (!sessionStarted) return;
    InCallManager.setKeepScreenOn(false);
    InCallManager.stop();
    sessionStarted = false;
  },
};
