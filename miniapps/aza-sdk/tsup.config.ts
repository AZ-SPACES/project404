import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // React is optional — don't bundle it
  external: ['react'],
  // Keep the bundle tiny; no minification so stack traces are readable
  minify: false,
});
