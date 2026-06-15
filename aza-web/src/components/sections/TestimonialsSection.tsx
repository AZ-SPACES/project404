const testimonials = [
  {
    id: "t1",
    quote: "Sending money to my cousin in Kumasi used to mean queuing at a mobile money kiosk. Now I just open Aza, tap twice, and it's done.",
    name: "Kofi A.",
    role: "University student, Accra",
    initials: "KA",
    large: true,
  },
  {
    id: "t2",
    quote: "The chat + pay combo is genuinely genius. I just send a payment request in the chat and the money's back in seconds — no awkward follow-ups.",
    name: "Abena M.",
    role: "Software developer, Kumasi",
    initials: "AM",
    large: false,
  },
  {
    id: "t3",
    quote: "I integrated the merchant API in an afternoon. The docs are clear and the test environment actually works. Rare for African fintech.",
    name: "Yaw O.",
    role: "Founder, e-commerce startup",
    initials: "YO",
    large: false,
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5 mb-4" aria-label="5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#174717" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  const [large, ...rest] = testimonials;

  return (
    <section id="testimonials" className="apple-light section-py">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6">

        <div className="text-center mb-12 reveal">
          <h2 className="apple-headline mb-4" style={{ color: "#1d1d1f" }}>
            They&rsquo;re not<br />going back.
          </h2>
          <p className="apple-body max-w-[400px] mx-auto" style={{ color: "#6e6e73" }}>
            Real users. Real transfers. No scripts.
          </p>
        </div>

        <div className="testimonials-asymm grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {/* Large card */}
          <div
            className="reveal testimonial-card rounded-3xl p-8 flex flex-col row-span-2"
            data-delay="0"
            style={{ background: "#ffffff", minHeight: "280px", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <Stars />
            <blockquote className="flex-1 text-[1.1rem] font-medium leading-[1.6] mb-6" style={{ color: "#1d1d1f", letterSpacing: "-0.01em" }}>
              &ldquo;{large.quote}&rdquo;
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: "#174717", color: "#B7EE7A" }}>
                {large.initials}
              </div>
              <div>
                <p className="font-semibold text-[0.875rem]" style={{ color: "#1d1d1f" }}>{large.name}</p>
                <p className="text-[0.75rem]" style={{ color: "#6e6e73" }}>{large.role}</p>
              </div>
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
              <Stars />
              <blockquote className="flex-1 text-[0.9rem] font-medium leading-[1.6] mb-5" style={{ color: "#1d1d1f" }}>
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0" style={{ background: "#174717", color: "#B7EE7A" }}>
                  {t.initials}
                </div>
                <div>
                  <p className="font-semibold text-[0.8rem]" style={{ color: "#1d1d1f" }}>{t.name}</p>
                  <p className="text-[0.72rem]" style={{ color: "#6e6e73" }}>{t.role}</p>
                </div>
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
