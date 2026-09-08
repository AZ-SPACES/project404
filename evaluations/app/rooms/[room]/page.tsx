import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import RoomBoard, { type Examiner, type Group, type Room, type ScoreRow } from "./RoomBoard";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room: roomId } = await params;

  const [room] = await query<Room>(
    `select id, code, label, venue, day from rooms where id = $1`,
    [roomId]
  );
  if (!room) notFound();

  const [examiners, groups, scores] = await Promise.all([
    query<Examiner>(`select id, name from examiners where room_id = $1 order by sort`, [roomId]),
    query<Group>(`
      select g.number,
             coalesce((
               select json_agg(json_build_object(
                 'id', s.id, 'name', s.name, 'indexNo', s.index_no,
                 'studentId', s.student_id, 'supervisor', s.supervisor) order by s.sort)
                 from students s where s.group_number = g.number
             ), '[]'::json) as students
        from groups g where g.room_id = $1 order by g.number
    `, [roomId]),
    query<ScoreRow>(`
      select sc.student_id as "studentId", sc.examiner_id as "examinerId",
             sc.appearance, sc.usability, sc.technical, sc.innovation, sc.presentation,
             sc.notes, sc.updated_at as "updatedAt"
        from scores sc
        join students s on s.id = sc.student_id
        join groups g   on g.number = s.group_number
       where g.room_id = $1
    `, [roomId]),
  ]);

  return (
    <RoomBoard room={room} examiners={examiners} groups={groups} initialScores={scores} />
  );
}
