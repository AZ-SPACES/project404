"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Deck } from "@/components/deck/Deck";
import { Gate } from "@/components/deck/Gate";
import { TRACKS, isTrackId, type TrackId } from "@/lib/deck";

/** Back/forward are the only navigation this page does not perform itself. */
function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function readTrackFromUrl(): TrackId | null {
  const param = new URLSearchParams(window.location.search).get("track");
  return isTrackId(param) ? param : null;
}

/**
 * Holds the chosen track. All four tracks are in the RSC payload, but only the
 * chosen one is mounted — so the IntersectionObserver in `Deck` never sees slides
 * from a track that is not on screen.
 *
 * `?track=investor` skips the gate, which is what makes a single track sendable as
 * a link without giving each one its own route. That parameter is read through
 * `useSyncExternalStore` rather than an effect: it is browser-only state, the page
 * is statically prerendered, and the server snapshot is simply "no track chosen".
 */
export function DeckShell({
  defence,
  investor,
  partner,
  academic,
}: {
  defence: React.ReactNode;
  investor: React.ReactNode;
  partner: React.ReactNode;
  academic: React.ReactNode;
}) {
  const urlTrack = useSyncExternalStore(subscribe, readTrackFromUrl, () => null);
  const [chosen, setChosen] = useState<TrackId | null>(null);

  /* An explicit in-session choice wins; the URL is what a cold visit reads. Both
     writes below use replaceState, so the snapshot is re-read on the next render
     without a popstate ever firing. */
  const track = chosen ?? urlTrack;

  const choose = useCallback((next: TrackId) => {
    setChosen(next);
    const url = new URL(window.location.href);
    url.searchParams.set("track", next);
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
  }, []);

  const exit = useCallback(() => {
    setChosen(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("track");
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
  }, []);

  if (!track) return <Gate onChoose={choose} />;

  const children = { defence, investor, partner, academic }[track];

  return (
    <Deck key={track} slides={TRACKS[track].slides} trackName={TRACKS[track].name} onExit={exit}>
      {children}
    </Deck>
  );
}
