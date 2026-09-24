import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export type StudentMatch = {
  id: string; name: string; indexNo: string; universityId: string | null;
  groupNumber: number | null;
  supervisorId: string | null; supervisorName: string | null;
  mark: number | null;
};

/**
 * Find students by name, index number or university ID, across every
 * supervisor. Numbers match from the start (typing "33645" narrows as you go);
 * names match anywhere, so a surname alone is enough.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ students: [] });

  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const students = await query<StudentMatch>(`
    select s.id, s.name, s.index_no as "indexNo", s.student_id as "universityId",
           s.group_number as "groupNumber",
           sv.id as "supervisorId", sv.name as "supervisorName",
           ss.mark::float8 as mark
      from students s
      left join supervisors sv       on sv.id = s.supervisor_id
      left join supervisor_scores ss on ss.student_id = s.id
     where s.name ilike '%' || $1 || '%'
        or s.index_no like $1 || '%'
        or s.student_id like $1 || '%'
     order by s.name
     limit 25
  `, [escaped]);
  return NextResponse.json({ students });
}
