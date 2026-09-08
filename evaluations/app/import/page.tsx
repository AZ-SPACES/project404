import ImportWizard from "./ImportWizard";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="mt-7">
      <h2 className="font-display text-[22px] font-bold">Student allocation</h2>
      <p className="mt-1 max-w-[70ch] text-[13px] text-ink-2">
        Replace the roster from a spreadsheet. Ballots already recorded for students who
        stay in the list are kept.
      </p>
      <ImportWizard />
    </main>
  );
}
