/// <reference types="node" />
// Every site example, as Storybook's test project checked every story (retire-storybook §2):
// axe with no stylesheet and with both theme presets, light and dark, in three engines; an
// ARIA snapshot per state example, keyed <slug>--<example>; and a state example for every
// state of every component contract.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as core from "@rind-ui/core"
import axe from "axe-core"
import * as pw from "playwright"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { missingAriaLines } from "../src/index"
import { anchoredContract } from "./anchored/anchored.contract"
import { streamContract } from "./announce/announce.contract"
import { disclosureContract } from "./disclosure/disclosure.contract"
import {
  type ExampleEntry,
  examplesIndex,
  exampleUrl,
  type SiteServer,
  type Skin,
  serveSite,
  waitHydrated,
} from "./harness"
import { layerContract } from "./layer/layer.contract"
import { listboxContract } from "./listbox/listbox.contract"
import { counterContract, toggleContract } from "./press/press.contract"

let site: SiteServer
beforeAll(async () => {
  site = await serveSite()
}, 60_000)
afterAll(() => site?.close())

const index = examplesIndex()
// All three by default; CI splits the playwright slice per engine with RIND_BROWSERS.
const engines = [pw.chromium, pw.firefox, pw.webkit].filter((e) =>
  (process.env["RIND_BROWSERS"] ?? "chromium,firefox,webkit").split(",").includes(e.name()),
)
const skins: readonly Skin[] = ["none", "theme-calm", "theme-crisp"]
const schemes = ["light", "dark"] as const
/** Waits for `n` animation frames of the page: work it scheduled has run (no elapsed time). */
async function frames(page: pw.Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())))
  }
}

/** Pages loaded at once per engine. */
const CONCURRENCY = 4
const RECYCLE = 50

const hydrated = waitHydrated

/** Runs `job` over `items` with at most CONCURRENCY pages of one browser. */
async function pool<T>(
  browser: pw.Browser,
  items: readonly T[],
  job: (page: pw.Page, item: T) => Promise<void>,
) {
  let next = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      // A fresh context every RECYCLE pages: one page reused for ~2000 navigations grows
      // Firefox's memory until the CI runner is killed.
      let context = await browser.newContext()
      let page = await context.newPage()
      for (let done = 0; next < items.length; done++) {
        if (done > 0 && done % RECYCLE === 0) {
          await context.close()
          context = await browser.newContext()
          page = await context.newPage()
          // Another worker may have taken the last items while this one recycled.
          if (next >= items.length) break
        }
        const item = items[next++] as T // bounded: checked just above, no await in between
        await job(page, item)
      }
      await context.close()
    }),
  )
}

