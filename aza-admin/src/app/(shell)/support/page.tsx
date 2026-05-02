"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getSupportChats,
  getSupportStats,
  SupportChatSummary,
  SupportStats,
  Page,
} from "@/lib/admin-api";
import { useSupportWs } from "@/lib/support-ws-context";
import { MessageCircle, User, Clock, Search, AlertCircle, Filter } from "lucide-react";

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SLA_THRESHOLDS_MINUTES: Record<string, number> = {
  URGENT: 60,
  HIGH: 240,
  NORMAL: 1440,
  LOW: 4320,
};

function getSlaStatus(priority: string, lastMessageAt: string | null): "ok" | "warning" | "breach" | null {
  if (!lastMessageAt) return null;
  const elapsed = (Date.now() - new Date(lastMessageAt).getTime()) / 60000;
  const threshold = SLA_THRESHOLDS_MINUTES[priority] ?? 1440;
  if (elapsed >= threshold) return "breach";
  if (elapsed >= threshold * 0.75) return "warning";
  return "ok";
}

function SlaBadge({ priority, lastMessageAt, status }: { priority: string; lastMessageAt: string | null; status: string }) {
  if (status === "RESOLVED") return null;
  const sla = getSlaStatus(priority, lastMessageAt);
  if (!sla || sla === "ok") return null;
  return (
    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
      sla === "breach"
        ? "bg-red-500/15 text-red-400 border-red-500/20"
        : "bg-amber-500/15 text-amber-400 border-amber-500/20"
    }`}>
      <AlertCircle size={9} />
      {sla === "breach" ? "SLA Breach" : "SLA Risk"}
    </span>
  );
}

function StatusBadge({ status }: { status: SupportChatSummary["status"] }) {
  const map: Record<string, { dot: string; label: string }> = {
    OPEN: { dot: "bg-emerald-400", label: "Open" },
    PENDING: { dot: "bg-amber-400", label: "Pending" },
    RESOLVED: { dot: "bg-white/20", label: "Resolved" },
  };
  const cfg = map[status] ?? map.OPEN;
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">{cfg.label}</span>
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

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/40 border border-white/10">
      {category}
    </span>
  );
}

type FilterStatus = "ALL" | "OPEN" | "PENDING" | "RESOLVED";

const CATEGORIES = ["All Categories", "BILLING", "TECHNICAL", "ACCOUNT", "KYC", "FRAUD", "GENERAL"];

export default function SupportPage() {
  const router = useRouter();
  const [data, setData] = useState<Page<SupportChatSummary> | null>(null);
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { clearUnread, addInboxListener, removeInboxListener } = useSupportWs();

  // Clear the nav badge when the inbox is open
  useEffect(() => {
    clearUnread();
  }, [clearUnread]);

  // Live inbox updates via WebSocket — upsert chat summary and re-sort by lastMessageAt
  useEffect(() => {
    const handleUpdate = (summary: SupportChatSummary) => {
      setData((prev) => {
        if (!prev) return prev;
        const exists = prev.content.some((c) => c.chatId === summary.chatId);
        const updated = exists
          ? prev.content.map((c) => (c.chatId === summary.chatId ? summary : c))
          : [summary, ...prev.content];
        const sorted = [...updated].sort((a, b) =>
          (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")
        );
        return { ...prev, content: sorted };
      });
      getSupportStats().then(setStats).catch(() => {});
    };
    addInboxListener(handleUpdate);
    return () => removeInboxListener(handleUpdate);
  }, [addInboxListener, removeInboxListener]);

  useEffect(() => {
    getSupportStats().then(setStats).catch(() => {});
  }, []);

  const load = useCallback(async (p: number, status: FilterStatus) => {
    setLoading(true);
    setError(null);
    try {
      const s = status === "ALL" ? undefined : status;
      const res = await getSupportChats(p, 25, s);
      setData(res);
      setPage(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load support chats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0, statusFilter);
  }, [load, statusFilter]);

  const filtered = data?.content.filter((chat) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      chat.userName?.toLowerCase().includes(q) ||
      chat.userHandle?.toLowerCase().includes(q) ||
      chat.lastMessage?.toLowerCase().includes(q);
    const matchCategory =
      categoryFilter === "All Categories" || chat.category === categoryFilter;
    return matchSearch && matchCategory;
  }) ?? [];

  const tabs: { key: FilterStatus; label: string; count?: number }[] = [
    { key: "ALL", label: "All" },
    { key: "OPEN", label: "Open", count: stats?.open },
    { key: "PENDING", label: "Pending" },
    { key: "RESOLVED", label: "Resolved", count: stats?.resolved },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Support Inbox</h1>
          <p className="text-white/40 text-sm mt-0.5">Customer support conversations</p>
        </div>
        {stats && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">{stats.open} open</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <span className="text-xs font-medium text-white/50">{stats.resolved} resolved</span>
            </div>
          </div>
        )}
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search by name, handle or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#1a1a1a] border border-white/8 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Category filter */}
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-8 pr-8 py-2 bg-[#1a1a1a] border border-white/8 rounded-xl text-sm text-white/70 focus:outline-none focus:border-white/20 transition-colors appearance-none cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c === "All Categories" ? c : c.charAt(0) + c.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-5 bg-white/5 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              statusFilter === tab.key
                ? "bg-[#F5A623] text-black"
                : "text-white/50 hover:text-white"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                statusFilter === tab.key ? "bg-black/20 text-black/70" : "bg-white/10 text-white/40"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm mb-5">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-[72px] bg-white/4 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/25">
          <MessageCircle size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No conversations found</p>
          {search && <p className="text-xs mt-1">Try adjusting your search or filters</p>}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((chat) => {
            const sla = getSlaStatus(chat.priority, chat.lastMessageAt);
            const slaBreach = sla === "breach" && chat.status !== "RESOLVED";
            return (
              <button
                key={chat.chatId}
                onClick={() => router.push(`/support/${chat.chatId}`)}
                className={`w-full text-left rounded-xl px-4 py-3.5 transition-all border ${
                  slaBreach
                    ? "bg-red-500/5 border-red-500/15 hover:bg-red-500/8"
                    : "bg-[#1a1a1a] border-white/5 hover:bg-[#222] hover:border-white/10"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center overflow-hidden">
                      {chat.userAvatar ? (
                        <img src={chat.userAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-white/50">
                          {chat.userName?.charAt(0)?.toUpperCase() ?? <User size={16} />}
                        </span>
                      )}
                    </div>
                    {chat.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#F5A623] text-black text-[9px] font-bold flex items-center justify-center">
                        {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-white truncate">
                          {chat.userName}
                          {chat.userHandle && (
                            <span className="text-white/35 font-normal ml-1.5">@{chat.userHandle}</span>
                          )}
                        </span>
                        <PriorityBadge priority={chat.priority} />
                        <SlaBadge priority={chat.priority} lastMessageAt={chat.lastMessageAt} status={chat.status} />
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <StatusBadge status={chat.status} />
                        <span className="text-[11px] text-white/25 flex items-center gap-1 flex-shrink-0">
                          <Clock size={10} />
                          {timeAgo(chat.lastMessageAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-white/40 truncate flex-1">
                        {chat.lastMessage ?? "No messages yet"}
                      </p>
                      <CategoryBadge category={chat.category} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-8">
          <button
            onClick={() => load(page - 1, statusFilter)}
            disabled={page === 0 || loading}
            className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors border border-white/5"
          >
            Previous
          </button>
          <span className="text-sm text-white/40 tabular-nums">
            {page + 1} / {data.totalPages}
          </span>
          <button
            onClick={() => load(page + 1, statusFilter)}
            disabled={page >= data.totalPages - 1 || loading}
            className="px-4 py-2 text-sm rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors border border-white/5"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
