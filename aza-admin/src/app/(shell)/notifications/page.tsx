"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { broadcastNotification } from "@/lib/admin-api";
import {
  Bell,
  Users,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Send,
  X,
  AlertTriangle,
} from "lucide-react";

type Audience = "ALL" | "KYC_VERIFIED" | "ACTIVE_ONLY";

const AUDIENCES: {
  value: Audience;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "ALL",
    label: "All Users",
    description: "Every registered account",
    icon: <Users size={16} />,
  },
  {
    value: "KYC_VERIFIED",
    label: "KYC Verified",
    description: "Identity-verified users only",
    icon: <ShieldCheck size={16} />,
  },
  {
    value: "ACTIVE_ONLY",
    label: "Active Only",
    description: "Accounts in good standing",
    icon: <Zap size={16} />,
  },
];

const TITLE_MAX = 80;
const BODY_MAX = 200;

function ComposeModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [imageUrl, setImageUrl] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState<number | null>(null);

  const sendMutation = useMutation({
    mutationFn: () =>
      broadcastNotification(title.trim(), body.trim(), audience, imageUrl.trim() || undefined),
    onSuccess: (res) => {
      setSent(res.sent);
      setConfirming(false);
    },
  });

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  if (sent !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70" onClick={onClose} />
        <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Notification Sent</h3>
          <p className="text-white/50 text-sm mb-6">
            Delivered to{" "}
            <span className="text-white font-semibold">{sent.toLocaleString()}</span>{" "}
            user{sent !== 1 ? "s" : ""}
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black font-semibold text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (confirming) {
    const audienceLabel = AUDIENCES.find((a) => a.value === audience)?.label ?? audience;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70" onClick={() => setConfirming(false)} />
        <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Confirm Broadcast</h3>
              <p className="text-xs text-white/40">This cannot be undone</p>
            </div>
          </div>

          <div className="bg-white/4 border border-white/8 rounded-xl p-4 mb-5 space-y-2.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-white/40 flex-shrink-0">Audience</span>
              <span className="text-white font-medium text-right">{audienceLabel}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-white/40 flex-shrink-0">Title</span>
              <span className="text-white font-medium text-right truncate max-w-[200px]">{title}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-white/40 flex-shrink-0">Message</span>
              <span className="text-white/70 text-right text-xs leading-relaxed max-w-[200px] line-clamp-3">{body}</span>
            </div>
          </div>

          {sendMutation.error && (
            <p className="text-red-400 text-sm mb-3">{(sendMutation.error as Error).message}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setConfirming(false)}
              disabled={sendMutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white/60 hover:text-white text-sm font-medium transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {sendMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send size={14} />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
          <h2 className="text-base font-semibold text-white">Compose Broadcast</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Audience */}
          <div>
            <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              Audience
            </label>
            <div className="flex gap-2 flex-wrap">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudience(a.value)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
                    audience === a.value
                      ? "bg-[#B7EE7A]/10 border-[#B7EE7A]/40 text-white"
                      : "bg-white/3 border-white/8 text-white/50 hover:text-white hover:border-white/20"
                  }`}
                >
                  <span className={audience === a.value ? "text-[#B7EE7A]" : "text-white/30"}>
                    {a.icon}
                  </span>
                  {a.label}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      audience === a.value
                        ? "bg-[#B7EE7A]/20 text-[#B7EE7A]"
                        : "bg-white/5 text-white/30"
                    }`}
                  >
                    {a.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Form fields */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                    Title
                  </label>
                  <span
                    className={`text-xs ${
                      title.length >= TITLE_MAX ? "text-amber-400" : "text-white/30"
                    }`}
                  >
                    {title.length}/{TITLE_MAX}
                  </span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                  placeholder="Notification title"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/40 text-sm transition-colors"
                />
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                    Message
                  </label>
                  <span
                    className={`text-xs ${
                      body.length >= BODY_MAX ? "text-amber-400" : "text-white/30"
                    }`}
                  >
                    {body.length}/{BODY_MAX}
                  </span>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
                  placeholder="Notification message body"
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/40 text-sm resize-none transition-colors"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5">
                  Image URL{" "}
                  <span className="normal-case font-normal text-white/25">(optional)</span>
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.png"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white placeholder-white/25 focus:outline-none focus:border-[#B7EE7A]/40 text-sm transition-colors"
                />
              </div>
            </div>

            {/* Preview panel */}
            <div>
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                Preview
              </label>
              <div className="bg-white/3 border border-white/5 rounded-xl p-4">
                {/* Phone notification card */}
                <div className="bg-[#2a2a2a] rounded-2xl p-3.5 shadow-lg border border-white/8">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-6 h-6 rounded-md bg-[#B7EE7A]/20 border border-[#B7EE7A]/20 flex items-center justify-center flex-shrink-0">
                      <Bell size={12} className="text-[#B7EE7A]" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-[11px] font-semibold text-white/60">aza</span>
                      <span className="text-[10px] text-white/30">· now</span>
                    </div>
                  </div>
                  {imageUrl && (
                    <div className="mb-2.5 w-full h-24 rounded-lg bg-black/20 overflow-hidden border border-white/5">
                      <img
                        src={imageUrl}
                        alt="Notification preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <p className="text-sm font-semibold text-white leading-snug mb-0.5">
                    {title || (
                      <span className="text-white/20 font-normal">Notification title</span>
                    )}
                  </p>
                  <p className="text-xs text-white/50 leading-relaxed">
                    {body || (
                      <span className="text-white/20">Message body here…</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex-shrink-0">
          <button
            onClick={() => setConfirming(true)}
            disabled={!canSend}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={15} />
            Send Notification
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1">Notifications</h1>
          <p className="text-white/50 text-sm">
            Broadcast push notifications and in-app messages to users
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black font-semibold text-sm transition-colors flex-shrink-0"
        >
          <Send size={15} />
          Send Broadcast
        </button>
      </div>

      {/* Audience info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          {
            icon: <Users size={20} />,
            label: "All Users",
            description: "Deliver to every registered account",
            color: "text-white/60",
          },
          {
            icon: <ShieldCheck size={20} />,
            label: "KYC Verified",
            description: "Only identity-verified users",
            color: "text-emerald-400",
          },
          {
            icon: <Zap size={20} />,
            label: "Active Only",
            description: "Accounts in good standing",
            color: "text-amber-400",
          },
        ].map((card) => (
          <div key={card.label} className="bg-[#161616] border border-white/5 rounded-xl p-4">
            <div className={`mb-2 ${card.color}`}>{card.icon}</div>
            <p className="text-sm font-semibold text-white">{card.label}</p>
            <p className="text-xs text-white/40 mt-0.5 leading-snug">{card.description}</p>
          </div>
        ))}
      </div>

      {/* Info panel */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#B7EE7A]/10 border border-[#B7EE7A]/20 flex items-center justify-center flex-shrink-0">
            <Bell size={18} className="text-[#B7EE7A]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Push Notification Broadcasts</p>
            <p className="text-xs text-white/40 mt-0.5">
              Notifications are delivered immediately via FCM push and in-app notification center
            </p>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-white/50">
          <li className="flex items-start gap-2">
            <span className="text-[#B7EE7A] mt-0.5 flex-shrink-0">·</span>
            Title is limited to {TITLE_MAX} characters
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#B7EE7A] mt-0.5 flex-shrink-0">·</span>
            Message body is limited to {BODY_MAX} characters
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#B7EE7A] mt-0.5 flex-shrink-0">·</span>
            Broadcasts are irreversible — always preview before sending
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#B7EE7A] mt-0.5 flex-shrink-0">·</span>
            Optionally attach an image URL for rich notifications
          </li>
        </ul>
      </div>

      {modalOpen && <ComposeModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
