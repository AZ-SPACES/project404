import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aza",
    short_name: "Aza",
    description: "Send money. Effortlessly.",
    start_url: "/",
    display: "standalone",
    background_color: "#0E0F0C",
    theme_color: "#174717",
    orientation: "portrait",
    icons: [
      { src: "/icon.png",       sizes: "any",        type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180",    type: "image/png", purpose: "any" },
    ],
    categories: ["finance", "utilities"],
  };
}
