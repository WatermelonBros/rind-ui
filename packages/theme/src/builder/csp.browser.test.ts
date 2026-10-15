// theme-builder "Strict CSP": the builder's css in <style nonce> applies under
// `style-src 'nonce-abc'` and the browser reports no violation.
import { expect, it } from "vitest"
import { parseColor } from "./color"
import { defineTheme } from "./theme"

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

it("applies the theme under style-src 'nonce-abc' without a violation", async () => {
  const violations: string[] = []
  document.addEventListener("securitypolicyviolation", (e) => violations.push(e.violatedDirective))

  // The policy is set before anything is injected; a meta policy applies from insertion on.
  const meta = document.createElement("meta")
  meta.httpEquiv = "Content-Security-Policy"
  meta.content = "style-src 'nonce-abc'"
  document.head.append(meta)

  const theme = defineTheme({ name: "acme", accent: "#0a7d55" })
  const style = document.createElement("style")
  style.setAttribute("nonce", "abc")
  style.textContent = theme.css
  document.head.append(style)

  const host = document.createElement("div")
  host.setAttribute("data-rind-theme", "acme")
  // A CSP also blocks inline style attributes: the scheme comes from a rule in the nonce'd sheet.
  host.className = "scheme-light"
  document.body.append(host)
  const sheet = document.createElement("style")
  sheet.setAttribute("nonce", "abc")
  sheet.textContent =
    ".scheme-light { color-scheme: light } .probe { color: var(--rind-color-accent-solid) }"
  document.head.append(sheet)
  const probe = document.createElement("span")
  probe.className = "probe"
  host.append(probe)

  await wait(50)
  const got = parseColor(getComputedStyle(probe).color)
  const want = parseColor(theme.tokens.colors["accent-solid"].light)
  expect(got, getComputedStyle(probe).color).not.toBeNull()
  expect(want).not.toBeNull()
  if (got && want) {
    expect(Math.abs(got.l - want.l)).toBeLessThan(0.01)
    expect(Math.abs(got.c - want.c)).toBeLessThan(0.01)
  }
  expect(violations).toEqual([])

  // Control: the policy really is enforced (a style without the nonce is blocked and reported).
  const blocked = document.createElement("style")
  blocked.textContent = ".control { color: rgb(1, 2, 3) }"
  document.head.append(blocked)
  await wait(100)
  expect(violations.length).toBeGreaterThan(0)
  host.remove()
})
