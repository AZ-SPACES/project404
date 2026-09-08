import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type RoomRow = {
  id: string; code: string; label: string; venue: string; day: string;
  groups: number; students: number; examiners: { id: string; name: string }[];
  scored: number;
};

export async function GET() {
  const rooms = await query<RoomRow>(`
    select r.id, r.code, r.label, r.venue, r.day,
           (select count(*)::int from groups g where g.room_id = r.id) as groups,
           (select count(*)::int from students s
              join groups g on g.number = s.group_number
             where g.room_id = r.id) as students,
           coalesce((
             select json_agg(json_build_object('id', e.id, 'name', e.name) order by e.sort)
               from examiners e where e.room_id = r.id
           ), '[]'::json) as examiners,
           (select count(*)::int from scores sc
              join students s on s.id = sc.student_id
              join groups g on g.number = s.group_number
             where g.room_id = r.id
               and sc.appearance is not null and sc.usability is not null
               and sc.technical is not null and sc.innovation is not null
               and sc.presentation is not null) as scored
      from rooms r
     order by r.sort
  `);
  return NextResponse.json({ rooms });
}
