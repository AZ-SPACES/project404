const partners = [
  {
    name: "Bank of Ghana",
    abbr: "BoG",
    sub: "Licensed & Regulated",
    color: "#00416A",
  },
  {
    name: "National ID Authority",
    abbr: "NIA",
    sub: "Identity Verified",
    color: "#1A4731",
  },
  {
    name: "GhIPSS",
    abbr: "GhIPSS",
    sub: "Interoperable Payments",
    color: "#2B5EA7",
  },
  {
    name: "MTN Ghana",
    abbr: "MTN",
    sub: "Network Partner",
    color: "#FFCC00",
    dark: true,
  },
  {
    name: "Vodafone Cash",
    abbr: "VDF",
    sub: "Network Partner",
    color: "#E60000",
  },
  {
    name: "AirtelTigo Money",
    abbr: "AT",
    sub: "Network Partner",
    color: "#C8102E",
  },
];

export function PartnerBarSection() {
  return (
    <section aria-label="Partners and regulators" style={{ background: "#ffffff", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-14">
        <p
          className="text-center text-[0.72rem] font-semibold tracking-[0.15em] uppercase mb-10"
          style={{ color: "#6e6e73" }}
        >
          Licensed, regulated, and trusted
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-6">
          {partners.map((p) => (
            <div key={p.abbr} className="partner-card flex flex-col items-center gap-2 group">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[0.8rem] tracking-tight shadow-sm transition-transform duration-200 group-hover:scale-105"
                style={{
                  background: p.color,
                  color: p.dark ? "#1d1d1f" : "#ffffff",
                  letterSpacing: "-0.02em",
                }}
                aria-hidden="true"
              >
                {p.abbr}
              </div>
              <div className="text-center">
                <div className="text-[0.72rem] font-semibold leading-snug" style={{ color: "#1d1d1f" }}>
                  {p.name}
                </div>
                <div className="text-[0.62rem]" style={{ color: "#6e6e73" }}>
                  {p.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 480px) {
          .partner-card { min-width: 80px; }
        }
      `}</style>
    </section>
  );
}
