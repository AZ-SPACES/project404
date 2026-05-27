"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getNotificationPreferences, updateNotificationPreferences,
  NotificationPreferences,
} from "@/lib/merchant-api";
import { Loader2, Bell, CheckCircle2 } from "lucide-react";

interface PrefGroup {
  label: string;
  description: string;
  items: { key: keyof NotificationPreferences; label: string; description: string }[];
}

const GROUPS: PrefGroup[] = [
  {
    label: "Payments",
    description: "Alerts related to incoming payments",
    items: [
      { key: "emailPaymentReceived", label: "Payment received", description: "When a customer completes a payment" },
    ],
  },
  {
    label: "Payouts",
    description: "Alerts for your payout activity",
    items: [
      { key: "emailPayoutCompleted", label: "Payout completed", description: "When a payout is successfully processed" },
      { key: "emailPayoutFailed", label: "Payout failed", description: "When a payout fails to process" },
    ],
  },
  {
    label: "Invoices & Disputes",
    description: "Customer activity on your account",
    items: [
      { key: "emailInvoicePaid", label: "Invoice paid", description: "When a customer pays an invoice" },
      { key: "emailDisputeOpened", label: "Dispute opened", description: "When a customer opens a dispute on a transaction" },
    ],
  },
  {
    label: "Security",
    description: "Account security events",
    items: [
      { key: "emailApiKeyCreated", label: "API key created", description: "When a new API key is generated on your account" },
    ],
  },
  {
    label: "Reports",
    description: "Scheduled summaries",
    items: [
      { key: "emailWeeklySummary", label: "Weekly summary", description: "A weekly digest of your revenue and key metrics" },
      { key: "emailLowBalance", label: "Low balance alert", description: "When your merchant balance drops below the threshold" },
    ],
  },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${enabled ? "bg-[#10b981]" : "bg-white/15"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotificationPreferences();
      setPrefs(data);
      setLowBalanceThreshold(data.lowBalanceThreshold != null ? String(data.lowBalanceThreshold) : "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggle(key: keyof NotificationPreferences) {
    setPrefs((p) => p ? { ...p, [key]: !p[key] } : p);
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateNotificationPreferences({
        emailPaymentReceived: prefs.emailPaymentReceived,
        emailDisputeOpened: prefs.emailDisputeOpened,
        emailPayoutCompleted: prefs.emailPayoutCompleted,
        emailPayoutFailed: prefs.emailPayoutFailed,
        emailInvoicePaid: prefs.emailInvoicePaid,
        emailWeeklySummary: prefs.emailWeeklySummary,
        emailApiKeyCreated: prefs.emailApiKeyCreated,
        emailLowBalance: prefs.emailLowBalance,
        lowBalanceThreshold: prefs.emailLowBalance && lowBalanceThreshold
          ? parseFloat(lowBalanceThreshold)
          : undefined,
      });
      setPrefs(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-[#10b981]" size={22} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Notification Preferences</h1>
        <p className="text-white/40 text-sm mt-0.5">Choose which events send you an email alert</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {prefs && GROUPS.map((group) => (
        <div key={group.label} className="bg-[#161616] border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-sm font-semibold text-white">{group.label}</p>
            <p className="text-xs text-white/35 mt-0.5">{group.description}</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {group.items.map(({ key, label, description }) => (
              <div key={key} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-white/35 mt-0.5">{description}</p>
                  {key === "emailLowBalance" && prefs.emailLowBalance && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-white/40">Threshold (GHS):</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={lowBalanceThreshold}
                        onChange={(e) => setLowBalanceThreshold(e.target.value)}
                        className="w-28 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#10b981]/50"
                        placeholder="50.00"
                      />
                    </div>
                  )}
                </div>
                <Toggle
                  enabled={prefs[key] as boolean}
                  onChange={() => toggle(key)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#0ea472] disabled:opacity-50 text-white font-semibold text-sm transition-colors"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving…" : "Save preferences"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-[#10b981]">
            <CheckCircle2 size={15} />Saved
          </span>
        )}
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Bell size={15} className="text-white/30 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-white/30">
            Emails are sent to your business email address on file. Update it in{" "}
            <a href="/settings" className="text-[#10b981] hover:underline">Settings</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
