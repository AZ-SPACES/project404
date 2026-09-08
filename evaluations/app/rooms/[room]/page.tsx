import { notFound } from "next/navigation";
import { serverApiUrl } from "@/lib/api";
import RoomBoard, { type Examiner, type Group, type Room, type ScoreRow } from "./RoomBoard";

export const dynamic = "force-dynamic";

type RoomState = {
  room: Room; examiners: Examiner[]; groups: Group[]; scores: ScoreRow[];
};

export default async function RoomPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const { room: roomId } = await params;

  // /api/rooms/[room] returns exactly the four collections the board needs, in
  // one round trip, and 404s on an unknown room — so the page maps straight onto
  // it. The four SQL queries this replaced now run inside that route instead.
  const res = await fetch(serverApiUrl(`/api/rooms/${encodeURIComponent(roomId)}`), {
    cache: "no-store",
  });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Could not load room ${roomId} (${res.status})`);

  const { room, examiners, groups, scores } = (await res.json()) as RoomState;

  return (
    <RoomBoard room={room} examiners={examiners} groups={groups} initialScores={scores} />
  );
}
