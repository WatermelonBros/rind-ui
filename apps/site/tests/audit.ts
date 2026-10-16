// Site audit: serves the static export (out/) and walks every page in a real browser.
// On each page it exercises every live example (each skin, Get code, each code tab, every
// enabled control), toggles the site phase, runs axe in both phases and checks for console
// errors and horizontal overflow on a phone. Any finding fails the run.
// Run: pnpm --filter @rind-ui/site audit   (builds first)
import { readFileSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join } from "node:path"
import { chromium, type Page } from "playwright"

const root = join(import.meta.dirname, "..")
const outDir = join(root, "out")
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain",
}

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/")
  let file = join(outDir, path)
  try {
    if (statSync(file).isDirectory()) file = join(file, "index.html")
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
    res.end(readFileSync(file))
  } catch {
    res.writeHead(404).end("not found")
  }
})
await new Promise<void>((ok) => server.listen(0, ok))
const address = server.address()
const base = `http://localhost:${typeof address === "object" && address ? address.port : 0}`

const docs = JSON.parse(readFileSync(join(root, "content/generated/docs.json"), "utf8")) as {
  slug: string
}[]
const urls = [
  "/",
  "/docs/",
  "/404.html",
  ...docs.map((p) => `/docs/${p.slug}/`),
  ...["/theme/", "/theme/tokens/", "/theme/contrast/", "/theme/showcase/"],
]
const axeSource = readFileSync(join(root, "node_modules/axe-core/axe.min.js"), "utf8")

type Finding = { url: string; kind: string; message: string }
// Known noise, each with its reason. Anything else fails the run.
const ignored: readonly RegExp[] = [
  // Next's static export preloads every route's CSS chunk; the browser warns when a page does
  // not use one within a few seconds. Harmless, and not fixable from the site.
  /was preloaded using link preload but not used within a few seconds/,
]
const findings: Finding[] = []
const report = (url: string, kind: string, message: string) => {
  if (ignored.some((r) => r.test(message))) return
  findings.push({ url, kind, message: message.split("\n")[0]?.slice(0, 240) ?? "" })
}

/** Two animation frames: layout, observers and style changes of the last step have run. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

/** No animation or transition is running (finite ones finished, none looping), so contrast and
 * opacity are measured on the final frame. A condition with a deadline, not a delay. */
async function settled(page: Page, url: string) {
  await frames(page)
  await page
    .waitForFunction(
      () => document.getAnimations().every((a) => a.playState !== "running"),
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => report(url, "animations", "animations still running after 10 s"))
}

