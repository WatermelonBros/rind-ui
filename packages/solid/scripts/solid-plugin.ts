// Compiles @rind-ui/solid's JSX with babel-preset-solid inside Rolldown (tsdown's build and the
// hydration fixtures): oxc strips the types and keeps the JSX, then Babel turns it into Solid's
// DOM or server output. Neither oxc nor esbuild can compile Solid's JSX themselves.
import { transformAsync } from "@babel/core"
import solid from "babel-preset-solid"
import { transformSync } from "rolldown/utils"

export interface SolidPluginOptions {
  /** `dom` for the browser, `ssr` for `renderToString`. */
  readonly generate: "dom" | "ssr"
  /** Emit the hydration keys (default true): server HTML and the client that hydrates it. */
  readonly hydratable?: boolean
}

export function solidPlugin({ generate, hydratable = true }: SolidPluginOptions) {
  return {
    name: "rind:solid",
    async transform(code: string, id: string) {
      if (!/\.[jt]sx$/.test(id)) return null
      const js = transformSync(id, code, { jsx: "preserve" }).code
      const out = await transformAsync(js, {
        filename: id.replace(/\.tsx$/, ".jsx"),
        presets: [[solid, { generate, hydratable }]],
        babelrc: false,
        configFile: false,
        sourceMaps: true,
      })
      return out?.code ? { code: out.code, map: out.map ?? null, moduleType: "js" as const } : null
    },
  }
}
