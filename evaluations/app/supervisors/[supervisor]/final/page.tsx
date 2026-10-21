import { notFound } from "next/navigation";
import { serverApiUrl } from "@/lib/api";
import SupervisorBoard, { type Supervisee, type Supervisor } from "./SupervisorBoard";

export const dynamic = "force-dynamic";

export default async function SupervisorPage({
  params,
}: {
  params: Promise<{ supervisor: string }>;
}) {
  const { supervisor: id } = await params;

  const res = await fetch(serverApiUrl(`/api/supervisors/${encodeURIComponent(id)}`), {
    cache: "no-store",
  });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Could not load supervisor ${id} (${res.status})`);

  const { supervisor, students, miniCount } = (await res.json()) as {
    supervisor: Supervisor; students: Supervisee[]; miniCount: number;
  };

  return <SupervisorBoard supervisor={supervisor} initialStudents={students} miniCount={miniCount} />;
}
