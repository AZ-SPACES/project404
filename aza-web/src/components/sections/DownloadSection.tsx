import { StoreButton } from "@/components/ui/StoreButton";

const appleIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.38.07 2.34.74 3.15.8 1.2-.24 2.35-.93 3.64-.84 1.54.12 2.71.72 3.46 1.83-3.18 1.91-2.5 6.05.82 7.27-.57 1.47-1.3 2.93-2.7 3.82zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

const googleIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3.18 23.76c.31.17.67.19 1.01.04l12.2-7.05-2.55-2.55-10.66 9.56zm16.84-10.09L17.44 12l2.58-1.67L6.8.28C6.47.1 6.11.09 5.79.26L16.42 10.9l3.6 2.77zm2.16-3.41c-.33-.23-.77-.24-1.11-.03l-2.13 1.38 2.3 2.3 1.94-1.26c.71-.46.71-1.62 0-2.39zm-18.8 1.37l-2.03-2.03c-.29.32-.35.79-.1 1.17l2.13 2.81v-1.95z" />
  </svg>
);

export function DownloadSection() {
  return (
    <section id="download" className="section-py" style={{ background: "var(--aza-bg)" }}>
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
        <div
          className="download-grid reveal rounded-xl p-8 md:p-12 lg:p-[80px_48px] grid gap-12 lg:gap-[80px] items-center relative overflow-hidden"
          style={{ background: "#174717", gridTemplateColumns: "1fr auto" }}
        >
          <div className="relative z-10">
            <h2
              className="text-[clamp(1.8rem,3.5vw,2.5rem)] font-bold tracking-[-0.02em] mb-4 text-white"
            >
              Ready to experience Aza?
            </h2>
            <p
              className="text-[1.05rem] leading-[1.7] mb-8 max-w-[480px]"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              Join millions of people who use Aza to send money, chat, and manage
              their finances — effortlessly.
            </p>
            <div className="flex gap-4 flex-wrap">
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

          {/* QR mockup */}
          <div className="relative z-10 text-center hidden md:block">
            <div className="w-[140px] h-[140px] bg-white rounded-xl p-3 mx-auto mb-2">
              <div className="qr-inner w-full h-full relative">
                <div className="absolute top-0 left-0 w-[22px] h-[22px]" style={{ border: "3px solid #174717", borderRight: "none", borderBottom: "none" }} />
                <div className="absolute top-0 right-0 w-[22px] h-[22px]" style={{ border: "3px solid #174717", borderLeft: "none", borderBottom: "none" }} />
                <div className="absolute bottom-0 left-0 w-[22px] h-[22px]" style={{ border: "3px solid #174717", borderRight: "none", borderTop: "none" }} />
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-[6px] flex items-center justify-center text-[0.9rem] font-black"
                  style={{ background: "#174717", color: "#B7EE7A" }}
                >
                  A
                </div>
              </div>
            </div>
            <p className="text-[0.8rem]" style={{ color: "rgba(255,255,255,0.7)" }}>Scan to download</p>
          </div>
        </div>
      </div>
    </section>
  );
}
