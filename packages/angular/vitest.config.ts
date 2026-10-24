// @rind-ui/angular's tests: compiled ahead of time by Analog's Angular plugin (JIT cannot see
// signal inputs), with its own TypeScript (6.0, which @angular/compiler-cli requires). Listed in
// the root config's projects (this jsdom one and vitest.browser.config.ts); neither inherits the
// root's plugins.
import angular from "@analogjs/vite-plugin-angular"
import { defineConfig } from "vitest/config"

const root = new URL(".", import.meta.url).pathname

export const shared = {
  // The parity tests render @rind-ui/react (.tsx) as the root config does.
  oxc: { jsx: { runtime: "automatic" as const } },
  plugins: [angular({ tsconfig: `${root}tsconfig.spec.json`, workspaceRoot: root, jit: false })],
  resolve: { conditions: ["@rind-ui/source", "module", "browser", "default"] },
  // No "import": jsdom's require("decimal.js") would get the ESM build (as in the root config).
  ssr: { resolve: { conditions: ["@rind-ui/source", "node", "default"] } },
}

export const include = ["src/**/*.dom.test.ts", "fixtures/**/*.dom.test.ts"]
export const expect = { poll: { timeout: 5000 } }

export default defineConfig({
  ...shared,
  test: {
    name: "angular-jsdom",
    root,
    environment: "jsdom",
    globals: true,
    include,
    expect,
    setupFiles: [
      "fixtures/setup.ts",
      "../testing/src/setup.ts",
      "../testing/src/warning-guard.setup.ts",
    ],
  },
})
