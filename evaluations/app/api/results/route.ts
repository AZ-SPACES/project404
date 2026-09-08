import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { CRITERIA, aggregate, ballotTotal, type Ballot } from "@/lib/rubric";

export const dynamic = "force-dynamic";

type Row = {
  roomId: string; roomCode: string; venue: string; groupNumber: number;
  studentId: string; name: string; indexNo: string; universityId: string | null;
  supervisor: string | null;
  ballots: { examinerId: string; examiner: string; ballot: Ballot }[];
};

async function load(): Promise<Row[]> {
  return query<Row>(`
    select r.id as "roomId", r.code as "roomCode", r.venue,
           g.number as "groupNumber",
           s.id as "studentId", s.name, s.index_no as "indexNo",
           s.student_id as "universityId", s.supervisor,
           coalesce((
             select json_agg(json_build_object(
                      'examinerId', e.id, 'examiner', e.name,
                      'ballot', json_build_object(
                        'appearance', sc.appearance, 'usability', sc.usability,
                        'technical', sc.technical, 'innovation', sc.innovation,
                        'presentation', sc.presentation))
                    order by e.sort)
               from scores sc join examiners e on e.id = sc.examiner_id
              where sc.student_id = s.id
           ), '[]'::json) as ballots
      from students s
      join groups g on g.number = s.group_number
      join rooms  r on r.id = g.room_id
     order by r.sort, g.number, s.sort
  `);
}

function csvCell(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const rows = await load();
  const format = new URL(req.url).searchParams.get("format");

  if (format !== "csv") {
    return NextResponse.json({
      students: rows.map((r) => ({ ...r, ...aggregate(r.ballots.map((b) => b.ballot)) })),
    });
  }

  const head = [
    "Room", "Venue", "Group", "Student", "Index No", "Student ID", "Supervisor", "Examiner",
    ...CRITERIA.map((c) => `${c.label} (${c.weight}%)`),
    "Weighted total",
  ];
  const lines = [head.map(csvCell).join(",")];

  for (const r of rows) {
    const agg = aggregate(r.ballots.map((b) => b.ballot));
    for (const b of r.ballots) {
      const t = ballotTotal(b.ballot);
      lines.push([
        r.roomCode, r.venue, r.groupNumber, r.name, r.indexNo, r.universityId ?? "",
        r.supervisor ?? "", b.examiner,
        ...CRITERIA.map((c) => b.ballot[c.key] ?? ""),
        t.scored ? t.points.toFixed(2) : "",
      ].map(csvCell).join(","));
    }
    lines.push([
      r.roomCode, r.venue, r.groupNumber, r.name, r.indexNo, r.universityId ?? "",
      r.supervisor ?? "", "PANEL MEAN",
      ...CRITERIA.map((c) => agg.per[c.key].mean?.toFixed(2) ?? ""),
      agg.total?.toFixed(2) ?? "",
    ].map(csvCell).join(","));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="cs-defense-scores-${stamp}.csv"`,
    },
  });
}
