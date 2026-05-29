"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSystemSettings, updateSystemSettings, SystemSettings } from "@/lib/admin-api";
import { Settings, AlertCircle, CheckCircle2, Loader2, Save, AlertTriangle } from "lucide-react";

function Toggle({ enabled, onChange, label, description, danger }: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
      <div className="flex-1 mr-4">
        <p className={`text-sm font-medium ${danger ? "text-red-300" : "text-white/80"}`}>{label}</p>
        {description && <p className="text-xs text-white/35 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
          enabled ? danger ? "bg-red-500" : "bg-[#B7EE7A]" : "bg-white/10"
        }`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-7" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function NumberInput({ label, description, value, onChange, prefix }: {
  label: string; description?: string; value: number; onChange: (v: number) => void; prefix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-white/80">{label}</p>
        {description && <p className="text-xs text-white/35 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {prefix && <span className="text-xs text-white/40 font-medium">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-white/20 transition-colors"
        />
      </div>
    </div>
  );
}

function TextInput({ label, description, value, onChange }: {
  label: string; description?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="py-4 border-b border-white/5 last:border-0">
      <div className="mb-2">
        <p className="text-sm font-medium text-white/80">{label}</p>
        {description && <p className="text-xs text-white/35 mt-0.5">{description}</p>}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors"
      />
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SystemSettings | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: settings, isLoading, error } = useQuery<SystemSettings>({
    queryKey: ["systemSettings"],
    queryFn: getSystemSettings,
  });

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => updateSystemSettings(draft!),
    onSuccess: (updated) => {
      queryClient.setQueryData(["systemSettings"], updated);
      setDraft(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(settings);

  const set = (key: keyof SystemSettings, value: unknown) => {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const setFlag = (key: keyof SystemSettings["featureFlags"], value: boolean) => {
    setDraft((prev) => prev ? { ...prev, featureFlags: { ...prev.featureFlags, [key]: value } } : prev);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-white/30" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">System Settings</h1>
          <p className="text-white/40 text-sm mt-0.5">Platform configuration and feature management</p>
        </div>
        {draft?.platformVersion && (
          <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/8 text-xs text-white/40 font-mono">
            v{draft.platformVersion}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{(error as Error).message}
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />Settings saved successfully.
        </div>
      )}

      {saveMutation.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle size={16} />{(saveMutation.error as Error).message}
        </div>
      )}

      {!draft && !error ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-4 text-amber-400 text-sm flex items-center gap-3">
          <AlertCircle size={18} className="flex-shrink-0" />
          <div>
            <p className="font-semibold">Settings endpoint not yet connected.</p>
            <p className="text-amber-400/70 text-xs mt-0.5">This page will be fully functional once the backend settings API is implemented.</p>
          </div>
        </div>
      ) : draft && (
        <>
          <div className="bg-[#161616] border border-white/5 rounded-2xl px-5">
            <div className="py-4 border-b border-white/5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/30 flex items-center gap-2">
                <Settings size={13} />
                Platform Operations
              </h3>
            </div>

            {draft.maintenanceMode && (
              <div className="mt-4 mb-2 flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle size={15} className="text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">
                  <span className="font-bold">Maintenance mode is ON.</span> All user-facing operations are suspended.
                </p>
              </div>
            )}

            <Toggle
              label="Maintenance Mode"
              description="Suspend all user-facing operations for system maintenance"
              enabled={draft.maintenanceMode}
              onChange={(v) => set("maintenanceMode", v)}
              danger
            />
            <Toggle
              label="User Registration"
              description="Allow new users to create accounts"
              enabled={draft.registrationEnabled}
              onChange={(v) => set("registrationEnabled", v)}
            />
            <Toggle
              label="KYC Required"
              description="Require KYC verification before users can transact"
              enabled={draft.kycRequired}
              onChange={(v) => set("kycRequired", v)}
            />
          </div>

          <div className="bg-[#161616] border border-white/5 rounded-2xl px-5">
            <div className="py-4 border-b border-white/5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/30">Default Transaction Limits</h3>
            </div>
            <p className="text-xs text-white/30 pt-4 pb-1">Platform-wide defaults. Individual users can have custom limits set on their profile page.</p>
            <NumberInput
              label="Default Max Daily Transfer"
              description="Applies to users without a custom daily limit"
              value={draft.maxDailyTransferGhs}
              onChange={(v) => set("maxDailyTransferGhs", v)}
              prefix="GHS"
            />
            <NumberInput
              label="Default Max Single Transaction"
              description="Applies to users without a custom single-transaction limit"
              value={draft.maxSingleTransactionGhs}
              onChange={(v) => set("maxSingleTransactionGhs", v)}
              prefix="GHS"
            />
          </div>

          <div className="bg-[#161616] border border-white/5 rounded-2xl px-5">
            <div className="py-4 border-b border-white/5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/30">Feature Flags</h3>
            </div>
            <Toggle
              label="Biometric Authentication"
              description="Allow users to use fingerprint / face ID"
              enabled={draft.featureFlags.biometricEnabled}
              onChange={(v) => setFlag("biometricEnabled", v)}
            />
            <Toggle
              label="P2P Transfers"
              description="Allow peer-to-peer money transfers between users"
              enabled={draft.featureFlags.p2pEnabled}
              onChange={(v) => setFlag("p2pEnabled", v)}
            />
            <Toggle
              label="Push Notifications"
              description="Enable push notification delivery to users"
              enabled={draft.featureFlags.notificationsEnabled}
              onChange={(v) => setFlag("notificationsEnabled", v)}
            />
          </div>

          <div className="bg-[#161616] border border-white/5 rounded-2xl px-5">
            <div className="py-4 border-b border-white/5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/30">Contact Information</h3>
            </div>
            <TextInput
              label="Support Email"
              description="Customer-facing support email address"
              value={draft.supportEmail}
              onChange={(v) => set("supportEmail", v)}
            />
            <TextInput
              label="Support Phone"
              description="Customer-facing support phone number"
              value={draft.supportPhone}
              onChange={(v) => set("supportPhone", v)}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#B7EE7A] text-black text-sm font-semibold hover:bg-[#B7EE7A]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
