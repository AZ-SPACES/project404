import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Merchant store/pay shortlink. `/m/<handle>` is the distinct, unambiguous path
 * for merchant codes (vs. `/pay/<handle>` which the app treats as user-first).
 * On the web there's no ambiguity, so we redirect to the existing merchant pay
 * page, preserving any amount/description query params.
 */
export default async function MerchantShortlink({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v) && v[0]) qs.set(k, v[0]);
  }
  const query = qs.toString();
  redirect(`/pay/${encodeURIComponent(handle)}${query ? `?${query}` : ""}`);
}
