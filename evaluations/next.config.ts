import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js and only the traced
  // dependencies, so the runtime image needs no npm install and no node_modules
  // copy. The Dockerfile's runner stage depends on this being set.
  output: "standalone",

  // This app lives inside the project404 monorepo, which keeps its own lockfile
  // one level up. Without this, Next infers that parent as the workspace root,
  // so Turbopack watches and resolves against the whole ~9GB tree: the iOS build
  // output, six sibling Next apps with their own .next and node_modules, and the
  // root node_modules. That costs ~150MB of resident memory every 25s at idle.
  // Pinning the root keeps the watcher inside this app.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
