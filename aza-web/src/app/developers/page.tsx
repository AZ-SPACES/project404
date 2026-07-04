import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Terminal, Activity, ArrowRight, Layers, History, ArrowUpRight } from "lucide-react";
import { DevNav } from "./_ui/DevNav";
import { DevFooter } from "./_ui/DevFooter";

export const metadata: Metadata = {
  title: "Developers | Aza",
  description: "Build on the Aza platform. Integrate payments, build Mini Apps, explore the REST API, and monitor system status.",
};

const explore = [
  {
    href: "/developers/guides",
    icon: BookOpen,
    title: "API Guides",
    description: "Step-by-step integration guides for checkout, payouts, webhooks, and Sign in with Aza.",
  },
  {
    href: "/developers/api-explorer",
    icon: Terminal,
    title: "API Reference",
    description: "Browse and test every REST endpoint in your browser, in test mode.",
  },
  {
    href: "/developers/guides?doc=miniapps-intro",
    icon: Layers,
    title: "Mini Apps",
    description: "Build web apps that run inside Aza. Users pay with one tap — no new account.",
  },
  {
    href: "/developers/changelog",
    icon: History,
    title: "Changelog",
    description: "Every API change, versioned. Breaking changes are called out explicitly.",
  },
  {
    href: "/developers/status",
    icon: Activity,
    title: "System Status",
    description: "Live health checks for the API, payments, and webhook delivery.",
  },
];

const steps = [
  {
    title: "Get a test key",
    body: "Create a developer account and grab an aza_test_ key from the dashboard.",
  },
  {
    title: "Create a checkout session",
    body: "Call the Merchant API server-to-server. It returns a hosted pay.aza.systems link.",
  },
  {
    title: "Redirect & get notified",
    body: "Send your customer to the link. Aza handles payment and 2FA, then pings your webhook.",
  },
];

export default function DevelopersPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#111827] antialiased">
      <DevNav active="home" />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-[#111827] sm:text-5xl" style={{ letterSpacing: "-0.03em", textWrap: "balance" }}>
              The payments API for{" "}
              <span className="text-[#2e7d2e]">Ghana</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[#374151]">
              Accept payments, pay out to sellers, and sign in Aza users — all on one REST API. Test keys behave exactly like live, so you can build before you go live.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/developers/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-[#B7EE7A] px-5 py-3 text-sm font-bold text-[#0e2a0e] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e] focus-visible:ring-offset-2"
              >
                Get API access
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/developers/guides"
                className="inline-flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-white px-5 py-3 text-sm font-semibold text-[#374151] transition-colors hover:border-[#0e2a0e] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e2a0e]"
              >
                Read the docs
              </Link>
            </div>
          </div>

          {/* Terminal card */}
          <div className="overflow-hidden rounded-2xl border border-[#1c3a1c] bg-[#0c1f0c] shadow-[0_24px_60px_-24px_rgba(14,42,14,0.6)]">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-2 font-mono text-xs text-white/40">create a checkout session</span>
            </div>
            <pre className="overflow-x-auto px-5 py-5 font-mono text-[12.5px] leading-relaxed text-white/85">
              <code>
                <span className="text-white/40"># Charge a customer ₵50.00</span>{"\n"}
                <span className="text-[#B7EE7A]">curl</span> -X POST https://api.aza.systems/api/v1/merchant/sessions{" \\"}{"\n"}
                {"  "}-H <span className="text-[#8fd96b]">&quot;X-Api-Key: aza_test_…&quot;</span>{" \\"}{"\n"}
                {"  "}-H <span className="text-[#8fd96b]">&quot;Content-Type: application/json&quot;</span>{" \\"}{"\n"}
                {"  "}-d <span className="text-[#8fd96b]">&apos;{"{"} &quot;amount&quot;: 5000, &quot;currency&quot;: &quot;GHS&quot; {"}"}&apos;</span>
              </code>
            </pre>
            <div className="border-t border-white/10 px-5 py-3 font-mono text-[12px] text-white/55">
              → <span className="text-[#B7EE7A]">pay.aza.systems/c/cs_test_9f2a…</span>
            </div>
          </div>
        </section>

        {/* Explore */}
        <section className="border-t border-[#e5e7eb] bg-[#f8f9fa]">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#6b7280]">Explore the platform</h2>
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
              {explore.map(({ href, icon: Icon, title, description }, i) => (
                <Link
                  key={href}
                  href={href}
                  className={`group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B7EE7A] ${i < explore.length - 1 ? "border-b border-[#f3f4f6]" : ""}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eaf7e0] text-[#2e7d2e]">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[#111827]">{title}</span>
                    <span className="block truncate text-sm text-[#6b7280]">{description}</span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-[#9ca3af] transition-transform group-hover:translate-x-0.5 group-hover:text-[#2e7d2e]" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Quickstart */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-black tracking-tight text-[#111827]" style={{ letterSpacing: "-0.02em" }}>
              Your first payment, in three steps
            </h2>
            <Link href="/developers/guides" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-[#174717] hover:underline sm:inline-flex">
              Full quickstart <ArrowUpRight size={14} />
            </Link>
          </div>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <span className="font-mono text-sm font-bold text-[#B7EE7A]">
                  <span className="text-[#2e7d2e]">0{i + 1}</span>
                </span>
                <h3 className="mt-2 font-bold text-[#111827]">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#6b7280]">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <DevFooter />
    </div>
  );
}
