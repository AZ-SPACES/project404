import { StoreButton } from "@/components/ui/StoreButton";

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

export function DownloadSection() {
  return (
    <section id="download" className="section-py" style={{ background: "var(--aza-bg)" }}>
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
        <div
          className="download-grid reveal rounded-xl p-8 md:p-12 lg:p-[80px_48px] grid gap-12 lg:gap-[80px] items-center relative overflow-hidden"
          style={{ background: "#174717", gridTemplateColumns: "1fr auto" }}
        >
          <div className="relative z-10">
            <div
              className="inline-flex items-center gap-2 px-[14px] py-[6px] rounded-md text-[0.8rem] font-semibold mb-6"
              style={{
                background: "rgba(183,238,122,0.15)",
                border: "1px solid rgba(183,238,122,0.3)",
                color: "#B7EE7A",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  background: "#B7EE7A",
                  borderRadius: 999,
                  animation: "badgePulse 2s infinite",
                  flexShrink: 0,
                }}
              />
              Soon available worldwide
            </div>
            <h2
              className="text-[clamp(1.8rem,3.5vw,2.5rem)] font-bold tracking-[-0.02em] mb-4 text-white"
            >
              Ready to experience Aza?
            </h2>
            <p
              className="text-[1.05rem] leading-[1.7] mb-8 max-w-[480px]"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              Be among the first to send money, chat with friends, and manage
              your finances — effortlessly, all in one place.
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
