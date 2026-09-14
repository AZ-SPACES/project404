import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  CRITERIA, PANEL_SHARE, SUPERVISOR_SHARE, aggregate, ballotTotal, finalMark, type Ballot,
} from "@/lib/rubric";

export const dynamic = "force-dynamic";

type Row = {
  roomId: string | null; roomCode: string | null; venue: string | null;
  groupNumber: number | null;
  studentId: string; name: string; indexNo: string; universityId: string | null;
  supervisor: string | null; supervisorId: string | null;
  supervisorMark: number | null; supervisorNotes: string;
  ballots: { examinerId: string; examiner: string; ballot: Ballot }[];
};

async function load(roomId: string | null, supervisorId: string | null): Promise<Row[]> {
  // Left joins throughout: a supervisee who never sat the defense has no group
  // and no room, and still has a supervisor's 60% to report.
  return query<Row>(`
    select r.id as "roomId", r.code as "roomCode", r.venue,
           g.number as "groupNumber",
           s.id as "studentId", s.name, s.index_no as "indexNo",
           s.student_id as "universityId",
           s.supervisor, s.supervisor_id as "supervisorId",
           ss.mark::float8 as "supervisorMark",
           coalesce(ss.notes, '') as "supervisorNotes",
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
      left join groups g             on g.number = s.group_number
      left join rooms  r             on r.id = g.room_id
      left join supervisor_scores ss on ss.student_id = s.id
     where ($1::text is null or r.id = $1)
       and ($2::text is null or s.supervisor_id = $2)
     order by r.sort nulls last, g.number nulls last, s.sort, s.name
  `, [roomId, supervisorId]);
}

function csvCell(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const roomId = params.get("room");
  const supervisorId = params.get("supervisor");
  const rows = await load(roomId, supervisorId);
  const format = params.get("format");

  if (format !== "csv") {
    return NextResponse.json({
      students: rows.map((r) => {
        const agg = aggregate(r.ballots.map((b) => b.ballot));
        return { ...r, ...agg, ...finalMark(agg.total, r.supervisorMark) };
      }),
    });
  }

  const head = [
    "Room", "Venue", "Group", "Student", "Index No", "Student ID", "Supervisor", "Examiner",
    ...CRITERIA.map((c) => `${c.label} (${c.weight}% of panel)`),
    "Panel score (of 100)",
    `Panel (${PANEL_SHARE}%)`,
    `Supervisor (${SUPERVISOR_SHARE}%)`,
    "Final (of 100)",
    "Complete",
    "Supervisor notes",
  ];
  const lines = [head.map(csvCell).join(",")];

  for (const r of rows) {
    const agg = aggregate(r.ballots.map((b) => b.ballot));
    const mark = finalMark(agg.total, r.supervisorMark);
    const identity = [
      r.roomCode ?? "", r.venue ?? "", r.groupNumber ?? "", r.name, r.indexNo,
      r.universityId ?? "", r.supervisor ?? "",
    ];

    // One line per examiner, so the individual ballots stay auditable, then the
    // student's own line carrying the panel mean and the two combined halves.
    for (const b of r.ballots) {
      const t = ballotTotal(b.ballot);
      lines.push([
        ...identity, b.examiner,
        ...CRITERIA.map((c) => b.ballot[c.key] ?? ""),
        t.scored ? t.points.toFixed(2) : "",
        "", "", "", "", "",
      ].map(csvCell).join(","));
    }

    lines.push([
      ...identity, r.ballots.length ? "PANEL MEAN" : "NO PANEL SCORE",
      ...CRITERIA.map((c) => agg.per[c.key].mean?.toFixed(2) ?? ""),
      agg.total?.toFixed(2) ?? "",
      mark.panelPoints?.toFixed(2) ?? "",
      mark.supervisorPoints?.toFixed(1) ?? "",
      mark.final?.toFixed(2) ?? "",
      mark.complete ? "yes" : "no",
      r.supervisorNotes,
    ].map(csvCell).join(","));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const scope = roomId ? `-${roomId}` : supervisorId ? `-${supervisorId}` : "";
  // A BOM keeps Excel on Windows from mangling the UTF-8 names.
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="cs-defense-scores${scope}-${stamp}.csv"`,
    },
  });
}
