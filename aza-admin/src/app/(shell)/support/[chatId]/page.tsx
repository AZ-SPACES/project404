"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSupportChatMessages,
  getSupportChat,
  sendSupportReply,
  sendTypingIndicator,
  resolveChat,
  reopenChat,
  updateChatPriority,
  updateChatCategory,
  getInternalNotes,
  addInternalNote,
  getCannedResponses,
  getUserDetail,
  getUserTransactions,
  takeoverChat,
  enableSupportBot,
  SupportMessage,
  SupportChatSummary,
  InternalNote,
  CannedResponse,
  AdminUser,
  AdminTransaction,
  getToken,
  initiateCall,
} from "@/lib/admin-api";
import {
  ArrowLeft,
  Send,
  User,
  Lock,
  ChevronDown,
  CheckCircle2,
  RotateCcw,
  MessageSquare,
  Search,
  Clock,
  AlertCircle,
  X,
  PanelLeftOpen,
  PanelRightOpen,
  Zap,
  Phone,
  Cpu,
  UserCheck,
} from "lucide-react";
import * as SockJS from "sockjs-client";
import { useSupportWs } from "@/lib/support-ws-context";
import { Client } from "@stomp/stompjs";
import SupportCallModal from "@/components/SupportCallModal";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const BUILT_IN_CANNED: CannedResponse[] = [
  { id: "bi-1", title: "Greeting", category: "General", usageCount: 0, content: "Hello! Thank you for reaching out to AZA Support. How can I assist you today?" },
  { id: "bi-2", title: "Follow-up", category: "General", usageCount: 0, content: "I wanted to follow up on your recent inquiry. Have you had a chance to try the suggested steps?" },
  { id: "bi-3", title: "Closing", category: "General", usageCount: 0, content: "Thank you for contacting AZA Support. Your issue has been resolved. Please don't hesitate to reach out if you need further assistance. Have a great day!" },
  { id: "bi-4", title: "KYC under review", category: "KYC", usageCount: 0, content: "Your KYC verification is currently under review. Our team typically processes verifications within 1-2 business days. We'll notify you once it's complete." },
  { id: "bi-5", title: "KYC docs needed", category: "KYC", usageCount: 0, content: "To complete your KYC verification, we need clearer images of your ID document. Please ensure the document is fully visible, the image is well-lit, and all four corners are shown." },
  { id: "bi-6", title: "Transaction processing", category: "Billing", usageCount: 0, content: "Your transaction is being processed. This usually takes a few minutes, but can occasionally take up to 24 hours for certain types of transfers." },
  { id: "bi-7", title: "Refund timeline", category: "Billing", usageCount: 0, content: "Refunds typically appear within 3-5 business days, depending on your bank. If you haven't received it after 7 business days, please contact us again." },
  { id: "bi-8", title: "Password reset", category: "Account", usageCount: 0, content: "To reset your password, please go to the login screen and tap 'Forgot Password'. You'll receive an email with reset instructions within a few minutes." },
  { id: "bi-9", title: "Account review", category: "Account", usageCount: 0, content: "Your account has been flagged for a security review. Our team is investigating and you'll be updated within 24-48 hours. We appreciate your patience." },
  { id: "bi-10", title: "Report fraud", category: "Fraud", usageCount: 0, content: "We take fraud reports very seriously. Your account has been flagged for review and we've initiated an investigation. Please do not share your OTP or PIN with anyone. We'll contact you shortly." },
];

const SLA_MINUTES: Record<string, number> = { URGENT: 60, HIGH: 240, NORMAL: 1440, LOW: 4320 };

type ChatItem =
  | { kind: "message"; ts: number; data: SupportMessage }
  | { kind: "note"; ts: number; data: InternalNote };

type InputMode = "reply" | "note";

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const CATEGORIES = ["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT", "KYC", "FRAUD"] as const;

function fmtTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtGhs(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SlaIndicator({ priority, lastMessageAt, status }: { priority: string; lastMessageAt: string | null; status: string }) {
  if (status === "RESOLVED" || !lastMessageAt) return null;
  const elapsed = (Date.now() - new Date(lastMessageAt).getTime()) / 60000;
  const threshold = SLA_MINUTES[priority] ?? 1440;
  const pct = Math.min((elapsed / threshold) * 100, 100);
  const slaStatus = pct >= 100 ? "breach" : pct >= 75 ? "warning" : "ok";
  const remaining = Math.max(threshold - elapsed, 0);
  const remainingStr = remaining < 60 ? `${Math.round(remaining)}m` : `${Math.round(remaining / 60)}h`;

  return (
    <div className="p-4 border-b border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">SLA</span>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${
          slaStatus === "breach" ? "text-red-400" : slaStatus === "warning" ? "text-amber-400" : "text-emerald-400"
        }`}>
          {slaStatus === "breach" ? "Breached" : `${remainingStr} left`}
        </span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            slaStatus === "breach" ? "bg-red-500" : slaStatus === "warning" ? "bg-amber-500" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-white/25 mt-1.5">
        {priority} · {Math.round(elapsed)}m elapsed of {threshold}m
      </p>
    </div>
  );
}

function InfoRow({ label, value, valueClass = "text-white/70" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-white/35 flex-shrink-0">{label}</span>
      <span className={`text-[11px] font-medium truncate ${valueClass}`}>{value}</span>
    </div>
  );
}

function CustomerPanel({ user, chat, recentTxns }: { user: AdminUser | null; chat: SupportChatSummary | null; recentTxns: AdminTransaction[] }) {
  if (!user) {
    return (
      <div className="p-5">
        <div className="w-12 h-12 rounded-full bg-white/8 mx-auto mb-3 animate-pulse" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-3 bg-white/5 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  const kycColor = user.kycStatus === "VERIFIED" ? "text-emerald-400" : user.kycStatus === "PENDING_REVIEW" ? "text-amber-400" : "text-red-400";
  const statusColor = user.accountStatus === "ACTIVE" ? "text-emerald-400" : user.accountStatus === "SUSPENDED" ? "text-amber-400" : "text-red-400";

  return (
    <div className="divide-y divide-white/5">
      <div className="p-5 text-center">
        <div className="w-14 h-14 rounded-full bg-white/8 flex items-center justify-center overflow-hidden mx-auto mb-3 border border-white/8">
          {user.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-white/50">{user.firstName?.charAt(0)?.toUpperCase()}</span>
          )}
        </div>
        <p className="text-sm font-semibold text-white">{[user.firstName, user.lastName].filter(Boolean).join(" ") || user.username}</p>
        {user.username && <p className="text-xs text-white/40 mt-0.5">@{user.username}</p>}
        <p className="text-xs text-white/30 mt-0.5 truncate">{user.email}</p>
      </div>

      <div className="px-5 py-4 space-y-2.5">
        <InfoRow label="Status" value={user.accountStatus} valueClass={statusColor} />
        <InfoRow label="KYC" value={user.kycStatus?.replace("_", " ")} valueClass={kycColor} />
        <InfoRow label="Wallet" value={fmtGhs(user.walletBalance)} />
        <InfoRow label="Joined" value={fmtDate(user.createdAt)} />
        {user.lastLoginAt && <InfoRow label="Last login" value={timeAgo(user.lastLoginAt)} />}
        {user.phone && <InfoRow label="Phone" value={user.phone} />}
      </div>

      {recentTxns.length > 0 && (
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">Recent Transactions</p>
          <div className="space-y-2">
            {recentTxns.slice(0, 4).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-white/70 truncate">{tx.type}</p>
                  <p className="text-[10px] text-white/30">{timeAgo(tx.initiatedAt)}</p>
                </div>
                <span className={`text-xs font-semibold ml-2 flex-shrink-0 ${
                  tx.status === "COMPLETED" ? "text-emerald-400" : tx.status === "FAILED" ? "text-red-400" : "text-amber-400"
                }`}>
                  {fmtGhs(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CannedPanel({ responses, onSelect }: { responses: CannedResponse[]; onSelect: (text: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = responses.filter(
    (r) => !q || r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
  );
  const grouped = filtered.reduce<Record<string, CannedResponse[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">Quick Replies</p>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            placeholder="Search templates..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 bg-white/5 border border-white/8 rounded-lg text-xs text-white placeholder-white/25 focus:outline-none focus:border-white/20"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <p className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-white/20 bg-white/2">{cat}</p>
            {items.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelect(r.content)}
                className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/4 transition-colors group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors">{r.title}</p>
                  <Zap size={11} className="text-[#B7EE7A] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
                <p className="text-[11px] text-white/35 line-clamp-2 leading-relaxed">{r.content}</p>
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-white/25 text-xs">No templates found</div>
        )}
      </div>
    </div>
  );
}

export default function SupportChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Local state for real-time data driven by WebSocket
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [chat, setChat] = useState<SupportChatSummary | null>(null);

  const [inputMode, setInputMode] = useState<InputMode>("reply");
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const stompRef = useRef<Client | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { addInboxListener, removeInboxListener } = useSupportWs();

  // Initial data via React Query
  const { isLoading } = useQuery({
    queryKey: ["supportChat", chatId],
    queryFn: async () => {
      const [chatData, msgsData] = await Promise.all([
        getSupportChat(chatId),
        getSupportChatMessages(chatId, 0, 60),
      ]);
      setChat(chatData);
      setMessages([...msgsData.content].reverse());
      return chatData;
    },
  });

  useQuery({
    queryKey: ["supportChatNotes", chatId],
    queryFn: async () => {
      const n = await getInternalNotes(chatId);
      setNotes(n);
      return n;
    },
    enabled: !!chatId,
    retry: false,
  });

  const { data: chatUser } = useQuery<AdminUser | null>({
    queryKey: ["supportChatUser", chatId, chat?.userId],
    queryFn: () => chat?.userId ? getUserDetail(chat.userId) : Promise.resolve(null),
    enabled: !!chat?.userId,
    retry: false,
  });

  const { data: recentTxnsPage } = useQuery({
    queryKey: ["supportChatTxns", chat?.userId],
    queryFn: () => getUserTransactions(chat!.userId!, 0, 5),
    enabled: !!chat?.userId,
    retry: false,
  });

  const { data: cannedResponses } = useQuery({
    queryKey: ["cannedResponses"],
    queryFn: async () => {
      const r = await getCannedResponses().catch(() => [] as CannedResponse[]);
      return [...BUILT_IN_CANNED, ...r];
    },
  });

  const recentTxns: AdminTransaction[] = recentTxnsPage?.content ?? [];
  const allCanned = cannedResponses ?? BUILT_IN_CANNED;

  // Inbox WebSocket listener — refresh messages when this chat gets an update
  useEffect(() => {
    const handleInboxEvent = (summary: SupportChatSummary) => {
      if (summary.chatId !== chatId) return;
      setTimeout(() => {
        getSupportChatMessages(chatId, 0, 200).then((res) => {
          setMessages((prev) => {
            const fetched = res.content.reverse();
            const map = new Map(prev.map((m) => [m.id, m]));
            fetched.forEach((m) => map.set(m.id, m));
            return Array.from(map.values()).sort((a, b) =>
              new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime()
            );
          });
        }).catch(() => {});
      }, 500);
    };
    addInboxListener(handleInboxEvent);
    return () => removeInboxListener(handleInboxEvent);
  }, [chatId, addInboxListener, removeInboxListener]);

  // Chat-specific WebSocket
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const client = new Client({
      webSocketFactory: () => new (SockJS as any)(`${BASE_URL}/ws`),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe("/user/queue/chat", (frame) => {
          try {
            const event = JSON.parse(frame.body);
            if (event.payload?.chatId !== chatId) return;
            if (event.type === "CHAT_MESSAGE") {
              const msg = event.payload as SupportMessage;
              setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
              setIsOtherTyping(false);
            } else if (event.type === "CHAT_TYPING" && !event.payload.isSelf) {
              setIsOtherTyping(event.payload.isTyping);
            } else if (event.type === "SUPPORT_BOT_TYPING" && !event.payload.isSelf) {
              setIsOtherTyping(event.payload.isTyping);
            } else if (event.type === "SUPPORT_CHAT_UPDATED") {
              const updated = event.payload as SupportChatSummary;
              if (updated.chatId === chatId) setChat(updated);
            }
          } catch { /* ignore */ }
        });
      },
    });
    client.activate();
    stompRef.current = client;
    return () => { client.deactivate(); };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, notes, isOtherTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [replyText]);

  // Mutations
  const resolveMutation = useMutation({
    mutationFn: () => chat?.status === "RESOLVED" ? reopenChat(chatId) : resolveChat(chatId),
    onSuccess: (updated) => {
      setChat(updated);
      queryClient.setQueryData(["supportChat", chatId], updated);
    },
    onError: (e: Error) => setError(e.message ?? "Failed to update status"),
  });

  const priorityMutation = useMutation({
    mutationFn: (p: string) => updateChatPriority(chatId, p),
    onSuccess: (updated) => {
      setChat(updated);
      setPriorityOpen(false);
    },
    onError: (e: Error) => setError(e.message ?? "Failed to update priority"),
  });

  const categoryMutation = useMutation({
    mutationFn: (c: string) => updateChatCategory(chatId, c),
    onSuccess: (updated) => {
      setChat(updated);
      setCategoryOpen(false);
    },
    onError: (e: Error) => setError(e.message ?? "Failed to update category"),
  });

  const takeoverMutation = useMutation({
    mutationFn: () => takeoverChat(chatId),
    onSuccess: (updated) => setChat(updated),
    onError: (e: Error) => setError(e.message ?? "Failed to take over"),
  });

  const enableBotMutation = useMutation({
    mutationFn: () => enableSupportBot(chatId),
    onSuccess: (updated) => setChat(updated),
    onError: (e: Error) => setError(e.message ?? "Failed to enable bot"),
  });

  const chatItems: ChatItem[] = [
    ...messages.map((m) => ({ kind: "message" as const, ts: m.sentAt ? new Date(m.sentAt).getTime() : 0, data: m })),
    ...notes.map((n) => ({ kind: "note" as const, ts: new Date(n.createdAt).getTime(), data: n })),
  ].sort((a, b) => a.ts - b.ts);

  const handleSend = async () => {
    if (!replyText.trim()) return;
    const content = replyText.trim();
    setReplyText("");
    setError(null);

    if (inputMode === "reply") {
      if (chat?.status === "RESOLVED") {
        setError("Cannot reply to a resolved chat. Reopen it first.");
        setReplyText(content);
        return;
      }
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: SupportMessage = {
        id: tempId, chatId, senderId: "me", content,
        type: "TEXT", status: "SENT",
        sentAt: new Date().toISOString(), isDeleted: false, isSelf: true,
      };
      setMessages(prev => [...prev, optimistic]);
      sendTypingIndicator(chatId, false).catch(() => {});
      try {
        const msg = await sendSupportReply(chatId, content);
        setMessages(prev => {
          const without = prev.filter(m => m.id !== tempId);
          return without.some(m => m.id === msg.id) ? without : [...without, msg];
        });
      } catch (e: any) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setError(e.message ?? "Failed to send");
        setReplyText(content);
      }
    } else {
      const tempId = `temp-note-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: InternalNote = {
        id: tempId, chatId, authorId: "", authorName: "You",
        content, createdAt: new Date().toISOString(),
      };
      setNotes(prev => [...prev, optimistic]);
      try {
        const note = await addInternalNote(chatId, content);
        setNotes(prev => {
          const without = prev.filter(n => n.id !== tempId);
          return without.some(n => n.id === note.id) ? without : [...without, note];
        });
      } catch (e: any) {
        setNotes(prev => prev.filter(n => n.id !== tempId));
        setError(e.message ?? "Failed to add note");
        setReplyText(content);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReplyText(e.target.value);
    if (inputMode === "reply") {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      sendTypingIndicator(chatId, true).catch(() => {});
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(chatId, false).catch(() => {});
      }, 3000);
    }
  };

  const isResolved = chat?.status === "RESOLVED";
  const isConnected = stompRef.current?.connected ?? false;

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-[calc(100vh-0rem)] max-w-[1440px] mx-auto -mx-6 lg:-mx-8 -my-6 lg:-my-8 overflow-hidden">

      {/* Left Panel – Customer Profile */}
      <>
        <div className="hidden xl:flex flex-col w-72 border-r border-white/5 bg-[#0d0d0d] overflow-y-auto flex-shrink-0">
          <div className="px-5 pt-5 pb-3 border-b border-white/5 flex-shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Customer Profile</p>
          </div>
          <CustomerPanel user={chatUser ?? null} chat={chat} recentTxns={recentTxns} />
        </div>

        {showLeftPanel && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 xl:hidden" onClick={() => setShowLeftPanel(false)} />
            <div className="fixed inset-y-0 left-0 z-50 w-72 bg-[#0d0d0d] border-r border-white/5 overflow-y-auto xl:hidden">
              <div className="px-5 pt-5 pb-3 border-b border-white/5 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Customer Profile</p>
                <button onClick={() => setShowLeftPanel(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
              </div>
              <CustomerPanel user={chatUser ?? null} chat={chat} recentTxns={recentTxns} />
            </div>
          </>
        )}
      </>

      {/* Center – Chat */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#0a0a0a]">

        {/* Bot status banner */}
        {chat && !isResolved && (
          chat.botActive ? (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#B7EE7A]/8 border-b border-[#B7EE7A]/15 flex-shrink-0">
              <div className="flex items-center gap-2 text-[#B7EE7A]">
                <Cpu size={14} />
                <span className="text-xs font-semibold">AI Bot is handling this conversation</span>
              </div>
              <button
                onClick={() => takeoverMutation.mutate()}
                disabled={takeoverMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#B7EE7A] text-black hover:bg-[#a0d85a] transition-colors disabled:opacity-50"
              >
                <UserCheck size={13} />
                {takeoverMutation.isPending ? "Taking over…" : "Take Over"}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 px-4 py-2 bg-white/3 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-2 text-white/50">
                <UserCheck size={13} />
                <span className="text-xs">Human agent handling · AI bot is off</span>
              </div>
              <button
                onClick={() => enableBotMutation.mutate()}
                disabled={enableBotMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <Cpu size={12} />
                {enableBotMutation.isPending ? "Enabling…" : "Hand to Bot"}
              </button>
            </div>
          )
        )}

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0d0d0d] flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </button>

          <button
            onClick={() => setShowLeftPanel(true)}
            className="xl:hidden p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-all flex-shrink-0"
          >
            <PanelLeftOpen size={16} />
          </button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center overflow-hidden flex-shrink-0 border border-white/8">
              {chat?.userAvatar
                ? <img src={chat.userAvatar} alt="" className="w-full h-full object-cover" />
                : <User size={16} className="text-white/30" />
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">
                {chat?.userName ?? "Loading..."}
                {chat?.userHandle && <span className="text-white/35 font-normal ml-1.5 text-xs">@{chat.userHandle}</span>}
              </p>
              {chat?.category && <span className="text-[10px] text-white/35">{chat.category}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Category dropdown */}
            <div className="relative">
              <button
                onClick={() => { setCategoryOpen(!categoryOpen); setPriorityOpen(false); }}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/8 text-xs text-white/60 transition-all"
              >
                {chat?.category ?? "Category"}
                <ChevronDown size={12} />
              </button>
              {categoryOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => categoryMutation.mutate(c)}
                      className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                        chat?.category === c ? "text-[#B7EE7A] bg-[#B7EE7A]/10" : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {c.charAt(0) + c.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Priority dropdown */}
            <div className="relative">
              <button
                onClick={() => { setPriorityOpen(!priorityOpen); setCategoryOpen(false); }}
                className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  chat?.priority === "URGENT" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                  chat?.priority === "HIGH" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                  "bg-white/5 border-white/8 text-white/50"
                }`}
              >
                {chat?.priority ?? "—"}
                <ChevronDown size={12} />
              </button>
              {priorityOpen && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[120px]">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      onClick={() => priorityMutation.mutate(p)}
                      className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                        chat?.priority === p ? "text-[#B7EE7A] bg-[#B7EE7A]/10" : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (chat?.userId) {
                  initiateCall(chat.userId, "VOICE").catch(() => {});
                  setCallModalOpen(true);
                }
              }}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-all"
            >
              <Phone size={14} />
            </button>

            <button
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                isResolved
                  ? "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
              } disabled:opacity-50`}
            >
              {isResolved ? <RotateCcw size={13} /> : <CheckCircle2 size={13} />}
              <span className="hidden sm:inline">{isResolved ? "Reopen" : "Resolve"}</span>
            </button>

            <button
              onClick={() => setShowRightPanel(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-all"
            >
              <PanelRightOpen size={16} />
            </button>
          </div>
        </div>

        {/* Message stream */}
        <div
          className="flex-1 overflow-y-auto px-4 py-5 space-y-3"
          onClick={() => { setPriorityOpen(false); setCategoryOpen(false); }}
        >
          {isLoading ? (
            <div className="space-y-4 pt-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 1 ? "justify-end" : "justify-start"}`}>
                  <div className={`h-10 rounded-2xl bg-white/5 animate-pulse ${i % 2 === 1 ? "w-40" : "w-56"}`} />
                </div>
              ))}
            </div>
          ) : chatItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <MessageSquare size={32} className="text-white/15 mb-3" />
              <p className="text-sm text-white/30 font-medium">No messages yet</p>
              <p className="text-xs text-white/20 mt-1">Start the conversation below</p>
            </div>
          ) : (
            chatItems.map((item) => {
              if (item.kind === "note") {
                return (
                  <div key={item.data.id} className="flex justify-center">
                    <div className="max-w-[85%] bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Lock size={11} className="text-amber-400/70" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400/70">Internal Note</span>
                        <span className="text-[10px] text-amber-400/40">· {item.data.authorName}</span>
                      </div>
                      <p className="text-xs text-amber-200/70 leading-relaxed whitespace-pre-wrap">{item.data.content}</p>
                      <p className="text-[10px] text-amber-400/30 mt-1.5">{fmtTime(item.data.createdAt)}</p>
                    </div>
                  </div>
                );
              }

              const msg = item.data;
              const isAgent = msg.isSelf;
              const isBot = msg.isBot;
              return (
                <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                  <div className={`flex flex-col ${isAgent ? "items-end" : "items-start"} max-w-[80%] lg:max-w-[72%]`}>
                    {isBot && (
                      <div className="flex items-center gap-1 mb-1 ml-1">
                        <Cpu size={10} className="text-[#B7EE7A]/60" />
                        <span className="text-[10px] text-[#B7EE7A]/60 font-semibold">AZA AI</span>
                      </div>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isAgent
                        ? "bg-[#B7EE7A] text-black rounded-br-sm font-medium"
                        : isBot
                          ? "bg-[#B7EE7A]/8 border border-[#B7EE7A]/15 text-white/85 rounded-bl-sm"
                          : "bg-[#1e1e1e] text-white/85 border border-white/6 rounded-bl-sm"
                    }`}>
                      {msg.isDeleted
                        ? <span className="italic opacity-40 text-xs">This message was deleted</span>
                        : <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      }
                    </div>
                    <span className={`text-[10px] mt-1 text-white/25 ${isAgent ? "mr-1" : "ml-1"}`}>
                      {fmtTime(msg.sentAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {isOtherTyping && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 bg-[#1e1e1e] border border-white/6 px-4 py-2.5 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" />
                </div>
                <span className="text-[10px] text-white/35 font-medium uppercase tracking-wider">
                  {chat?.botActive ? "AI Bot is thinking…" : "User is typing"}
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-white/5 bg-[#0d0d0d] px-4 pt-3 pb-4 flex-shrink-0">
          {error && (
            <div className="mb-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 flex items-center justify-between">
              <p className="text-xs text-red-400">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400 ml-2 flex-shrink-0"><X size={14} /></button>
            </div>
          )}

          <div className="flex gap-1 mb-2.5">
            <button
              onClick={() => setInputMode("reply")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                inputMode === "reply"
                  ? "bg-[#B7EE7A]/15 text-[#B7EE7A] border border-[#B7EE7A]/25"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <MessageSquare size={11} />
              Reply
            </button>
            <button
              onClick={() => setInputMode("note")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                inputMode === "note"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <Lock size={11} />
              Internal Note
            </button>
          </div>

          <div className={`flex items-end gap-2 rounded-2xl p-2 border transition-all ${
            inputMode === "note"
              ? "bg-amber-500/5 border-amber-500/20 focus-within:border-amber-500/35"
              : "bg-[#1a1a1a] border-white/8 focus-within:border-white/18"
          }`}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={replyText}
              onChange={handleInputChange}
              disabled={isResolved && inputMode === "reply"}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder={
                isResolved && inputMode === "reply"
                  ? "Chat is resolved — reopen to reply"
                  : inputMode === "note"
                  ? "Add an internal note (not visible to customer)..."
                  : "Write a message..."
              }
              className={`flex-1 bg-transparent px-2 py-1.5 text-sm resize-none focus:ring-0 border-none min-h-[38px] max-h-40 ${
                inputMode === "note" ? "text-amber-200/70 placeholder-amber-400/25" : "text-white placeholder-white/20"
              } disabled:opacity-40`}
            />
            <button
              onClick={handleSend}
              disabled={!replyText.trim() || (isResolved && inputMode === "reply")}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                !replyText.trim() || (isResolved && inputMode === "reply")
                  ? "bg-white/5 text-white/20"
                  : inputMode === "note"
                  ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  : "bg-[#B7EE7A] text-black hover:scale-105 active:scale-95 shadow-lg shadow-[#B7EE7A]/15"
              }`}
            >
              <Send size={16} />
            </button>
          </div>

          <div className="mt-2 flex justify-between items-center px-1">
            <p className="text-[10px] text-white/20 uppercase tracking-widest">Enter to send · Shift+Enter for newline</p>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-white/20"}`} />
              <span className="text-[10px] text-white/20 uppercase tracking-widest">{isConnected ? "Live" : "Connecting"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel – Tools */}
      <>
        <div className="hidden lg:flex flex-col w-72 border-l border-white/5 bg-[#0d0d0d] flex-shrink-0 overflow-hidden">
          <SlaIndicator priority={chat?.priority ?? "NORMAL"} lastMessageAt={chat?.lastMessageAt ?? null} status={chat?.status ?? "OPEN"} />
          <div className="flex-1 overflow-hidden">
            <CannedPanel responses={allCanned} onSelect={(text) => { setInputMode("reply"); setReplyText(text); textareaRef.current?.focus(); }} />
          </div>
        </div>

        {showRightPanel && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setShowRightPanel(false)} />
            <div className="fixed inset-y-0 right-0 z-50 w-72 bg-[#0d0d0d] border-l border-white/5 flex flex-col overflow-hidden lg:hidden">
              <div className="px-4 py-3.5 border-b border-white/5 flex items-center justify-between flex-shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Tools</p>
                <button onClick={() => setShowRightPanel(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
              </div>
              <SlaIndicator priority={chat?.priority ?? "NORMAL"} lastMessageAt={chat?.lastMessageAt ?? null} status={chat?.status ?? "OPEN"} />
              <div className="flex-1 overflow-hidden">
                <CannedPanel responses={allCanned} onSelect={(text) => { setInputMode("reply"); setReplyText(text); setShowRightPanel(false); textareaRef.current?.focus(); }} />
              </div>
            </div>
          </>
        )}
      </>

      <SupportCallModal
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        chatId={chatId}
        userName={chat?.userName ?? "Customer"}
      />
    </div>
  );
}
