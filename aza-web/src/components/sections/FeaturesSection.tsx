import { SectionHeader } from "@/components/ui/SectionHeader";

const features = [
  {
    key: "send",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
    iconBg: "rgba(23,71,23,0.1)", iconColor: "#174717",
    title: "Send Money",
    desc: "Send money instantly to anyone on Aza. Just search a name, enter an amount, and confirm — done in seconds.",
    tag: "Instant transfer",
    large: true,
  },
  {
    key: "request",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    iconBg: "rgba(183,238,122,0.2)", iconColor: "#2E7D32",
    title: "Request Money",
    desc: "Split bills and request funds from friends. Add a note so they know what it's for — no awkward conversations needed.",
    tag: "Split bills",
    large: true,
  },
  {
    key: "chat",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    iconBg: "rgba(66,133,244,0.1)", iconColor: "#4285F4",
    title: "Chat",
    desc: "Message your contacts and send money right in the conversation.",
    large: false,
  },
  {
    key: "scan",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    iconBg: "rgba(255,109,0,0.1)", iconColor: "#FF6D00",
    title: "Scan & Pay",
    desc: "Scan QR codes to pay instantly. Share your own code to get paid.",
    large: false,
  },
  {
    key: "hub",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    iconBg: "rgba(142,36,170,0.1)", iconColor: "#8E24AA",
    title: "Mini-App Hub",
    desc: "Access finance, bills, and entertainment apps without leaving Aza.",
    large: false,
  },
  {
    key: "notify",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    iconBg: "rgba(234,67,53,0.1)", iconColor: "#EA4335",
    title: "Smart Notifications",
    desc: "Stay on top of every transaction, request, and message in real time.",
    large: false,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="section-py" style={{ background: "var(--aza-surface)" }}>
      <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
        <SectionHeader
          label="Everything you need"
          heading="One app, infinite possibilities"
          description="From sending money to chatting with friends — Aza has everything in one seamless experience."
        />

        <div
          className="features-grid grid gap-4"
          style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
        >
          {features.map((f, i) => (
            <div
              key={f.key}
              className="feature-card reveal rounded-xl p-6 md:p-8"
              style={{
                gridColumn: f.large ? "span 2" : "span 1",
                background: "var(--aza-card-bg)",
                border: "1px solid var(--aza-border)",
                boxShadow: "var(--aza-card-shadow)",
              }}
              data-delay={String(i * 60)}
            >
              <div
                className="w-[52px] h-[52px] rounded-xl flex items-center justify-center mb-6"
                style={{ background: f.iconBg, color: f.iconColor }}
              >
                {f.icon}
              </div>
              <h3 className="text-[1.2rem] font-semibold mb-2" style={{ color: "var(--aza-text)" }}>
                {f.title}
              </h3>
              <p className="text-[0.9rem] leading-[1.6] mb-4" style={{ color: "var(--aza-text-secondary)" }}>
                {f.desc}
              </p>
              {f.tag && (
                <span
                  className="inline-block px-3 py-1 rounded-md text-[0.75rem] font-semibold"
                  style={{ background: "rgba(183,238,122,0.2)", color: "#2E7D32" }}
                >
                  {f.tag}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
