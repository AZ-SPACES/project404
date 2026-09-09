// The rubric exactly as printed in DEFENSE ALLOCATION FOR COMPUTER SCIENCE 2026.
// Weights are percentages of a 100-point total; each criterion is scored 0-10.
export type CriterionKey =
  | "appearance" | "usability" | "technical" | "innovation" | "presentation";

export type Criterion = {
  key: CriterionKey;
  label: string;
  /** Column header where the full label will not fit. */
  short: string;
  weight: number;
  blurb: string;
};

// Each criterion used to carry its own hue. The hues meant nothing, collided
// with the KNUST green the app uses for state, and two of them failed contrast
// behind white text. The weight percentage identifies a criterion instead.
export const CRITERIA: Criterion[] = [
  { key: "appearance",   label: "Appearance",          short: "Appear.", weight: 10,
    blurb: "Visual craft — type, colour, spacing, and how consistently it holds together." },
  { key: "usability",    label: "Design & Usability",  short: "Design",  weight: 20,
    blurb: "Can a first-time user finish the core task without being told how?" },
  { key: "technical",    label: "Technical Execution", short: "Tech.",   weight: 20,
    blurb: "Does it run? Depth of the build, edge cases, and what happens when it fails." },
  { key: "innovation",   label: "Innovation",          short: "Innov.",  weight: 30,
    blurb: "A new idea, or a genuinely new angle on an old one. Carries the most weight." },
  { key: "presentation", label: "Presentation",        short: "Present.", weight: 20,
    blurb: "The defence itself — story, pacing, and how questions get answered." },
];

export const TOTAL_WEIGHT = CRITERIA.reduce((n, c) => n + c.weight, 0); // 100

/** The criterion carrying the most weight; the only one the rubric bar accents. */
export const HEAVIEST = CRITERIA.reduce((a, b) => (b.weight > a.weight ? b : a));

export type Ballot = Partial<Record<CriterionKey, number | null>>;

/** Weighted points out of 100 for one ballot, plus how many criteria are filled in. */
export function ballotTotal(b: Ballot | undefined | null) {
  let points = 0, scored = 0;
  for (const c of CRITERIA) {
    const v = b?.[c.key];
    if (typeof v === "number") { points += (v / 10) * c.weight; scored++; }
  }
  return { points, scored, complete: scored === CRITERIA.length };
}

/** Mean per criterion across examiners, then weighted — so partial ballots still count. */
export function aggregate(ballots: Ballot[]) {
  const per = {} as Record<CriterionKey, { mean: number | null; spread: number; values: number[] }>;
  let total = 0, any = false;
  for (const c of CRITERIA) {
    const values = ballots
      .map((b) => b?.[c.key])
      .filter((v): v is number => typeof v === "number");
    if (values.length) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      per[c.key] = { mean, spread: Math.max(...values) - Math.min(...values), values };
      total += (mean / 10) * c.weight;
      any = true;
    } else {
      per[c.key] = { mean: null, spread: 0, values: [] };
    }
  }
  return { per, total: any ? total : null };
}
