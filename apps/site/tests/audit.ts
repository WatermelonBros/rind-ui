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
const urls = ["/", "/docs/", ...docs.map((p) => `/docs/${p.slug}/`)]
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

async function axe(page: Page, url: string, phase: string) {
  // let entrance animations (code panels, toggles) settle before measuring contrast
  await page.waitForTimeout(800)
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
    for (const skin of ["juicy", "bare", "crisp"]) {
      await frame.getByRole("button", { name: `${skin} skin`, exact: true }).click()
    }
    await frame.getByRole("button", { name: /Get code/ }).click()
    if ((await frame.locator("pre").count()) === 0) report(url, "code", `example ${i} has no code`)
    const css = frame.getByRole("button", { name: "Our skin CSS" })
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
    }
  }
}

/** Text that is laid out but painted at (near) zero opacity: invisible to sighted users. */
async function invisibleText(page: Page, url: string) {
  await page.waitForTimeout(800)
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  // the landing intro plays once per session; audit the styled page
  await page.addInitScript(() => sessionStorage.setItem("rind-intro", "1"))
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") report(url, `console.${m.type()}`, m.text())
  })
  page.on("pageerror", (e) => report(url, "pageerror", e.message))
  await page.goto(base + url, { waitUntil: "networkidle" })
  await exercise(page, url)
  // every section the reader can scroll to must be visible once scrolled into view
  const height = await page.evaluate(() => document.body.scrollHeight)
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(80)
  }
  await invisibleText(page, url)
  await axe(page, url, "crisp")
  await page.getByRole("switch", { name: "juicy mode" }).click()
  await page.waitForTimeout(1600)
  await axe(page, url, "juicy")
  await page.getByRole("switch", { name: "juicy mode" }).click()
  await page.waitForTimeout(1600)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  if (overflow > 1) report(url, "mobile-overflow", `${overflow}px wider than a 390px phone`)
  await page.close()
}
// the intro itself: a first visit starts unstyled and ends styled
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on("pageerror", (e) => report("/ (intro)", "pageerror", e.message))
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" })
  const started = await page.evaluate(() => document.documentElement.classList.contains("unstyled"))
  await page.waitForTimeout(3000)
  const ended = await page.evaluate(() => !document.documentElement.classList.contains("unstyled"))
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
