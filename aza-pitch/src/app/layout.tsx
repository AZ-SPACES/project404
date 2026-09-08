import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pitch.aza.systems";

const title = "AZA — An Integrated Payments and Messaging Platform";
const description =
  "Thesis defence deck for AZA: a mobile-first digital financial services platform unifying encrypted messaging, e-money transfer, merchant acceptance, an agent cash network and a developer platform under one ledger with nine enforced financial invariants.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "AZA Thesis Defence",
  authors: [{ name: "Caleb Dussey" }],
  keywords: [
    "AZA", "fintech thesis", "e-money", "financial invariants", "double-entry ledger",
    "agent network", "end-to-end encryption", "Ghana", "mobile money", "Spring Boot", "React Native",
  ],
  openGraph: {
    type: "article",
    locale: "en_GB",
    url: siteUrl,
    siteName: "AZA",
    title,
    description,
  },
  twitter: { card: "summary_large_image", title, description },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#E6ECE1",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable}`}>
      <body>
        {/* Stamps data-theme before the body paints, so a dark-mode visitor never
            sees a frame of the light ground. Light is the default when nothing is
            stored — deliberately not following prefers-color-scheme, because the
            deck should open the same way on whatever machine it is presented from. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('aza-pitch-theme');document.documentElement.dataset.theme=(t==='dark'?'dark':'light')}catch(e){document.documentElement.dataset.theme='light'}})()",
          }}
        />
        {children}
      </body>
    </html>
  );
}
