/**
 * AzaQrLogin — Drop-in "Login with Aza" QR component
 *
 * The user scans this QR with their Aza mobile app. No password, no redirect.
 *
 * SETUP — add two server-side proxy routes to your app:
 *
 *   POST /api/aza-auth/qr/start
 *     → calls POST https://api.aza.systems/oauth/qr/initiate (server-side, with client_secret)
 *     → returns { challengeToken, sessionSecret, qrImageBase64, ttlSeconds }
 *       (store sessionSecret in the session — never send it to the browser)
 *     → return to browser: { challengeToken, qrImageBase64, ttlSeconds }
 *
 *   POST /api/aza-auth/qr/complete
 *     body: { challengeToken: string }
 *     → reads sessionSecret from server session
 *     → calls POST https://api.aza.systems/oauth/qr/complete (server-side)
 *     → on success: sets session cookie, returns { user }
 *
 * Usage:
 *   <AzaQrLogin onSuccess={(user) => router.push('/ide')} />
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const AZA_API = 'https://api.aza.systems';
const POLL_INTERVAL_MS = 2000;

// Shape returned by your /api/aza-auth/qr/start proxy
interface QrSession {
  challengeToken: string;
  qrImageBase64: string;
  ttlSeconds: number;
}

// Shape returned by your /api/aza-auth/qr/complete proxy
interface AzaUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  email?: string;
}

type QrState = 'loading' | 'pending' | 'approved' | 'expired' | 'error';

interface AzaQrLoginProps {
  /** Called with the authenticated user object once the QR is scanned and complete */
  onSuccess: (user: AzaUser) => void;
  /** Called if an unrecoverable error occurs */
  onError?: (message: string) => void;
  /** Proxy route on your server that initiates the QR session. Default: /api/aza-auth/qr/start */
  startRoute?: string;
  /** Proxy route on your server that completes the QR login. Default: /api/aza-auth/qr/complete */
  completeRoute?: string;
  /** Pixel size of the QR code image. Default: 200 */
  size?: number;
}

