// Browser tests import stylesheets as text (Vite's `?inline`), to draw a part as a theme or
// the docs site does. A global script (no import or export), so the declaration applies to
// the whole package; `*.d.ts` files under src are ignored by git (build-output safety net).
// Test support only.
declare module "*.css?inline" {
  const css: string
  export default css
}
