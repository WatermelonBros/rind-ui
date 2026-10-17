/// <reference types="node" />
// The site's examples harness for Playwright tests: serves the static export (apps/site/out)
// and opens one example at `/examples/<slug>/<example>/[<skin>/]`. Storybook's place
// (retire-storybook). The theme-calm skin is what every Storybook story rendered with.
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import type { Page } from "playwright"

export const siteOut = join(import.meta.dirname, "../../../apps/site/out")

const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
}

export interface SiteServer {
  readonly base: string
  close(): void
}

/** Serves the site export on a free local port. */
export async function serveSite(): Promise<SiteServer> {
  if (!existsSync(join(siteOut, "examples/index.json"))) {
    throw new Error("Build the site first: pnpm turbo run build --filter=@rind-ui/site")
  }
  const server: Server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/"))
    let file = join(siteOut, path.endsWith("/") ? `${path}index.html` : path)
    if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`
    // A directory without the trailing slash: its index page.
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html")
    if (!file.startsWith(siteOut) || !existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
    createReadStream(file).pipe(res)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0
  return { base: `http://127.0.0.1:${port}`, close: () => server.close() }
}

export type Skin = "none" | "bare" | "crisp" | "juicy" | "theme-calm" | "theme-crisp"

/** One entry of `/examples/index.json`. */
export interface ExampleEntry {
  readonly slug: string
  readonly example: string
  readonly name: string
  readonly hidden: boolean
  /** `scope:state` the example shows (state examples). */
  readonly states: readonly string[]
  readonly axeDisable: readonly string[]
  readonly motion: "keep" | "reduce"
}

/** Every example the site exports. */
export function examplesIndex(): readonly ExampleEntry[] {
  return JSON.parse(readFileSync(join(siteOut, "examples/index.json"), "utf8")) as ExampleEntry[] // the site's own build output
}

export const exampleUrl = (
  base: string,
  slug: string,
  example: string,
  {
    skin = "theme-calm",
    scheme,
  }: { readonly skin?: Skin; readonly scheme?: "light" | "dark" } = {},
) =>
  `${base}/examples/${slug}/${example}/${skin === "none" ? "" : `${skin}/`}${scheme ? `?scheme=${scheme}` : ""}`

/**
 * The example host marks its root `data-hydrated` from an effect: effects run only once the
 * whole tree has hydrated, so nothing a test does before is lost to a not-yet-hydrated node.
 */
export const waitHydrated = (page: Page) =>
  page.locator("[data-example-root][data-hydrated]").waitFor({ state: "attached" })

/**
 * Opens an example and waits for React to hydrate it (a static page is interactive only
 * then). Default skin: theme-calm, as Storybook rendered.
 */
export async function openExample(
  page: Page,
  base: string,
  slug: string,
  example: string,
  options: { readonly skin?: Skin; readonly scheme?: "light" | "dark" } = {},
): Promise<Page> {
  await page.goto(exampleUrl(base, slug, example, options))
  await waitHydrated(page)
  return page
}
