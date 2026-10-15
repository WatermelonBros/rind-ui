/// <reference types="node" />
// The shared driver scenario through the Playwright adapter, against the built Storybook.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { contract, setup, type } from "@rind-ui/core"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { states as accordionStates } from "../../../../apps/storybook/stories/Accordion.stories"
import { states as announceStates } from "../../../../apps/storybook/stories/AnnounceFixture.stories"
import { states as buttonStates } from "../../../../apps/storybook/stories/Button.stories"
import { states as checkboxStates } from "../../../../apps/storybook/stories/Checkbox.stories"
import { states as checkboxGroupStates } from "../../../../apps/storybook/stories/CheckboxGroup.stories"
import { states as collapsibleStates } from "../../../../apps/storybook/stories/Collapsible.stories"
import { states as disclosureStates } from "../../../../apps/storybook/stories/Disclosure.stories"
import { states as fieldStates } from "../../../../apps/storybook/stories/Field.stories"
import { states as fieldsetStates } from "../../../../apps/storybook/stories/Fieldset.stories"
import { states as formStates } from "../../../../apps/storybook/stories/Form.stories"
import { states as headingStates } from "../../../../apps/storybook/stories/Heading.stories"
import { states as labelStates } from "../../../../apps/storybook/stories/Label.stories"
import { states as layerStates } from "../../../../apps/storybook/stories/LayerFixture.stories"
import { states as linkStates } from "../../../../apps/storybook/stories/Link.stories"
import { states as pressStates } from "../../../../apps/storybook/stories/PressFixture.stories"
import { states as radioGroupStates } from "../../../../apps/storybook/stories/RadioGroup.stories"
import { states as segmentedControlStates } from "../../../../apps/storybook/stories/SegmentedControl.stories"
import { states as separatorStates } from "../../../../apps/storybook/stories/Separator.stories"
import { states as switchStates } from "../../../../apps/storybook/stories/Switch.stories"
import { states as tabsStates } from "../../../../apps/storybook/stories/Tabs.stories"
import { states as textFieldStates } from "../../../../apps/storybook/stories/TextField.stories"
import { states as toggleStates } from "../../../../apps/storybook/stories/Toggle.stories"
import { states as toggleGroupStates } from "../../../../apps/storybook/stories/ToggleGroup.stories"
import { createDriver, missingAriaLines, playwrightEnv, testMachine } from "../../src/index"
import { chromiumTree } from "../../src/playwright"
import { streamContract } from "../announce/announce.contract"
import { disclosureContract } from "./disclosure.contract"
import { disclosureScenario } from "./disclosure.scenario"

const root = join(import.meta.dirname, "../../../../apps/storybook/storybook-static")
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

let server: Server
let browser: Browser
let base = ""

