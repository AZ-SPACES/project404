import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ room: string }> }
) {
  const { room } = await params;

  const [meta] = await query(
    `select id, code, label, venue, day from rooms where id = $1`,
    [room]
  );
  if (!meta) return NextResponse.json({ error: "Unknown room" }, { status: 404 });

  const examiners = await query(
    `select id, name from examiners where room_id = $1 order by sort`,
    [room]
  );
  const groups = await query(`
    select g.number,
           coalesce((
             select json_agg(json_build_object(
               'id', s.id, 'name', s.name, 'indexNo', s.index_no,
               'studentId', s.student_id, 'supervisor', s.supervisor) order by s.sort)
               from students s where s.group_number = g.number
           ), '[]'::json) as students
      from groups g
     where g.room_id = $1
     order by g.number
  `, [room]);
  const scores = await query(`
    select sc.student_id as "studentId", sc.examiner_id as "examinerId",
           sc.appearance, sc.usability, sc.technical, sc.innovation, sc.presentation,
           sc.notes, sc.updated_at as "updatedAt"
      from scores sc
      join students s on s.id = sc.student_id
      join groups g   on g.number = s.group_number
     where g.room_id = $1
  `, [room]);

  return NextResponse.json({ room: meta, examiners, groups, scores });
}
