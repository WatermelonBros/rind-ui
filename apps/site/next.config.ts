import type { NextConfig } from "next"

const config: NextConfig = {
  output: "export",
  // A build must not clobber a running dev server's cache.
  distDir: process.env["NODE_ENV"] === "development" ? ".next-dev" : ".next",
  trailingSlash: true,
  images: { unoptimized: true },
  // Workspace packages ship TypeScript sources under the @rind-ui/source condition.
  transpilePackages: ["@rind-ui/react", "@rind-ui/core", "@rind-ui/theme"],
  // The repo runs TypeScript 7; Next's checker uses the TS JS API. `pnpm typecheck` runs tsc.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}

export default config
