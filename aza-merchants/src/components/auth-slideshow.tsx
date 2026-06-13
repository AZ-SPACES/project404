"use client";

import { useEffect, useRef, useState } from "react";

const PHOTOS = [
  "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1563986768609-6778c80a08e8?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1612178537253-bccd437b730e?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1400&q=80",
];

const KB_ANIMATIONS = ["kenBurnsA", "kenBurnsB", "kenBurnsC"] as const;
const SLIDE_DURATION = 6000; // ms between slides
const FADE_DURATION  = 1400; // ms crossfade

function getKb(index: number) {
  return KB_ANIMATIONS[index % KB_ANIMATIONS.length];
}

export function AuthSlideshow() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev]       = useState<number | null>(null);
  const [fading, setFading]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(function advance() {
      setFading(true);
      setPrev(current);
      const next = (current + 1) % PHOTOS.length;
      setCurrent(next);
      setTimeout(() => { setFading(false); setPrev(null); }, FADE_DURATION);
      timerRef.current = setTimeout(advance, SLIDE_DURATION);
    }, SLIDE_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Outgoing slide */}
      {prev !== null && (
        <img
          key={`prev-${prev}`}
          src={PHOTOS[prev]}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            animation: `${getKb(prev)} 8s ease-out forwards, slideFadeOut ${FADE_DURATION}ms ease-in-out forwards`,
          }}
        />
      )}

      {/* Incoming slide */}
      <img
        key={`curr-${current}`}
        src={PHOTOS[current]}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          animation: `${getKb(current)} 8s ease-out forwards${fading ? `, slideFadeIn ${FADE_DURATION}ms ease-in-out forwards` : ""}`,
        }}
      />
    </div>
  );
}
