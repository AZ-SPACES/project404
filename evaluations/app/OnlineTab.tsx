"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";

const PING_MS = 20_000;

/** One random id per browser, so several tabs open by one person count once. */
function browserId() {
  try {
    let id = localStorage.getItem("presence-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("presence-id", id);
    }
    return id;
  } catch {
    // Storage blocked (private window): this tab still counts, just on its own.
    return crypto.randomUUID();
  }
}

/**
 * The "none" tab in the header. Every page carries it, so it is also what keeps
 * this browser on the count: it pings while the page is visible and stops when
 * it is hidden, so a forgotten background tab drops off after the window.
 */
export default function OnlineTab() {
  const [online, setOnline] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = browserId();
    let timer: ReturnType<typeof setInterval> | undefined;

    const ping = async () => {
      try {
        const res = await fetch(apiUrl("/api/presence"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (res.ok) setOnline(((await res.json()) as { online: number }).online);
      } catch {
        // Offline for a moment; the next ping will catch up.
      }
    };
    const start = () => { ping(); timer ??= setInterval(ping, PING_MS); };
    const stop = () => { clearInterval(timer); timer = undefined; };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              // Meant to go unnoticed: plain yellow text on white, no button chrome.
              className="px-1 text-[11px] text-gold-bright hover:text-gold">
        none
      </button>
      {open && (
        <div role="dialog" aria-label="People on the site"
             className="card absolute right-0 top-full z-30 mt-2 w-[220px] p-4 shadow-lg">
          <p className="eyebrow">On the site now</p>
          <p className="num mt-1 font-display text-[34px] font-bold leading-none">
            {online ?? "…"}
          </p>
          <p className="mt-2 text-[12px] text-ink-3">
            {online === 1 ? "person" : "people"} with a page open in the last minute,
            you included. Updates every {PING_MS / 1000} seconds.
          </p>
        </div>
      )}
    </div>
  );
}
