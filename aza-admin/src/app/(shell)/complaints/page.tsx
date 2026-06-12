"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createComplaint,
  getComplaints,
  updateComplaintStatus,
  type Complaint,
  type Page,
} from "@/lib/admin-api";
import { Loader2, MessageSquareWarning, Plus, X } from "lucide-react";

const STATUS_TABS = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "ALL"] as const;

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ACKNOWLEDGED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  RESOLVED: "bg-green-500/10 text-green-400 border-green-500/20",
};

const CHANNELS = ["APP", "EMAIL", "PHONE", "IN_PERSON", "SOCIAL_MEDIA"] as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function overdueBadge(c: Complaint): string | null {
  const today = new Date().toISOString().slice(0, 10);
  if (c.status === "OPEN" && c.ackDueAt < today) return "ACK OVERDUE";
  if (c.status !== "RESOLVED" && c.resolveDueAt < today) return "RESOLVE OVERDUE";
  return null;
}

function LogComplaintPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [channel, setChannel] = useState<string>("APP");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createComplaint({
        complainantName: name || undefined,
        complainantContact: contact || undefined,
        channel,
        subject,
        details,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-xl border border-border p-5 mb-6 space-y-3 bg-muted/10">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-foreground">Log a complaint</h2>
        <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Complainant name (optional)"
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
        />
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Contact (email/phone, optional)"
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
        />
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
        >
          {CHANNELS.map((c) => (
            <option key={c} value={c}>{c.replace("_", " ")}</option>
          ))}
        </select>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject *"
          className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
        />
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={3}
        placeholder="Complaint details *"
        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={() => create.mutate()}
        disabled={create.isPending || !subject.trim() || !details.trim()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-40 transition-colors"
      >
        {create.isPending && <Loader2 size={14} className="animate-spin" />}
        Log complaint (5-day ack / 20-day resolve deadlines)
      </button>
    </div>
  );
}

export default function ComplaintsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<string>("OPEN");
  const [adding, setAdding] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery<Page<Complaint>>({
    queryKey: ["complaints", tab],
    queryFn: () => getComplaints(tab === "ALL" ? undefined : tab, 0, 50),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      updateComplaintStatus(id, status, note),
    onSuccess: () => {
      setResolving(null);
      setResolution("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Complaints</h1>
          <p className="text-foreground/50 text-sm">
            Customer complaints register — acknowledge within 5 days, resolve within 20.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold transition-colors"
        >
          <Plus size={14} />
          Log complaint
        </button>
      </div>

      {adding && <LogComplaintPanel onClose={() => setAdding(false)} />}

      <div className="flex gap-1 mb-6 rounded-lg border border-border p-1 w-fit">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data || data.content.length === 0 ? (
        <div className="text-center py-24 text-foreground/30">
          <MessageSquareWarning size={40} className="mx-auto mb-4 opacity-40" />
          <p>No {tab === "ALL" ? "" : tab.toLowerCase() + " "}complaints</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {data.content.map((c) => {
            const overdue = overdueBadge(c);
            return (
              <div key={c.id} className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{c.subject}</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLES[c.status]}`}>
                        {c.status}
                      </span>
                      {overdue && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-500/10 text-red-400 border-red-500/20">
                          {overdue}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground/40 mt-0.5 truncate">
                      {c.complainantName || "Anonymous"} · {c.channel.replace("_", " ")} · logged {fmtDate(c.createdAt)} ·
                      ack by {fmtDate(c.ackDueAt)} · resolve by {fmtDate(c.resolveDueAt)}
                    </p>
                    <p className="text-xs text-foreground/50 mt-1 line-clamp-2">{c.details}</p>
                    {c.resolution && (
                      <p className="text-xs text-emerald-400/80 mt-1 italic">Resolution: {c.resolution}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {c.status === "OPEN" && (
                      <button
                        onClick={() => setStatus.mutate({ id: c.id, status: "ACKNOWLEDGED" })}
                        disabled={setStatus.isPending}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium hover:bg-blue-500/20 disabled:opacity-30 transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    {c.status !== "RESOLVED" && (
                      <button
                        onClick={() => setResolving(resolving === c.id ? null : c.id)}
                        className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium hover:bg-green-500/20 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
                {resolving === c.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setStatus.mutate({ id: c.id, status: "RESOLVED", note: resolution });
                    }}
                    className="flex gap-2 mt-3"
                  >
                    <input
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      required
                      autoFocus
                      placeholder="Resolution note (required)"
                      className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
                    />
                    <button
                      type="submit"
                      disabled={setStatus.isPending}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
                    >
                      {setStatus.isPending && <Loader2 size={14} className="animate-spin" />}
                      Save
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
