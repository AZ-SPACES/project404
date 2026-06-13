"use client";

import { useEffect, useRef, useState } from "react";

// Pool of Accra / Ghana market & city photos from Unsplash.
// Add more IDs here — each session picks 5 at random in a random order.
const PHOTO_POOL = [
  "https://images.unsplash.com/photo-1594736797933-d0501ba4b65b?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1526304640581-d334cddf9380?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1601597111158-2fceff292cdc?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1583265982-d7f68f8da5ce?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1563986768609-6778c80a08e8?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1612178537253-bccd437b730e?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1400&q=80",
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
