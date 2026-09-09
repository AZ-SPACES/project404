// Tapping a room used to give no feedback at all until the server answered, so
// on venue wifi the examiner tapped again.
export default function Loading() {
  return (
    <main className="mt-8" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-44 animate-pulse rounded bg-sunken" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-[132px] animate-pulse rounded-xl bg-sunken/60" />
        ))}
      </div>
    </main>
  );
}
