/**
 * Track definitions. Each track is a self-contained running order; the deck shows
 * one at a time and the gate slide is what chooses between them.
 *
 * These lists drive the rail, the counter and the keyboard jumps, and they match
 * the rendered slides *by position*, so a track's array here and its JSX in
 * `page.tsx` must be edited together.
 */
export type SlideMeta = {
  /** Also the DOM id, so every slide is deep-linkable as `#unit-economics`. */
  id: string;
  /** Rail tooltip. Kept short — the rail is ~200px at its widest. */
  label: string;
  /** Source reference, shown in the chrome. Chapter for academic, section for the rest. */
  ref?: string;
};

export type TrackId = "investor" | "academic" | "partner";

export type Track = {
  id: TrackId;
  /** Shown on the gate card and in the chrome once chosen. */
  name: string;
  /** The one-line promise on the gate card. */
  promise: string;
  /** Two or three lines of what this track actually argues. */
  blurb: string;
  /** Runtime of the talk, so the presenter can pick by time as well as audience. */
  duration: string;
  slides: SlideMeta[];
};

const INVESTOR: SlideMeta[] = [
  { id: "cover", label: "Cover" },
  { id: "problem", label: "The problem" },
  { id: "product", label: "The product" },
  { id: "built", label: "Already built" },
  { id: "cash-network", label: "Cash network" },
  { id: "safeguarding", label: "Where money enters" },
  { id: "flywheel", label: "The flywheel" },
  { id: "unit-economics", label: "Unit economics" },
  { id: "fees-consumer", label: "Consumer fees" },
  { id: "fees-merchant", label: "Merchant engine" },
  { id: "fees-treasury", label: "Partner & treasury" },
  { id: "agent-economics", label: "Agent economics" },
  { id: "brand", label: "Keeping “free”" },
  { id: "roadmap", label: "Sequencing" },
  { id: "close", label: "Open items" },
];

const ACADEMIC: SlideMeta[] = [
  { id: "cover", label: "Cover" },
  { id: "problem", label: "The problem", ref: "§1.1" },
  { id: "gap", label: "The gap", ref: "§1.2" },
  { id: "objectives", label: "Aim & objectives", ref: "§1.3–1.4" },
  { id: "scope", label: "Scope", ref: "§1.5" },
  { id: "artefact", label: "The artefact", ref: "§1.7" },
  { id: "architecture", label: "Architecture", ref: "§4.2" },
  { id: "money-engine", label: "Money engine", ref: "§5.3" },
  { id: "invariants", label: "Nine invariants", ref: "§5.4" },
  { id: "invariant-four", label: "Invariant 4", ref: "§5.4a" },
  { id: "e2ee", label: "Withdrawn property", ref: "§12.4a" },
  { id: "testing", label: "Testing", ref: "§11" },
  { id: "concurrency", label: "Concurrency", ref: "§12.5" },
  { id: "delivery", label: "Delivery", ref: "§10" },
  { id: "results", label: "Results", ref: "§12.3" },
  { id: "contributions", label: "Contributions", ref: "§1.6" },
  { id: "limitations", label: "Limitations", ref: "§13" },
  { id: "close", label: "Close" },
];

const PARTNER: SlideMeta[] = [
  { id: "cover", label: "Cover" },
  { id: "position", label: "Our position" },
  { id: "closed-loop", label: "Closed loop" },
  { id: "safeguarding", label: "Safeguarding" },
  { id: "controls", label: "Money controls" },
  { id: "agent-controls", label: "Agent controls" },
  { id: "kyc-risk", label: "KYC & risk" },
  { id: "maker-checker", label: "Maker–checker" },
  { id: "audit", label: "Audit & recon" },
  { id: "security", label: "Security posture" },
  { id: "close", label: "Open items" },
];

export const TRACKS: Record<TrackId, Track> = {
  investor: {
    id: "investor",
    name: "Investor",
    promise: "The business",
    blurb:
      "How AZA moves cash without a payment processor, what it charges, and where the margin actually is. Leads with the agent network, the flywheel and the unit economics.",
    duration: "≈15 min · 15 slides",
    slides: INVESTOR,
  },
  partner: {
    id: "partner",
    name: "Partner & regulator",
    promise: "The controls",
    blurb:
      "The closed-loop ledger, the safeguarding invariant, agent due diligence, maker–checker and the audit trail — plus an honest statement of the licensing position.",
    duration: "≈12 min · 11 slides",
    slides: PARTNER,
  },
  academic: {
    id: "academic",
    name: "Academic",
    promise: "The argument",
    blurb:
      "The thesis defence: objectives, architecture, the nine money invariants, the concurrency measurements, and the security property that was built and then deliberately withdrawn.",
    duration: "≈20 min · 18 slides",
    slides: ACADEMIC,
  },
};

export const TRACK_ORDER: TrackId[] = ["investor", "partner", "academic"];

export function isTrackId(value: string | null | undefined): value is TrackId {
  return value === "investor" || value === "academic" || value === "partner";
}

export const AUTHORS = "Dussey Caleb Semekor · Andam-Cobbold Paapa Kobbina";