beforeAll(async () => {
  if (!existsSync(root))
    throw new Error("Build Storybook first: pnpm --filter @rind-ui/storybook build")
  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/"))
    const file = join(root, path.endsWith("/") ? `${path}index.html` : path)
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
    createReadStream(file).pipe(res)
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`
  browser = await chromium.launch()
}, 60_000)

afterAll(async () => {
  await browser?.close()
  server?.close()
})

const story = (id = "closed") =>
  `${base}/iframe.html?id=foundations-disclosure-fixture--${id}&viewMode=story`
const pages: Page[] = []
async function open(url?: string) {
  const context = await browser.newContext({ hasTouch: true })
  const page = await context.newPage()
  pages.push(page)
  if (url) {
    await page.goto(url)
    await page.getByRole("button", { name: "Details", exact: true }).waitFor()
    // Storybook's a11y addon styles <body> and adds nodes once it initialises; wait for
    // it so the path's baseline is the settled page.
    await page
      .locator("#storybook-a11y-vision-filters")
      .waitFor({ state: "attached" })
      .catch(() => {})
  }
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe("disclosure driver through Playwright", () => {
  it("runs the shared scenario against Storybook", { timeout: 60_000 }, async () => {
    const context = await browser.newContext({ hasTouch: true })
    const page = await context.newPage()
    await page.goto(`${base}/iframe.html?id=foundations-disclosure-fixture--closed&viewMode=story`)
    await page.getByRole("button", { name: "Details", exact: true }).waitFor()
    await disclosureScenario(page)
    await context.close()
  })
})

describe("Playwright targets", () => {
  it("a FrameLocator target scopes to the frame", { timeout: 60_000 }, async () => {
    const page = await open()
    await page.setContent(`<button>Details</button><iframe src="${story()}"></iframe>`)
    const frame = page.frameLocator("iframe")
    await frame.getByRole("button", { name: "Details", exact: true }).waitFor()
    await disclosureScenario(frame)
  })

  it("a Locator target limits the anchor search to the container", {
    timeout: 60_000,
  }, async () => {
    const page = await open(story())
    await page.evaluate(() =>
      document.body.insertAdjacentHTML("afterbegin", "<button>Details</button>"),
    )
    await disclosureScenario(page.locator("#storybook-root"))
  })

  it("exists() and text anchors agree with the DOM adapter", { timeout: 60_000 }, async () => {
    const page = await open()
    await page.setContent(
      '<div data-scope="t" data-instance="a" data-part="root"><p><span>Details</span></p></div>' +
        '<div style="display:contents">c</div><div hidden="until-found">u</div>',
    )
    const env = playwrightEnv(page).create({
      scope: "t",
      anchor: { text: "Details" },
      modality: "pointer",
    })
    expect(await env.anchorCount()).toBe(1)
    expect(await env.instance()).toBe("a")
    expect(await env.find({ text: "c" }).exists()).toBe(true)
    expect(await env.find({ text: "u" }).exists()).toBe(false)
    expect(await env.focused().count()).toBe(0)
  })
})

describe("testMachine through Playwright", () => {
  testMachine(disclosureContract, {
    test: (name, fn) => it(name, { timeout: 60_000 }, () => fn()),
    setup: () => open(story()),
    target: (page) => page,
    anchor: ["Details"],
    props: { closeOnEscape: undefined, autoCloseMs: undefined },
  })
})

describe("errors during setup", () => {
  it("are reported by the first step (listeners go on before setup)", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const tests: (() => Promise<void>)[] = []
    testMachine(disclosureContract, {
      test: (_name, fn) => tests.push(() => fn(page)),
      setup: async (p: Page) => {
        await p.goto(story())
        await p.getByRole("button", { name: "Details", exact: true }).waitFor()
        await p.evaluate(() => console.error("boom during setup"))
        return p
      },
      target: (p) => p,
      anchor: ["Details"],
      props: { closeOnEscape: undefined, autoCloseMs: undefined },
      modalities: ["keyboard"],
    })
    const first = tests[0]
    await expect(first?.()).rejects.toThrow(/boom during setup/)
  })
})

describe("announcements through Playwright", () => {
  it("a streamed message: the driver's log is exactly ['Hello there']", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    await page.goto(`${base}/iframe.html?id=foundations-announce-fixture--stream&viewMode=story`)
    await page.getByRole("button", { name: "Stream", exact: true }).waitFor()
    const stream = createDriver(streamContract, page, "Stream")
    await stream.stream()
    expect((await stream.announcements()).map((a) => a.message)).toEqual(["Hello there"])
  })
})

describe("adapter inputs through Playwright", () => {
  it("a composing Enter and inert-as-hidden match the DOM adapter", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    await page.setContent('<input aria-label="Prompt"><div inert><button>Inside</button></div>')
    await page.evaluate(() => {
      const w = window as unknown as { seen: unknown[] }
      w.seen = []
      for (const type of ["keydown", "keyup"]) {
        document.querySelector("input")?.addEventListener(type, (e) => {
          const k = e as KeyboardEvent
          w.seen.push([type, k.key, k.isComposing, k.keyCode])
        })
      }
    })
    const env = playwrightEnv(page).create({
      scope: "x",
      anchor: { role: "textbox", name: "Prompt" },
      modality: "keyboard",
    })
    await env.find({ role: "textbox", name: "Prompt" }).press("Enter", { composing: true })
    expect(await page.evaluate(() => (window as unknown as { seen: unknown[] }).seen)).toEqual([
      ["keydown", "Enter", true, 229],
      ["keyup", "Enter", true, 229],
    ])
    expect(await env.find({ text: "Inside" }).exists()).toBe(false)
  })
})

describe("Chromium accessibility tree (RA#9737)", () => {
  const menuMachine = setup({
    types: type<{ props: object; events: { type: "TICK" }; env: object }>(),
  }).machine({ id: "menu", initial: "open", states: { open: { on: { TICK: {} } } } })
  const menuContract = contract("menu", {
    machine: menuMachine,
    anatomy: ["trigger", "content"],
    locate: (name: string) => ({ role: "menu", name }),
    queries: { open: async (env) => env.part("content").exists() },
    actions: {
      tick: { keyboard: (env) => env.part("content").press("Escape"), done: async () => true },
    },
    states: { open: { open: true } },
    events: { TICK: "tick" },
    traits: [],
  })
  const markup = (inert: boolean) =>
    `<div ${inert ? "inert" : ""}><button id="t" data-scope="menu" data-part="trigger" data-instance="m">Actions</button></div>` +
    '<div role="menu" tabindex="-1" aria-labelledby="t" data-focus-visible data-scope="menu" data-part="content" data-instance="m"><div role="menuitem">Copy</div></div>'

  async function run(inert: boolean) {
    const page = await open()
    const tests: (() => Promise<void>)[] = []
    testMachine(menuContract, {
      test: (_name, fn) => tests.push(() => fn(page)),
      setup: async (p: Page) => {
        await p.setContent(markup(inert))
        return p
      },
      target: (p) => p,
      anchor: ["Actions"],
      props: {},
    })
    return Promise.all(
      tests.map((t) =>
        t().then(
          () => null,
          (e: Error) => e.message,
        ),
      ),
    )
  }

  it("a menu named through an inert trigger fails in Chromium", { timeout: 60_000 }, async () => {
    const errors = await run(true)
    expect(errors.some((e) => e?.includes("chromium-tree") && e.includes("RA#9737"))).toBe(true)
  })

  it("the same menu with its trigger exposed passes", { timeout: 60_000 }, async () => {
    expect((await run(false)).filter((e) => e !== null)).toEqual([])
  })

  it("chromiumTree is unavailable in Firefox", { timeout: 60_000 }, async () => {
    const firefox = await (await import("playwright")).firefox.launch()
    const page = await firefox.newPage()
    expect(await chromiumTree(page)).toEqual({ unavailable: true })
    await firefox.close()
  })

  it("chromiumTree retries until Chromium has built the tree, and fails clearly if never", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    await page.setContent("<body></body>")
    await page.evaluate(() =>
      setTimeout(() => document.body.insertAdjacentHTML("beforeend", "<button>Late</button>"), 150),
    )
    const late = (tree: readonly { name: string }[]) => tree.some((n) => n.name === "Late")
    const tree = await chromiumTree(page, { until: late })
    expect(Array.isArray(tree) && late(tree)).toBe(true)
    await expect(
      chromiumTree(page, { until: (t) => t.some((n) => n.name === "Never"), timeout: 100 }),
    ).rejects.toThrow(/did not match within 100 ms/)
  })

  it("chromiumTree returns the tree in Chromium", { timeout: 60_000 }, async () => {
    const page = await open()
    await page.setContent("<button>Go</button>")
    const tree = await chromiumTree(page)
    expect(Array.isArray(tree) && tree.some((n) => n.role === "button" && n.name === "Go")).toBe(
      true,
    )
  })
})

describe("ARIA snapshots per state story (Chromium, Firefox, WebKit)", () => {
  const ariaDir = join(import.meta.dirname, "../../../../apps/storybook/stories/__aria__")
  // The story files' own `states` exports (the same the coverage check reads).
  const stories: Record<string, Record<string, Record<string, string>>> = {
    "./stories/Disclosure.stories.tsx": disclosureStates,
    "./stories/PressFixture.stories.tsx": pressStates,
    "./stories/AnnounceFixture.stories.tsx": announceStates,
    "./stories/LayerFixture.stories.tsx": layerStates,
    "./stories/Link.stories.tsx": linkStates,
    "./stories/Heading.stories.tsx": headingStates,
    "./stories/Separator.stories.tsx": separatorStates,
    "./stories/Button.stories.tsx": buttonStates,
    "./stories/Label.stories.tsx": labelStates,
    "./stories/Fieldset.stories.tsx": fieldsetStates,
    "./stories/Field.stories.tsx": fieldStates,
    "./stories/TextField.stories.tsx": textFieldStates,
    "./stories/Form.stories.tsx": formStates,
    "./stories/Accordion.stories.tsx": accordionStates,
    "./stories/Checkbox.stories.tsx": checkboxStates,
    "./stories/CheckboxGroup.stories.tsx": checkboxGroupStates,
    "./stories/Collapsible.stories.tsx": collapsibleStates,
    "./stories/RadioGroup.stories.tsx": radioGroupStates,
    "./stories/SegmentedControl.stories.tsx": segmentedControlStates,
    "./stories/Switch.stories.tsx": switchStates,
    "./stories/Tabs.stories.tsx": tabsStates,
    "./stories/Toggle.stories.tsx": toggleStates,
    "./stories/ToggleGroup.stories.tsx": toggleGroupStates,
  }
  it("each state story matches its ARIA snapshot in every engine", {
    timeout: 180_000,
  }, async () => {
    const { readFileSync, writeFileSync, mkdirSync } = await import("node:fs")
    const pw = await import("playwright")
    const index = JSON.parse(readFileSync(join(root, "index.json"), "utf8")) as {
      entries: Record<string, { id: string; importPath: string; exportName: string }>
    }
    const ids = Object.entries(stories).flatMap(([importPath, byScope]) =>
      Object.values(byScope).flatMap((byState) =>
        Object.values(byState).map((exportName) => {
          const entry = Object.values(index.entries).find(
            (e) => e.importPath === importPath && e.exportName === exportName,
          )
          if (!entry) throw new Error(`no story ${importPath} ${exportName}`)
          return entry.id
        }),
      ),
    )
    mkdirSync(ariaDir, { recursive: true })
    // Snapshots are written only on request (from Chromium); a missing one fails, so CI
    // never approves a snapshot by writing it.
    const update = process.env["RIND_UPDATE_ARIA"] === "1"
    const failures: string[] = []
    for (const engine of [pw.chromium, pw.firefox, pw.webkit]) {
      const b = engine === pw.chromium ? browser : await engine.launch()
      const page = await b.newPage()
      for (const id of ids) {
        await page.goto(`${base}/iframe.html?id=${id}&viewMode=story`)
        await page.locator("#storybook-root > *").first().waitFor()
        // The whole body: overlays render in portals outside the story root (matching is
        // partial, so Storybook's own nodes do not matter).
        const snapshot = await page.locator("body").ariaSnapshot()
        const file = join(ariaDir, `${id}.aria.yml`)
        if (update && engine === pw.chromium) writeFileSync(file, `${snapshot}\n`)
        if (!existsSync(file)) {
          failures.push(`${id}: no ARIA snapshot (run with RIND_UPDATE_ARIA=1 and review it)`)
          continue
        }
        const missing = missingAriaLines(snapshot, readFileSync(file, "utf8"))
        if (missing.length > 0) {
          failures.push(
            `${id} in ${engine.name()}: missing ${JSON.stringify(missing)}\n${snapshot}`,
          )
        }
      }
      await page.close()
      if (b !== browser) await b.close()
    }
    expect(failures).toEqual([])
  })
})

describe("theme accessibility (forced colors, reduced motion, target size)", () => {
  const { readFileSync, mkdirSync } = require("node:fs") as typeof import("node:fs")
  const themeDir = join(import.meta.dirname, "../../../theme/src")
  const themeCss = ["tokens.css", "base.css"]
    .map((f) => readFileSync(join(themeDir, f), "utf8"))
    .join("\n")
  const captures = join(import.meta.dirname, "../../../../.vitest/attachments/captures")
  mkdirSync(captures, { recursive: true })
  async function themed(html: string) {
    const page = await open()
    await page.setContent(`<div class="rind-root">${html}</div>`)
    await page.addStyleTag({ content: themeCss })
    return page
  }
  const outline = (page: Page, selector: string) =>
    page.locator(selector).evaluate((el) => {
      const s = getComputedStyle(el)
      return { style: s.outlineStyle, width: Number.parseFloat(s.outlineWidth) }
    })

  it("forced colors: the keyboard focus ring stays visible (RA#5931)", async () => {
    const page = await open(story("closed"))
    await page.emulateMedia({ forcedColors: "active" })
    await page.keyboard.press("Tab")
    const trigger = '[data-part="trigger"]'
    await expect.poll(() => page.locator(trigger).getAttribute("data-focus-visible")).toBe("")
    const ring = await outline(page, trigger)
    expect(ring.style).toBe("solid")
    expect(ring.width).toBeGreaterThanOrEqual(2)
    await page.screenshot({ path: join(captures, "disclosure-forced-colors-focus.png") })
  })

  it("pointer focus draws no ring", async () => {
    const page = await open(story("closed"))
    await page.locator('[data-part="trigger"]').click()
    expect((await outline(page, '[data-part="trigger"]')).style).toBe("none")
  })

  it("forced colors: every state has a non-colour cue; states differ by pattern (ARK#3421, RX#2993)", async () => {
    const states: Record<string, string> = {
      unchecked: 'data-state="unchecked"',
      checked: 'data-state="checked"',
      highlighted: "data-highlighted",
      selected: "data-selected",
      disabled: "data-disabled",
    }
    const page = await themed(
      Object.entries(states)
        .map(
          ([name, attr]) =>
            `<span id="${name}" data-scope="x" data-part="item" ${attr} style="display:inline-block;width:20px;height:20px">${name}</span>`,
        )
        .join(""),
    )
    await page.emulateMedia({ forcedColors: "active" })
    const pattern = (id: string) =>
      page.locator(`#${id}`).evaluate((el) => getComputedStyle(el).outlineStyle)
    const cues = Object.fromEntries(
      await Promise.all(Object.keys(states).map(async (id) => [id, await pattern(id)] as const)),
    )
    expect(cues).toEqual({
      unchecked: "none",
      checked: "double",
      highlighted: "dashed",
      selected: "double",
      disabled: "dotted",
    })
  })

  it("a 16px pressable part has a 24×24 hit area", async () => {
    const page = await themed(
      '<button data-rind-pressable aria-label="Remove" style="width:16px;height:16px;padding:0;margin:40px"></button>',
    )
    const box = await page.getByRole("button", { name: "Remove" }).boundingBox()
    if (!box) throw new Error("no box")
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    // 11px from the centre: outside the 16px box, inside the 24px area.
    for (const [x, y] of [
      [cx + 11, cy],
      [cx, cy - 11],
      [cx - 11, cy + 11],
    ] as const) {
      expect(
        await page.evaluate(
          ({ px, py }) => document.elementFromPoint(px, py)?.getAttribute("aria-label"),
          { px: x, py: y },
        ),
      ).toBe("Remove")
    }
    expect(
      await page.evaluate(({ px, py }) => document.elementFromPoint(px, py)?.tagName, {
        px: cx + 14,
        py: cy,
      }),
    ).not.toBe("BUTTON")
  })

  it("reduced motion: theme transitions run with zero duration", async () => {
    const page = await themed(
      '<div id="overlay" style="transition: opacity var(--rind-duration-normal) var(--rind-ease-out)">x</div>',
    )
    const duration = () =>
      page.locator("#overlay").evaluate((el) => getComputedStyle(el).transitionDuration)
    expect(await duration()).not.toBe("0s")
    await page.emulateMedia({ reducedMotion: "reduce" })
    expect(await duration()).toBe("0s")
    const fixture = await open(story("open"))
    await fixture.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" })
    await fixture.screenshot({
      path: join(captures, "disclosure-open-reduced-motion-forced-colors.png"),
    })
  })

  it("find-in-page: the theme leaves hidden=until-found content findable", async () => {
    const page = await themed(
      '<div hidden="until-found" id="c" data-scope="disclosure" data-part="content">Needle</div>',
    )
    expect(await page.locator("#c").evaluate((el) => getComputedStyle(el).display)).not.toBe("none")
    const reveal = await themed(
      '<div data-reveal="find-in-page" id="r" style="transition: opacity 1s">x</div>',
    )
    expect(
      await reveal.locator("#r").evaluate((el) => getComputedStyle(el).transitionProperty),
    ).toBe("none")
  })
})

