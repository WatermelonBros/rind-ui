/// <reference types="node" />
// add-theme-system 9.1: the published CSS built by Vite with LightningCSS, then checked in
// browsers: a scoped [data-theme="dark"] island in a light page must still get the dark tokens.
// LightningCSS lowers light-dark() for targets without it into
// `var(--lightningcss-light, …) var(--lightningcss-dark, …)`, which toggles on the scheme of
// :root only and breaks nested colour-scheme (tailwindcss#18849). The documented setup is
// targets that support light-dark() natively, so nothing is lowered; that is what runs here.
import { mkdtempSync, readdirSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Browser } from "playwright"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { type Engine, engines, launch, probe } from "../harness"

const { build } = await import("vite")

const root = new URL(".", import.meta.url).pathname
// The first versions with light-dark(): Chrome 123, Safari 17.5, Firefox 120.
const targets = { chrome: 123 << 16, safari: (17 << 16) | (5 << 8), firefox: 120 << 16 }

async function bundle(lightningcss: boolean) {
  const outDir = mkdtempSync(join(tmpdir(), "rind-vite-"))
  await build({
    root,
    logLevel: "silent",
    configFile: false,
    css: lightningcss ? { transformer: "lightningcss", lightningcss: { targets } } : {},
    build: {
      outDir,
      emptyOutDir: true,
      cssMinify: lightningcss ? "lightningcss" : "esbuild",
      // The minifier uses build.cssTarget, not css.lightningcss.targets: the same browsers.
      cssTarget: ["chrome123", "safari17.5", "firefox120"],
    },
  })
  const assets = join(outDir, "assets")
  const css = readFileSync(
    join(assets, readdirSync(assets).find((f) => f.endsWith(".css")) as string),
    "utf8",
  )
  return { outDir, css, html: readFileSync(join(outDir, "index.html"), "utf8") }
}

describe.each(engines)("Vite + LightningCSS (%s)", (engine: Engine) => {
  let browser: Browser
  beforeAll(async () => {
    browser = await launch(engine)
  }, 60_000)
  afterAll(async () => {
    await browser.close()
  })

  const measure = async (built: Awaited<ReturnType<typeof bundle>>) => {
    const page = await (await browser.newContext({ colorScheme: "light" })).newPage()
    await page.setContent(
      built.html.replace(/<link[^>]*stylesheet[^>]*>/, `<style>${built.css}</style>`),
    )
    const bg = (selector: string) =>
      page.evaluate(probe(selector, "--rind-color-bg") as string) as Promise<string>
    const text = (selector: string) =>
      page.evaluate(probe(selector, "--rind-color-text") as string) as Promise<string>
    const out = {
      page: await bg("#page"),
      island: await bg("#island"),
      tenant: await bg("#tenant"),
      pageText: await text("#page"),
      islandText: await text("#island"),
    }
    await page.context().close()
    return out
  }

  it("control: the default (esbuild) build keeps light-dark() and switches per element", async () => {
    const built = await bundle(false)
    expect(built.css).toContain("light-dark(")
    const m = await measure(built)
    expect(m.island).not.toBe(m.page)
    expect(m.islandText).not.toBe(m.pageText)
  })

  it("scoped light-dark() still switches after LightningCSS lowering (tailwindcss#18849)", async () => {
    const built = await bundle(true)
    const m = await measure(built)
    // A [data-theme="dark"] island inside a light page gets the dark tokens...
    expect(
      m.island,
      `lowered CSS: ${built.css.includes("--lightningcss") ? "uses --lightningcss-* toggles" : "no toggles"}`,
    ).not.toBe(m.page)
    expect(m.islandText).not.toBe(m.pageText)
    // ...the same ones as the scope that is dark from the start.
    expect(m.island).toBe(m.tenant)
  })
})
