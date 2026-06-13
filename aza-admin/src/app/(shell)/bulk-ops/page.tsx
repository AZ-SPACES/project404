"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  bulkSuspendUsers,
  bulkActivateUsers,
  bulkNotifyUsers,
  bulkKycApprove,
} from "@/lib/admin-api";
import { Users, Bell, ShieldCheck, Ban, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

function parseIds(raw: string): string[] {
  return raw
    .split(/[\n,\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function ResultBanner({ result, error }: { result: Record<string, number> | null; error: string | null }) {
  if (error) return (
    <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
      <AlertCircle size={14} /> {error}
    </div>
  );
  if (result) return (
    <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm">
      <CheckCircle2 size={14} />
      {Object.entries(result).map(([k, v]) => `${v} ${k}`).join(", ")} successfully.
    </div>
  );
  return null;
}

function Section({ icon, title, color, children }: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={color}>{icon}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function IdsTextarea({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-foreground/40 block mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Paste user UUIDs — one per line, or comma-separated"
        rows={4}
        className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none resize-none"
      />
      <p className="text-[10px] text-foreground/25 mt-1">{parseIds(value).length} IDs</p>
    </div>
  );
}

export default function BulkOpsPage() {

  // Suspend
  const [suspendIds, setSuspendIds] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendResult, setSuspendResult] = useState<Record<string, number> | null>(null);
  const suspendMut = useMutation({
    mutationFn: () => bulkSuspendUsers(parseIds(suspendIds), suspendReason),
    onSuccess: (r) => { setSuspendResult(r); setSuspendIds(""); setSuspendReason(""); },
    onError: () => setSuspendResult(null),
  });

  // Activate
  const [activateIds, setActivateIds] = useState("");
  const [activateResult, setActivateResult] = useState<Record<string, number> | null>(null);
  const activateMut = useMutation({
    mutationFn: () => bulkActivateUsers(parseIds(activateIds)),
    onSuccess: (r) => { setActivateResult(r); setActivateIds(""); },
    onError: () => setActivateResult(null),
  });

  // Notify
  const [notifyIds, setNotifyIds] = useState("");
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [notifyResult, setNotifyResult] = useState<Record<string, number> | null>(null);
  const notifyMut = useMutation({
    mutationFn: () => bulkNotifyUsers(parseIds(notifyIds), notifyTitle, notifyBody),
    onSuccess: (r) => { setNotifyResult(r); setNotifyTitle(""); setNotifyBody(""); setNotifyIds(""); },
    onError: () => setNotifyResult(null),
  });

  // KYC approve
  const [kycIds, setKycIds] = useState("");
  const [kycResult, setKycResult] = useState<Record<string, number> | null>(null);
  const kycMut = useMutation({
    mutationFn: () => bulkKycApprove(parseIds(kycIds)),
    onSuccess: (r) => { setKycResult(r); setKycIds(""); },
    onError: () => setKycResult(null),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Bulk Operations</h1>
        <p className="text-foreground/40 text-sm mt-1">
          Apply status changes, notifications, and KYC approvals to multiple users at once.
        </p>
      </div>

      <Section icon={<Ban size={15} />} title="Bulk Suspend" color="text-amber-400">
        <div className="space-y-3">
          <IdsTextarea label="User IDs to suspend" value={suspendIds} onChange={setSuspendIds} />
          <div>
            <label className="text-xs text-foreground/40 block mb-1.5">Reason</label>
            <input
              type="text"
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              placeholder="Policy violation, fraud investigation…"
              className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
          <ResultBanner
            result={suspendResult}
            error={suspendMut.error ? (suspendMut.error as Error).message : null}
          />
          <button
            onClick={() => suspendMut.mutate()}
            disabled={suspendMut.isPending || parseIds(suspendIds).length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-sm font-medium hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
          >
            {suspendMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
            Suspend {parseIds(suspendIds).length > 0 ? `${parseIds(suspendIds).length} users` : "users"}
          </button>
        </div>
      </Section>

      <Section icon={<CheckCircle2 size={15} />} title="Bulk Activate" color="text-emerald-400">
        <div className="space-y-3">
          <IdsTextarea label="User IDs to reactivate" value={activateIds} onChange={setActivateIds} />
          <ResultBanner
            result={activateResult}
            error={activateMut.error ? (activateMut.error as Error).message : null}
          />
          <button
            onClick={() => activateMut.mutate()}
            disabled={activateMut.isPending || parseIds(activateIds).length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
          >
            {activateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Activate {parseIds(activateIds).length > 0 ? `${parseIds(activateIds).length} users` : "users"}
          </button>
        </div>
      </Section>

      <Section icon={<Bell size={15} />} title="Bulk Notification" color="text-[#B7EE7A]">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-foreground/40 block mb-1.5">Notification Title</label>
            <input
              type="text"
              value={notifyTitle}
              onChange={e => setNotifyTitle(e.target.value)}
              placeholder="System update, important notice…"
              className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-foreground/40 block mb-1.5">Message Body</label>
            <textarea
              value={notifyBody}
              onChange={e => setNotifyBody(e.target.value)}
              placeholder="Full message text…"
              rows={3}
              className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none resize-none"
            />
          </div>
          <IdsTextarea
            label="Target User IDs (leave blank to send to ALL active users)"
            value={notifyIds}
            onChange={setNotifyIds}
          />
          {notifyIds.trim() === "" && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              No IDs specified — this will send to all active users.
            </p>
          )}
          <ResultBanner
            result={notifyResult}
            error={notifyMut.error ? (notifyMut.error as Error).message : null}
          />
          <button
            onClick={() => notifyMut.mutate()}
            disabled={notifyMut.isPending || !notifyTitle.trim() || !notifyBody.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#B7EE7A]/10 border border-[#B7EE7A]/20 text-[#B7EE7A] text-sm font-medium hover:bg-[#B7EE7A]/20 disabled:opacity-50 transition-colors"
          >
            {notifyMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
            Send Notification
          </button>
        </div>
      </Section>

      <Section icon={<ShieldCheck size={15} />} title="Bulk KYC Approve" color="text-sky-400">
        <div className="space-y-3">
          <IdsTextarea
            label="User IDs with KYC status UNDER_REVIEW"
            value={kycIds}
            onChange={setKycIds}
          />
          <p className="text-xs text-foreground/30">
            Only users currently in UNDER_REVIEW status will be approved. Others are skipped.
          </p>
          <ResultBanner
            result={kycResult}
            error={kycMut.error ? (kycMut.error as Error).message : null}
          />
          <button
            onClick={() => kycMut.mutate()}
            disabled={kycMut.isPending || parseIds(kycIds).length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/15 border border-sky-500/25 text-sky-400 text-sm font-medium hover:bg-sky-500/25 disabled:opacity-50 transition-colors"
          >
            {kycMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Approve {parseIds(kycIds).length > 0 ? `${parseIds(kycIds).length} users` : "KYC"}
          </button>
        </div>
      </Section>

      <Section icon={<Users size={15} />} title="How to use" color="text-foreground/30">
        <ul className="text-sm text-foreground/50 space-y-1.5 list-disc list-inside">
          <li>Paste user UUIDs from the Users list, exported CSV, or from a risk report.</li>
          <li>Bulk Suspend and Activate require ADMIN or COMPLIANCE role.</li>
          <li>Leaving IDs blank on Notify sends to all active users — confirm before sending.</li>
          <li>KYC Approve skips users who are already VERIFIED or not UNDER_REVIEW.</li>
          <li>All operations are audit-logged with the acting admin's email.</li>
        </ul>
      </Section>
    </div>
  );
}
