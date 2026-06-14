"use client";

import { Fragment, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRateLimits,
  createRateLimit,
  updateRateLimit,
  deleteRateLimit,
  toggleRateLimit,
  type RateLimitConfig,
} from "@/lib/admin-api";
import {
  Gauge,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";

const SCOPE_OPTIONS: RateLimitConfig["scope"][] = ["USER", "IP", "GLOBAL"];

const SCOPE_COLORS: Record<RateLimitConfig["scope"], string> = {
  USER: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  IP: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  GLOBAL: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

interface FormState {
  endpointPattern: string;
  description: string;
  maxRequests: number;
  windowSeconds: number;
  scope: RateLimitConfig["scope"];
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  endpointPattern: "",
  description: "",
  maxRequests: 100,
  windowSeconds: 60,
  scope: "USER",
  enabled: true,
};

function fmtWindow(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${sec / 60}m`;
  return `${sec / 3600}h`;
}

export default function RateLimitsPage() {
  const queryClient = useQueryClient();

  // form mode: "create" | editing id | null
  const [formMode, setFormMode] = useState<"create" | string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const { data: rules, isLoading, error } = useQuery<RateLimitConfig[]>({
    queryKey: ["rateLimits"],
    queryFn: getRateLimits,
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<RateLimitConfig, "id" | "createdAt">) => createRateLimit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateLimits"] });
      setFormMode(null);
      setForm(EMPTY_FORM);
      showToast("Rate limit rule created");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<RateLimitConfig, "id" | "createdAt"> }) =>
      updateRateLimit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateLimits"] });
      setFormMode(null);
      showToast("Rate limit rule updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRateLimit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateLimits"] });
      setDeleteConfirm(null);
      showToast("Rule deleted");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleRateLimit(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["rateLimits"] });
      const prev = queryClient.getQueryData<RateLimitConfig[]>(["rateLimits"]);
      queryClient.setQueryData<RateLimitConfig[]>(["rateLimits"], (old) =>
        old?.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["rateLimits"], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["rateLimits"] });
    },
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormMode("create");
    setDeleteConfirm(null);
  }

  function openEdit(rule: RateLimitConfig) {
    setForm({
      endpointPattern: rule.endpointPattern,
      description: rule.description ?? "",
      maxRequests: rule.maxRequests,
      windowSeconds: rule.windowSeconds,
      scope: rule.scope,
      enabled: rule.enabled,
    });
    setFormMode(rule.id);
    setDeleteConfirm(null);
  }

  function cancelForm() {
    setFormMode(null);
    setForm(EMPTY_FORM);
  }

  function submitForm() {
    const data: Omit<RateLimitConfig, "id" | "createdAt"> = {
      endpointPattern: form.endpointPattern.trim(),
      description: form.description.trim() || null,
      maxRequests: form.maxRequests,
      windowSeconds: form.windowSeconds,
      scope: form.scope,
      enabled: form.enabled,
    };
    if (!data.endpointPattern) return;
    if (formMode === "create") {
      createMutation.mutate(data);
    } else if (formMode) {
      updateMutation.mutate({ id: formMode, data });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const saveError = createMutation.error || updateMutation.error;

  const RuleForm = (
    <div className="rounded-xl border border-border bg-foreground/5 p-5 space-y-4">
      <p className="text-sm font-semibold text-foreground">
        {formMode === "create" ? "New Rate Limit Rule" : "Edit Rule"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-foreground/40 block mb-1.5">
            Endpoint Pattern
          </label>
          <input
            type="text"
            value={form.endpointPattern}
            onChange={(e) => setForm((f) => ({ ...f, endpointPattern: e.target.value }))}
            placeholder="/api/v1/transfers/**"
            className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-foreground/40 block mb-1.5">
            Description
          </label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional description"
            className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/20"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-foreground/40 block mb-1.5">
            Max Requests
          </label>
          <input
            type="number"
            min={1}
            value={form.maxRequests}
            onChange={(e) => setForm((f) => ({ ...f, maxRequests: Number(e.target.value) }))}
            className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/20"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-foreground/40 block mb-1.5">
            Window (seconds)
          </label>
          <input
            type="number"
            min={1}
            value={form.windowSeconds}
            onChange={(e) => setForm((f) => ({ ...f, windowSeconds: Number(e.target.value) }))}
            className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/20"
          />
          <p className="text-[11px] text-foreground/30 mt-1">e.g. 60 = per minute</p>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-foreground/40 block mb-1.5">
            Scope
          </label>
          <select
            value={form.scope}
            onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as RateLimitConfig["scope"] }))}
            className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/20"
          >
            {SCOPE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2.5 pt-5">
          <input
            id="rl-enabled"
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            className="w-4 h-4 accent-[#B7EE7A] rounded"
          />
          <label htmlFor="rl-enabled" className="text-sm text-foreground/70 select-none">Enabled</label>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={14} />{(saveError as Error).message}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={submitForm}
          disabled={isSaving || !form.endpointPattern.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#B7EE7A]/15 border border-[#B7EE7A]/25 text-[#B7EE7A] text-sm font-semibold hover:bg-[#B7EE7A]/25 disabled:opacity-40 transition-all"
        >
          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Save
        </button>
        <button
          onClick={cancelForm}
          className="px-4 py-2 rounded-xl bg-muted/30 text-foreground/50 text-sm hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm px-4 py-3 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Gauge size={22} className="text-foreground/40" />
            Rate Limit Config
          </h1>
          <p className="text-foreground/40 text-sm mt-0.5">Configure per-endpoint request limits</p>
        </div>
        {formMode === null && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#B7EE7A]/15 border border-[#B7EE7A]/25 text-[#B7EE7A] text-sm font-semibold hover:bg-[#B7EE7A]/25 transition-all"
          >
            <Plus size={15} />
            Add Rule
          </button>
        )}
      </div>

      {/* Create form (above table) */}
      {formMode === "create" && RuleForm}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{(error as Error).message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="animate-spin text-foreground/30" size={24} />
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && rules && rules.length === 0 && formMode !== "create" && (
        <div className="text-center py-20 text-foreground/25">
          <Gauge size={36} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No rate limit rules yet</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && rules && rules.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/10">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">
                  Endpoint Pattern
                </th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden sm:table-cell">
                  Max Requests
                </th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden md:table-cell">
                  Window
                </th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30 hidden lg:table-cell">
                  Scope
                </th>
                <th className="text-center px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/30">
                  Status
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((rule) => (
                <Fragment key={rule.id}>
                  <tr className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-mono text-foreground">{rule.endpointPattern}</p>
                      {rule.description && (
                        <p className="text-xs text-foreground/35 mt-0.5">{rule.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center hidden sm:table-cell">
                      <span className="text-sm font-semibold text-foreground">{rule.maxRequests}</span>
                    </td>
                    <td className="px-5 py-3 text-center hidden md:table-cell">
                      <span className="text-sm text-foreground/70">{fmtWindow(rule.windowSeconds)}</span>
                    </td>
                    <td className="px-5 py-3 text-center hidden lg:table-cell">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-semibold ${SCOPE_COLORS[rule.scope]}`}>
                        {rule.scope}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => toggleMutation.mutate(rule.id)}
                        disabled={toggleMutation.isPending}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${
                          rule.enabled ? "bg-[#B7EE7A]/70" : "bg-muted/40"
                        }`}
                        title={rule.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            rule.enabled ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {deleteConfirm === rule.id ? (
                          <span className="flex items-center gap-1.5 text-xs text-foreground/50">
                            Really delete?
                            <button
                              onClick={() => deleteMutation.mutate(rule.id)}
                              disabled={deleteMutation.isPending}
                              className="px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 disabled:opacity-40"
                            >
                              {deleteMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-2 py-0.5 rounded-md bg-muted/30 text-foreground/50 hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(rule)}
                              className="p-1.5 rounded-lg text-foreground/30 hover:text-foreground hover:bg-muted/40 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => { setDeleteConfirm(rule.id); setFormMode(null); }}
                              className="p-1.5 rounded-lg text-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Inline edit form replaces this row */}
                  {formMode === rule.id && (
                    <tr>
                      <td colSpan={6} className="px-5 py-4 bg-muted/5">
                        {RuleForm}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
