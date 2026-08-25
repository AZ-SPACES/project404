import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <Logo className="justify-center" />
        <p className="mt-6 text-sm font-medium">That page isn&apos;t here.</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm text-primary underline underline-offset-4"
        >
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
