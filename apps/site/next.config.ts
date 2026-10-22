import type { NextConfig } from "next"

const config: NextConfig = {
  output: "export",
  // A build must not clobber a running dev server's cache.
  distDir: process.env["NODE_ENV"] === "development" ? ".next-dev" : ".next",
  trailingSlash: true,
  images: { unoptimized: true },
  // Workspace packages ship TypeScript sources under the @rind-ui/source condition.
  transpilePackages: ["@rind-ui/react", "@rind-ui/core", "@rind-ui/theme"],
  // The packages' index re-exports every component; without this a page that uses three of
  // them shipped all of them (the landing loaded the whole library). Next rewrites each import
  // to the component's own module.
  experimental: { optimizePackageImports: ["@rind-ui/react", "@rind-ui/core"] },
  // The repo runs TypeScript 7; Next's checker uses the TS JS API. `pnpm typecheck` runs tsc.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Read workspace packages from source (their `@rind-ui/source` export), so the site never
  // depends on another package's dist being built at that moment.
  webpack(config: { resolve: { conditionNames?: string[] } }) {
    config.resolve.conditionNames = [
      "@rind-ui/source",
      ...(config.resolve.conditionNames ?? ["..."]),
    ]
    return config
  },
}

export default config
