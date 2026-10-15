// Nightly real screen-reader runs (non-blocking): VoiceOver + WebKit on macOS, NVDA + Chrome
// on Windows, over the built Storybook. Run by .github/workflows/a11y-nightly.yml.
import { screenReaderConfig } from "@guidepup/playwright"
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  ...screenReaderConfig,
  testDir: ".",
  reporter: [["list"], ["json", { outputFile: "results.json" }]],
  timeout: 5 * 60 * 1000,
  retries: 1,
  use: { baseURL: "http://localhost:6007" },
  webServer: {
    command: "node ../scripts/serve-static.mjs ../apps/storybook/storybook-static 6007",
    url: "http://localhost:6007/index.json",
    reuseExistingServer: true,
  },
  projects: [
    {
      // Playwright's WebKit build (Playwright cannot drive Safari itself).
      name: "voiceover-webkit",
      testMatch: /\.voiceover\.spec\.ts$/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "nvda-chrome",
      testMatch: /\.nvda\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
})