describe("IME composition input (R1.7)", () => {
  it("composes に, にほ, にほん → 日本 in Chromium (DevTools protocol), Firefox and WebKit", {
    timeout: 120_000,
  }, async () => {
    const pw = await import("playwright")
    const results: Record<string, unknown> = {}
    for (const engine of [pw.chromium, pw.firefox, pw.webkit]) {
      const b = engine === pw.chromium ? browser : await engine.launch()
      const page = await b.newPage()
      await page.setContent(
        '<input aria-label="Name" data-scope="field" data-part="input" data-instance="f1">',
      )
      await page.evaluate(() => {
        const input = document.querySelector("input") as HTMLInputElement
        const log: string[] = []
        let composing = false
        let plainKeydowns = 0
        let composingKeydowns = 0
        input.addEventListener("compositionstart", () => {
          composing = true
          log.push("compositionstart")
        })
        input.addEventListener("compositionend", (e) => {
          composing = false
          log.push(`compositionend:${e.data}`)
        })
        input.addEventListener("input", (e) => {
          if ((e as InputEvent).isComposing) log.push(`input:${input.value}`)
        })
        input.addEventListener("keydown", (e) => {
          const marked = e.isComposing || e.keyCode === 229
          if (marked) composingKeydowns++
          else if (composing) plainKeydowns++
        })
        Reflect.set(globalThis, "__ime", () => ({
          log,
          value: input.value,
          plainKeydowns,
          composingKeydowns,
        }))
      })
      const env = playwrightEnv(page).create({
        scope: "field",
        anchor: { role: "textbox", name: "Name" },
        modality: "keyboard",
      })
      await env.part("input").compose(["に", "にほ", "にほん"], "日本")
      const seen = (await page.evaluate(() =>
        (Reflect.get(globalThis, "__ime") as () => unknown)(),
      )) as { composingKeydowns: number }
      // One IME key per update at least (keyCode 229 or isComposing).
      expect(seen.composingKeydowns, engine.name()).toBeGreaterThanOrEqual(3)
      results[engine.name()] = { ...seen, composingKeydowns: undefined }
      await page.close()
      if (b !== browser) await b.close()
    }
    const expected = {
      // The commit is a last composing input, as Chromium sends it natively.
      log: [
        "compositionstart",
        "input:に",
        "input:にほ",
        "input:にほん",
        "input:日本",
        "compositionend:日本",
      ],
      value: "日本",
      plainKeydowns: 0,
      composingKeydowns: undefined,
    }
    expect(results).toEqual({ chromium: expected, firefox: expected, webkit: expected })
  })
})
