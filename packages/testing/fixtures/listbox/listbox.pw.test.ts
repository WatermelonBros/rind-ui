/// <reference types="node" />
// The listbox driver through the Playwright adapter, against the built Storybook.
import { createReadStream, existsSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { extname, join, normalize } from "node:path"
import { platforms } from "@rind-ui/core"
import { type Browser, chromium, type Page } from "playwright"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { createDriver, playwrightEnv, testMachine } from "../../src/index"
import { listboxIds } from "./listbox.connect"
import { listboxContract } from "./listbox.contract"
import { FRUITS } from "./listbox.fixture"
import { fromData } from "./listbox.react"

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

const pages: Page[] = []
async function open(id: string) {
  const context = await browser.newContext({ hasTouch: true })
  const page = await context.newPage()
  pages.push(page)
  await page.goto(`${base}/iframe.html?id=internal-listbox-fixture--${id}&viewMode=story`)
  await page.getByRole("listbox", { name: "Fruit" }).waitFor()
  // Storybook's a11y addon styles <body> once it initialises; wait so the baseline is settled.
  await page
    .locator("#storybook-a11y-vision-filters")
    .waitFor({ state: "attached" })
    .catch(() => {})
  return page
}
afterEach(async () => {
  for (const page of pages.splice(0)) await page.context().close()
})

describe.each(["roving", "active-descendant"] as const)(
  "listbox driver through Playwright (%s)",
  (id) => {
    it("highlights, chooses, extends a range and typeaheads by keyboard", {
      timeout: 60_000,
    }, async () => {
      const page = await open(id)
      // The stories render single selection: only the keyboard scenario needs multiple, so the
      // range step is checked on the MultipleSelection story below.
      const lb = createDriver(listboxContract, playwrightEnv(page), "Fruit").via("keyboard")
      expect(await lb.items()).toEqual(["Apple", "Banana", "Cherry", "Date", "Elderberry"])
      await lb.highlight("Cherry")
      expect(await lb.highlighted()).toBe("Cherry")
      expect(await lb.focusedItem()).toBe("Cherry")
      await lb.choose("Banana")
      expect(await lb.selected()).toEqual(["Banana"])
      await lb.typeahead("e")
      expect(await lb.highlighted()).toBe("Elderberry")
    })

    it("chooses by pointer", { timeout: 60_000 }, async () => {
      const page = await open(id)
      const lb = createDriver(listboxContract, playwrightEnv(page), "Fruit").via("pointer")
      await lb.choose("Date")
      expect(await lb.selected()).toEqual(["Date"])
    })
  },
)

it("extends a range by keyboard (multiple selection)", { timeout: 60_000 }, async () => {
  const page = await open("multiple-selection")
  const lb = createDriver(listboxContract, playwrightEnv(page), "Fruit").via("keyboard")
  await lb.choose("Banana")
  await lb.chooseRange("Banana", "Date")
  expect(await lb.selected()).toEqual(["Banana", "Cherry", "Date"])
})

it("chooses a range and toggles by pointer (multiple selection)", { timeout: 60_000 }, async () => {
  const page = await open("multiple-selection")
  const lb = createDriver(listboxContract, playwrightEnv(page), "Fruit").via("pointer")
  await lb.chooseRange("Banana", "Date")
  expect(await lb.selected()).toEqual(["Banana", "Cherry", "Date"])
  await lb.toggle("Apple")
  expect(await lb.selected()).toEqual(["Apple", "Banana", "Cherry", "Date"])
  await lb.toggle("Apple")
  expect(await lb.selected()).toEqual(["Banana", "Cherry", "Date"])
})

describe("testMachine through Playwright", () => {
  const initial = fromData(FRUITS)
  testMachine(listboxContract, {
    test: (name, fn) => it(name, { timeout: 60_000 }, () => fn()),
    setup: () => open("multiple-selection"),
    target: (page) => page,
    anchor: ["Fruit"],
    props: {
      collection: initial,
      ids: listboxIds("oracle"),
      strategy: "roving",
      selectionMode: "multiple",
    },
    modalities: ["pointer", "keyboard"],
    // The page runs on the host: the `mod` key the oracle presses must match its platform.
    platforms: [process.platform === "darwin" ? platforms.apple : platforms.linux],
  })
})
