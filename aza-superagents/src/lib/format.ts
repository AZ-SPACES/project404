/**
 * Money is always GHS here (the platform is Ghana-only), and always shown to two decimals —
 * a float figure that rounds to the cedi hides exactly the pesewa drift an operator is
 * checking for.
 */
export function ghs(amount: number | null | undefined): string {
  const value = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  return value.toLocaleString("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Compact form for dense tiles, where the currency symbol is already in the label. */
export function amount(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return dateTime(iso);
}

/**
 * A per-attempt idempotency key. The backend keys float movements on this, so a double-submit
 * or a retried request settles once — the key has to be generated when the operator commits to
 * the amount, not per render.
 */
export function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `sa-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
