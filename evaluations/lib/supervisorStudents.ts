import { query } from "./db";
import type { SheetStudent } from "./markSheet";

export type SupervisorRow = { id: string; name: string };

export async function loadSupervisor(id: string): Promise<SupervisorRow | null> {
  const [row] = await query<SupervisorRow>(
    `select id, name from supervisors where id = $1`,
    [id]
  );
  return row ?? null;
}

/**
 * One supervisor's students, with both halves of the mark.
 *
 * Every join is a LEFT join: a supervisee who never sat the defense has no group,
 * no room and no ballots, and still has to appear. `mark` is numeric, which pg
 * hands back as a string, so it is cast rather than parsed at each call site.
 */
export async function loadSupervisees(supervisorId: string) {
  return query<SheetStudent & { universityId: string | null; roomLabel: string | null; updatedAt: string | null }>(`
    select s.id, s.name, s.index_no as "indexNo", s.student_id as "universityId",
           g.number as "groupNumber", r.code as "roomCode", r.label as "roomLabel",
           coalesce((
             select json_agg(json_build_object(
                      'appearance', sc.appearance, 'usability', sc.usability,
                      'technical', sc.technical, 'innovation', sc.innovation,
                      'presentation', sc.presentation))
               from scores sc where sc.student_id = s.id
           ), '[]'::json) as ballots,
           ss.mark::float8 as mark,
           coalesce(ss.notes, '') as notes,
           ss.updated_at as "updatedAt"
      from students s
      left join groups g             on g.number = s.group_number
      left join rooms  r             on r.id = g.room_id
      left join supervisor_scores ss on ss.student_id = s.id
     where s.supervisor_id = $1
     order by g.number nulls last, s.sort, s.name
  `, [supervisorId]);
}
