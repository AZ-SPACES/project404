import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-6"
      style={{ background: "var(--aza-bg)", color: "var(--aza-text)" }}
    >
      {/* Logo */}
      <Link href="/" className="mb-10">
        <img src="/logo.png" alt="AZA" className="h-7 w-auto" />
      </Link>

      <div className="max-w-md w-full text-center space-y-4">
        {/* 404 badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-2"
          style={{
            background: "rgba(183,238,122,0.15)",
            border: "1px solid rgba(183,238,122,0.3)",
            color: "#174717",
          }}
        >
          404 — Page not found
        </div>

        <h1
          className="text-5xl font-extrabold tracking-tight"
          style={{ color: "var(--aza-text)" }}
        >
          Wrong turn.
        </h1>
        <p
          className="text-base leading-relaxed"
          style={{ color: "var(--aza-text-secondary)" }}
        >
          This page doesn&apos;t exist. Head back home or join the waitlist while
          you&apos;re here.
        </p>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "#174717" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" />
            </svg>
            Go home
          </Link>
          <Link
            href="/#waitlist"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
            style={{
              border: "1.5px solid var(--aza-border)",
              color: "var(--aza-text)",
            }}
          >
            Join waitlist
          </Link>
        </div>
      </div>
    </div>
  );
}
