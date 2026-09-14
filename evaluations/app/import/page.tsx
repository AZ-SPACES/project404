import ImportWizard from "./ImportWizard";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="mt-7">
      <h2 className="font-display text-[22px] font-bold">Student allocation</h2>
      <p className="mt-1 max-w-[70ch] text-[13px] text-ink-2">
        Update the roster from a spreadsheet. By default this only adds and corrects the
        students in the file — anyone it does not mention is left exactly as they are,
        with their ballots and supervisor mark intact. Replacing the roster outright is
        offered as a separate choice, and asks before it deletes anything.
      </p>
      <ImportWizard />
    </main>
  );
}
