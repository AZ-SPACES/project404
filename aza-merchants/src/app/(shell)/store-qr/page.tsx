"use client";

import { useEffect, useMemo, useState } from "react";
import { getMe, Merchant } from "@/lib/merchant-api";
import { Loader2, Copy, Check, Share2, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// Codes are drawn in the browser rather than fetched from an image service: a printed
// poster is the one thing here that has to keep working when a third party is down,
// and the handle stops being sent to anyone outside Aza to have it rendered.

/**
 * The counter code. `till` rides along so a shop with several points of sale can tell
 * which one rang up a sale; `amount` turns the permanent code into a one-off charge.
 * The app parses both off any Aza link it scans.
 */
function buildLink(handle: string, opts: { till?: string; amount?: string; note?: string } = {}) {
  const url = new URL(`https://aza.systems/m/${handle}`);
  if (opts.amount) url.searchParams.set("amount", opts.amount);
  if (opts.note) url.searchParams.set("note", opts.note);
  if (opts.till) url.searchParams.set("till", opts.till);
  return url.toString();
}

const TILL_MAX = 40;

export default function StoreQrPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [mode, setMode] = useState<"open" | "charge">("open");
  const [till, setTill] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    getMe()
      .then((me) => setMerchant(me))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const amountValid = useMemo(() => {
    const n = parseFloat(amount);
    return !isNaN(n) && n > 0;
  }, [amount]);

  // In charge mode an incomplete amount would encode a code that pays the wrong sum,
  // so hold on the open code until the figure is actually valid.
  const link = useMemo(() => {
    if (!merchant) return "";
    const till_ = till.trim() || undefined;
    if (mode === "charge" && amountValid) {
      return buildLink(merchant.businessHandle, {
        till: till_,
        amount: parseFloat(amount).toFixed(2),
        note: note.trim() || undefined,
      });
    }
    return buildLink(merchant.businessHandle, { till: till_ });
  }, [merchant, mode, till, amount, amountValid, note]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#B7EE7A]" size={24} />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-foreground/40 text-sm">No merchant account found.</p>
      </div>
    );
  }

  function copyLink() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function share() {
    if (navigator.share) {
      navigator
        .share({
          title: `Pay ${merchant!.businessName}`,
          text: `Pay ${merchant!.businessName} on Aza Pay`,
          url: link,
        })
        .catch(() => {});
    } else {
      copyLink();
    }
  }

  const charging = mode === "charge" && amountValid;
  const amountLabel = charging
    ? `GHS ${parseFloat(amount).toFixed(2)}`
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Store QR Code</h1>
        <p className="text-foreground/40 text-sm mt-0.5">
          Customers scan this to pay you in person
        </p>
      </div>

      {/* Mode toggle */}
      <div className="bg-card border border-border rounded-xl p-1.5 flex gap-1.5 print:hidden">
        {(
          [
            ["open", "Any amount", "Permanent code. Customer types the amount."],
            ["charge", "Charge an amount", "One sale. The amount is baked into the code."],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`flex-1 px-3 py-2.5 rounded-lg text-left transition-colors ${
              mode === value
                ? "bg-[#174717] text-foreground"
                : "text-foreground/50 hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-[11px] opacity-60 mt-0.5">{hint}</span>
          </button>
        ))}
      </div>

      {/* Poster Card */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center print:border-0 print:bg-transparent">
        {/* Business Identity */}
        <div className="flex items-center gap-3 mb-6 print:hidden">
          {merchant.logoUrl ? (
            <img
              src={merchant.logoUrl}
              alt={merchant.businessName}
              className="w-12 h-12 rounded-xl object-cover border border-border"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#B7EE7A]/15 border border-[#B7EE7A]/25 flex items-center justify-center flex-shrink-0">
              <span className="text-base font-bold text-[#B7EE7A]">
                {merchant.businessName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="text-base font-bold text-foreground">{merchant.businessName}</p>
            <p className="text-sm text-foreground/40">@{merchant.businessHandle}</p>
          </div>
        </div>

        {/* Printable White Poster */}
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center w-full max-w-xs shadow-lg print:shadow-none">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Pay Merchant</p>
          <p className="text-lg font-extrabold text-gray-900 mb-1 text-center">{merchant.businessName}</p>
          {till.trim() && (
            <p className="text-[11px] font-semibold text-gray-400 mb-4 uppercase tracking-wider">
              Till {till.trim()}
            </p>
          )}
          {!till.trim() && <div className="mb-4" />}

          {/* QR with the Aza mark punched out of the middle. The code carries enough
              error correction (level H) to stay readable behind the overlay. */}
          <div className="relative mb-5">
            <div className="p-2 bg-white border border-gray-100 rounded-xl">
              <QRCodeSVG
                value={link}
                size={200}
                level="H"
                marginSize={0}
                bgColor="#ffffff"
                fgColor="#111111"
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-md p-1 shadow-sm">
                <div className="w-7 h-7 rounded bg-[#174717] flex items-center justify-center">
                  <span className="text-white font-bold text-xs">A</span>
                </div>
              </div>
            </div>
          </div>

          {charging ? (
            <>
              <p className="text-2xl font-extrabold text-gray-900 mb-1">{amountLabel}</p>
              <p className="text-xs text-gray-400 text-center mb-4">
                {note.trim() || "Scan to pay this exact amount."}
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-extrabold text-gray-900 mb-1">Scan to Pay</p>
              <p className="text-xs text-gray-400 text-center mb-4">
                Enter amount on your phone to complete payment.
              </p>
            </>
          )}

          <div className="border-t border-gray-100 w-full pt-3 text-center">
            <p className="text-[10px] text-gray-400 font-medium">Scan with Aza App</p>
            <p className="text-[9px] text-gray-300 mt-0.5">Powered by Aza Systems</p>
          </div>
        </div>

        {/* Charge inputs */}
        {mode === "charge" && (
          <div className="w-full max-w-xs mt-5 space-y-2.5 print:hidden">
            <div>
              <label htmlFor="amount" className="block text-[11px] text-foreground/40 mb-1.5 uppercase tracking-wider font-medium">
                Amount (GHS)
              </label>
              <input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-border text-foreground text-sm outline-none focus:border-[#B7EE7A]/50"
              />
            </div>
            <div>
              <label htmlFor="note" className="block text-[11px] text-foreground/40 mb-1.5 uppercase tracking-wider font-medium">
                What for (optional)
              </label>
              <input
                id="note"
                value={note}
                maxLength={120}
                onChange={(e) => setNote(e.target.value)}
                placeholder="2 jollof, 1 drink"
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-border text-foreground text-sm outline-none focus:border-[#B7EE7A]/50"
              />
            </div>
            {!amountValid && amount.length > 0 && (
              <p className="text-[11px] text-amber-400/80">
                Enter an amount above 0 — the code below still charges any amount until you do.
              </p>
            )}
          </div>
        )}

        {/* Till */}
        <div className="w-full max-w-xs mt-4 print:hidden">
          <label htmlFor="till" className="block text-[11px] text-foreground/40 mb-1.5 uppercase tracking-wider font-medium">
            Till / branch (optional)
          </label>
          <input
            id="till"
            value={till}
            maxLength={TILL_MAX}
            onChange={(e) => setTill(e.target.value)}
            placeholder="Counter 1"
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-border text-foreground text-sm outline-none focus:border-[#B7EE7A]/50"
          />
          <p className="text-[11px] text-foreground/30 mt-1.5">
            Print a different code per till and every sale is tagged with the one it came
            from — visible on transactions and in the app&apos;s takings view.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 w-full max-w-xs mt-5 print:hidden">
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-muted/30 border border-border text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
          >
            {copied ? <Check size={15} className="text-[#B7EE7A]" /> : <Copy size={15} />}
            {copied ? "Copied!" : "Copy payment link"}
          </button>
          <button
            onClick={share}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-muted/30 border border-border text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
          >
            <Share2 size={15} />
            Share
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#174717] hover:bg-[#1e5e1e] text-sm font-semibold text-foreground transition-colors"
          >
            <Printer size={15} />
            Print poster
          </button>
        </div>
      </div>

      {/* Link info */}
      <div className="bg-card border border-border rounded-xl p-5 print:hidden">
        <p className="text-sm font-semibold text-foreground mb-3">
          {charging ? "This charge link" : "Your store payment link"}
        </p>
        <div className="bg-black/30 border border-border rounded-xl p-3.5 mb-3">
          <p className="text-[10px] text-foreground/30 mb-1.5 uppercase tracking-wider font-medium">
            {charging ? "One-off charge" : "Static URL"}
          </p>
          <p className="text-xs font-mono text-foreground/70 break-all">{link}</p>
        </div>
        <p className="text-xs text-foreground/30">
          {charging
            ? "This link is for one sale. The customer confirms the exact amount you entered — reprint it for the next one."
            : "This link is permanent and tied to your business handle. Customers can open it to pay any amount directly to your merchant account."}
        </p>
      </div>
    </div>
  );
}
