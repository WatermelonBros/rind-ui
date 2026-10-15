/// <reference types="node" />
// add-theme-system 7.2 (theme-scoping "No Script For First Paint"): a server-rendered tenant,
// loaded with JavaScript disabled, and the absence of colour transitions on a scheme flip.
import { readFileSync } from "node:fs"
import type { Browser, BrowserContext, Page } from "playwright"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { defineTheme } from "../../src/builder"
import { type Engine, engines, indexCss, launch, probe } from "../harness"

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8")
const acme = defineTheme({ name: "acme", accent: "#0a7d55", radius: "1rem" })
const css = `${indexCss}\n${acme.css}`
const origin = "http://rind.test"

async function open(
  browser: Browser,
  javaScriptEnabled: boolean,
  scheme: "light" | "dark" = "light",
) {
  const context = await browser.newContext({ javaScriptEnabled, colorScheme: scheme })
  const page = await context.newPage()
  await page.route(`${origin}/**`, (route) => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill(
      path === "/theme.css"
        ? { contentType: "text/css", body: css }
        : { contentType: "text/html", body: html },
    )
  })
  await page.goto(`${origin}/`)
  return { context, page }
}

describe.each(engines)("SSR first paint (%s)", (engine: Engine) => {
  let browser: Browser
  const contexts: BrowserContext[] = []
  const pages = async (
    ...args: Parameters<typeof open> extends [Browser, ...infer R] ? R : never
  ) => {
    const o = await open(browser, ...args)
    contexts.push(o.context)
    return o.page
  }
  beforeAll(async () => {
    browser = await launch(engine)
  }, 60_000)
  afterAll(async () => {
    await Promise.all(contexts.map((c) => c.close()))
    await browser.close()
  })

  const colours = (page: Page) =>
    page.evaluate(`(() => {
      const bg = ${probe("html", "--rind-color-bg")}
      const accent = ${probe("button", "--rind-color-accent-solid")}
      const lightBg = (() => {
        const island = document.createElement("div")
        island.style.colorScheme = "light"
        document.body.append(island)
        island.innerHTML = "<span></span>"
        const el = island.firstChild
        el.style.color = "var(--rind-color-bg)"
        const v = getComputedStyle(el).color
        island.remove()
        return v
      })()
      const expectedAccent = (() => {
        const el = document.createElement("span")
        el.style.color = ${JSON.stringify(acme.tokens.colors["accent-solid"].light)}
        document.body.append(el)
        const v = getComputedStyle(el).color
        el.remove()
        return v
      })()
      const darkBg = (() => {
        const el = document.createElement("span")
        el.style.color = ${JSON.stringify(acme.tokens.colors["bg"].dark)}
        document.body.append(el)
        const v = getComputedStyle(el).color
        el.remove()
        return v
      })()
      return {
        title: document.title,
        scheme: getComputedStyle(document.documentElement).colorScheme,
        htmlBackground: getComputedStyle(document.documentElement).backgroundColor,
        bg, accent, lightBg, expectedAccent, darkBg,
      }
    })()`) as Promise<Record<string, string>>

  it("Server-rendered tenant (chakra-ui#2430, shadcn-ui#5476): JavaScript disabled, acme dark from markup and head CSS", async () => {
    // The OS says light: the markup's data-theme="dark" must win with no script.
    const page = await pages(false, "light")
    const c = await colours(page)
    expect(c["title"], "the inline script must not have run").toBe("ssr")
    expect(c["scheme"]).toBe("dark")
    expect(c["bg"]).toBe(c["darkBg"]) // acme's built dark background
    expect(c["bg"]).not.toBe(c["lightBg"])
    expect(c["htmlBackground"]).toBe(c["bg"]) // painted on the scope element itself
    expect(c["accent"]).toBe(c["expectedAccent"])
  })

  it("renders the same pixels with and without JavaScript", async () => {
    const off = await (await pages(false, "light")).screenshot()
    const on = await (await pages(true, "light")).screenshot()
    expect(off.equals(on)).toBe(true)
  })

  it("No transition on scheme change (tailwindcss#3272)", async () => {
    const page = await pages(true, "light")
    const flipped = await page.evaluate(async () => {
      const button = document.querySelector("button") as HTMLElement
      const read = () => {
        const s = getComputedStyle(button)
        const h = getComputedStyle(document.documentElement)
        return [s.color, s.backgroundColor, s.borderTopColor, h.backgroundColor, h.color].join("|")
      }
      const before = read()
      document.documentElement.setAttribute("data-theme", "light")
      const immediately = read() // a running transition would still show the old colours
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const settled = read()
      return { before, immediately, settled, running: document.getAnimations().length }
    })
    expect(flipped.immediately).not.toBe(flipped.before)
    expect(flipped.immediately).toBe(flipped.settled)
    expect(flipped.running).toBe(0)
  })

  it("the theme declares no transition on a colour property", async () => {
    const page = await pages(true, "light")
    const offenders = await page.evaluate(() => {
      const found: string[] = []
      const walk = (rules: CSSRuleList) => {
        for (const rule of rules) {
          if ("cssRules" in rule) walk((rule as CSSGroupingRule).cssRules)
          const style = (rule as CSSStyleRule).style
          const property = style?.getPropertyValue("transition-property") ?? ""
          if (
            property &&
            property !== "none" &&
            /color|background|border|outline|fill|stroke|all/i.test(property)
          ) {
            found.push(`${(rule as CSSStyleRule).selectorText}: ${property}`)
          }
        }
      }
      for (const sheet of document.styleSheets) walk(sheet.cssRules)
      return found
    })
    expect(offenders).toEqual([])
    const durations = await page.evaluate(() =>
      ["html", "body", "main", "button"].map(
        (s) => getComputedStyle(document.querySelector(s) as Element).transitionDuration,
      ),
    )
    expect(durations.every((d) => /^0s(, 0s)*$/.test(d))).toBe(true)
  })
})
