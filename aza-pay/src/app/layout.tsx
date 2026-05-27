import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AZA Pay",
  description: "Secure wallet payments, powered by AZA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
