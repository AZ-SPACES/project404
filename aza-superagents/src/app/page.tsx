import { redirect } from "next/navigation";

/**
 * The portal has no marketing surface — it is an operator's console. The shell decides whether
 * the visitor has a session, so the root just points at it.
 */
export default function Home() {
  redirect("/dashboard");
}
