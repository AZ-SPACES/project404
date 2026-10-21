import { serverApiUrl } from "./api";

/** A supervisor's progress in both cohorts, from /api/supervisors?cohorts=all. */
export type SupervisorOverview = {
  id: string; name: string;
  students: number; scored: number; defended: number;
  miniStudents: number; miniScored: number;
};

export async function loadOverview(): Promise<SupervisorOverview[]> {
  const res = await fetch(serverApiUrl("/api/supervisors?cohorts=all"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load supervisors (${res.status})`);
  const { supervisors } = (await res.json()) as { supervisors: SupervisorOverview[] };
  return supervisors;
}
