import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from '@vercel/speed-insights/next';
import QueryProvider from "@/lib/query-provider";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "AZA Admin",
  description: "AZA internal admin dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
