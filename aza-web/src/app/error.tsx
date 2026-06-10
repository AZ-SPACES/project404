"use client";

import { useEffect } from "react";

export default function Error({
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
      <h2 className="text-2xl font-bold tracking-tight">Something went wrong</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        An unexpected error occurred. Try refreshing the page.
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
