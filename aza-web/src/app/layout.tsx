import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aza.systems";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Aza — Send Money. Effortlessly.",
    template: "%s | Aza",
  },
  description:
    "Aza lets you send and request money, chat with friends, scan QR codes, and access powerful mini-apps — all in one secure platform.",
  keywords: [
    "send money", "money transfer", "fintech", "mobile payments",
    "digital wallet", "peer to peer payments", "QR payments", "mini apps",
  ],
  authors: [{ name: "JumpSpaces" }],
  creator: "JumpSpaces",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Aza",
    title: "Aza — Send Money. Effortlessly.",
    description:
      "Send and request money, chat with friends, scan QR codes, and access powerful mini-apps — all in one secure platform.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Aza — Send Money. Effortlessly." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aza — Send Money. Effortlessly.",
    description:
      "Send and request money, chat with friends, scan QR codes, and access powerful mini-apps — all in one secure platform.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('aza-theme')||'light';document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Aza",
              url: siteUrl,
              logo: `${siteUrl}/logo.png`,
              description: "Aza is a mobile-first payments platform that lets you send money, chat with friends, scan QR codes, and access mini-apps — all in one secure platform.",
              sameAs: [
                "https://x.com/azafintech",
                "https://instagram.com/azafintech",
                "https://linkedin.com/company/azafintech",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                email: "support@aza.systems",
                contactType: "customer support",
              },
            }),
          }}
        />
        {children}
        <Analytics />
        <Script
          id="chatbase-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){if(!window.chatbase||window.chatbase("getState")!=="initialized"){window.chatbase=(...arguments)=>{if(!window.chatbase.q){window.chatbase.q=[]}window.chatbase.q.push(arguments)};window.chatbase=new Proxy(window.chatbase,{get(target,prop){if(prop==="q"){return target.q}return(...args)=>target(prop,...args)}})}const onLoad=function(){const script=document.createElement("script");script.src="https://www.chatbase.co/embed.min.js";script.id="lcXHLFPWBcPsUbKaDDbeK";script.domain="www.chatbase.co";document.body.appendChild(script)};if(document.readyState==="complete"){onLoad()}else{window.addEventListener("load",onLoad)}})();`,
          }}
        />
      </body>
    </html>
  );
}

