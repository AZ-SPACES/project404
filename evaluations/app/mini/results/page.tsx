import { redirect } from "next/navigation";

// Moved to /results/mini, beside the final-year results. Kept for old links.
export default function MiniResultsRedirect() {
  redirect("/results/mini");
}
