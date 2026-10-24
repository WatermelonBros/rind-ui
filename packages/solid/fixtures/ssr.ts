// Server and client builds of one fixture, for hydration tests and server-HTML parity: Vitest
// compiles Solid's JSX for the DOM only, so the fixture (and the parts it imports) is bundled
// twice with babel-preset-solid (`ssr` and `dom`, both hydratable). Each bundle carries its own
// Solid runtime (the server build for `ssr`, the browser build for `dom`, resolved by those
// conditions) and re-exports what the test calls on it: a runtime left to Vite would resolve to
// the server build in this Node project, and hydration needs one runtime for its templates and
// `hydrate`. `@rind-ui/core` stays external and resolves like the tests.
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { rolldown } from "rolldown"
import type { Component, JSX } from "solid-js"
import { solidPlugin } from "../scripts/solid-plugin"

const here = dirname(fileURLToPath(import.meta.url))
// Outside node_modules, so Vite transforms the bundle and resolves its imports like the tests.
const out = join(here, "../.ssr")
/** What a built fixture exports: its `App` and the runtime functions for its target. */
export interface ServerBundle {
  readonly App: Component
  readonly createComponent: (c: Component, props: Record<string, never>) => JSX.Element
  readonly renderToString: (fn: () => JSX.Element) => string
  /** The `<script>` a server page carries before the markup (Solid's hydration bootstrap). */
  readonly generateHydrationScript: () => string
}
export interface ClientBundle {
  readonly App: Component
  readonly createComponent: (c: Component, props: Record<string, never>) => JSX.Element
  readonly hydrate: (fn: () => JSX.Element, node: Element) => () => void
}

/** The fixture's `App` built for `generate`, written beside the package and imported. */
export async function build(fixture: string, generate: "ssr"): Promise<ServerBundle>
export async function build(fixture: string, generate: "dom"): Promise<ClientBundle>
export async function build(fixture: string, generate: "ssr" | "dom") {
  const entry = `export { App } from ${JSON.stringify(join(here, fixture))}
export { createComponent, ${generate === "ssr" ? "renderToString, generateHydrationScript" : "hydrate"} } from "solid-js/web"`
  const bundle = await rolldown({
    input: "virtual:entry",
    external: [/^@rind-ui\/core/],
    platform: generate === "ssr" ? "node" : "browser",
    resolve: {
      conditionNames: [
        "@rind-ui/source",
        generate === "ssr" ? "node" : "browser",
        "import",
        "default",
      ],
    },
    plugins: [
      {
        name: "rind:entry",
        resolveId: (id: string) => (id === "virtual:entry" ? id : null),
        load: (id: string) => (id === "virtual:entry" ? entry : null),
      },
      solidPlugin({ generate }),
    ],
  })
  const { output } = await bundle.generate({ format: "esm" })
  const file = join(out, `${fixture.replace(/\W/g, "_")}.${generate}.${Date.now()}.mjs`)
  mkdirSync(out, { recursive: true })
  writeFileSync(file, output[0].code)
  return import(/* @vite-ignore */ file)
}

/** Runs a server bundle's hydration bootstrap in this document, as the page's script would. */
export function bootstrap(server: ServerBundle) {
  const script = /<script[^>]*>([\s\S]*)<\/script>/.exec(server.generateHydrationScript())?.[1]
  // The server's own bootstrap code, run where a page would run it.
  if (script) new Function(script)()
}

/** Solid's hydration keys are its own, not markup: removed before comparing with React. */
export const withoutHydrationKeys = (html: string) => html.replace(/ data-hk="[^"]*"/g, "")
