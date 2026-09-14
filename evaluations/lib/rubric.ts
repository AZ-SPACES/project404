// The rubric exactly as printed in DEFENSE ALLOCATION FOR COMPUTER SCIENCE 2026.
//
// The weights below are percentages of the *panel* score, which is itself 40% of
// the final mark — the student's supervisor contributes the other 60% separately.
// They are deliberately left summing to 100 rather than rescaled to 40: this is
// the scale printed on the sheet the panels scored from, and every ballot already
// in the database is on it. The 40% conversion happens once, in `finalMark`.
export type CriterionKey =
  | "appearance" | "usability" | "technical" | "innovation" | "presentation";

export type Criterion = {
  key: CriterionKey;
  label: string;
  weight: number;
  color: string;
  onColor: string;
  blurb: string;
};

export const CRITERIA: Criterion[] = [
  { key: "appearance",   label: "Appearance",          weight: 10, color: "#05409E", onColor: "#FFFFFF",
    blurb: "Visual craft — type, colour, spacing, and how consistently it holds together." },
  { key: "usability",    label: "Design & Usability",  weight: 20, color: "#2E7D8C", onColor: "#FFFFFF",
    blurb: "Can a first-time user finish the core task without being told how?" },
  { key: "technical",    label: "Technical Execution", weight: 20, color: "#4A8C3F", onColor: "#FFFFFF",
    blurb: "Does it run? Depth of the build, edge cases, and what happens when it fails." },
  { key: "innovation",   label: "Innovation",          weight: 30, color: "#C9A227", onColor: "#231C03",
    blurb: "A new idea, or a genuinely new angle on an old one. Carries the most weight." },
  { key: "presentation", label: "Presentation",        weight: 20, color: "#3A3F44", onColor: "#FFFFFF",
    blurb: "The defence itself — story, pacing, and how questions get answered." },
];

export const TOTAL_WEIGHT = CRITERIA.reduce((n, c) => n + c.weight, 0); // 100

/** How the final mark is split between the defense panel and the supervisor. */
export const PANEL_SHARE = 40;
export const SUPERVISOR_SHARE = 60;

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

/**
 * The two halves of a student's mark, combined.
 *
 * `panelTotal` is the panel mean on the 0-100 rubric scale above; `supervisorMark`
 * is the supervisor's own figure, already out of 60. Either may be missing, and a
 * missing half is not a zero — `complete` says whether the mark can be published,
 * and `final` is only the sum of the halves that exist, so a part-marked student
 * reads as "28.4 so far" rather than as a failing 28.4.
 *
 * The two components are named `...Points` because this result gets spread onto a
 * student row that already carries `supervisor` — the person's name.
 */
export function finalMark(
  panelTotal: number | null | undefined,
  supervisorMark: number | null | undefined
) {
  const panel = typeof panelTotal === "number"
    ? (panelTotal / TOTAL_WEIGHT) * PANEL_SHARE
    : null;
  const supervisor = typeof supervisorMark === "number" ? supervisorMark : null;

  return {
    panelPoints: panel,                // out of PANEL_SHARE
    supervisorPoints: supervisor,      // out of SUPERVISOR_SHARE
    final: panel === null && supervisor === null ? null : (panel ?? 0) + (supervisor ?? 0),
    complete: panel !== null && supervisor !== null,
  };
}
