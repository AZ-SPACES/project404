"use client";

import { useState } from "react";
import { broadcastNotification } from "@/lib/admin-api";
import { Bell, Users, ShieldCheck, Zap, CheckCircle2, Send } from "lucide-react";

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
    description: "Deliver to every registered account",
    icon: <Users size={20} />,
  },
  {
    value: "KYC_VERIFIED",
    label: "KYC Verified",
    description: "Only users who have completed identity verification",
    icon: <ShieldCheck size={20} />,
  },
  {
    value: "ACTIVE_ONLY",
    label: "Active Users",
    description: "Only accounts in good standing",
    icon: <Zap size={20} />,
  },
];

export default function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await broadcastNotification(title.trim(), body.trim(), audience, imageUrl.trim() || undefined);
      setResult(res.sent);
      setTitle("");
      setBody("");
      setImageUrl("");
    } catch (e: any) {
      setError(e.message ?? "Failed to send notification");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Notifications</h1>
        <p className="text-white/50 text-sm">
          Broadcast push notifications and in-app messages to users
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {result !== null && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-green-400 text-sm mb-6 flex items-center gap-2">
          <CheckCircle2 size={16} />
          Notification sent to {result.toLocaleString()} user{result !== 1 ? "s" : ""}
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-6">
        {/* Audience selector */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-3">Audience</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {AUDIENCES.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setAudience(a.value)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  audience === a.value
                    ? "bg-[#F5A623]/10 border-[#F5A623]/40 text-white"
                    : "bg-[#1a1a1a] border-white/5 text-white/60 hover:border-white/15 hover:text-white"
                }`}
              >
                <div
                  className={`mb-2 ${
                    audience === a.value ? "text-[#F5A623]" : "text-white/40"
                  }`}
                >
                  {a.icon}
                </div>
                <div className="text-sm font-medium">{a.label}</div>
                <div className="text-xs text-white/40 mt-0.5 leading-snug">{a.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-white/70">Title</label>
            <span className="text-xs text-white/30">{title.length}/100</span>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 100))}
            placeholder="Notification title"
            className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-[#F5A623]/50 text-sm transition-colors"
            required
          />
        </div>

        {/* Body */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-white/70">Message</label>
            <span className="text-xs text-white/30">{body.length}/500</span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 500))}
            placeholder="Notification message body"
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-[#F5A623]/50 text-sm resize-none transition-colors"
            required
          />
        </div>

        {/* Image URL */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-white/70">Image URL (Optional)</label>
          </div>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.png"
            className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-[#F5A623]/50 text-sm transition-colors"
          />
        </div>

        {/* Preview */}
        {(title || body) && (
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">Preview</label>
            <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5 flex items-start gap-4">
              {/* Phone-like notification card */}
              <div className="flex-1 max-w-sm mx-auto bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-md bg-[#F5A623]/20 flex items-center justify-center flex-shrink-0">
                    <Bell size={12} className="text-[#F5A623]" />
                  </div>
                  <span className="text-xs text-white/40 font-medium">aza · now</span>
                </div>
                {imageUrl && (
                  <div className="mb-2 w-full h-32 rounded-lg bg-black/20 overflow-hidden relative border border-white/5">
                    {/* We use standard img for simple admin preview to avoid Next.js Image host config issues */}
                    <img 
                      src={imageUrl} 
                      alt="Notification preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://via.placeholder.com/400x200/1a1a1a/F5A623?text=Invalid+Image+URL";
                      }}
                    />
                  </div>
                )}
                <div className="text-sm font-semibold text-white mb-0.5 leading-snug">
                  {title || <span className="text-white/20">Title here</span>}
                </div>
                <div className="text-xs text-white/50 leading-relaxed">
                  {body || <span className="text-white/20">Message body here</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={sending || !title.trim() || !body.trim()}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#F5A623] hover:bg-[#F5A623]/90 text-black font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? (
            <>
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send size={16} />
              Send Notification
            </>
          )}
        </button>

        <p className="text-xs text-white/25 text-center">
          Notifications are delivered immediately via FCM push and in-app notification center
        </p>
      </form>
    </div>
  );
}
