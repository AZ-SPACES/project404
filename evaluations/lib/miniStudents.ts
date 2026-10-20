import { query } from "./db";
import type { MiniStudent, MiniSupervisorCard } from "./miniProject";

export async function loadMiniSupervisors() {
  // Only supervisors who have third years. Inner join, so a supervisor of final
  // years alone does not show up with an empty list.
  return query<MiniSupervisorCard>(`
    select sv.id, sv.name,
           count(m.id)::int                                             as students,
           count(ms.student_id) filter (where ms.mark is not null)::int as scored
      from supervisors sv
      join mini_students m    on m.supervisor_id = sv.id
      left join mini_scores ms on ms.student_id = m.id
     group by sv.id, sv.name
     order by sv.name
  `);
}

/** `mark` is numeric, which pg hands back as a string, so it is cast here. */
export async function loadMiniStudents(supervisorId: string | null) {
  return query<MiniStudent & { supervisor: string }>(`
    select m.id, m.name, m.index_no as "indexNo", sv.name as supervisor,
           ms.mark::float8 as mark, coalesce(ms.notes, '') as notes,
           ms.updated_at as "updatedAt"
      from mini_students m
      join supervisors sv      on sv.id = m.supervisor_id
      left join mini_scores ms on ms.student_id = m.id
     where ($1::text is null or m.supervisor_id = $1)
     order by sv.name, m.sort
  `, [supervisorId]);
}
