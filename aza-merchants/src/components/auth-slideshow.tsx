"use client";

import { useEffect, useRef, useState } from "react";

// Pool of Accra / Ghana market & city photos from Unsplash.
// Add more IDs here — each session picks 5 at random in a random order.
const PHOTO_POOL = [ 
  "https://images.unsplash.com/photo-1568232033336-8bbd9ff19a9a?q=80&w=927&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1697049643520-cfa552d99de7?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1697049643603-b35346a3cb5b?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1697049643231-5d6a35b8849c?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1692285071971-3f15ad9ac343?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1733141175064-f7d160a3f2ec?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1762945274836-4c2cbb75e20e?q=80&w=1287&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1665904285523-47c0a6fdfc0e?q=80&w=1365&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1727022967451-5aba342d36c8?q=80&w=2970&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1771938140863-e57f4d57db47?q=80&w=2148&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
  "https://images.unsplash.com/photo-1732208494630-0268c6549147?q=80&w=1335&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
];

const POOL_SIZE     = 5;
const SLIDE_MS      = 6000;
const FADE_MS       = 1400;
const KB_ANIMATIONS = ["kenBurnsA", "kenBurnsB", "kenBurnsC"] as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function AuthSlideshow() {
  // Randomised each mount — different subset, different order every session
  const [photos] = useState(() => shuffle(PHOTO_POOL).slice(0, POOL_SIZE));

  const [current, setCurrent] = useState(0);
  const [prev, setPrev]       = useState<number | null>(null);
  const [fading, setFading]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(function advance() {
      setFading(true);
      setPrev(current);
      const next = (current + 1) % photos.length;
      setCurrent(next);
      setTimeout(() => { setFading(false); setPrev(null); }, FADE_MS);
      timerRef.current = setTimeout(advance, SLIDE_MS);
    }, SLIDE_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, photos.length]);

  const kb = (i: number) => KB_ANIMATIONS[i % KB_ANIMATIONS.length];

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Outgoing slide */}
      {prev !== null && (
        <img
          key={`prev-${prev}`}
          src={photos[prev]}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{ animation: `${kb(prev)} 8s ease-out forwards, slideFadeOut ${FADE_MS}ms ease-in-out forwards` }}
        />
      )}

      {/* Incoming / current slide */}
      <img
        key={`curr-${current}`}
        src={photos[current]}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          animation: `${kb(current)} 8s ease-out forwards${fading ? `, slideFadeIn ${FADE_MS}ms ease-in-out forwards` : ""}`,
        }}
      />
    </div>
  );
}
