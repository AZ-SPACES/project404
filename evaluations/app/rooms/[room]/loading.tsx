export default function Loading() {
  return (
    <main className="mt-6" aria-busy="true" aria-label="Loading the room">
      <div className="h-7 w-40 animate-pulse rounded bg-sunken" />
      <div className="mt-5 grid items-start gap-5 md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="h-[420px] animate-pulse rounded-xl bg-sunken/60" />
        <div className="h-[520px] animate-pulse rounded-xl bg-sunken/60" />
      </div>
    </main>
  );
}
