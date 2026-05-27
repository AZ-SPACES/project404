"use client";

import { useEffect, useState } from "react";
import { getMe, Merchant } from "@/lib/merchant-api";
import { Loader2, Copy, Check, Share2, QrCode, ExternalLink } from "lucide-react";
import Image from "next/image";

function buildStaticLink(handle: string) {
  return `https://aza.systems/pay/${handle}`;
}

function buildQrUrl(data: string, size = 400) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

export default function StoreQrPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getMe()
      .then((me) => setMerchant(me))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#10b981]" size={24} />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/40 text-sm">No merchant account found.</p>
      </div>
    );
  }

  const staticLink = buildStaticLink(merchant.businessHandle);
  const qrUrl = buildQrUrl(staticLink, 400);
  const printQrUrl = buildQrUrl(staticLink, 1000);

  function copyLink() {
    navigator.clipboard.writeText(staticLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function share() {
    if (navigator.share) {
      navigator.share({
        title: `Pay ${merchant!.businessName}`,
        text: `Pay ${merchant!.businessName} on Aza Pay`,
        url: staticLink,
      }).catch(() => {});
    } else {
      copyLink();
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Store QR Code</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Customers scan this to pay you any amount in person
        </p>
      </div>

      {/* Poster Card */}
      <div className="bg-[#161616] border border-white/5 rounded-xl p-6 flex flex-col items-center">
        {/* Business Identity */}
        <div className="flex items-center gap-3 mb-6">
          {merchant.logoUrl ? (
            <img
              src={merchant.logoUrl}
              alt={merchant.businessName}
              className="w-12 h-12 rounded-xl object-cover border border-white/10"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#10b981]/15 border border-[#10b981]/25 flex items-center justify-center flex-shrink-0">
              <span className="text-base font-bold text-[#10b981]">
                {merchant.businessName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="text-base font-bold text-white">{merchant.businessName}</p>
            <p className="text-sm text-white/40">@{merchant.businessHandle}</p>
          </div>
        </div>

        {/* Printable White Poster */}
        <div className="bg-white rounded-2xl p-8 flex flex-col items-center w-full max-w-xs shadow-lg">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Pay Merchant</p>
          <p className="text-lg font-extrabold text-gray-900 mb-5 text-center">{merchant.businessName}</p>

          {/* QR Code with logo overlay */}
          <div className="relative mb-5">
            <div className="p-2 bg-white border border-gray-100 rounded-xl">
              <img
                src={qrUrl}
                alt="Store QR code"
                width={200}
                height={200}
                className="block"
              />
            </div>
            {/* Aza logo overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-md p-1 shadow-sm">
                <div className="w-7 h-7 rounded bg-[#10b981] flex items-center justify-center">
                  <span className="text-white font-bold text-xs">A</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-2xl font-extrabold text-gray-900 mb-1">Scan to Pay</p>
          <p className="text-xs text-gray-400 text-center mb-4">Enter amount on your phone to complete payment.</p>

          <div className="border-t border-gray-100 w-full pt-3 text-center">
            <p className="text-[10px] text-gray-400 font-medium">Scan with Aza App</p>
            <p className="text-[9px] text-gray-300 mt-0.5">Powered by Aza Systems</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 w-full max-w-xs mt-5">
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            {copied ? <Check size={15} className="text-[#10b981]" /> : <Copy size={15} />}
            {copied ? "Copied!" : "Copy payment link"}
          </button>
          <button
            onClick={share}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Share2 size={15} />
            Share
          </button>
          <a
            href={printQrUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#10b981] hover:bg-[#0ea472] text-sm font-semibold text-white transition-colors"
          >
            <ExternalLink size={15} />
            Save / Print Poster
          </a>
        </div>
      </div>

      {/* Static link info */}
      <div className="bg-[#161616] border border-white/5 rounded-xl p-5">
        <p className="text-sm font-semibold text-white mb-3">Your store payment link</p>
        <div className="bg-black/30 border border-white/8 rounded-xl p-3.5 mb-3">
          <p className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider font-medium">Static URL</p>
          <p className="text-xs font-mono text-white/70 break-all">{staticLink}</p>
        </div>
        <p className="text-xs text-white/30">
          This link is permanent and tied to your business handle. Customers can open it to pay any amount directly to your merchant account.
        </p>
      </div>
    </div>
  );
}
