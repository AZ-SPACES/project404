import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CS Defense Scoring — KNUST",
  description:
    "Panel scoring for the Department of Computer Science project defense, 2026.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <div className="mx-auto max-w-[1400px] px-5 pt-6 pb-16">
          <header className="flex flex-wrap items-start justify-between gap-x-7 gap-y-5">
            <div className="flex min-w-0 items-center gap-4">
              <Image src="/knust-crest.png" alt="KNUST crest" width={40} height={54}
                     className="h-[54px] w-auto" priority />
              <div className="hidden sm:block">
                <div className="font-display text-[13px] font-bold tracking-[0.03em]">KNUST</div>
                <div className="text-[9.5px] leading-[1.3] text-ink-3">
                  Kwame Nkrumah University of<br />Science &amp; Technology
                </div>
              </div>
              <div className="hidden h-12 w-px self-stretch bg-line sm:block" />
              <div>
                <Link href="/" className="font-display text-[22px] font-bold leading-tight sm:text-[25px]">
                  CS Defense Scoring
                </Link>
                <p className="mt-1 max-w-[54ch] text-[13px] text-ink-2">
                  Department of Computer Science · Project defense 2026
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <nav className="flex items-center gap-2">
                <Link href="/" className="btn">Rooms</Link>
                <Link href="/results" className="btn">Results</Link>
              </nav>
              <Image src="/css-logo.png" alt="Computer Science Society" width={60} height={40}
                     className="h-10 w-auto" />
            </div>
          </header>
          <div className="mt-4 overflow-hidden rounded-sm">
            <div className="h-1 bg-knust" />
            <div className="h-0.5 bg-gold-bright" />
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
