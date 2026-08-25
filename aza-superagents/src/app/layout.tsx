import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AZA Super Agents",
  description: "Distribute float across your agent network.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // `dark` is set on <html> rather than toggled: this console has one palette. See globals.css.
  return (
    <html lang="en" className={`dark ${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
