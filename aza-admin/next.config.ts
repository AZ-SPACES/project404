import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
    ],
  },
};
export default nextConfig;
