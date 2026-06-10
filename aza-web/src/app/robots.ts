import { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aza.systems";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/developers/login", "/developers/signup"],
      },
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "CCBot",
          "anthropic-ai",
          "Claude-Web",
          "Google-Extended",
          "Omgilibot",
          "FacebookBot",
          "Bytespider",
          "PetalBot",
        ],
        disallow: "/",
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
