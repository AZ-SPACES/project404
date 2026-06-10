const rings = [
  { cls: "animate-spin-slow",         size: 2000, rotate: 279.05, src: "/waitlist-rings/ring-1.png", opacity: "opacity-50" },
  { cls: "animate-spin-slow-reverse", size: 1000, rotate: 304.42, src: "/waitlist-rings/ring-2.png", opacity: "opacity-60" },
  { cls: "animate-spin-slow",         size: 800,  rotate: 48.33,  src: "/waitlist-rings/ring-3.png", opacity: "opacity-80" },
] as const;

export function WaitlistBackground() {
  return (
    <div
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        perspective: "1200px",
        transform: "perspective(1200px) rotateX(15deg)",
        transformOrigin: "center bottom",
      }}
      aria-hidden="true"
    >
      {rings.map(({ cls, size, rotate, src, opacity }, i) => (
        <div key={i} className={`absolute inset-0 ${cls}`}>
          <div
            className="absolute top-1/2 left-1/2"
            style={{ width: size, height: size, transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}
          >
            {/* Decorative below-the-fold art: plain <img> + lazy is enough; no next/image pipeline needed */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" decoding="async" className={`w-full h-full object-cover ${opacity}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
