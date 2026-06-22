import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AZA Superagents",
  description: "Distribute float to AZA agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
