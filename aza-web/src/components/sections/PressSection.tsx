const outlets = [
  "MyJoyOnline", "GhanaWeb", "B&FT Online", "Graphic Business",
  "Citi Business News", "TechNigeria", "Disrupt Africa", "Tech Cabal",
  "The Pulse Ghana", "Modern Ghana",
];

export function PressSection() {
  const doubled = [...outlets, ...outlets];

  return (
    <section
      className="relative py-5 overflow-hidden apple-white"
      aria-label="As covered by"
      style={{ borderTop: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}
    >
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{ background: "linear-gradient(to right, #fff, transparent)" }} aria-hidden="true" />
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none" style={{ background: "linear-gradient(to left, #fff, transparent)" }} aria-hidden="true" />

      <p className="text-center text-[0.68rem] font-semibold tracking-widest uppercase mb-3" style={{ color: "#c7c7cc" }}>
        Covered by journalists at
      </p>

      <div className="press-marquee-track flex" style={{ animation: "pressMarquee 32s linear infinite" }}>
        {doubled.map((name, i) => (
          <span
            key={i}
            className="shrink-0 px-8 text-[0.9rem] font-semibold select-none"
            style={{ color: "#c7c7cc", letterSpacing: "-0.01em" }}
          >
            {name}
          </span>
        ))}
      </div>

      <style>{`
        @keyframes pressMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { @keyframes pressMarquee { from, to { transform: none; } } }
        .press-marquee-track:hover { animation-play-state: paused; }
      `}</style>
    </section>
  );
}