async function axe(page: Page, url: string, phase: string) {
  // entrance animations (code panels, toggles) must end before contrast is measured
  await settled(page, url)
  await page.addScriptTag({ content: axeSource })
  const violations = await page.evaluate(async () => {
    type Violation = { id: string; impact: string; nodes: { target: string[] }[] }
    const w = window as unknown as {
      axe: { run: (d: Document) => Promise<{ violations: Violation[] }> }
    }
    const r = await w.axe.run(document)
    return r.violations.map(
      (v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes[0]?.target}`,
    )
  })
  for (const v of violations) report(url, `axe/${phase}`, v)
}

async function exercise(page: Page, url: string) {
  const frames = page.locator("section[data-example]")
  for (let i = 0; i < (await frames.count()); i++) {
    const frame = frames.nth(i)
    // the anatomy view, with its first part inspected
    await frame.getByRole("radio", { name: "parts", exact: true }).click()
    const legend = frame.getByRole("list", { name: "Parts" }).getByRole("button")
    if (await legend.count()) await legend.first().hover()
    for (const skin of ["juicy", "bare", "crisp"]) {
      await frame.getByRole("radio", { name: skin, exact: true }).click()
    }
    await frame.getByRole("button", { name: /Get code/ }).click()
    if ((await frame.locator("pre").count()) === 0) report(url, "code", `example ${i} has no code`)
    const css = frame.getByRole("tab", { name: "Our skin CSS" })
    if (await css.count()) await css.click()
    // every enabled control of the example, once
    const controls = frame.locator(
      '[data-skin] :is(button, [role="switch"], [role="checkbox"], label, a[href^="#"]):not([disabled], [aria-disabled="true"], [data-disabled], [data-readonly])',
    )
    const visible = controls.filter({ visible: true })
    for (let k = 0; k < Math.min(await visible.count(), 12); k++) {
      await visible
        .nth(k)
        .click({ timeout: 2000 })
        .catch((e: Error) => report(url, "click", `example ${i} control ${k}: ${e.message}`))
      await closeModals(page, url)
    }
  }
}

/** A control may open a modal layer: close it (Escape, else its last button) before going on. */
async function closeModals(page: Page, url: string) {
  for (let n = 0; n < 4; n++) {
    const modal = page.locator('[aria-modal="true"]').last()
    if (!(await modal.isVisible().catch(() => false))) return
    await page.keyboard.press("Escape")
    const closed = await modal
      .waitFor({ state: "hidden", timeout: 2000 })
      .then(() => true)
      .catch(() => false)
    if (!closed) {
      await modal
        .getByRole("button")
        .last()
        .click({ timeout: 2000 })
        .catch(() => {})
      await modal.waitFor({ state: "hidden", timeout: 2000 }).catch(() => {})
    }
  }
  report(url, "modal", "a modal layer did not close with Escape or its buttons")
}

/** Text that is laid out but painted at (near) zero opacity: invisible to sighted users. */
async function invisibleText(page: Page, url: string) {
  await settled(page, url)
  const ghosts = await page.evaluate(() => {
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(
      "[data-skin] *, main p, main h1, main h2",
    )) {
      if (
        !el.childNodes.length ||
        ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())
      )
        continue
      if (el.closest("[hidden], [aria-hidden='true'], [inert]")) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      let opacity = 1
      for (let n: HTMLElement | null = el; n; n = n.parentElement)
        opacity *= Number(getComputedStyle(n).opacity)
      if (opacity < 0.3)
        out.push(`"${el.textContent?.trim().slice(0, 40)}" at opacity ${opacity.toFixed(2)}`)
    }
    return out
  })
  for (const g of ghosts) report(url, "invisible-text", g)
}

const browser = await chromium.launch()
for (const url of urls) {
  // reduced motion: every looping animation rests on its final frame, so axe never samples
  // a label mid-fade
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  })
  // the landing intro plays once per session; audit the styled page
  await page.addInitScript(() => sessionStorage.setItem("rind-intro", "1"))
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") report(url, `console.${m.type()}`, m.text())
  })
  page.on("pageerror", (e) => report(url, "pageerror", e.message))
  // a step that throws (a click that times out, a wait past its deadline) is a finding with
  // its page, not a crash that hides which page and step failed
  try {
    await page.goto(base + url, { waitUntil: "networkidle" })
    await exercise(page, url)
    // every link inside the site resolves to an exported file
    for (const href of await page.evaluate(() =>
      [...document.querySelectorAll<HTMLAnchorElement>("a[href^='/']")].map((a) => a.pathname),
    )) {
      const file = join(outDir, decodeURIComponent(href))
      let found = false
      try {
        found = statSync(file).isFile() || statSync(join(file, "index.html")).isFile()
      } catch {}
      if (!found) report(url, "broken-link", href)
    }
    // every section the reader can scroll to must be visible once scrolled into view
    const height = await page.evaluate(() => document.body.scrollHeight)
    for (let y = 0; y < height; y += 600) {
      await page.evaluate((top) => window.scrollTo(0, top), y)
      await frames(page)
    }
    await invisibleText(page, url)
    await axe(page, url, "crisp")
    // the theme pages are @rind-ui/theme's own, with no site phase
    if (!url.startsWith("/theme/")) {
      await page.getByRole("switch", { name: "juicy mode" }).click()
      await page.waitForFunction(() => document.documentElement.dataset["phase"] === "juicy")
      await axe(page, url, "juicy")
      await page.getByRole("switch", { name: "juicy mode" }).click()
      await page.waitForFunction(() => document.documentElement.dataset["phase"] === "crisp")
      await settled(page, url)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await settled(page, url)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    if (overflow > 1) report(url, "mobile-overflow", `${overflow}px wider than a 390px phone`)
  } catch (e) {
    report(url, "audit", e instanceof Error ? e.message : String(e))
  }
  await page.close()
}
// the examples harness: every example of index.json is exported in every skin and renders
// alone, with no site stylesheet on the unstyled skin
{
  type Entry = { slug: string; example: string; urls: Record<string, string> }
  const index = JSON.parse(readFileSync(join(outDir, "examples/index.json"), "utf8")) as Entry[]
  for (const u of index.flatMap((e) => Object.values(e.urls))) {
    try {
      statSync(join(outDir, u, "index.html"))
    } catch {
      report(u, "harness", "listed in index.json but not exported")
    }
  }
  const page = await browser.newPage({ reducedMotion: "reduce" })
  let at = ""
  page.on("pageerror", (e) => report(at, "pageerror", e.message))
  page.on("console", (m) => {
    if (m.type() === "error") report(at, "console.error", m.text())
  })
  for (const e of index) {
    at = e.urls["none"] ?? ""
    await page.goto(base + at)
    // the example mounts on the client; the host marks the root once its effects have run
    await page
      .waitForSelector("[data-example-root][data-hydrated]", { timeout: 10_000 })
      .catch(() => report(at, "harness", "never marked data-hydrated"))
    const { rendered, sheets } = await page.evaluate(() => ({
      rendered: (document.querySelector("[data-example-root]")?.childElementCount ?? 0) > 0,
      // the root layout's font faces are the only stylesheet besides the inline reset
      sheets: document.querySelectorAll('link[rel="stylesheet"]').length,
    }))
    if (!rendered) report(at, "harness", "the example rendered nothing")
    if (sheets > 1) report(at, "harness", `the unstyled skin loads ${sheets} stylesheets`)
  }
  await page.close()
}
// the intro itself: a first visit starts unstyled and ends styled
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on("pageerror", (e) => report("/ (intro)", "pageerror", e.message))
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" })
  const started = await page.evaluate(() => document.documentElement.classList.contains("unstyled"))
  const ended = await page
    .waitForFunction(() => !document.documentElement.classList.contains("unstyled"), undefined, {
      timeout: 10_000,
    })
    .then(() => true)
    .catch(() => false)
  if (!started) report("/ (intro)", "intro", "a first visit did not start unstyled")
  if (!ended) report("/ (intro)", "intro", "the intro never revealed the styled page")
  await page.close()
}
await browser.close()
server.close()

const grouped = new Map<string, Set<string>>()
for (const f of findings) {
  const key = `${f.kind}: ${f.message}`
  grouped.set(key, (grouped.get(key) ?? new Set()).add(f.url))
}
for (const [key, pages] of [...grouped].sort()) {
  console.log(`✗ ${key}\n    ${[...pages].slice(0, 8).join(" ")}${pages.size > 8 ? " …" : ""}`)
}
console.log(`\n${findings.length} findings on ${urls.length} pages`)
process.exit(findings.length > 0 ? 1 : 0)
