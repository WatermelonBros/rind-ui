import { availableParallelism } from "node:os"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import vue from "@vitejs/plugin-vue"
import { playwright } from "@vitest/browser-playwright"
import solid from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

// Workspace packages resolve to their TypeScript sources (see the `@rind-ui/source`
// export condition), so tests never wait for a build.
const conditions = ["@rind-ui/source", "module", "browser", "default"]
// The Color Picker's internal parts (not exported by @rind-ui/react) for their behaviour tests.
const alias = {
  "@rind-ui/react/color-internals": new URL(
    "./packages/react/src/color-internals.ts",
    import.meta.url,
  ).pathname,
}
const resolve = { conditions, alias }
// No "import": jsdom's require("decimal.js") would get the ESM build ("Decimal is not a
// constructor" on a range input's validity).
const ssr = { resolve: { conditions: ["@rind-ui/source", "node", "default"] } }

// Chromium locally; CI sets RIND_BROWSERS=chromium,firefox,webkit.
const browsers = (process.env["RIND_BROWSERS"] ?? "chromium").split(",")
// Instances are named per project: two projects on the same browser would otherwise clash.
// The DOM tests run with classic (space-taking) scrollbars, so scroll-lock compensation is
// measured for real (radix#3251): headless Chromium hides them, Firefox overlays them.
const classicScrollbars = {
  launchOptions: {
    ignoreDefaultArgs: ["--hide-scrollbars"],
    firefoxUserPrefs: {
      "ui.useOverlayScrollbars": 0,
      "widget.gtk.overlay-scrollbars.enabled": false,
    },
  },
}
const browser = (project: string, options?: typeof classicScrollbars) => ({
  enabled: true,
  headless: true,
  provider: playwright(options),
  instances: browsers.map((name) => ({
    browser: name as "chromium" | "firefox" | "webkit",
    name: `${project} (${name})`,
  })),
})

// Real-browser projects retry a failed test once on CI: shared runners make timing-sensitive
// browser tests flaky. A test that passes only on retry is listed as flaky in the job summary
// (scripts/flaky-report.mjs) so it gets fixed; node and jsdom never retry.
const ciRetry = process.env["CI"] ? 1 : 0

// `*.test-d.ts` type tests are checked by `pnpm typecheck` (tsc), not by Vitest.
// `*.test.ts`: machines, graphs — no DOM. `*.dom.test.tsx`: driver tests that run
// unchanged in jsdom (through @rind-ui/testing/setup) and in real browsers.
const dom = ["packages/*/{src,fixtures}/**/*.dom.test.{ts,tsx}"]
// @rind-ui/angular's tests need the Angular compiler: its own projects (below) run them.
const angularOwn = ["packages/angular/**", "**/node_modules/**"]

// Locally the machine is shared by several sessions: at most half the cores per run unless
// RIND_MAX_WORKERS says otherwise, so parallel runs do not starve each other. CI unchanged.
// On CI, RIND_MAX_WORKERS (set for the real-browser slices) caps the pages one browser runs at
// once: Chromium crashed mid-run ("Browser connection was closed") with the default.
const maxWorkers = process.env["CI"]
  ? Number(process.env["RIND_MAX_WORKERS"]) || undefined
  : Number(process.env["RIND_MAX_WORKERS"]) || Math.max(1, Math.floor(availableParallelism() / 2))

// `expect.poll` waits on a condition; its timeout is only the failure deadline, and a loaded
// machine (several sessions, CI) needs more than Vitest's 1 s default.
const patient = { poll: { timeout: 5000 } }

// Compiles @rind-ui/svelte's components and fixtures (`.svelte`, `.svelte.ts`), the Vue
// examples' single-file components (`.vue`) and @rind-ui/solid's JSX (babel-preset-solid, only
// under packages/solid: every other `.tsx` keeps the React transform); inline projects inherit
// it. Other files pass through untouched.
const plugins = [
  svelte({ configFile: false, compilerOptions: { dev: true } }),
  vue(),
  solid({ include: ["packages/solid/**/*.{tsx,jsx}"], hot: false, dev: true }),
]

