import { redirect } from "next/navigation";

// Moved under /supervisors/[supervisor]/mini. Kept so old links still work.
export default async function MiniSupervisorRedirect({
  params,
}: {
  params: Promise<{ supervisor: string }>;
}) {
  const { supervisor } = await params;
  redirect(`/supervisors/${encodeURIComponent(supervisor)}/mini`);
}
