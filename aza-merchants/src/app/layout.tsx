import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AZA Merchants",
  description: "Accept payments with AZA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
