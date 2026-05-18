"use client";

import { useEffect, useState, useRef } from "react";
import { X, Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

interface SupportCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  userName: string;
}

export default function SupportCallModal({ isOpen, onClose, chatId, userName }: SupportCallModalProps) {
  const [status, setStatus] = useState<"connecting" | "ringing" | "connected" | "ended">("connecting");
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "connected") {
      interval = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (isOpen) {
      setStatus("ringing");
      const timer = setTimeout(() => setStatus("connected"), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-[#1c1c1c] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 ring-4 ring-[#F5A623]/20">
            <User size={48} className="text-[#F5A623]" />
          </div>
          
          <h2 className="text-xl font-semibold mb-1">{userName}</h2>
          <p className="text-sm text-white/40 mb-8 uppercase tracking-widest">
            {status === "ringing" ? "Ringing..." : status === "connected" ? formatTime(duration) : "Connecting..."}
          </p>

          <div className="flex items-center gap-6 mb-8">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-4 rounded-full transition-colors ${isMuted ? "bg-white/10 text-white" : "bg-white/5 text-white/60 hover:text-white"}`}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <button
              onClick={() => setIsSpeaker(!isSpeaker)}
              className={`p-4 rounded-full transition-colors ${!isSpeaker ? "bg-white/10 text-white" : "bg-white/5 text-white/60 hover:text-white"}`}
            >
              {isSpeaker ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>
          </div>

          <button
            onClick={() => {
              setStatus("ended");
              setTimeout(onClose, 1000);
            }}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
          >
            <PhoneOff size={28} />
          </button>
        </div>
      </div>
    </div>
  );
}

function User({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
