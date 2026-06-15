import Link from "next/link";
import { StoreButton } from "@/components/ui/StoreButton";
import QRCode from "qrcode";

const appleIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const googleIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.487 1.487 0 0 0-.227.82v21.89c0 .28.077.54.211.76l11.498-11.54L1.337.924zm10.992 10.927L1.297 22.872a1.498 1.498 0 0 0 1.58-.315l13.06-7.398-4.608-3.308zm.214-.215l4.655 3.339 3.028-1.715L2.946.6a1.5 1.5 0 0 0-.803-.303l10.4 11.339z" />
  </svg>
);

async function generateQR(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: 160,
      margin: 1,
      color: { dark: "#ffffff", light: "#174717" },
      errorCorrectionLevel: "M",
    });
  } catch {
    return "";
  }
}

export async function DownloadSection() {
  const qrDataUrl = await generateQR("https://aza.systems");

  return (
    <section id="download" className="section-py" style={{ background: "#174717" }}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">

        {/* Centered heading */}
        <div className="text-center mb-14 reveal">
          <h2 className="apple-headline mb-4" style={{ color: "#ffffff" }}>
            Ready to experience Aza?
          </h2>
          <p className="apple-body max-w-[440px] mx-auto mb-8" style={{ color: "rgba(255,255,255,0.65)" }}>
            Be among the first to send money, chat with friends, and manage your finances — effortlessly.
          </p>

          {/* Primary CTA */}
          <div className="flex gap-3 justify-center flex-wrap mb-12">
            <Link
              href="/#waitlist"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-[0.95rem] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#B7EE7A", color: "#174717" }}
            >
              Join the waitlist
            </Link>
          </div>

          {/* Store buttons */}
          <div className="flex gap-4 justify-center flex-wrap download-btns mb-12">
            <StoreButton label="Download on the App Store">
              {appleIcon}
              <div>
                <span className="block text-[0.7rem] opacity-70">Download on the</span>
                <span className="block text-[0.95rem] font-bold">App Store</span>
              </div>
            </StoreButton>
            <StoreButton label="Get it on Google Play">
              {googleIcon}
              <div>
                <span className="block text-[0.7rem] opacity-70">Get it on</span>
                <span className="block text-[0.95rem] font-bold">Google Play</span>
              </div>
            </StoreButton>
          </div>
        </div>

        {/* QR + stats row */}
        <div className="flex items-center justify-center gap-16 flex-wrap reveal">
          {/* QR */}
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-2xl p-3 shadow-xl" style={{ background: "#174717", border: "1px solid rgba(255,255,255,0.15)" }}>
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Scan to visit aza.systems" width={120} height={120} />
              ) : (
                <div className="w-[120px] h-[120px] flex items-center justify-center text-[0.7rem]" style={{ color: "#B7EE7A" }}>aza.systems</div>
              )}
            </div>
            <p className="text-[0.75rem]" style={{ color: "rgba(255,255,255,0.45)" }}>Scan to open</p>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-20" style={{ background: "rgba(255,255,255,0.15)" }} aria-hidden="true" />

          {/* Stats */}
          <div className="flex gap-10">
            {[
              { value: "₵0",      label: "Hidden fees"  },
              { value: "<2s",     label: "Transfer time" },
              { value: "256-bit", label: "Encryption"   },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <span className="block text-[1.6rem] font-black tracking-[-0.04em]" style={{ color: "#B7EE7A" }}>{value}</span>
                <span className="block text-[0.75rem] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
