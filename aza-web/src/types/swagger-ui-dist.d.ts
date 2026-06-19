// Minimal typing for the swagger-ui-dist bundle (ships no types of its own).
// We only use SwaggerUIBundle + its `presets.apis`.
interface SwaggerUIBundleStatic {
  (options: Record<string, unknown>): unknown;
  presets: { apis: unknown };
}

declare module 'swagger-ui-dist' {
  export const SwaggerUIBundle: SwaggerUIBundleStatic;
  export const SwaggerUIStandalonePreset: unknown;
}

declare module 'swagger-ui-dist/swagger-ui-bundle.js' {
  const SwaggerUIBundle: SwaggerUIBundleStatic;
  export default SwaggerUIBundle;
}