export function AzaQrLogin({
  onSuccess,
  onError,
  startRoute = '/api/aza-auth/qr/start',
  completeRoute = '/api/aza-auth/qr/complete',
  size = 200,
}: AzaQrLoginProps) {
  const [qrState, setQrState]   = useState<QrState>('loading');
  const [session, setSession]   = useState<QrSession | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (pollRef.current)      clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const startSession = useCallback(async () => {
    clearTimers();
    setQrState('loading');
    setErrorMsg('');
    setSession(null);

    try {
      const res  = await fetch(startRoute, { method: 'POST' });
      const json = await res.json();

      if (!res.ok) throw new Error(json.message ?? 'Failed to start QR session');

      const s: QrSession = {
        challengeToken: json.challengeToken,
        qrImageBase64:  json.qrImageBase64,
        ttlSeconds:     json.ttlSeconds ?? 90,
      };
      setSession(s);
      setCountdown(s.ttlSeconds);
      setQrState('pending');

      // Countdown timer
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearTimers();
            setQrState('expired');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Poll Aza directly for status — no secret involved
      pollRef.current = setInterval(async () => {
        try {
          const statusRes  = await fetch(`${AZA_API}/oauth/qr/status/${s.challengeToken}`);
          const statusJson = await statusRes.json();
          const status: string = statusJson.data?.status ?? statusJson.status ?? 'PENDING';

          if (status === 'APPROVED') {
            clearTimers();
            setQrState('approved');

            // Complete login server-side (needs sessionSecret from server session)
            const completeRes  = await fetch(completeRoute, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ challengeToken: s.challengeToken }),
            });
            const completeJson = await completeRes.json();

            if (!completeRes.ok) throw new Error(completeJson.message ?? 'Login failed');
            onSuccess(completeJson.user ?? completeJson.data);

          } else if (status === 'EXPIRED') {
            clearTimers();
            setQrState('expired');
          }
        } catch (pollErr) {
          // Polling errors are transient — keep trying until TTL expires
          console.warn('[AzaQrLogin] poll error:', pollErr);
        }
      }, POLL_INTERVAL_MS);

    } catch (err: unknown) {
      clearTimers();
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setQrState('error');
      setErrorMsg(msg);
      onError?.(msg);
    }
  }, [startRoute, completeRoute, onSuccess, onError]);

  // Start on mount
  useEffect(() => {
    startSession();
    return clearTimers;
  }, [startSession]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={styles.wrapper}>

      {/* QR image area */}
      <div style={{ ...styles.qrBox, width: size + 24, height: size + 24 }}>
        {qrState === 'loading' && (
          <div style={styles.spinnerWrap}>
            <div style={styles.spinner} />
          </div>
        )}

        {(qrState === 'pending' || qrState === 'approved') && session && (
          <img
            src={`data:image/png;base64,${session.qrImageBase64}`}
            alt="Scan with Aza to log in"
            width={size}
            height={size}
            style={{
              display: 'block',
              opacity: qrState === 'approved' ? 0.3 : 1,
              transition: 'opacity 0.3s',
            }}
          />
        )}

        {qrState === 'approved' && (
          <div style={styles.overlay}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}

        {(qrState === 'expired' || qrState === 'error') && (
          <div style={styles.overlay}>
            <button onClick={startSession} style={styles.retryBtn}>
              {qrState === 'expired' ? '↻ Scan again' : '↻ Retry'}
            </button>
          </div>
        )}
      </div>

      {/* Status text */}
      <div style={styles.statusArea}>
        {qrState === 'loading' && (
          <p style={styles.hint}>Generating QR code…</p>
        )}
        {qrState === 'pending' && (
          <>
            <p style={styles.label}>Open <strong>Aza</strong> and scan this code</p>
            <p style={{ ...styles.hint, color: countdown < 20 ? '#f97316' : '#6b7280' }}>
              Expires in {countdown}s
            </p>
          </>
        )}
        {qrState === 'approved' && (
          <p style={{ ...styles.label, color: '#22c55e' }}>Signing you in…</p>
        )}
        {qrState === 'expired' && (
          <p style={{ ...styles.hint, color: '#f97316' }}>QR code expired — click to refresh</p>
        )}
        {qrState === 'error' && (
          <p style={{ ...styles.hint, color: '#ef4444' }}>{errorMsg}</p>
        )}
      </div>

      <p style={styles.footer}>
        Powered by <span style={{ color: '#16a34a', fontWeight: 700 }}>Aza</span>
      </p>
    </div>
  );
}

// ── Inline styles — no CSS deps ───────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            '12px',
    padding:        '24px',
    borderRadius:   '16px',
    border:         '1px solid #e5e7eb',
    background:     '#fff',
    fontFamily:     'system-ui, sans-serif',
    width:          'fit-content',
  },
  qrBox: {
    position:       'relative',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     '#f9fafb',
    borderRadius:   '12px',
    border:         '1px solid #e5e7eb',
    overflow:       'hidden',
  },
  overlay: {
    position:       'absolute',
    inset:          0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(2px)',
  },
  spinnerWrap: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    width:          '100%',
    height:         '100%',
  },
  spinner: {
    width:       '32px',
    height:      '32px',
    border:      '3px solid #e5e7eb',
    borderTop:   '3px solid #16a34a',
    borderRadius:'50%',
    animation:   'aza-spin 0.7s linear infinite',
  },
  statusArea: {
    textAlign:  'center',
    lineHeight: 1.4,
  },
  label: {
    margin:     0,
    fontSize:   '14px',
    color:      '#111827',
    fontWeight: 500,
  },
  hint: {
    margin:    '4px 0 0',
    fontSize:  '12px',
    color:     '#6b7280',
  },
  retryBtn: {
    padding:      '8px 20px',
    borderRadius: '8px',
    border:       'none',
    background:   '#16a34a',
    color:        '#fff',
    fontSize:     '13px',
    fontWeight:   600,
    cursor:       'pointer',
  },
  footer: {
    margin:   0,
    fontSize: '11px',
    color:    '#9ca3af',
  },
};

// Inject the spinner keyframes once
if (typeof document !== 'undefined' && !document.getElementById('aza-qr-style')) {
  const style = document.createElement('style');
  style.id = 'aza-qr-style';
  style.textContent = '@keyframes aza-spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}
