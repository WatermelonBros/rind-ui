/// <reference types="node" />
// File Upload through the Playwright adapter (add-file-upload 6.1): the chooser (the Trigger
// opens a real `filechooser`), drops and drags through a DataTransfer, a paste, the form
// carrier holding exactly the held files, and reset.
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Browser, chromium, type Page } from "playwright"
import { rolldown } from "rolldown"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { getFileUpload } from "../../src/index"

const here = import.meta.dirname
const themeSrc = join(here, "../../../theme/src")

function themeCss(file = join(themeSrc, "index.css")): string {
  return readFileSync(file, "utf8").replace(/@import\s+"(.+?)";/g, (_, path: string) =>
    path.includes("fonts") ? "" : themeCss(join(dirname(file), path)),
  )
}

let browser: Browser
let html = ""

beforeAll(async () => {
  const bundle = await rolldown({
    input: join(here, "app.tsx"),
    platform: "browser",
    resolve: { conditionNames: ["@rind-ui/source", "browser", "import", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"development"' } },
    logLevel: "silent",
  })
  const { output } = await bundle.generate({ format: "iife" })
  const script = output[0].code.replaceAll("</script", "<\\/script")
  html = `<!doctype html><html lang="en"><head><style>${themeCss()}</style></head><body><div id="root"></div><script>${script}</script></body></html>`
  browser = await chromium.launch()
}, 120_000)

afterAll(async () => {
  await browser?.close()
})

const pages: Page[] = []
afterEach(async () => {
  for (const p of pages.splice(0)) await p.context().close()
})

async function open() {
  const page = await (await browser.newContext()).newPage()
  pages.push(page)
  await page.setContent(html)
  await page.getByRole("button", { name: /Choose file/ }).waitFor()
  return page
}

const spec = (name: string, type = "text/plain") => ({ name, type, content: "hello" })
const inputNames = (page: Page) =>
  page
    .locator('[data-part="hidden-input"]')
    .evaluate((el) => Array.from((el as HTMLInputElement).files ?? []).map((f) => f.name))

describe("file-upload driver through Playwright", () => {
  it("the Trigger opens a real file chooser", { timeout: 60_000 }, async () => {
    const page = await open()
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: /Choose file/ }).click(),
    ])
    expect(chooser.isMultiple()).toBe(true)
    await chooser.setFiles([{ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("x") }])
    expect(await getFileUpload(page).files()).toEqual(["a.txt"])
  })

  it("choose, drop, drag and paste; the input holds exactly the files", {
    timeout: 60_000,
  }, async () => {
    const page = await open()
    const d = getFileUpload(page, { name: /Choose file/ })
    await d.choose([spec("a.txt")])
    await d.dragEnter()
    expect(await d.isDragging()).toBe(true)
    await d.dragLeave()
    expect(await d.isDragging()).toBe(false)
    await d.drop([spec("b.txt")])
    await d.paste([spec("c.png", "image/png")])
    expect(await d.files()).toEqual(["a.txt", "b.txt", "c.png"])
    await d.remove("b.txt")
    expect(await inputNames(page)).toEqual(["a.txt", "c.png"])
    await d.resetForm()
    expect(await d.files()).toEqual([])
    expect(await inputNames(page)).toEqual([])
  })
})
