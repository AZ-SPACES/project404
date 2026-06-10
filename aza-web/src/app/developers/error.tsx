"use client";

import { useEffect } from "react";

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-bold tracking-tight">Developer portal error</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Something went wrong loading this page. Check the{" "}
        <a href="/developers/status" className="underline underline-offset-4">
          status page
        </a>{" "}
        for any ongoing incidents.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-80"
      >
        Try again
      </button>
    </div>
  );
}
