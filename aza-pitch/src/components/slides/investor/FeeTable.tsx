import { cn } from "@/lib/utils";

export type FeeKind = "free" | "fee" | "b2b" | "pays";

export type FeeRow = {
  name: string;
  kind: FeeKind;
  rate: string;
  why: string;
};

const KIND_LABEL: Record<FeeKind, string> = {
  free: "Free",
  fee: "Fee",
  b2b: "B2B",
  pays: "AZA pays",
};

/**
 * One table shape for all four fee catalogues. The `kind` pill is the column that
 * carries the argument — a reader should be able to scan only that column and come
 * away with the pricing philosophy.
 */
export function FeeTable({ rows, whatLabel = "Fee" }: { rows: FeeRow[]; whatLabel?: string }) {
  return (
    <div className="scroll-x">
      <table className="dtable min-w-[780px]">
        <thead>
          <tr>
            <th>{whatLabel}</th>
            <th>Type</th>
            <th>Suggested rate</th>
            <th>Rationale</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="font-medium">{row.name}</td>
              <td>
                <span
                  className={cn(
                    "pill",
                    row.kind === "free" && "pill--ok",
                    row.kind === "fee" && "pill--warn",
                    row.kind === "pays" && "pill--bad",
                  )}
                >
                  {KIND_LABEL[row.kind]}
                </span>
              </td>
              <td className="mono text-[0.8rem] text-[var(--text)]">{row.rate}</td>
              <td>{row.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
