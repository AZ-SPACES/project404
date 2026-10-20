import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Ballot } from "@/lib/rubric";

export const dynamic = "force-dynamic";

export type FinalYearHit = {
  cohort: "final";
  id: string; name: string; indexNo: string; universityId: string | null;
  supervisorId: string | null; supervisorName: string | null;
  groupNumber: number | null; roomCode: string | null; venue: string | null;
  ballots: { examiner: string; ballot: Ballot }[];
  mark: number | null; notes: string;
};
export type MiniHit = {
  cohort: "mini";
  id: string; name: string; indexNo: string;
  supervisorId: string; supervisorName: string;
  mark: number | null; notes: string;
};
export type SupervisorHit = { id: string; name: string; finalYear: number; mini: number };

/**
 * One search across both cohorts and the supervisors. Numbers match from the
 * start (typing "33645" narrows as you go); names match anywhere, so a surname
 * alone is enough. Every hit carries its full record, so the page can show it
 * without a second request.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ students: [], supervisors: [] });

  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);

  const [finalYears, minis, supervisors] = await Promise.all([
    query<FinalYearHit>(`
      select 'final' as cohort, s.id, s.name, s.index_no as "indexNo",
             s.student_id as "universityId",
             sv.id as "supervisorId", sv.name as "supervisorName",
             g.number as "groupNumber", r.code as "roomCode", r.venue,
             coalesce((
               select json_agg(json_build_object(
                        'examiner', e.name,
                        'ballot', json_build_object(
                          'appearance', sc.appearance, 'usability', sc.usability,
                          'technical', sc.technical, 'innovation', sc.innovation,
                          'presentation', sc.presentation))
                      order by e.sort)
                 from scores sc join examiners e on e.id = sc.examiner_id
                where sc.student_id = s.id
             ), '[]'::json) as ballots,
             ss.mark::float8 as mark, coalesce(ss.notes, '') as notes
        from students s
        left join supervisors sv       on sv.id = s.supervisor_id
        left join groups g             on g.number = s.group_number
        left join rooms r              on r.id = g.room_id
        left join supervisor_scores ss on ss.student_id = s.id
       where s.name ilike '%' || $1 || '%'
          or s.index_no like $1 || '%'
          or s.student_id like $1 || '%'
       order by s.name
       limit 25
    `, [escaped]),
    query<MiniHit>(`
      select 'mini' as cohort, m.id, m.name, m.index_no as "indexNo",
             sv.id as "supervisorId", sv.name as "supervisorName",
             ms.mark::float8 as mark, coalesce(ms.notes, '') as notes
        from mini_students m
        join supervisors sv      on sv.id = m.supervisor_id
        left join mini_scores ms on ms.student_id = m.id
       where m.name ilike '%' || $1 || '%'
          or m.index_no like $1 || '%'
       order by m.name
       limit 25
    `, [escaped]),
    query<SupervisorHit>(`
      select sv.id, sv.name,
             (select count(*)::int from students s where s.supervisor_id = sv.id)       as "finalYear",
             (select count(*)::int from mini_students m where m.supervisor_id = sv.id)  as mini
        from supervisors sv
       where sv.name ilike '%' || $1 || '%'
       order by sv.name
    `, [escaped]),
  ]);

  return NextResponse.json({ students: [...finalYears, ...minis], supervisors });
}
