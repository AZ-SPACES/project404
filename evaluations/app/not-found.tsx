export default function NotFound() {
  return (
    <main className="mt-10 flex justify-center">
      <div className="card w-full max-w-md p-6">
        <h1 className="font-display text-[19px] font-bold">No such page</h1>
        <p className="mt-1.5 text-[13px] text-ink-2">
          That room or link does not exist. Pick your room from the list.
        </p>
        <a href="/" className="btn btn-primary mt-4">Back to rooms</a>
      </div>
    </main>
  );
}
