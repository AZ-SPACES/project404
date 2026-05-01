"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupportChats, SupportChatSummary, Page } from "@/lib/admin-api";
import { MessageCircle, User, Clock } from "lucide-react";

function timeAgo(iso: string | null) {
  if (!iso) return "No messages";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function SupportPage() {
  const router = useRouter();
  const [data, setData] = useState<Page<SupportChatSummary> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSupportChats(p, 20);
      setData(res);
      setPage(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load support chats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Support</h1>
        <p className="text-white/50 text-sm">User support conversations</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data?.content.length === 0 ? (
        <div className="text-center py-24 text-white/30">
          <MessageCircle size={40} className="mx-auto mb-4 opacity-40" />
          <p>No support conversations yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.content.map((chat) => (
            <button
              key={chat.chatId}
              onClick={() => router.push(`/support/${chat.chatId}`)}
              className="w-full text-left bg-[#1a1a1a] hover:bg-[#222] border border-white/5 rounded-xl px-5 py-4 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {chat.userAvatar ? (
                    <img src={chat.userAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={18} className="text-white/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white truncate">
                      {chat.userName}
                      {chat.userHandle && (
                        <span className="text-white/40 font-normal ml-2">@{chat.userHandle}</span>
                      )}
                    </span>
                    <span className="text-xs text-white/30 flex-shrink-0 ml-3 flex items-center gap-1">
                      <Clock size={11} />
                      {timeAgo(chat.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-sm text-white/50 truncate">
                    {chat.lastMessage ?? "No messages yet"}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => load(page - 1)}
            disabled={page === 0 || loading}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-white/50">
            {page + 1} / {data.totalPages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= data.totalPages - 1 || loading}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