export default defineConfig({
  // The adapters' example tests render the site's React examples, whose tsconfig keeps JSX
  // for Next (\`preserve\`): transform it here as every package does (react-jsx).
  oxc: { jsx: { runtime: "automatic" } },
  plugins,
  resolve,
  ssr,
  // Declared up front: found mid-run on a cold cache (CI), a dependency makes Vite re-optimise
  // and reload the browser tests ("Vite unexpectedly reloaded a test"). Solid's runtime entries,
  // and React's JSX runtimes (an explicit list stops Vite discovering them in time).
  optimizeDeps: {
    include: [
      "solid-js",
      "solid-js/web",
      "solid-js/store",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  test: {
    ...(maxWorkers === undefined ? {} : { maxWorkers }),
    projects: [
      // @rind-ui/angular, compiled ahead of time by Analog's plugin, in jsdom and real browsers.
      "packages/angular/vitest.config.ts",
      "packages/angular/vitest.browser.config.ts",
      {
        resolve,
        ssr,
        test: {
          name: "node",
          expect: patient,
          environment: "node",
          include: [
            "packages/*/{src,fixtures}/**/*.test.{ts,tsx}",
            "scripts/**/*.test.ts",
            "a11y-nightly/**/*.test.ts",
            // the site's pure geometry (no DOM): components/home/docks.ts
            "apps/site/components/**/*.test.ts",
          ],
          exclude: [
            ...dom,
            "**/*.pw.test.ts",
            "**/*.browser.test.{ts,tsx}",
            "**/*.{noglobals,optout}.test.{ts,tsx}",
            "**/node_modules/**",
          ],
        },
      },
      {
        resolve,
        ssr,
        test: {
          name: "jsdom",
          expect: patient,
          environment: "jsdom",
          // Globals let Testing Library and @rind-ui/testing/setup register afterEach.
          globals: true,
          include: dom,
          exclude: angularOwn,
          setupFiles: [
            "packages/testing/src/setup.ts",
            "packages/testing/src/warning-guard.setup.ts",
          ],
        },
      },
      {
        // @rind-ui/testing/setup without Vitest globals (the consumer default): it must
        // still clean up after each test.
        resolve,
        ssr,
        test: {
          name: "setup-noglobals",
          expect: patient,
          environment: "jsdom",
          globals: false,
          include: ["packages/testing/src/setup-noglobals/*.noglobals.test.{ts,tsx}"],
          setupFiles: ["packages/testing/src/setup.ts"],
        },
      },
      {
        // The opt-out: RIND_AUTO_CLEANUP = false before the setup leaves cleanup to the test.
        resolve,
        ssr,
        test: {
          name: "setup-optout",
          expect: patient,
          environment: "jsdom",
          globals: false,
          include: ["packages/testing/src/setup-noglobals/*.optout.test.{ts,tsx}"],
          setupFiles: [
            "packages/testing/src/setup-noglobals/opt-out.setup.ts",
            "packages/testing/src/setup.ts",
          ],
        },
      },
      {
        resolve,
        test: {
          name: "browser",
          expect: patient,
          // `*.browser.test.*`: needs real input (vitest/browser's userEvent), browser only.
          include: [...dom, "packages/*/{src,fixtures}/**/*.browser.test.{ts,tsx}"],
          exclude: angularOwn,
          browser: browser("browser", classicScrollbars),
          retry: ciRetry,
          globals: true,
          // A no-op in real browsers; listed so that is tested.
          setupFiles: [
            "packages/testing/src/setup.ts",
            // the [rind-ui] warning guard is jsdom-only for now: in the browser project it set off
            // Chromium connection drops (docs/review-backlog.md)
          ],
        },
      },
      {
        // The shared driver scenarios through the Playwright adapter, against the site's
        // examples harness (apps/site/out; turbo builds it before tests).
        resolve,
        ssr,
        test: {
          name: "playwright",
          expect: patient,
          environment: "node",
          include: ["packages/*/fixtures/**/*.pw.test.ts"],
          // Each test launches real browsers (Firefox is slow to start under load). A deadline,
          // not a delay: a passing test still finishes as soon as its conditions hold.
          testTimeout: 30_000,
          hookTimeout: 60_000,
          retry: ciRetry,
        },
      },
    ],
  },
})
