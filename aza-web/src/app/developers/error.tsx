"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function DevelopersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f9fa] px-6 text-center font-sans antialiased">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#fff2df] text-[#b45309] ring-1 ring-inset ring-[#fbdca0]">
        <AlertTriangle size={26} strokeWidth={2.2} />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-[#111827]">Developer portal error</h2>
      <p className="max-w-sm text-sm leading-relaxed text-[#6b7280]">
        Something went wrong loading this page. Check the{" "}
        <Link href="/developers/status" className="font-semibold text-[#174717] underline-offset-4 hover:underline">
          status page
        </Link>{" "}
        for any ongoing incidents.
      </p>
      <button
        onClick={reset}
        className="mt-1 rounded-xl bg-[#B7EE7A] px-5 py-2.5 text-sm font-bold text-[#0e2a0e] transition-all hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e] focus-visible:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
