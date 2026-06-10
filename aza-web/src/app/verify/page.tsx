import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL &&
  process.env.NEXT_PUBLIC_API_URL !== "http://localhost:8080"
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === "production"
    ? "https://api.aza.systems"
    : "http://localhost:8080";

export const metadata: Metadata = {
  title: "Statement Verification — Aza",
  description: "Verify the authenticity of an Aza account statement.",
};

interface VerifyData {
  verified: boolean;
  accountHolderName?: string;
  accountNumber?: string;
  periodStart?: string;
  periodEnd?: string;
  transactionCount?: number;
  openingBalance?: number;
  totalCredits?: number;
  totalDebits?: number;
  closingBalance?: number;
  generatedAt?: string;
  currency?: string;
  issuedBy?: string;
}

async function fetchVerification(code: string): Promise<VerifyData> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/public/statements/verify?code=${encodeURIComponent(code)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { verified: false };
    const json = await res.json();
    return json.data ?? { verified: false };
  } catch {
    return { verified: false };
  }
}

function fmt(n?: number) {
  if (n == null) return "—";
  return n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCode(raw: string) {
  const clean = raw.replace(/-/g, "").toUpperCase();
  if (clean.length < 16) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}`;
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  let data: VerifyData = { verified: false };
  let errorMsg = "No verification code provided.";

  if (code && code.trim()) {
    data = await fetchVerification(code.trim());
    if (!data.verified) {
      errorMsg =
        "This code does not match any statement issued by Aza. " +
        "The document may have been altered or the code may be incorrect.";
    }
  }

  return (
    <div className="min-h-screen bg-[#0E0F0C] text-[#E8EAE4] flex flex-col">
      {/* Header */}
      <header className="bg-[#161616] border-b-2 border-[#B7EE7A] px-6 py-4 flex items-center gap-3">
        <span className="text-[#B7EE7A] text-xl font-extrabold tracking-tight">aza</span>
        <span className="text-[#3a3d35] text-lg">|</span>
        <span className="text-[#8a8d82] text-sm font-medium">Statement Verification</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex justify-center items-start px-4 py-12">
        <div className="w-full max-w-lg bg-[#161616] border border-[#2a2d25] rounded-2xl overflow-hidden">

          {/* Banner */}
          {data.verified ? (
            <div className="flex items-center gap-4 px-7 py-6 bg-[#0d1f0d] border-b border-[#1e3d1e]">
              <div className="w-11 h-11 rounded-full bg-[rgba(183,238,122,0.15)] flex items-center justify-center text-xl flex-shrink-0">
                ✓
              </div>
              <div>
                <h2 className="text-[#B7EE7A] text-base font-bold leading-tight">Statement verified</h2>
                <p className="text-[#6a8f52] text-sm mt-1 leading-snug">
                  This document was issued by AZA Financial Technology Ltd and has not been altered.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 px-7 py-6 bg-[#1f0d0d] border-b border-[#3d1e1e]">
              <div className="w-11 h-11 rounded-full bg-[rgba(239,68,68,0.15)] flex items-center justify-center text-xl flex-shrink-0">
                ✗
              </div>
              <div>
                <h2 className="text-[#f87171] text-base font-bold leading-tight">Verification failed</h2>
                <p className="text-[#a05050] text-sm mt-1 leading-snug">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Details */}
          {data.verified && (
            <div className="px-7 py-6 space-y-5">
              {/* Account info */}
              <p className="text-[10px] font-bold tracking-widest text-[#5a5f52] uppercase">Account Information</p>
              <div className="space-y-0 divide-y divide-[#1e211a]">
                <Row label="Account Holder" value={data.accountHolderName} />
                <Row label="Account Number" value={data.accountNumber} />
                <Row label="Statement Period" value={`${data.periodStart} – ${data.periodEnd}`} />
                <Row label="Transactions" value={String(data.transactionCount ?? "—")} />
              </div>

              <div className="h-px bg-[#1e211a]" />

              {/* Balances */}
              <p className="text-[10px] font-bold tracking-widest text-[#5a5f52] uppercase">
                Balance Summary ({data.currency ?? "GHS"})
              </p>
              <div className="space-y-0 divide-y divide-[#1e211a]">
                <Row label="Opening Balance" value={fmt(data.openingBalance)} />
                <Row label="Total Credits" value={`+ ${fmt(data.totalCredits)}`} valueClass="text-[#4ade80]" />
                <Row label="Total Debits" value={`− ${fmt(data.totalDebits)}`} valueClass="text-[#f87171]" />
                <Row label="Closing Balance" value={fmt(data.closingBalance)} valueClass="text-[#B7EE7A] text-base" />
              </div>

              <div className="h-px bg-[#1e211a]" />

              {/* Document details */}
              <p className="text-[10px] font-bold tracking-widest text-[#5a5f52] uppercase">Document Details</p>
              <div className="space-y-0 divide-y divide-[#1e211a]">
                <Row label="Generated On" value={data.generatedAt} />
                <Row label="Issued By" value={data.issuedBy ?? "AZA Financial Technology Ltd"} />
              </div>

              {/* Code block */}
              {code && (
                <div className="bg-[#0E0F0C] border border-[#2a2d25] rounded-xl px-5 py-4 flex items-center justify-between gap-3 mt-2">
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-[#5a5f52] uppercase mb-1">
                      Verification Code
                    </div>
                    <div className="font-mono text-[15px] font-bold text-[#B7EE7A] tracking-widest">
                      {formatCode(code)}
                    </div>
                  </div>
                  <span className="text-xl flex-shrink-0">✓</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center px-4 pb-10 text-xs text-[#3a3d35] leading-7">
        AZA Financial Technology Ltd &nbsp;·&nbsp; Licensed under the Payment Systems and Services Act, 2019 (Act 987)
        <br />
        <a href="https://aza.systems" className="hover:text-[#B7EE7A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A] focus-visible:ring-offset-1 rounded-sm">
          aza.systems
        </a>
        &nbsp;·&nbsp;
        <a href="mailto:support@aza.systems" className="hover:text-[#B7EE7A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A] focus-visible:ring-offset-1 rounded-sm">
          support@aza.systems
        </a>
      </footer>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between items-baseline py-2.5">
      <span className="text-sm text-[#7a7d72]">{label}</span>
      <span className={`text-sm font-semibold text-[#E8EAE4] text-right ${valueClass ?? ""}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}
