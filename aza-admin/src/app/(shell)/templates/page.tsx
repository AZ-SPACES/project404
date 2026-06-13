"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  getEmailTemplates,
  updateEmailTemplate,
  type EmailTemplate,
} from "@/lib/admin-api";
import { Edit2, FileText, Loader2, Plus, Trash2, X } from "lucide-react";

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric" });
}

type FormState = { templateKey: string; subject: string; body: string };

function TemplateForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  initial?: FormState;
  onSubmit: (data: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string;
}) {
  const [form, setForm] = useState<FormState>(
    initial ?? { templateKey: "", subject: "", body: "" }
  );
  return (
    <div className="rounded-xl border border-border p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          {initial ? "Edit template" : "New template"}
        </h3>
        <button onClick={onCancel} className="text-foreground/40 hover:text-foreground/70">
          <X size={15} />
        </button>
      </div>
      <div className="space-y-2">
        <input
          placeholder="Template key (e.g. welcome, otp, kyc_approved)"
          value={form.templateKey}
          onChange={(e) => setForm((f) => ({ ...f, templateKey: e.target.value }))}
          className="w-full text-sm bg-foreground/5 border border-border rounded-lg px-3 py-2 text-foreground placeholder-foreground/30 outline-none focus:border-foreground/20 font-mono"
        />
        <input
          placeholder="Email subject"
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          className="w-full text-sm bg-foreground/5 border border-border rounded-lg px-3 py-2 text-foreground placeholder-foreground/30 outline-none focus:border-foreground/20"
        />
        <textarea
          placeholder="Email body (HTML or plain text)"
          rows={8}
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          className="w-full text-sm bg-foreground/5 border border-border rounded-lg px-3 py-2 text-foreground placeholder-foreground/30 outline-none focus:border-foreground/20 font-mono resize-y"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="text-sm px-4 py-2 rounded-lg border border-border text-foreground/50 hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={() => onSubmit(form)}
          disabled={isPending || !form.templateKey || !form.subject || !form.body}
          className="text-sm px-4 py-2 rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 transition-colors"
        >
          {isPending ? "Saving…" : "Save template"}
        </button>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [formError, setFormError] = useState("");

  const { data: templates, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["email-templates"],
    queryFn: getEmailTemplates,
  });

  const create = useMutation({
    mutationFn: createEmailTemplate,
    onSuccess: () => {
      setShowCreate(false);
      setFormError("");
      qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormState }) => updateEmailTemplate(id, data),
    onSuccess: () => {
      setEditing(null);
      setFormError("");
      qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteEmailTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Email Templates</h1>
          <p className="text-sm text-foreground/50 mt-0.5">
            Override the default email content sent to users
          </p>
        </div>
        {!showCreate && !editing && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-foreground/5 border border-border hover:bg-foreground/10 text-foreground/70 hover:text-foreground transition-colors"
          >
            <Plus size={14} />
            New template
          </button>
        )}
      </div>

      {showCreate && (
        <TemplateForm
          onSubmit={(data) => create.mutate(data)}
          onCancel={() => { setShowCreate(false); setFormError(""); }}
          isPending={create.isPending}
          error={formError}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={18} className="animate-spin text-foreground/40" />
        </div>
      ) : (
        <div className="space-y-3">
          {(templates ?? []).map((t) =>
            editing?.id === t.id ? (
              <TemplateForm
                key={t.id}
                initial={{ templateKey: t.templateKey, subject: t.subject, body: t.body }}
                onSubmit={(data) => update.mutate({ id: t.id, data })}
                onCancel={() => { setEditing(null); setFormError(""); }}
                isPending={update.isPending}
                error={formError}
              />
            ) : (
              <div key={t.id} className="rounded-xl border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-foreground/40 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground font-mono">{t.templateKey}</p>
                      <p className="text-xs text-foreground/50">{t.subject}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-foreground/30">
                      {t.updatedBy ? `by ${t.updatedBy} · ` : ""}{fmt(t.updatedAt)}
                    </span>
                    <button
                      onClick={() => setEditing(t)}
                      className="p-1.5 rounded-lg hover:bg-foreground/5 text-foreground/40 hover:text-foreground/70 transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => remove.mutate(t.id)}
                      disabled={remove.isPending}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-foreground/40 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <pre className="text-xs text-foreground/40 bg-foreground/[0.03] rounded-lg px-3 py-2 overflow-auto max-h-24 font-mono whitespace-pre-wrap">
                  {t.body.slice(0, 300)}{t.body.length > 300 ? "…" : ""}
                </pre>
              </div>
            )
          )}
          {(templates ?? []).length === 0 && !showCreate && (
            <div className="rounded-xl border border-border py-12 text-center">
              <FileText size={24} className="mx-auto text-foreground/20 mb-3" />
              <p className="text-sm text-foreground/40">No custom templates yet.</p>
              <p className="text-xs text-foreground/30 mt-1">
                Create a template to override the default email content.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
