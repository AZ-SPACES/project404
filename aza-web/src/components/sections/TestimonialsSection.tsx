const scenarios = [
  {
    id: "t1",
    quote: "Sending money to a cousin in Kumasi usually means queuing at a mobile money kiosk. With Aza, it's two taps and it's done.",
    role: "University student, Accra",
    initials: "01",
    large: true,
  },
  {
    id: "t2",
    quote: "Request a payment right inside the chat with a friend, and it lands back in seconds — no switching apps, no awkward follow-up texts.",
    role: "Everyday transfers",
    initials: "02",
    large: false,
  },
  {
    id: "t3",
    quote: "A merchant API with real docs and a sandbox that actually works, so integrating payments takes an afternoon instead of a week.",
    role: "For developers & merchants",
    initials: "03",
    large: false,
  },
];

export function TestimonialsSection() {
  const [large, ...rest] = scenarios;

  return (
    <section id="testimonials" className="apple-light section-py">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">

        <div className="text-center mb-12 reveal">
          <h2 className="apple-headline mb-4" style={{ color: "#1d1d1f" }}>
            Built for how<br />Ghana moves money.
          </h2>
          <p className="apple-body max-w-[420px] mx-auto" style={{ color: "#6e6e73" }}>
            These are the everyday moments Aza is designed to fix.
          </p>
        </div>

        <div className="testimonials-asymm grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {/* Large card */}
          <div
            className="reveal testimonial-card rounded-3xl p-8 flex flex-col row-span-2"
            data-delay="0"
            style={{ background: "#ffffff", minHeight: "280px", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <blockquote className="flex-1 text-[1.1rem] font-medium leading-[1.6] mb-6" style={{ color: "#1d1d1f", letterSpacing: "-0.01em" }}>
              &ldquo;{large.quote}&rdquo;
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: "#174717", color: "#B7EE7A" }}>
                {large.initials}
              </div>
              <p className="font-semibold text-[0.875rem]" style={{ color: "#1d1d1f" }}>{large.role}</p>
            </div>
          </div>

          {/* Two smaller */}
          {rest.map((t, i) => (
            <div
              key={t.id}
              className="reveal testimonial-card rounded-3xl p-6 flex flex-col"
              data-delay={String((i + 1) * 80)}
              style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <blockquote className="flex-1 text-[0.9rem] font-medium leading-[1.6] mb-5" style={{ color: "#1d1d1f" }}>
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{ background: "#174717", color: "#B7EE7A" }}>
                  {t.initials}
                </div>
                <p className="font-semibold text-[0.8rem]" style={{ color: "#1d1d1f" }}>{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .testimonials-asymm { grid-template-columns: 1fr !important; }
          .testimonials-asymm .row-span-2 { grid-row: span 1 !important; }
        }
      `}</style>
    </section>
  );
}
