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
  // Branding
  const [brandColor, setBrandColor] = useState("#10b981");
  const [checkoutTagline, setCheckoutTagline] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  // Tax
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState("");
  const [taxLabel, setTaxLabel] = useState("VAT");

  useEffect(() => {
    getMe()
      .then((me) => {
        if (!me) return;
        setMerchant(me);
        setBusinessName(me.businessName ?? "");
        setBusinessEmail(me.businessEmail ?? "");
        setBusinessPhone(me.businessPhone ?? "");
        setBusinessDescription(me.businessDescription ?? "");
        setBrandColor(me.brandColor ?? "#10b981");
        setCheckoutTagline(me.checkoutTagline ?? "");
        setSupportEmail(me.supportEmail ?? "");
        setTaxEnabled(me.taxEnabled ?? false);
        setTaxRate(me.taxRate != null ? String(me.taxRate) : "");
        setTaxLabel(me.taxLabel ?? "VAT");
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
        brandColor: brandColor || undefined,
        checkoutTagline: checkoutTagline || undefined,
        supportEmail: supportEmail || undefined,
        taxEnabled,
        taxRate: taxEnabled && taxRate ? parseFloat(taxRate) : undefined,
        taxLabel: taxEnabled && taxLabel ? taxLabel : undefined,
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

      {/* Checkout branding */}
      <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
        <p className="text-sm font-semibold text-white mb-1">Checkout branding</p>
        <p className="text-xs text-white/30 mb-5">Customize how your checkout page looks to customers</p>
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <label className="text-sm font-medium text-white/65">Brand color</label>
              <span className="text-xs text-white/30">Used for the pay button on checkout</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder="#10b981"
                className={inputCls + " font-mono w-36"}
              />
              <div
                className="flex-1 h-10 rounded-xl border border-white/10 flex items-center justify-center text-white text-xs font-semibold"
                style={{ backgroundColor: brandColor }}
              >
                Pay now
              </div>
            </div>
          </div>
          <Field label="Checkout tagline" hint="Short text under your business name">
            <input
              type="text"
              value={checkoutTagline}
              onChange={(e) => setCheckoutTagline(e.target.value)}
              placeholder="Fast & secure payments"
              maxLength={80}
              className={inputCls}
            />
          </Field>
          <Field label="Support email" hint="Shown to customers on checkout">
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@yourbusiness.com"
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      {/* Tax configuration */}
      <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white">Tax</p>
            <p className="text-xs text-white/30 mt-0.5">Automatically calculate tax on invoices and checkouts</p>
          </div>
          <button
            type="button"
            onClick={() => setTaxEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${taxEnabled ? "bg-[#10b981]" : "bg-white/15"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${taxEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        {taxEnabled && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tax rate (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="12.50"
                className={inputCls}
              />
            </Field>
            <Field label="Tax label">
              <input
                type="text"
                value={taxLabel}
                onChange={(e) => setTaxLabel(e.target.value)}
                placeholder="VAT"
                maxLength={20}
                className={inputCls}
              />
            </Field>
          </div>
        )}
      </div>

      {/* Save button (for branding + tax) */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave as unknown as React.MouseEventHandler}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#0ea472] disabled:opacity-50 text-white font-semibold text-sm transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Saving…" : "Save all settings"}
        </button>
        {success && (
          <span className="flex items-center gap-1.5 text-sm text-[#10b981]">
            <CheckCircle2 size={15} />Saved
          </span>
        )}
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
