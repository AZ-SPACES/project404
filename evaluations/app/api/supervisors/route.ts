import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type SupervisorRow = {
  id: string; name: string;
  students: number; scored: number; defended: number;
};

export async function GET() {
  // `defended` is the subset that sat the defense and so has a panel half too;
  // the rest are supervisees who only ever get the 60%.
  const supervisors = await query<SupervisorRow>(`
    select sv.id, sv.name,
           count(s.id)::int                                        as students,
           count(ss.student_id) filter (where ss.mark is not null)::int as scored,
           count(s.id) filter (where s.group_number is not null)::int   as defended
      from supervisors sv
      left join students s          on s.supervisor_id = sv.id
      left join supervisor_scores ss on ss.student_id = s.id
     group by sv.id, sv.name, sv.sort
     order by sv.sort
  `);
  return NextResponse.json({ supervisors });
}
