import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "http://localhost:8080"
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === "production"
    ? "https://api.aza.systems"
    : "http://localhost:8080";

interface MerchantPublic {
  id: string;
  businessName: string;
  businessHandle: string;
  businessDescription?: string;
  logoUrl?: string;
  category?: string;
  currency: string;
  brandColor?: string;
  checkoutTagline?: string;
  supportEmail?: string;
  status?: string;
}

type FetchResult =
  | { ok: true; merchant: MerchantPublic }
  | { ok: false; status: number };

async function fetchMerchant(handle: string): Promise<FetchResult> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/merchant/public/${handle}`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const json = await res.json();
      const merchant = json.data ?? null;
      if (merchant) return { ok: true, merchant };
      return { ok: false, status: 404 };
    }
    return { ok: false, status: res.status };
  } catch {
    return { ok: false, status: 503 };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const result = await fetchMerchant(handle);
  if (!result.ok) return { title: "Merchant not found | Aza" };
  const { merchant } = result;
  return {
    title: `Pay ${merchant.businessName} | Aza`,
    description:
      merchant.businessDescription ??
      `Send a payment to ${merchant.businessName} via Aza.`,
    openGraph: {
      title: `Pay ${merchant.businessName}`,
      description:
        merchant.businessDescription ??
        `Send a payment to ${merchant.businessName} via Aza.`,
      ...(merchant.logoUrl ? { images: [merchant.logoUrl] } : {}),
    },
  };
}

function QrCode({ url }: { url: string }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=2`;
  return (
    <img
      src={qrSrc}
      alt="QR code"
      width={220}
      height={220}
      className="rounded-2xl border border-black/8"
    />
  );
}

function MerchantLogo({ merchant }: { merchant: MerchantPublic }) {
  const accent = merchant.brandColor ?? "#10b981";
  if (merchant.logoUrl) {
    return (
      <img
        src={merchant.logoUrl}
        alt={merchant.businessName}
        width={72}
        height={72}
        className="rounded-2xl object-cover border border-black/6"
        style={{ width: 72, height: 72 }}
      />
    );
  }
  const initials = merchant.businessName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className="rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
      style={{ backgroundColor: accent, width: 72, height: 72 }}
    >
      {initials}
    </div>
  );
}

function NotAcceptingPage({ handle }: { handle: string }) {
  return (
    <div className="min-h-screen bg-[#f5f7f5] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="bg-white rounded-3xl shadow-xl shadow-black/6 overflow-hidden">
          <div className="h-2 w-full bg-amber-400" />
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
              <span className="text-3xl">🏗️</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Not yet live</h1>
              <p className="text-sm text-gray-500 mt-1">@{handle}</p>
              <p className="text-sm text-gray-600 mt-3 leading-snug">
                This merchant is not yet accepting payments. Check back soon.
              </p>
            </div>
            <a
              href="https://aza.systems"
              className="text-sm font-medium text-[#10b981] hover:underline"
            >
              Learn about Aza →
            </a>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400">
          Payments powered by{" "}
          <a href="https://aza.systems" className="font-medium text-gray-500 hover:underline">
            Aza
          </a>
        </p>
      </div>
    </div>
  );
}

export default async function PayPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const result = await fetchMerchant(handle);

  if (!result.ok) {
    // 403 = merchant exists but not yet active (pending KYB etc.)
    if (result.status === 403) return <NotAcceptingPage handle={handle} />;
    // 404 = truly doesn't exist
    notFound();
  }

  const { merchant } = result;
  const accent = merchant.brandColor ?? "#10b981";
  const deepLink = `aza://pay/${merchant.businessHandle}`;
  const pageUrl = `https://aza.systems/pay/${merchant.businessHandle}`;

  return (
    <div className="min-h-screen bg-[#f5f7f5] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="bg-white rounded-3xl shadow-xl shadow-black/6 overflow-hidden">
          <div className="h-2 w-full" style={{ backgroundColor: accent }} />

          <div className="p-8 flex flex-col items-center gap-5">
            <MerchantLogo merchant={merchant} />

            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                {merchant.businessName}
              </h1>
              <p className="text-sm text-gray-500 mt-1">@{merchant.businessHandle}</p>
              {(merchant.checkoutTagline ?? merchant.businessDescription) && (
                <p className="text-sm text-gray-600 mt-2 leading-snug">
                  {merchant.checkoutTagline ?? merchant.businessDescription}
                </p>
              )}
            </div>

            <QrCode url={pageUrl} />

            <p className="text-xs text-gray-400 text-center -mt-1">
              Scan with the Aza app to pay
            </p>

            <a
              href={deepLink}
              style={{ backgroundColor: accent }}
              className="w-full py-3.5 rounded-2xl text-white text-sm font-semibold text-center block hover:opacity-90 transition-opacity"
            >
              Open in Aza App
            </a>

            <p className="text-xs text-gray-400 text-center">
              Don&apos;t have Aza?{" "}
              <a
                href="https://aza.systems"
                className="font-medium hover:underline"
                style={{ color: accent }}
              >
                Download the app
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          Payments powered by{" "}
          <a
            href="https://aza.systems"
            className="font-medium text-gray-500 hover:underline"
          >
            Aza
          </a>
        </p>
      </div>
    </div>
  );
}
