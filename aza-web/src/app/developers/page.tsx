import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Terminal, Activity, ArrowRight, LogIn, UserPlus, Layers } from "lucide-react";

export const metadata: Metadata = {
  title: "Developers | Aza",
  description: "Build on the Aza platform. Integrate payments, build Mini Apps, explore the REST API, and monitor system status.",
};

const sections = [
  {
    href: "/developers/guides?doc=miniapps-intro",
    icon: Layers,
    title: "Mini Apps",
    description: "Build web apps that run inside Aza. Users pay with one tap — no new account, no card details.",
    cta: "Start building",
  },
  {
    href: "/developers/guides",
    icon: BookOpen,
    title: "API Guides",
    description: "Step-by-step integration guides for payments, webhooks, OAuth, and more.",
    cta: "Read the docs",
  },
  {
    href: "/developers/api-explorer",
    icon: Terminal,
    title: "API Explorer",
    description: "Interactively browse and test every Aza REST endpoint directly in your browser.",
    cta: "Open explorer",
  },
  {
    href: "/developers/status",
    icon: Activity,
    title: "System Status",
    description: "Live health checks for the Aza API, authentication, payments, and webhooks.",
    cta: "View status",
  },
];

export default function DevelopersPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(135deg, #0e2a0e 0%, #132613 60%, #0a1a0a 100%)" }}
    >
      {/* Back link */}
      <div className="px-6 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A] rounded"
          style={{ color: "rgba(183,238,122,0.6)" }}
        >
          ← Back to aza.systems
        </Link>
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center justify-center text-center px-6 pt-20 pb-16">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-[0.75rem] font-semibold mb-6"
          style={{ background: "rgba(183,238,122,0.1)", border: "1px solid rgba(183,238,122,0.2)", color: "#B7EE7A" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#B7EE7A" }}
          />
          Developer Platform
        </div>

        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4"
          style={{ letterSpacing: "-0.04em" }}
        >
          Build on{" "}
          <span style={{ color: "#B7EE7A" }}>Aza</span>
        </h1>
        <p className="text-base sm:text-lg max-w-lg" style={{ color: "rgba(255,255,255,0.45)" }}>
          Integrate payments, send money programmatically, and build on top of the Aza platform using our REST API.
        </p>

        {/* Auth links */}
        <div className="flex items-center gap-3 mt-8">
          <Link
            href="/developers/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A]"
            style={{ background: "#B7EE7A", color: "#174717" }}
          >
            <UserPlus size={15} />
            Get API access
          </Link>
          <Link
            href="/developers/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
          >
            <LogIn size={15} />
            Sign in
          </Link>
        </div>
      </div>

      {/* Section cards */}
      <div className="max-w-4xl mx-auto w-full px-6 pb-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map(({ href, icon: Icon, title, description, cta }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-4 p-6 rounded-2xl transition-all border border-[rgba(183,238,122,0.1)] hover:border-[rgba(183,238,122,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B7EE7A]"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(183,238,122,0.1)", color: "#B7EE7A" }}
            >
              <Icon size={18} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-white mb-1">{title}</p>
              <p className="text-[0.8rem] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                {description}
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold transition-gap"
              style={{ color: "#B7EE7A" }}
            >
              {cta}
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto text-center pb-8 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
        © {new Date().getFullYear()} JumpSpaces, Inc.
      </div>
    </div>
  );
}
