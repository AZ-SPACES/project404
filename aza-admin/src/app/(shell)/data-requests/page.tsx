"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDataRequest,
  downloadUserDataExport,
  getDataRequests,
  getUsers,
  updateDataRequestStatus,
  type AdminUser,
  type DataRequest,
  type Page,
} from "@/lib/admin-api";
import { Download, FileSearch, Loader2, Plus, Search, X } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  COMPLETED: "bg-green-500/10 text-green-400 border-green-500/20",
  REJECTED: "bg-muted/50 text-foreground/50 border-border",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function NewRequestPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [type, setType] = useState("ACCESS");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const { data: results, isFetching } = useQuery({
    queryKey: ["dsarUserSearch", search],
    queryFn: () => getUsers({ query: search, size: 6 }),
    enabled: search.length >= 2,
  });

  const create = useMutation({
    mutationFn: () => createDataRequest(selected!.id, type, notes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dataRequests"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-xl border border-border p-5 mb-6 space-y-4 bg-muted/10">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-foreground">Log a data request</h2>
        <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors">
          <X size={16} />
        </button>
      </div>

      {!selected ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
          className="space-y-3"
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users by name, email, or handle…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={query.trim().length < 2 || isFetching}
              className="px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted text-sm disabled:opacity-30 transition-colors"
            >
              {isFetching ? <Loader2 size={14} className="animate-spin" /> : "Search"}
            </button>
          </div>
          {results && results.content.length === 0 && (
            <p className="text-sm text-foreground/40">No users match that search.</p>
          )}
          {results && results.content.length > 0 && (
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {results.content.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelected(user)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-xs text-foreground/40">{user.email}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
            <div>
              <div className="text-sm font-medium text-foreground">
                {selected.firstName} {selected.lastName}
              </div>
              <div className="text-xs text-foreground/40">{selected.email}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-foreground/40 hover:text-foreground transition-colors"
            >
              Change
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none"
            >
              <option value="ACCESS">ACCESS — copy of their data</option>
              <option value="DELETION">DELETION — erase their data</option>
            </select>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-foreground/30"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            Log request (30-day deadline)
          </button>
        </div>
      )}
    </div>
  );
}

export default function DataRequestsPage() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery<Page<DataRequest>>({
    queryKey: ["dataRequests"],
    queryFn: () => getDataRequests(undefined, 0, 50),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateDataRequestStatus(id, status),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["dataRequests"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  async function exportData(req: DataRequest) {
    setBusy(req.id);
    setError("");
    try {
      await downloadUserDataExport(req.userId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Data Requests</h1>
          <p className="text-foreground/50 text-sm">
            DPA access &amp; deletion requests, each with a 30-day response deadline.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#B7EE7A] hover:bg-[#B7EE7A]/90 text-black text-sm font-semibold transition-colors"
        >
          <Plus size={14} />
          New request
        </button>
      </div>

      {adding && <NewRequestPanel onClose={() => setAdding(false)} />}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data || data.content.length === 0 ? (
        <div className="text-center py-24 text-foreground/30">
          <FileSearch size={40} className="mx-auto mb-4 opacity-40" />
          <p>No data requests logged</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {data.content.map((req) => (
            <div key={req.id} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {req.userName ?? req.userId}
                  </span>
                  <span className="text-xs text-foreground/40">{req.type}</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLES[req.status]}`}
                  >
                    {req.status.replace("_", " ")}
                  </span>
                  {req.overdue && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-500/10 text-red-400 border-red-500/20">
                      OVERDUE
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground/40 mt-0.5">
                  {req.userEmail} · due {fmtDate(req.dueDate)}
                  {req.notes ? ` · ${req.notes}` : ""}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {req.type === "ACCESS" && req.status !== "COMPLETED" && req.status !== "REJECTED" && (
                  <button
                    onClick={() => exportData(req)}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted text-xs disabled:opacity-30 transition-colors"
                  >
                    {busy === req.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    Export data
                  </button>
                )}
                {(req.status === "OPEN" || req.status === "IN_PROGRESS") && (
                  <select
                    value={req.status}
                    onChange={(e) => setStatus.mutate({ id: req.id, status: e.target.value })}
                    className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs outline-none"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
