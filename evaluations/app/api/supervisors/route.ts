import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { SupervisorOverview } from "@/lib/supervisorOverview";

export const dynamic = "force-dynamic";

type SupervisorRow = {
  id: string; name: string;
  students: number; scored: number; defended: number;
};

export async function GET(req: Request) {
  // ?cohorts=all is the supervisor picker: everyone with students in either
  // cohort, with progress for both. Without it the list stays final-year only,
  // which is what /transfers needs.
  if (new URL(req.url).searchParams.get("cohorts") === "all") {
    const supervisors = await query<SupervisorOverview>(`
      select sv.id, sv.name,
             coalesce(f.students, 0) as students, coalesce(f.scored, 0) as scored,
             coalesce(f.defended, 0) as defended,
             coalesce(m.students, 0) as "miniStudents", coalesce(m.scored, 0) as "miniScored"
        from supervisors sv
        left join (
          select s.supervisor_id,
                 count(*)::int                                                as students,
                 count(ss.student_id) filter (where ss.mark is not null)::int as scored,
                 count(*) filter (where s.group_number is not null)::int      as defended
            from students s
            left join supervisor_scores ss on ss.student_id = s.id
           group by s.supervisor_id
        ) f on f.supervisor_id = sv.id
        left join (
          select m.supervisor_id,
                 count(*)::int                                                as students,
                 count(ms.student_id) filter (where ms.mark is not null)::int as scored
            from mini_students m
            left join mini_scores ms on ms.student_id = m.id
           group by m.supervisor_id
        ) m on m.supervisor_id = sv.id
       where f.students > 0 or m.students > 0
       order by sv.sort
    `);
    return NextResponse.json({ supervisors });
  }

  // `defended` is the subset that sat the defense and so has a panel half too;
  // the rest are supervisees who only ever get the 60%. A supervisor of third
  // years alone has no final-year students and is left out.
  const supervisors = await query<SupervisorRow>(`
    select sv.id, sv.name,
           count(s.id)::int                                        as students,
           count(ss.student_id) filter (where ss.mark is not null)::int as scored,
           count(s.id) filter (where s.group_number is not null)::int   as defended
      from supervisors sv
      left join students s          on s.supervisor_id = sv.id
      left join supervisor_scores ss on ss.student_id = s.id
     group by sv.id, sv.name, sv.sort
    having count(s.id) > 0
     order by sv.sort
  `);
  return NextResponse.json({ supervisors });
}
