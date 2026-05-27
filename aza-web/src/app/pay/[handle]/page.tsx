import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

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
}

async function getMerchant(handle: string): Promise<MerchantPublic | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/merchant/public/${handle}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const merchant = await getMerchant(handle);
  if (!merchant) {
    return { title: "Merchant not found | Aza" };
  }
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

export default async function PayPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const merchant = await getMerchant(handle);

  if (!merchant) notFound();

  const deepLink = `aza://pay/${merchant.businessHandle}`;
  const pageUrl = `https://aza.systems/pay/${merchant.businessHandle}`;
  const accent = merchant.brandColor ?? "#10b981";

  return (
    <div className="min-h-screen bg-[#f5f7f5] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-black/6 overflow-hidden">
          {/* Header band */}
          <div
            className="h-2 w-full"
            style={{ backgroundColor: accent }}
          />

          <div className="p-8 flex flex-col items-center gap-5">
            {/* Logo / initials */}
            {merchant.logoUrl ? (
              <img
                src={merchant.logoUrl}
                alt={merchant.businessName}
                width={72}
                height={72}
                className="rounded-2xl object-cover border border-black/6"
              />
            ) : (
              <div
                className="w-18 h-18 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
                style={{ backgroundColor: accent, width: 72, height: 72 }}
              >
                {merchant.businessName
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </div>
            )}

            {/* Name + tagline */}
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                {merchant.businessName}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                @{merchant.businessHandle}
              </p>
              {(merchant.checkoutTagline ?? merchant.businessDescription) && (
                <p className="text-sm text-gray-600 mt-2 leading-snug">
                  {merchant.checkoutTagline ?? merchant.businessDescription}
                </p>
              )}
            </div>

            {/* QR */}
            <QrCode url={pageUrl} />

            <p className="text-xs text-gray-400 text-center -mt-1">
              Scan with the Aza app to pay
            </p>

            {/* CTA */}
            <a
              href={deepLink}
              style={{ backgroundColor: accent }}
              className="w-full py-3.5 rounded-2xl text-white text-sm font-semibold text-center block hover:opacity-90 transition-opacity"
            >
              Open in Aza App
            </a>

            {/* Download nudge */}
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

        {/* Footer */}
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
