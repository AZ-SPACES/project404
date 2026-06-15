import { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aza.systems";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base,                                lastModified: new Date(), changeFrequency: "weekly",  priority: 1   },
    { url: `${base}/about`,                     lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/blog`,                      lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/security`,                  lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/developers`,                lastModified: new Date(), changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/developers/guides`,         lastModified: new Date(), changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/developers/status`,         lastModified: new Date(), changeFrequency: "always",  priority: 0.6 },
    { url: `${base}/privacy-policy`,            lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/terms-of-service`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/cookie-policy`,             lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/compliance`,                lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];
}
