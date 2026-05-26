"use client";

import { useEffect, useState, useRef } from "react";
import { getMe, updateMe, uploadLogo, Merchant } from "@/lib/merchant-api";
import {
  Loader2,
  Camera,
  Save,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

function BusinessAvatar({ merchant, size = 64 }: { merchant: Merchant; size?: number }) {
  if (merchant.logoUrl) {
    return (
      <img
        src={merchant.logoUrl}
        alt={merchant.businessName}
        className="rounded-xl object-cover border border-white/10"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = merchant.businessName
    .split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      className="rounded-xl bg-[#10b981]/15 border border-[#10b981]/25 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <span className="text-xl font-bold text-[#10b981]">{initials}</span>
    </div>
  );
}

export default function SettingsPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");

  useEffect(() => {
    getMe()
      .then((me) => {
        if (!me) return;
        setMerchant(me);
        setBusinessName(me.businessName ?? "");
        setBusinessEmail(me.businessEmail ?? "");
        setBusinessPhone(me.businessPhone ?? "");
        setBusinessDescription(me.businessDescription ?? "");
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogoUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const updated = await uploadLogo(file);
      setMerchant(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const updated = await updateMe({
        businessName: businessName || undefined,
        businessEmail: businessEmail || undefined,
        businessPhone: businessPhone || undefined,
        businessDescription: businessDescription || undefined,
      });
      setMerchant(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-[#10b981]" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-0.5">Business profile and preferences</p>
      </div>

      {/* Business logo */}
      <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
        <p className="text-sm font-semibold text-white mb-4">Business logo</p>
        <div className="flex items-center gap-4">
          {merchant && <BusinessAvatar merchant={merchant} size={64} />}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/6 border border-white/10 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              {uploading ? "Uploading…" : "Change logo"}
            </button>
            <p className="text-xs text-white/25 mt-1.5">PNG or JPG, max 5MB</p>
          </div>
        </div>
      </div>

      {/* Profile form */}
      <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
        <p className="text-sm font-semibold text-white mb-5">Business details</p>
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Business name">
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Business email">
            <input
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              placeholder="payments@yourcompany.com"
              className={inputCls}
            />
          </Field>
          <Field label="Business phone">
            <input
              type="tel"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="+233 XX XXX XXXX"
              className={inputCls}
            />
          </Field>
          <Field label="Description" hint="Optional short bio shown on checkout">
            <textarea
              rows={3}
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              placeholder="We sell premium handmade goods…"
              className={inputCls + " resize-none"}
            />
          </Field>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={15} />{error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-sm">
              <CheckCircle2 size={15} />Settings saved
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#0ea472] disabled:opacity-50 text-white font-semibold text-sm transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </div>

      {/* Account info */}
      {merchant && (
        <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
          <p className="text-sm font-semibold text-white mb-4">Account info</p>
          <div className="space-y-3">
            <InfoRow label="Business handle" value={`@${merchant.businessHandle}`} mono />
            <InfoRow label="Merchant ID" value={merchant.id} mono />
            <InfoRow label="Status" value={merchant.status.replace(/_/g, " ")} cls={merchant.status === "ACTIVE" ? "text-[#10b981]" : "text-amber-400"} />
            <InfoRow label="Currency" value={merchant.currency} />
            {merchant.feeRateBps > 0 && (
              <InfoRow label="Platform fee" value={`${(merchant.feeRateBps / 100).toFixed(2)}%`} />
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-white/25">
              To close your business account, please{" "}
              <a href="mailto:support@aza.systems" className="text-[#10b981] hover:underline">
                contact support
              </a>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#10b981]/60 focus:bg-white/8 transition-all text-sm";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <label className="text-sm font-medium text-white/65">{label}</label>
        {hint && <span className="text-xs text-white/30">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, cls }: { label: string; value: string; mono?: boolean; cls?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/35">{label}</span>
      <span className={`text-xs ${mono ? "font-mono" : ""} ${cls ?? "text-white/65"}`}>{value}</span>
    </div>
  );
}
