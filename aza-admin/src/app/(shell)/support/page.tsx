"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getSupportChats,
  getSupportStats,
  SupportChatSummary,
  SupportStats,
  Page,
} from "@/lib/admin-api";
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

function StatusBadge({ status }: { status: SupportChatSummary["status"] }) {
  const map: Record<string, { dot: string; label: string }> = {
    OPEN: { dot: "bg-emerald-400", label: "Open" },
    PENDING: { dot: "bg-amber-400", label: "Pending" },
    RESOLVED: { dot: "bg-white/30", label: "Resolved" },
  };
  const cfg = map[status] ?? map.OPEN;
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
        {cfg.label}
      </span>
    </span>
  );
}

function PriorityBadge({ priority }: { priority: SupportChatSummary["priority"] }) {
  if (priority === "URGENT") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/20">
        Urgent
      </span>
    );
  }
  if (priority === "HIGH") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20">
        High
      </span>
    );
  }
  return null;
}

type FilterTab = "ALL" | "OPEN" | "RESOLVED";

export default function SupportPage() {
  const router = useRouter();
  const [data, setData] = useState<Page<SupportChatSummary> | null>(null);
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [page, setPage] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load stats once on mount
  useEffect(() => {
    getSupportStats().then(setStats).catch(() => {});
  }, []);

  const load = useCallback(async (p: number, filter: FilterTab) => {
    setLoading(true);
    setError(null);
    try {
      const status = filter === "ALL" ? undefined : filter;
      const res = await getSupportChats(p, 20, status);
      setData(res);
      setPage(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load support chats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0, activeFilter);
  }, [load, activeFilter]);

  const handleFilterChange = (f: FilterTab) => {
    if (f === activeFilter) return;
    setActiveFilter(f);
    setPage(0);
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "OPEN", label: "Open" },
    { key: "RESOLVED", label: "Resolved" },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-1">Support</h1>
        <p className="text-white/50 text-sm">User support conversations</p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => handleFilterChange("OPEN")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              activeFilter === "OPEN"
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {stats.open} Open
          </button>
          <button
            onClick={() => handleFilterChange("RESOLVED")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              activeFilter === "RESOLVED"
                ? "bg-white/10 border-white/20 text-white/80"
                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-white/30" />
            {stats.resolved} Resolved
          </button>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleFilterChange(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeFilter === tab.key
                ? "bg-[#F5A623] text-black"
                : "text-white/50 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
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
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                    {chat.userAvatar ? (
                      <img src={chat.userAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-white/60">
                        {chat.userName?.charAt(0)?.toUpperCase() ?? <User size={18} className="text-white/40" />}
                      </span>
                    )}
                  </div>
                  {/* Unread badge */}
                  {chat.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F5A623] text-black text-[10px] font-bold flex items-center justify-center">
                      {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-white truncate">
                        {chat.userName}
                        {chat.userHandle && (
                          <span className="text-white/40 font-normal ml-2">@{chat.userHandle}</span>
                        )}
                      </span>
                      <PriorityBadge priority={chat.priority} />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <StatusBadge status={chat.status} />
                      <span className="text-xs text-white/30 flex items-center gap-1">
                        <Clock size={11} />
                        {timeAgo(chat.lastMessageAt)}
                      </span>
                    </div>
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
            onClick={() => load(page - 1, activeFilter)}
            disabled={page === 0 || loading}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-white/50">
            {page + 1} / {data.totalPages}
          </span>
          <button
            onClick={() => load(page + 1, activeFilter)}
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