describe("axe on the theme pages", () => {
  // Storybook's Tokens, Contrast report and Showcase stories, now site pages: every brand
  // the site ships samples for, both schemes, three engines (full pages: every rule).
  const brands = [undefined, "calm", "crisp", "sample-yellow", "sample-white"]
  const pages = ["tokens", "contrast", "showcase"].flatMap((page) =>
    brands.flatMap((brand) =>
      schemes.map((scheme) => ({
        name: `${page} ${brand ?? "default"} ${scheme}`,
        path: `/theme/${page}/?${brand ? `brand=${brand}&` : ""}scheme=${scheme}`,
      })),
    ),
  )
  for (const engine of engines) {
    it(engine.name(), { timeout: 300_000 }, async () => {
      const browser = await engine.launch()
      const failures: string[] = []
      try {
        await pool(browser, pages, async (page, p) => {
          await page.goto(site.base + p.path)
          await page.waitForLoadState("load")
          await frames(page, 2)
          await page.addScriptTag({ content: axe.source })
          const violations = await page.evaluate(async () => {
            const result = await window.axe.run(document)
            return result.violations.map(
              (v) => `${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
            )
          })
          if (violations.length > 0) failures.push(`${p.name}: ${violations.join("; ")}`)
        })
      } finally {
        await browser.close()
      }
      expect(failures).toEqual([])
    })
  }
})

describe("axe on every example", () => {
  // No stylesheet has no dark scheme: the browser's own dark defaults (blue links on a dark
  // canvas) are not the component's colours.
  const runs = index.flatMap((e) =>
    skins.flatMap((skin) =>
      (skin === "none" ? (["light"] as const) : schemes).map((scheme) => ({ e, skin, scheme })),
    ),
  )
  for (const engine of engines) {
    // About 2000 page loads per engine: Firefox on a CI runner needs over half an hour.
    it(engine.name(), { timeout: 2_700_000 }, async () => {
      const browser = await engine.launch()
      const failures: string[] = []
      try {
        await pool(browser, runs, async (page, { e, skin, scheme }) => {
          await page.goto(exampleUrl(site.base, e.slug, e.example, { skin, scheme }))
          await hydrated(page)
          // Effects that open layers on mount settle before the scan.
          await frames(page, 2)
          await page.addScriptTag({ content: axe.source })
          const scan = () =>
            page.evaluate(
              async (disabled) => {
                // An example is a fragment inside the harness's <main>, not a page: page-level
                // rules do not apply (Storybook scanned the story root only).
                const page = [
                  "page-has-heading-one",
                  "region",
                  "landmark-main-is-top-level",
                  "landmark-one-main",
                  "landmark-no-duplicate-main",
                  "landmark-unique",
                ]
                const rules = Object.fromEntries(
                  [...disabled, ...page].map((id) => [id, { enabled: false }]),
                )
                const result = await window.axe.run(document, { rules })
                return result.violations.map(
                  (v) => `${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
                )
              },
              [
                ...e.axeDisable,
                // WebKitGTK (Linux) paints unstyled native buttons in the dark scheme with its
                // own low-contrast colours; macOS WebKit and the other engines check them.
                ...(engine === pw.webkit && scheme === "dark" && process.platform === "linux"
                  ? ["color-contrast"]
                  : []),
              ],
            )
          let violations = await scan()
          // A name or a title registered by an effect after hydration (late under load):
          // scan again on the next frames, up to a deadline.
          const until = Date.now() + 3000
          while (violations.length > 0 && Date.now() < until) {
            await frames(page, 2)
            violations = await scan()
          }
          if (violations.length > 0) {
            failures.push(`${e.slug}/${e.example} ${skin} ${scheme}: ${violations.join("; ")}`)
          }
        })
      } finally {
        await browser.close()
      }
      const report = process.env["RIND_AXE_REPORT"]
      if (report) writeFileSync(`${report}.${engine.name()}.txt`, failures.join("\n"))
      // A summary per rule first: a long list is truncated in the report.
      const byRule: Record<string, number> = {}
      for (const f of failures) {
        for (const m of f.matchAll(/(?:: |; )([a-z0-9-]+) \(/g)) {
          const rule = m[1] ?? "?"
          byRule[rule] = (byRule[rule] ?? 0) + 1
        }
      }
      expect({ byRule, failures: failures.slice(0, 30) }).toEqual({ byRule: {}, failures: [] })
    })
  }
})

/**
 * The harness renders an example inside `<main>`: its landmark level is the page's, not the
 * component's, so its children move up one level (portalled layers are already at the top).
 */
function withoutMain(snapshot: string): string {
  const out: string[] = []
  let inMain = false
  for (const line of snapshot.split("\n")) {
    if (/^- main( \[|:|$)/.test(line)) {
      inMain = true
      // Text only, inline ("- main: Saving is paused"): the example's text, kept.
      const inline = /^- main: (.+)$/.exec(line)
      if (inline) out.push(`- text: ${inline[1]}`)
      continue
    }
    if (inMain && line.startsWith("  ")) out.push(line.slice(2))
    else {
      inMain = false
      out.push(line)
    }
  }
  return out.join("\n")
}
/** Next's route announcer (an empty alert) is the harness's, not the example's. */
const withoutNoise = (snapshot: string) =>
  snapshot
    .split("\n")
    .filter((l) => l !== "- alert")
    .join("\n")
const ariaOf = async (page: pw.Page) => withoutMain(await page.locator("body").ariaSnapshot())

describe("ARIA snapshot per state example", () => {
  const dir = join(import.meta.dirname, "__aria__")
  // Every state example needs one; any other example with a snapshot (a docs page shows it)
  // is checked too.
  const stateExamples = index.filter(
    (e) => e.states.length > 0 || existsSync(join(dir, `${e.slug}--${e.example}.aria.yml`)),
  )
  // Written only on request (from Chromium); a missing one fails, so CI never approves a
  // snapshot by writing it.
  // RIND_UPDATE_ARIA=1 writes the missing snapshots; =all rewrites every one.
  const update = process.env["RIND_UPDATE_ARIA"]
  for (const engine of engines) {
    it(engine.name(), { timeout: 300_000 }, async () => {
      mkdirSync(dir, { recursive: true })
      const browser = await engine.launch()
      const failures: string[] = []
      try {
        await pool(browser, stateExamples, async (page, e) => {
          await page.goto(exampleUrl(site.base, e.slug, e.example))
          await hydrated(page)
          const file = join(dir, `${e.slug}--${e.example}.aria.yml`)
          if (!update && !existsSync(file)) {
            failures.push(
              `${e.slug}--${e.example}: no ARIA snapshot (RIND_UPDATE_ARIA=1, review it)`,
            )
            return
          }
          // The whole body: overlays render in portals outside the example root. Layers
          // opened on mount may come a little later (effects run after hydration): retake until it matches or 10 s pass.
          let snapshot = await ariaOf(page)
          if (
            engine === pw.chromium &&
            (update === "all" || (update === "1" && !existsSync(file)))
          ) {
            writeFileSync(file, `${withoutNoise(snapshot)}\n`)
          }
          const want = readFileSync(file, "utf8")
          let missing = missingAriaLines(snapshot, want)
          const until = Date.now() + 10_000
          while (missing.length > 0 && Date.now() < until) {
            await frames(page, 2)
            snapshot = await ariaOf(page)
            missing = missingAriaLines(snapshot, want)
          }
          if (missing.length > 0) {
            failures.push(
              `${e.slug}--${e.example}: missing ${JSON.stringify(missing)}\n${snapshot}`,
            )
          }
        })
      } finally {
        await browser.close()
      }
      expect(failures).toEqual([])
    })
  }
})

/**
 * States a static page cannot hold: they last while an async check, an IME composition, a held
 * stepper or a drag or a hover delay runs (their ARIA is covered by the components' DOM tests). A stateless contract's single
 * `static` state is the component itself, covered by any of its examples.
 */
const TRANSIENT = new Set([
  // Focus in the grid: entered by focusing a cell.
  "calendar:focused",
  // A segment focused, or an IME composing in it: entered by focusing a segment.
  "date-field:editing",
  "date-field:composing",
  "field:validating",
  "form:validating",
  "form:awaiting-server",
  "text-field:composing",
  "slider:dragging",
  "color-area:dragging",
  "color-field:editing",
  "tooltip:opening",
  "tooltip:closing",
  "number-input:composing",
  "number-input:pressing",
  "number-input:spinning",
  "pin-input:composing",
  // Focus-driven: entered by focusing the input or a chip, or by editing a chip.
  "tags-input:typing",
  "tags-input:editing",
  // Focus inside the group (a tag focused): its ARIA is covered by the Tag Group DOM tests.
  "tag-group:focused",
  // A submenu level waiting for its hover delay (a root menu never enters it).
  "menu:opening",
  // Pointer interactions: scrollbars shown while scrolling or hovered, a thumb dragged.
  "scroll-area:engaged",
  "scroll-area:lingering",
  "scroll-area:dragging",
  // The open and close delays (a hover or focus in progress).
  "hover-card:opening",
  "hover-card:closing",
  // Hover delays and the warm window after a close (Navigation Menu).
  "navigation-menu:opening",
  "navigation-menu:closing",
  "navigation-menu:warm",
  // A toast not yet started by a region, and one exiting: both last for moments.
  "toast:idle",
  "toast:dismissed",
])

/**
 * Components merged before their site examples: the docs session's PR adds the examples and
 * removes the entry. Every component PR brings its own state examples, so this stays empty.
 */
const EXAMPLES_PENDING = new Set<string>()

describe("state examples", () => {
  it("every state of every component contract has a state example", () => {
    const shown = new Set(index.flatMap((e: ExampleEntry) => e.states))
    const isContract = (v: unknown): v is core.AnyContract =>
      typeof v === "object" && v !== null && "scope" in v && "states" in v
    const contracts: [string, core.AnyContract][] = Object.entries(
      core as Record<string, unknown>,
    ).flatMap(([name, v]) => (name.endsWith("Contract") && isContract(v) ? [[name, v]] : []))
    // The test-only fixtures' contracts too (hidden examples on the site).
    contracts.push(
      ["disclosureContract", disclosureContract],
      ["toggleContract", toggleContract],
      ["counterContract", counterContract],
      ["streamContract", streamContract],
      ["layerContract", layerContract],
      ["listboxContract", listboxContract],
      ["anchoredContract", anchoredContract],
    )
    expect(contracts.length).toBeGreaterThan(7)
    const missing = contracts.flatMap(([name, c]) =>
      Object.keys(c.states)
        .filter(() => !EXAMPLES_PENDING.has(c.scope))
        .filter((state) => state !== "static" && !TRANSIENT.has(`${c.scope}:${state}`))
        .filter((state) => !shown.has(`${c.scope}:${state}`))
        .map((state) => `${name}: ${c.scope}:${state}`),
    )
    expect(missing).toEqual([])
  })
})

declare global {
  interface Window {
    axe: typeof axe
  }
}
