const regions = [
  {
    name: "Ghana",
    status: "launching",
    countries: [
      { flag: "🇬🇭", name: "Accra",       note: "Live" },
      { flag: "🇬🇭", name: "Kumasi",      note: "Live" },
      { flag: "🇬🇭", name: "Tamale",      note: "Live" },
      { flag: "🇬🇭", name: "Nationwide",  note: "All regions" },
    ],
  },
  {
    name: "West Africa",
    status: "planned",
    countries: [
      { flag: "🇳🇬", name: "Nigeria",       note: "Next" },
      { flag: "🇸🇳", name: "Senegal",       note: "Planned" },
      { flag: "🇨🇮", name: "Côte d'Ivoire", note: "Planned" },
      { flag: "🇬🇳", name: "Guinea",        note: "Planned" },
    ],
  },
  {
    name: "East Africa",
    status: "planned",
    countries: [
      { flag: "🇰🇪", name: "Kenya",    note: "Planned" },
      { flag: "🇹🇿", name: "Tanzania", note: "Planned" },
      { flag: "🇺🇬", name: "Uganda",   note: "Planned" },
      { flag: "🇷🇼", name: "Rwanda",   note: "Planned" },
    ],
  },
];

export function AvailabilitySection() {
  return (
    <section id="availability" className="apple-white section-py">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">

        <div className="text-center mb-12 reveal">
          <h2 className="apple-headline mb-4" style={{ color: "#1d1d1f" }}>
            Built for Africa.<br />
            <span style={{ color: "#174717" }}>Expanding fast.</span>
          </h2>
          <p className="apple-body max-w-[420px] mx-auto" style={{ color: "#6e6e73" }}>
            Starting in Ghana. Expanding across Africa. One market at a time.
          </p>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {regions.map((region, ri) => (
            <div
              key={region.name}
              className="reveal rounded-2xl p-5"
              data-delay={String(ri * 80)}
              style={{
                background: "#f5f5f7",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[0.95rem]" style={{ color: "#1d1d1f", letterSpacing: "-0.02em" }}>
                  {region.name}
                </h3>
                <span
                  className="px-2.5 py-1 rounded-lg text-[0.7rem] font-semibold"
                  style={
                    region.status === "launching"
                      ? { background: "rgba(23,71,23,0.1)", color: "#174717" }
                      : { background: "rgba(0,0,0,0.05)", color: "#6e6e73" }
                  }
                >
                  {region.status === "launching" ? "Live" : "Planned"}
                </span>
              </div>
              <ul className="space-y-2.5">
                {region.countries.map((c) => (
                  <li key={c.name} className="flex items-center gap-3">
                    <span className="text-xl leading-none" role="img" aria-label={c.name}>{c.flag}</span>
                    <span className="flex-1 text-[0.875rem] font-medium" style={{ color: "#1d1d1f" }}>{c.name}</span>
                    <span className="text-[0.75rem]" style={{ color: "#6e6e73" }}>{c.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
