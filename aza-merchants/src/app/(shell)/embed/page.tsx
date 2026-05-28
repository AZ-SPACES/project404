"use client";

import { useEffect, useState } from "react";
import { getMe, Merchant } from "@/lib/merchant-api";
import { Loader2, Copy, Check, Code2, ExternalLink, Monitor } from "lucide-react";

const PAY_BASE = "https://pay.aza.systems";
const PAY_URL_BASE = "https://aza.systems/pay";

function buildPayUrl(handle: string, amount?: string, description?: string) {
  const base = `${PAY_URL_BASE}/${handle}`;
  const params = new URLSearchParams();
  if (amount) params.set("amount", amount);
  if (description) params.set("description", description);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return { copied, copy };
}

function CodeBlock({ code, language = "html" }: { code: string; language?: string }) {
  const { copied, copy } = useCopy(code);
  return (
    <div className="relative group">
      <pre className="bg-black/40 border border-white/8 rounded-xl p-4 text-xs text-white/60 font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? <Check size={13} className="text-[#B7EE7A]" /> : <Copy size={13} />}
      </button>
    </div>
  );
}

type EmbedType = "button" | "qr" | "link" | "script";

export default function EmbedPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);

  // Config
  const [embedType, setEmbedType] = useState<EmbedType>("button");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [buttonText, setButtonText] = useState("Pay now");
  const [buttonColor, setButtonColor] = useState("#B7EE7A");
  const [buttonSize, setButtonSize] = useState<"sm" | "md" | "lg">("md");

  useEffect(() => {
    getMe()
      .then((me) => {
        setMerchant(me);
        if (me?.brandColor) setButtonColor(me.brandColor);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-[#B7EE7A]" size={22} />
      </div>
    );
  }

  if (!merchant) return null;

  const payUrl = buildPayUrl(merchant.businessHandle, amount, description);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payUrl)}`;

  const sizeCss = {
    sm: "padding: 8px 16px; font-size: 13px; border-radius: 8px;",
    md: "padding: 12px 24px; font-size: 15px; border-radius: 10px;",
    lg: "padding: 16px 32px; font-size: 17px; border-radius: 12px;",
  }[buttonSize];

  const buttonHtml = `<a
  href="${payUrl}"
  target="_blank"
  rel="noopener noreferrer"
  style="display:inline-block;background-color:${buttonColor};color:#ffffff;font-weight:600;text-decoration:none;${sizeCss}font-family:system-ui,sans-serif;cursor:pointer;"
>
  ${buttonText}
</a>`;

  const qrHtml = `<!-- Aza Pay QR Code for ${merchant.businessName} -->
<div style="display:inline-flex;flex-direction:column;align-items:center;gap:8px;font-family:system-ui,sans-serif;">
  <img
    src="${qrUrl}"
    alt="Scan to pay ${merchant.businessName}"
    width="200"
    height="200"
    style="border-radius:12px;border:1px solid #e5e7eb;"
  />
  <p style="margin:0;font-size:13px;color:#6b7280;">Scan to pay ${merchant.businessName}</p>
</div>`;

  const linkHtml = `<a
  href="${payUrl}"
  target="_blank"
  rel="noopener noreferrer"
  style="color:${buttonColor};font-weight:500;font-family:system-ui,sans-serif;"
>
  Pay ${merchant.businessName}
</a>`;

  const scriptHtml = `<!-- Aza Pay Widget for ${merchant.businessName} -->
<div id="aza-pay-widget"></div>
<script>
  window.AzaPayConfig = {
    merchant: "${merchant.businessHandle}",
    buttonText: "${buttonText}",
    buttonColor: "${buttonColor}",${amount ? `\n    amount: ${amount},` : ""}${description ? `\n    description: "${description}",` : ""}
  };
</script>
<script src="${PAY_BASE}/embed.js" async></script>`;

  const snippets: Record<EmbedType, string> = {
    button: buttonHtml,
    qr: qrHtml,
    link: linkHtml,
    script: scriptHtml,
  };

  const TYPES: { id: EmbedType; label: string; icon: React.ElementType }[] = [
    { id: "button", label: "Button", icon: Code2 },
    { id: "qr", label: "QR Code", icon: Monitor },
    { id: "link", label: "Text Link", icon: ExternalLink },
    { id: "script", label: "JS Widget", icon: Code2 },
  ];

  const sizeLabel = { sm: "Small", md: "Medium", lg: "Large" };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Payment Embed Widget</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Embed a pay button, QR code, or link on your website
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Config panel */}
        <div className="space-y-5">
          {/* Embed type */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
            <p className="text-sm font-semibold text-white mb-3">Widget type</p>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setEmbedType(id)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-colors text-left ${embedType === id ? "bg-[#B7EE7A]/10 border-[#B7EE7A]/40 text-[#B7EE7A]" : "border-white/8 text-white/50 hover:border-white/15 hover:text-white/70"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment config */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-5 space-y-4">
            <p className="text-sm font-semibold text-white">Payment options</p>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Amount (GHS) <span className="text-white/20">— leave blank for customer to enter</span></label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-black/30 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#B7EE7A]/50"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Description <span className="text-white/20">optional</span></label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-black/30 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#B7EE7A]/50"
                placeholder="Order #1234, Event ticket…"
              />
            </div>
          </div>

          {/* Style config (only for button/script) */}
          {(embedType === "button" || embedType === "script") && (
            <div className="bg-[#161616] border border-white/5 rounded-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-white">Button style</p>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Button text</label>
                <input
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  className="w-full bg-black/30 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#B7EE7A]/50"
                  placeholder="Pay now"
                  maxLength={30}
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Button color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-white/10 bg-transparent"
                  />
                  <input
                    type="text"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    className="w-28 bg-black/30 border border-white/8 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-[#B7EE7A]/50"
                  />
                </div>
              </div>
              {embedType === "button" && (
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Size</label>
                  <div className="flex gap-2">
                    {(["sm", "md", "lg"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setButtonSize(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${buttonSize === s ? "bg-white/10 border-white/20 text-white" : "border-white/8 text-white/40 hover:border-white/15"}`}
                      >
                        {sizeLabel[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generated code */}
          <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
            <p className="text-sm font-semibold text-white mb-3">Generated code</p>
            <CodeBlock code={snippets[embedType]} />
            {embedType === "script" && (
              <p className="text-xs text-white/30 mt-3">
                The JS widget script (<code className="text-white/50">embed.js</code>) renders a button that opens an inline checkout modal without leaving your page.
              </p>
            )}
          </div>
        </div>

        {/* Live preview */}
        <div className="space-y-5">
          <div className="bg-[#161616] border border-white/5 rounded-xl p-5 sticky top-6">
            <p className="text-sm font-semibold text-white mb-4">Preview</p>

            {/* Simulated webpage */}
            <div className="bg-white rounded-xl p-6 min-h-40 flex flex-col items-center justify-center gap-4">
              {embedType === "button" && (
                <a
                  href={payUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-block",
                    backgroundColor: buttonColor,
                    color: "#ffffff",
                    fontWeight: 600,
                    textDecoration: "none",
                    padding: buttonSize === "sm" ? "8px 16px" : buttonSize === "lg" ? "16px 32px" : "12px 24px",
                    fontSize: buttonSize === "sm" ? 13 : buttonSize === "lg" ? 17 : 15,
                    borderRadius: buttonSize === "sm" ? 8 : buttonSize === "lg" ? 12 : 10,
                    fontFamily: "system-ui, sans-serif",
                    cursor: "pointer",
                  }}
                >
                  {buttonText || "Pay now"}
                </a>
              )}
              {embedType === "qr" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontFamily: "system-ui, sans-serif" }}>
                  <img src={qrUrl} alt="QR code" width={160} height={160} style={{ borderRadius: 10, border: "1px solid #e5e7eb" }} />
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>Scan to pay {merchant.businessName}</p>
                </div>
              )}
              {embedType === "link" && (
                <a
                  href={payUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: buttonColor, fontWeight: 500, fontFamily: "system-ui, sans-serif", fontSize: 15 }}
                >
                  Pay {merchant.businessName}
                </a>
              )}
              {embedType === "script" && (
                <div style={{ textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
                  <button
                    style={{
                      backgroundColor: buttonColor,
                      color: "#fff",
                      fontWeight: 600,
                      border: "none",
                      padding: "12px 24px",
                      fontSize: 15,
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  >
                    {buttonText || "Pay now"}
                  </button>
                  <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Opens checkout modal</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-xs text-white/30 mb-2">Payment URL</p>
              <p className="text-xs font-mono text-white/50 break-all">{payUrl}</p>
              <a
                href={payUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-xs text-[#B7EE7A] hover:underline"
              >
                <ExternalLink size={11} />
                Open in browser
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
