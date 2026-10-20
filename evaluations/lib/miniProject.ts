/**
 * Third-year mini project. There was no defense, so the supervisor's mark is the
 * whole grade — one figure out of MINI_MAX, to one decimal place.
 */
export const MINI_MAX = 100;

export type MiniStudent = {
  id: string; name: string; indexNo: string;
  mark: number | null; notes: string; updatedAt: string | null;
};

export type MiniSupervisorCard = {
  id: string; name: string; students: number; scored: number;
};
