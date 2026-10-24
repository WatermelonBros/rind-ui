// @rind-ui/angular's tests in real browsers (Chromium locally; CI sets RIND_BROWSERS), compiled
// as in vitest.config.ts.
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import { expect, include, shared } from "./vitest.config.ts"

const browsers = (process.env["RIND_BROWSERS"] ?? "chromium").split(",")

export default defineConfig({
  ...shared,
  test: {
    name: "angular-browser",
    root: new URL(".", import.meta.url).pathname,
    include,
    // Its own group: listed beside the root's projects, it does not share their maxWorkers.
    sequence: { groupOrder: 2 },
    // The server platform runs on Node only.
    exclude: ["**/*.ssr.dom.test.ts", "**/node_modules/**"],
    expect,
    globals: true,
    retry: process.env["CI"] ? 1 : 0,
    setupFiles: ["fixtures/setup.ts", "../testing/src/setup.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: browsers.map((name) => ({
        browser: name as "chromium" | "firefox" | "webkit",
        name: `angular-browser (${name})`,
      })),
    },
  },
})
