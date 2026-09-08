"use client";

import { AUTHORS, TRACKS, TRACK_ORDER, type TrackId } from "@/lib/deck";
import { ThemeToggle } from "@/components/deck/ThemeToggle";
import { stagger } from "@/lib/utils";

/**
 * The chooser. Deliberately not a slide inside the deck: the track determines
 * which deck exists, so it has to be answered before there is a running order
 * to navigate.
 */
export function Gate({ onChoose }: { onChoose: (track: TrackId) => void }) {
  return (
    <main className="gate is-live">
      <div className="w-full max-w-[1180px] mx-auto">
        <div className="flex items-start justify-between gap-6">
          <p className="eyebrow anim anim-fade" style={stagger(0)}>
            AZA · {AUTHORS}
          </p>
          <div className="anim anim-fade" style={stagger(0)}>
            <ThemeToggle />
          </div>
        </div>

        <h1 className="display mt-7 anim" style={stagger(1)}>
          Same system. Three <span className="accent">different arguments</span>.
        </h1>

        <p className="lede mt-5 anim" style={stagger(2)}>
          AZA is a mobile-first payments platform for Ghana — one ledger carrying a wallet, a
          chat, a merchant rail, an agent cash network and a developer platform. Pick who is in
          the room.
        </p>

        <ul className="gate-grid mt-12">
          {TRACK_ORDER.map((id, i) => {
            const track = TRACKS[id];
            return (
              <li key={id} className="anim" style={stagger(3 + i)}>
                <button type="button" className="gate-card" onClick={() => onChoose(id)}>
                  <span className="eyebrow">{track.promise}</span>
                  <span className="gate-card-name">{track.name}</span>
                  <span className="body-sm gate-card-blurb">{track.blurb}</span>
                  <span className="gate-card-foot">
                    <span className="mono text-[0.72rem] text-[var(--text-tertiary)]">
                      {track.duration}
                    </span>
                    <span className="gate-card-arrow" aria-hidden="true">
                      &rarr;
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="body-sm mt-10 anim" style={stagger(6)}>
          Every figure in all three decks is drawn from the repository and the internal strategy
          documents, and each is dated. Nothing here is a projection presented as a measurement.
        </p>
      </div>
    </main>
  );
}
