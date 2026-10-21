import Link from "next/link";

const TABS = [
  { key: "final", href: "/results", label: "Final year project" },
  { key: "mini", href: "/results/mini", label: "Mini project (3rd year)" },
] as const;

/** Switches /results between the two cohorts, each with its own CSV. */
export default function ResultsTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="mb-5 inline-flex rounded-md border border-line bg-surface p-[3px] text-[13px]">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} aria-current={t.key === active ? "page" : undefined}
              className={`rounded-[5px] px-3.5 py-1.5 font-medium transition ${
                t.key === active ? "bg-knust text-white" : "text-ink-2 hover:text-ink"
              }`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
