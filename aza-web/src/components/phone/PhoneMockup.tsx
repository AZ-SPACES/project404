"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import photo1 from "@/app/assets/photo-1.png";
import photo2 from "@/app/assets/photo-2.png";
import photo3 from "@/app/assets/photo-3.png";
import photo4 from "@/app/assets/photo-4.png";

const IMAGES = [
  { src: photo1, alt: "Aza app screen 1" },
  { src: photo2, alt: "Aza app screen 2" },
  { src: photo3, alt: "Aza app screen 3" },
  { src: photo4, alt: "Aza app screen 4" },
];
const AUTOPLAY_INTERVAL = 3200;

export function PhoneMockup({ hideDots = false }: { hideDots?: boolean }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setActive((a) => (a + 1) % IMAGES.length),
      AUTOPLAY_INTERVAL,
    );
  };

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const goTo = (i: number) => {
    setActive(i);
    startTimer();
  };

  return (
    <div className="phone-mockup flex flex-col items-center gap-6 relative z-[1]">
      <div className="phone-device">
        {/* Left-side buttons */}
        <div className="phone-btn phone-btn--mute"   aria-hidden="true" />
        <div className="phone-btn phone-btn--vol-up" aria-hidden="true" />
        <div className="phone-btn phone-btn--vol-dn" aria-hidden="true" />
        {/* Right-side power button */}
        <div className="phone-btn phone-btn--power"  aria-hidden="true" />

        {/* Screen glass */}
        <div className="phone-screen">
        

          {/* Slide content */}
          {IMAGES.map((img, i) => (
            <div
              key={i}
              className={`phone-slide${active === i ? " active" : ""}`}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="268px"
                style={{ objectFit: "cover", objectPosition: "top" }}
                priority={i === 0}
              />
            </div>
          ))}

          {/* Home indicator */}
          <div className="phone-home-bar" aria-hidden="true" />
        </div>
      </div>

      {/* Slide dots */}
      {!hideDots && (
        <div className="flex gap-2 justify-center" role="tablist" aria-label="Phone screens">
          {IMAGES.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={active === i}
              aria-label={`Screen ${i + 1}`}
              onClick={() => goTo(i)}
              className="h-2 rounded-full transition-[width,background-color] duration-300 ease-out"
              style={{
                width: active === i ? 24 : 8,
                background: active === i ? "#174717" : "#DADCE0",
              }}
            />
          ))}
        </div>
      )}

      <div className="hero__glow" aria-hidden="true" />
    </div>
  );
}
