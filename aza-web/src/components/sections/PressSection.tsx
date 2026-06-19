const API_URL =
  process.env.NEXT_PUBLIC_API_URL &&
  process.env.NEXT_PUBLIC_API_URL !== "http://localhost:8080"
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === "production"
    ? "https://api.aza.systems"
    : "http://localhost:8080";

const BRAND_GREEN = "#174717";
const LIME = "#B7EE7A";

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
    return Array.isArray(list)
      ? list.filter((m: PublicMerchant) => m?.businessName && m?.businessHandle)
      : [];
  } catch {
    return [];
  }
}

/** Up to two initials for the monogram avatar used when a merchant has no logo. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]?.[0] ?? "";
  const second = words.length > 1 ? words[1]?.[0] ?? "" : "";
  return (first + second).toUpperCase() || "?";
}

/** Pick black-ish or white ink for legible text on an arbitrary brand colour. */
function readableInk(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length < 6) return BRAND_GREEN;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? BRAND_GREEN : "#ffffff";
}

export async function PressSection() {
  const merchants = await fetchMerchants();
  if (merchants.length === 0) {
    return null;
  }

  // Repeat until the track is wide enough for a seamless loop, then double it
  // so translateX(-50%) lands exactly on the copy.
  const base = [...merchants];
  while (base.length < 8) base.push(...merchants);
  const doubled = [...base, ...base];

  return (
    <section
      className="relative overflow-hidden"
      aria-label="Merchants you can pay on Aza"
      style={{ background: BRAND_GREEN }}
    >
      <div className="py-7 sm:py-9">
        <p
          className="text-center text-sm sm:text-[0.95rem] font-medium mb-5 px-6"
          style={{ color: "rgba(255,255,255,0.65)" }}
        >
          Pay any of these merchants in seconds.
        </p>

        {/* Fade edges (match the band colour). */}
        <div
          className="absolute left-0 bottom-0 w-20 z-10 pointer-events-none"
          style={{ top: "3.5rem", background: `linear-gradient(to right, ${BRAND_GREEN}, transparent)` }}
          aria-hidden="true"
        />
        <div
          className="absolute right-0 bottom-0 w-20 z-10 pointer-events-none"
          style={{ top: "3.5rem", background: `linear-gradient(to left, ${BRAND_GREEN}, transparent)` }}
          aria-hidden="true"
        />

        <div
          className="press-marquee-track flex items-center w-max"
          style={{ animation: "pressMarquee 40s linear infinite" }}
        >
          {doubled.map((m, i) => {
            const monoBg = m.brandColor || LIME;
            return (
              <a
                key={i}
                href={`/pay/${m.businessHandle}`}
                title={`Pay ${m.businessName}`}
                className="press-chip shrink-0 mx-2 flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4"
              >
                {m.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.logoUrl}
                    alt=""
                    loading="lazy"
                    className="h-9 w-9 rounded-full object-cover shrink-0"
                    style={{ background: "#fff" }}
                  />
                ) : (
                  <span
                    className="h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-[0.8rem] font-bold"
                    style={{ background: monoBg, color: readableInk(monoBg) }}
                    aria-hidden="true"
                  >
                    {initials(m.businessName)}
                  </span>
                )}
                <span className="press-chip-name whitespace-nowrap text-[0.92rem] font-semibold">
                  {m.businessName}
                </span>
              </a>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes pressMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .press-marquee-track:hover { animation-play-state: paused; }
        .press-chip {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          transition: transform .3s cubic-bezier(.22,1,.36,1), border-color .3s, background .3s;
        }
        .press-chip:hover { transform: translateY(-2px); border-color: ${LIME}; background: rgba(183,238,122,0.12); }
        .press-chip-name { color: rgba(255,255,255,0.9); transition: color .3s; }
        .press-chip:hover .press-chip-name { color: ${LIME}; }
        @media (prefers-reduced-motion: reduce) {
          .press-marquee-track { animation: none !important; }
          .press-chip:hover { transform: none; }
        }
      `}</style>
    </section>
  );
}
