import { serverApiUrl } from "@/lib/api";
import TransferBoard, { type SupervisorOption } from "./TransferBoard";

export const dynamic = "force-dynamic";

async function loadSupervisors(): Promise<SupervisorOption[]> {
  const res = await fetch(serverApiUrl("/api/supervisors"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load supervisors (${res.status})`);
  const { supervisors } = (await res.json()) as { supervisors: SupervisorOption[] };
  return supervisors.map(({ id, name }) => ({ id, name }));
}

export default async function TransfersPage() {
  const supervisors = await loadSupervisors();
  return <TransferBoard supervisors={supervisors} />;
}
