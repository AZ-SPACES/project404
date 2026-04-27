"use client";

import { useEffect, useRef, useState } from "react";
import { HomeScreen } from "./HomeScreen";
import { SendScreen } from "./SendScreen";
import { ChatScreen } from "./ChatScreen";

const SLIDES = ["home", "send", "chat"] as const;
const AUTOPLAY_INTERVAL = 3200;

export function PhoneMockup() {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setActive((a) => (a + 1) % SLIDES.length),
      AUTOPLAY_INTERVAL,
    );
  };

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (i: number) => {
    setActive(i);
    startTimer();
  };

  return (
    <div className="phone-mockup flex flex-col items-center gap-4 relative z-[1]">
      <div className="phone-mockup__frame">
        <div className="phone-screen">
          <div className={`phone-slide screen--home${active === 0 ? " active" : ""}`}>
            <HomeScreen />
          </div>
          <div className={`phone-slide screen--send${active === 1 ? " active" : ""}`}>
            <SendScreen />
          </div>
          <div className={`phone-slide screen--chat${active === 2 ? " active" : ""}`}>
            <ChatScreen />
          </div>
        </div>
      </div>

      {/* Slide dots */}
      <div className="flex gap-2 justify-center" role="tablist" aria-label="Phone screens">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={active === i}
            aria-label={`Screen ${i + 1}`}
            onClick={() => goTo(i)}
            className="h-2 rounded-full transition-all"
            style={{
              width: active === i ? 24 : 8,
              background: active === i ? "#174717" : "#DADCE0",
            }}
          />
        ))}
      </div>

      <div className="hero__glow" aria-hidden="true" />
    </div>
  );
}
