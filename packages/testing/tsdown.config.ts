import { defineConfig } from "tsdown"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    dom: "src/dom.ts",
    playwright: "src/playwright.ts",
    setup: "src/setup.ts",
  },
  // Optional peers stay external; Playwright is imported for types only.
  external: [/^@testing-library\//, /^playwright/, /^@guidepup\//],
  // Only src: the package tsconfig also covers fixtures, which import Storybook stories.
  dts: { tsconfig: "tsconfig.build.json" },
  publint: true,
})
