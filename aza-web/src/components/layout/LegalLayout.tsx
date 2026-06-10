import Link from "next/link";

interface LegalLayoutProps {
  children: React.ReactNode;
}

export function LegalLayout({ children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--aza-bg)", color: "var(--aza-text)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: "var(--aza-bg)", borderColor: "var(--aza-border)" }}
      >
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt="AZA" className="h-6 w-auto" />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--aza-text-secondary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M19 12H5M5 12l7-7M5 12l7 7" />
            </svg>
            Back to aza.systems
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer
        className="border-t"
        style={{ borderColor: "var(--aza-border)" }}
      >
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs" style={{ color: "var(--aza-text-secondary)" }}>
            © 2026 JumpSpaces, Inc. All rights reserved.
          </p>
          <nav className="flex items-center gap-4 flex-wrap">
            {[
              { label: "Privacy Policy",   href: "/privacy-policy"   },
              { label: "Terms of Service", href: "/terms-of-service" },
              { label: "Cookie Policy",    href: "/cookie-policy"    },
              { label: "Compliance",       href: "/compliance"       },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: "var(--aza-text-secondary)" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
