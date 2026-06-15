export function PartnerBarSection() {
  const partners = [
    { name: "Bank of Ghana", abbr: "BoG", sub: "Licensed & Regulated" },
    { name: "National ID Authority", abbr: "NIA", sub: "Identity Verified" },
    { name: "GhIPSS", abbr: "GhIPSS", sub: "Interoperable Payments" },
    { name: "MTN Ghana", abbr: "MTN", sub: "Network Partner" },
    { name: "Vodafone Cash", abbr: "Vodafone", sub: "Network Partner" },
    { name: "AirtelTigo Money", abbr: "AirtelTigo", sub: "Network Partner" },
  ];

  return (
    <section aria-label="Partners and regulators" style={{ background: "#ffffff", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-14">
        <p
          className="text-center text-[0.72rem] font-semibold tracking-[0.15em] uppercase mb-10"
          style={{ color: "#6e6e73" }}
        >
          Licensed, regulated, and trusted
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-8">
          {partners.map((p, i) => (
            <div key={p.abbr} className="flex items-center gap-6">
              <div className="text-center min-w-[80px]">
                <div
                  className="text-[0.95rem] font-black tracking-tight mb-0.5"
                  style={{ color: "#1d1d1f" }}
                >
                  {p.abbr}
                </div>
                <div className="text-[0.65rem] font-medium" style={{ color: "#6e6e73" }}>
                  {p.sub}
                </div>
              </div>
              {i < partners.length - 1 && (
                <div
                  className="hidden sm:block h-8 w-px"
                  style={{ background: "rgba(0,0,0,0.1)" }}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
