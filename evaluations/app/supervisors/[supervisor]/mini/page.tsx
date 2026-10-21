import { notFound } from "next/navigation";
import { serverApiUrl } from "@/lib/api";
import type { MiniStudent } from "@/lib/miniProject";
import type { Supervisor } from "../SupervisorBoard";
import MiniBoard from "../MiniBoard";

export const dynamic = "force-dynamic";

export default async function MiniSupervisorPage({
  params,
}: {
  params: Promise<{ supervisor: string }>;
}) {
  const { supervisor: id } = await params;

  const res = await fetch(serverApiUrl(`/api/mini/${encodeURIComponent(id)}`), {
    cache: "no-store",
  });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Could not load supervisor ${id} (${res.status})`);

  const { supervisor, students } = (await res.json()) as {
    supervisor: Supervisor; students: MiniStudent[];
  };

  return <MiniBoard supervisor={supervisor} initialStudents={students} />;
}
