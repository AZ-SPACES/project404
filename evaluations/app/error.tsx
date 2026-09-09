"use client";

// There was no error boundary anywhere in the app. Any API hiccup on defense
// day put the framework's default stack-trace screen in front of the panel.
export default function Error({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mt-10 flex justify-center">
      <div className="card w-full max-w-md border-t-4 border-t-alert p-6">
        <h1 className="font-display text-[19px] font-bold">This screen could not load</h1>
        <p className="mt-1.5 text-[13px] text-ink-2">
          The scoring database did not answer. Nothing you have already filed is
          affected — every score is saved as it is tapped.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={reset} className="btn btn-primary">Try again</button>
          <a href="/" className="btn">Back to rooms</a>
        </div>
        {error.digest && (
          <p className="num mt-4 text-[11px] text-ink-3">
            Reference {error.digest} — quote this if you need to report it.
          </p>
        )}
      </div>
    </main>
  );
}
