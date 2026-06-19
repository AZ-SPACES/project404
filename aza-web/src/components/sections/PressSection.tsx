const API_URL =
  process.env.NEXT_PUBLIC_API_URL &&
  process.env.NEXT_PUBLIC_API_URL !== "http://localhost:8080"
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === "production"
    ? "https://api.aza.systems"
    : "http://localhost:8080";

interface PublicMerchant {
  businessName: string;
  businessHandle: string;
  logoUrl?: string;
  category?: string;
  brandColor?: string;
}

async function fetchMerchants(): Promise<PublicMerchant[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/merchant/public/directory?limit=30`, {
      // Marketing content — cache for a few minutes rather than hitting the API on every render.
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const list = json?.data;
    return Array.isArray(list) ? list.filter((m: PublicMerchant) => m?.businessName) : [];
  } catch {
    return [];
  }
}

export async function PressSection() {
  const merchants = await fetchMerchants();
  if (merchants.length === 0) {
    return null;
  }

  // Repeat until the track is wide enough for a seamless loop, then double it.
  const base = [...merchants];
  while (base.length < 10) base.push(...merchants);
  const doubled = [...base, ...base];

  return (
    <section
      className="relative py-5 overflow-hidden apple-white"
      aria-label="Merchants on AZA"
      style={{ borderTop: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}
    >
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, #fff, transparent)" }} aria-hidden="true" />
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, #fff, transparent)" }} aria-hidden="true" />

      <p className="text-center text-[0.68rem] font-semibold tracking-widest uppercase mb-3" style={{ color: "#c7c7cc" }}>
        Merchants building on AZA
      </p>

      <div className="press-marquee-track flex items-center" style={{ animation: "pressMarquee 32s linear infinite" }}>
        {doubled.map((m, i) =>
          m.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={m.logoUrl}
              alt={m.businessName}
              title={m.businessName}
              loading="lazy"
              className="shrink-0 mx-8 h-7 w-auto max-w-[120px] object-contain rounded-md select-none"
            />
          ) : (
            <span
              key={i}
              className="shrink-0 px-8 text-[0.9rem] font-semibold select-none"
              style={{ color: "#c7c7cc", letterSpacing: "-0.01em" }}
            >
              {m.businessName}
            </span>
          )
        )}
      </div>

      <style>{`
        @keyframes pressMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { @keyframes pressMarquee { from, to { transform: none; } } }
        .press-marquee-track:hover { animation-play-state: paused; }
      `}</style>
    </section>
  );
}
