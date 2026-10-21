import { redirect } from "next/navigation";

// The third-year list was folded into /supervisors, where a supervisor picks
// their name and then the cohort. Kept so old links still land somewhere.
export default function MiniProjectPage() {
  redirect("/supervisors");
}
