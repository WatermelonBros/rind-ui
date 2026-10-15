import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

// Workspace packages resolve to their TypeScript sources (see the `@rind-ui/source`
// export condition), so tests never wait for a build.
const conditions = ["@rind-ui/source", "module", "browser", "default"]
const resolve = { conditions }
const ssr = { resolve: { conditions: ["@rind-ui/source", "node", "import", "default"] } }

// Chromium locally; CI sets RIND_BROWSERS=chromium,firefox,webkit.
const browsers = (process.env["RIND_BROWSERS"] ?? "chromium").split(",")
// Instances are named per project: two projects on the same browser would otherwise clash.
const browser = (project: string) => ({
  enabled: true,
  headless: true,
  provider: playwright(),
  instances: browsers.map((name) => ({
    browser: name as "chromium" | "firefox" | "webkit",
    name: `${project} (${name})`,
  })),
})

// `*.test-d.ts` type tests are checked by `pnpm typecheck` (tsc), not by Vitest.
// `*.test.ts`: machines, graphs — no DOM. `*.dom.test.tsx`: driver tests that run
// unchanged in jsdom (through @rind-ui/testing/setup) and in real browsers.
const dom = ["packages/*/{src,fixtures}/**/*.dom.test.{ts,tsx}"]

export default defineConfig({
  resolve,
  ssr,
  test: {
    projects: [
      {
        resolve,
        ssr,
        test: {
          name: "node",
          environment: "node",
          include: [
            "packages/*/{src,fixtures}/**/*.test.{ts,tsx}",
            "scripts/**/*.test.ts",
            "a11y-nightly/**/*.test.ts",
          ],
          exclude: [...dom, "**/*.pw.test.ts", "**/*.browser.test.{ts,tsx}", "**/node_modules/**"],
        },
      },
      {
        resolve,
        ssr,
        test: {
          name: "jsdom",
          environment: "jsdom",
          // Globals let Testing Library and @rind-ui/testing/setup register afterEach.
          globals: true,
          include: dom,
          setupFiles: ["packages/testing/src/setup.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "browser",
          // `*.browser.test.*`: needs real input (vitest/browser's userEvent), browser only.
          include: [...dom, "packages/*/{src,fixtures}/**/*.browser.test.{ts,tsx}"],
          browser: browser("browser"),
          globals: true,
          // A no-op in real browsers; listed so that is tested.
          setupFiles: ["packages/testing/src/setup.ts"],
        },
      },
      {
        // The shared driver scenarios through the Playwright adapter, against the built
        // Storybook (turbo builds it before tests).
        resolve,
        ssr,
        test: {
          name: "playwright",
          environment: "node",
          include: ["packages/*/fixtures/**/*.pw.test.ts"],
        },
      },
      {
        resolve,
        plugins: [storybookTest({ configDir: "apps/storybook/.storybook" })],
        test: { name: "storybook", browser: browser("storybook") },
      },
    ],
  },
})
