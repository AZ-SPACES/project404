import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js and only the traced
  // dependencies, so the runtime image needs no npm install and no node_modules
  // copy. The Dockerfile's runner stage depends on this being set.
  output: "standalone",
};

export default nextConfig;
