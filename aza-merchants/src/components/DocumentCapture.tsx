"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, X, Flashlight, ZoomIn } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = "permission" | "scanning" | "liveness" | "confirm" | "done";
type Quality = "ok" | "blurry" | "dark" | "glare" | "tooFar" | "tilted";

interface Props {
  docLabel: string;
  onCapture: (file: File) => Promise<void>;
  onCancel: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BLUR_THRESHOLD       = 80;   // Laplacian variance — below this = blurry
const DARK_THRESHOLD       = 55;   // avg brightness — below = too dark
const GLARE_THRESHOLD      = 235;  // avg brightness — above = glare
const STABLE_FRAMES        = 12;   // frames that must pass before auto-capture
const LIVENESS_TILT_MS     = 2200; // ms user has to tilt the document

const QUALITY_MESSAGES: Record<Quality, string> = {
  ok:      "Hold still…",
  blurry:  "Too blurry — hold steady",
  dark:    "Too dark — find better lighting",
  glare:   "Glare detected — adjust angle",
  tooFar:  "Move closer to the document",
  tilted:  "Tilt document slightly to verify it's real",
};

// ── Blur detection via Laplacian variance ────────────────────────────────────

function laplacianVariance(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const img = ctx.getImageData(0, 0, w, h);
  const d   = img.data;
  let sum = 0, sumSq = 0, n = 0;

  // Laplacian kernel: 0,1,0 / 1,-4,1 / 0,1,0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const gray = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      const lap  =
        4 * gray
        - (d[((y - 1) * w + x) * 4] * 0.299 + d[((y - 1) * w + x) * 4 + 1] * 0.587 + d[((y - 1) * w + x) * 4 + 2] * 0.114)
        - (d[((y + 1) * w + x) * 4] * 0.299 + d[((y + 1) * w + x) * 4 + 1] * 0.587 + d[((y + 1) * w + x) * 4 + 2] * 0.114)
        - (d[(y * w + x - 1) * 4] * 0.299 + d[(y * w + x - 1) * 4 + 1] * 0.587 + d[(y * w + x - 1) * 4 + 2] * 0.114)
        - (d[(y * w + x + 1) * 4] * 0.299 + d[(y * w + x + 1) * 4 + 1] * 0.587 + d[(y * w + x + 1) * 4 + 2] * 0.114);
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

function avgBrightness(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const d = ctx.getImageData(0, 0, w, h).data;
  let total = 0;
  for (let i = 0; i < d.length; i += 16) { // sample every 4th pixel
    total += (d[i] + d[i + 1] + d[i + 2]) / 3;
  }
  return total / (d.length / 16);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DocumentCapture({ docLabel, onCapture, onCancel }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number>(0);
  const stableRef   = useRef(0);
  const livenessRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase]         = useState<Phase>("permission");
  const [quality, setQuality]     = useState<Quality>("blurry");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [livenessOk, setLivenessOk] = useState(false);
  const [livenessCount, setLivenessCount] = useState(0); // 0-100 progress

  // ── Camera start ───────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setPhase("scanning"); // video element renders after this; useEffect below attaches the stream
    } catch {
      setPhase("permission");
    }
  }, []);

  // Attach stream once the video element is in the DOM (phase === "scanning")
  useEffect(() => {
    if (phase !== "scanning" || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [phase]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => { startCamera(); return stopCamera; }, [startCamera, stopCamera]);

  // ── Quality analysis loop ──────────────────────────────────────────────────

  // Frame capture — declared before the analysis effect below (which invokes it) so
  // the React Compiler can see it before use and preserve its memoization.
  const captureFrame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const video = videoRef.current;
    if (!video) return;

    const W = video.videoWidth, H = video.videoHeight;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    c.getContext("2d")!.drawImage(video, 0, 0, W, H);

    c.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], "document.jpg", { type: "image/jpeg" });
      const url  = URL.createObjectURL(blob);
      setCapturedFile(file);
      setCapturedUrl(url);
      setPhase("liveness");
    }, "image/jpeg", 0.92);
  }, []);

  useEffect(() => {
    if (phase !== "scanning") return;

    const analyse = () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(analyse); return;
      }

      const W = 320, H = 200; // downsample for performance
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, W, H);

      const blur   = laplacianVariance(ctx, W, H);
      const bright = avgBrightness(ctx, W, H);

      let q: Quality = "ok";
      if (bright < DARK_THRESHOLD)  q = "dark";
      else if (bright > GLARE_THRESHOLD) q = "glare";
      else if (blur < BLUR_THRESHOLD)    q = "blurry";

      setQuality(q);

      if (q === "ok") {
        stableRef.current++;
        if (stableRef.current >= STABLE_FRAMES) {
          // Capture and move to liveness check
          captureFrame();
        }
      } else {
        stableRef.current = 0;
      }

      rafRef.current = requestAnimationFrame(analyse);
    };

    rafRef.current = requestAnimationFrame(analyse);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Liveness timer ────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "liveness") return;
    setLivenessCount(0);
    const start = Date.now();
    const tick  = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / LIVENESS_TILT_MS) * 100));
      setLivenessCount(pct);
      if (elapsed >= LIVENESS_TILT_MS) {
        clearInterval(tick);
        setLivenessOk(true);
        setPhase("confirm");
      }
    }, 50);
    return () => clearInterval(tick);
  }, [phase]);

  // ── Frame capture ─────────────────────────────────────────────────────────

  const retake = useCallback(() => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedFile(null);
    setLivenessOk(false);
    stableRef.current = 0;
    setPhase("scanning");
  }, [capturedUrl]);

  const confirmUpload = useCallback(async () => {
    if (!capturedFile) return;
    setUploading(true);
    try {
      await onCapture(capturedFile);
      setPhase("done");
    } finally {
      setUploading(false);
    }
  }, [capturedFile, onCapture]);

  // ── Renders ───────────────────────────────────────────────────────────────

  if (phase === "permission") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center px-6 text-center">
        <Camera size={40} className="text-[#B7EE7A] mb-4" />
        <h2 className="text-white font-bold text-lg mb-2">Camera access needed</h2>
        <p className="text-white/40 text-sm mb-6 max-w-xs">
          Allow camera access in your browser settings, then tap the button below.
        </p>
        <button onClick={startCamera}
          className="px-6 py-3 rounded-2xl bg-[#B7EE7A] text-[#0e2a0e] font-bold text-sm">
          Allow camera
        </button>
        <button onClick={onCancel} className="mt-4 text-white/30 text-sm">Cancel</button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#B7EE7A]/15 flex items-center justify-center mb-4">
          <Check size={32} className="text-[#B7EE7A]" />
        </div>
        <p className="text-white font-bold text-lg">Uploaded</p>
        <p className="text-white/40 text-sm mt-1">{docLabel}</p>
      </div>
    );
  }

  if (phase === "confirm" || phase === "liveness") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Preview */}
        <div className="flex-1 relative overflow-hidden">
          {capturedUrl && (
            <img src={capturedUrl} alt="Captured document"
              className="w-full h-full object-contain" />
          )}

          {/* Liveness overlay */}
          {phase === "liveness" && (
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 px-6 bg-black/50">
              <div className="w-full max-w-xs bg-white/10 rounded-full h-2 mb-3 overflow-hidden">
                <div className="h-full bg-[#B7EE7A] rounded-full transition-all duration-75"
                  style={{ width: `${livenessCount}%` }} />
              </div>
              <p className="text-white font-semibold text-sm text-center">
                Slowly tilt the document left and right
              </p>
              <p className="text-white/40 text-xs mt-1 text-center">
                Verifying it&apos;s a physical document…
              </p>
            </div>
          )}
        </div>

        {/* Actions (only shown after liveness passes) */}
        {phase === "confirm" && (
          <div className="bg-[#0f0f0f] px-5 pt-5 pb-8 space-y-3">
            <p className="text-white font-semibold text-sm text-center mb-1">{docLabel}</p>
            <button onClick={confirmUpload} disabled={uploading}
              className="w-full py-3.5 rounded-2xl bg-[#B7EE7A] text-[#0e2a0e] font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {uploading
                ? <><span className="w-4 h-4 border-2 border-[#0e2a0e]/30 border-t-[#0e2a0e] rounded-full animate-spin" />Uploading…</>
                : <><Check size={16} />Use this photo</>}
            </button>
            <button onClick={retake} disabled={uploading}
              className="w-full py-3 rounded-2xl border border-white/10 text-white/60 font-medium text-sm flex items-center justify-center gap-2">
              <RotateCcw size={14} />Retake
            </button>
          </div>
        )}
      </div>
    );
  }

  // scanning phase
  const isOk = quality === "ok";
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Cancel */}
      <button onClick={() => { stopCamera(); onCancel(); }}
        className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
        <X size={18} className="text-white" />
      </button>

      {/* Live video */}
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted
          className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Document frame overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Dark surround */}
          <div className="absolute inset-0 bg-black/45" />

          {/* Card cutout */}
          <div className="relative z-10 w-[85vw] max-w-sm"
            style={{ aspectRatio: "85.6/54" }}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 856 540" fill="none">
              {/* Corner marks */}
              {[
                [0,0,1,0,0,1], [856,0,-1,0,0,1],
                [0,540,1,0,0,-1], [856,540,-1,0,0,-1],
              ].map(([x,y,dx1,dy1,dx2,dy2], i) => (
                <g key={i}>
                  <line x1={x} y1={y} x2={x+dx1*80} y2={y+dy1*80}
                    stroke={isOk ? "#B7EE7A" : "white"} strokeWidth="6" strokeLinecap="round" />
                  <line x1={x} y1={y} x2={x+dx2*80} y2={y+dy2*80}
                    stroke={isOk ? "#B7EE7A" : "white"} strokeWidth="6" strokeLinecap="round" />
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Quality feedback */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
          <div className={`px-5 py-2.5 rounded-full text-sm font-semibold backdrop-blur-sm transition-colors ${
            isOk
              ? "bg-[#B7EE7A]/20 text-[#B7EE7A] border border-[#B7EE7A]/30"
              : "bg-black/60 text-white/70 border border-white/10"
          }`}>
            {QUALITY_MESSAGES[quality]}
          </div>
        </div>
      </div>

      {/* Label + manual shutter */}
      <div className="bg-[#0f0f0f] px-5 pt-4 pb-8 flex flex-col items-center gap-3">
        <p className="text-white/50 text-xs">{docLabel}</p>
        <button onClick={captureFrame}
          className="w-16 h-16 rounded-full border-4 border-white/20 bg-white/10 flex items-center justify-center active:scale-95 transition-transform">
          <Camera size={24} className="text-white" />
        </button>
        <p className="text-white/25 text-[11px]">Auto-captures when ready · or tap to capture manually</p>
      </div>
    </div>
  );
}
