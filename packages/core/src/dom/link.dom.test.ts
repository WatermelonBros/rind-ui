// The temporary-anchor routine, the browser-handled rules and the quirk repros of
// link-navigation, against real events (jsdom and browsers).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PressEvent } from "../a11y/events"
import { domEnvironment } from "../env/dom-environment"
import type { Router } from "../env/router"
import {
  activateLink,
  type LinkActivation,
  type LinkEnv,
  linkProps,
  openLink,
  shouldBrowserHandle,
  warnInteractiveContent,
} from "./link"
import { platforms } from "./platform"

let host: HTMLElement
const cleanups: (() => void)[] = []

// The browser would navigate (or open a tab) after the handlers ran: cancel it, last.
function cancelNavigation() {
  const capture = (e: Event) => {
    const a = e.target as HTMLAnchorElement
    a.addEventListener("click", (c) => c.preventDefault(), { once: true })
  }
  window.addEventListener("click", capture, true)
  cleanups.push(() => window.removeEventListener("click", capture, true))
}

beforeEach(() => {
  document.body.innerHTML = '<div id="host"><span>row</span></div>'
  host = document.getElementById("host") as HTMLElement
  cancelNavigation()
})
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
  vi.restoreAllMocks()
})

const noMods = { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }
const press = (init: Partial<typeof noMods> = {}): PressEvent => ({
  type: "PRESS",
  modality: "keyboard",
  pointerType: "keyboard",
  ...noMods,
  ...init,
})
function envWith(platform = domEnvironment().platform) {
  const navigate = vi.fn()
  const router: Router = { navigate }
  const base = domEnvironment({ platform })
  const env: LinkEnv = { platform, modality: base.modality, router }
  return { env, navigate }
}

describe("talkback-unfocusable-link (react-spectrum#3998)", () => {
  it("a disabled link has tabindex -1, is out of the Tab order and still takes focus()", () => {
    const { env } = envWith()
    const p = linkProps({ tag: "a", href: "/a", disabled: true }, env)
    const a = document.createElement("a")
    a.setAttribute("tabindex", String(p["tabindex"]))
    a.setAttribute("role", String(p["role"]))
    a.textContent = "Off"
    document.body.append(a)
    expect(a.getAttribute("tabindex")).toBe("-1")
    expect(a.tabIndex).toBe(-1) // Tab (tabindex >= 0) skips it
    a.focus()
    expect(document.activeElement).toBe(a)
  })

  it("is on whatever the platform", () => {
    for (const platform of Object.values(platforms)) {
      const p = linkProps({ tag: "a", href: "/a", disabled: true }, envWith(platform).env)
      expect(p["tabindex"]).toBe(-1)
    }
  })
})

describe("webkit-synthetic-click-modifiers", () => {
  const active = platforms.apple // webkit + mac
  const inactive = platforms.windows
  const attrs = { href: "/a" }

  for (const [label, platform] of [
    ["active", active],
    ["inactive", inactive],
  ] as const) {
    it(`openLink with metaKey clicks the temporary anchor carrying metaKey (${label}, every engine)`, () => {
      const clicks: MouseEvent[] = []
      openLink(host, attrs, { ...noMods, metaKey: true }, { platform }, (e) => clicks.push(e))
      expect(clicks).toHaveLength(1)
      expect(clicks[0]?.metaKey).toBe(true)
      expect(clicks[0]?.ctrlKey).toBe(false)
    })

    it(`carries each modifier on its own (${label})`, () => {
      for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
        const clicks: MouseEvent[] = []
        openLink(host, attrs, { ...noMods, [key]: true }, { platform }, (e) => clicks.push(e))
        expect(clicks).toHaveLength(1)
        expect(clicks[0]?.[key]).toBe(true)
      }
    })
  }

  it("dispatches a keydown Enter on the anchor only where the quirk is active", () => {
    const keydowns = (platform: typeof active) => {
      const seen: KeyboardEvent[] = []
      const append = host.append.bind(host)
      vi.spyOn(host, "append").mockImplementation((...nodes) => {
        for (const n of nodes) {
          if (typeof n !== "string")
            n.addEventListener("keydown", (e) => seen.push(e as KeyboardEvent))
        }
        append(...nodes)
      })
      openLink(host, attrs, { ...noMods, metaKey: true }, { platform }, () => {})
      vi.restoreAllMocks()
      return seen
    }
    const on = keydowns(active)
    expect(on).toHaveLength(1)
    expect(on[0]?.key).toBe("Enter")
    expect(on[0]?.metaKey).toBe(true)
    expect(keydowns(inactive)).toHaveLength(0)
  })

  it("no keydown without modifiers, even where the quirk is active", () => {
    const seen: Event[] = []
    const append = host.append.bind(host)
    vi.spyOn(host, "append").mockImplementation((...nodes) => {
      for (const n of nodes)
        if (typeof n !== "string") n.addEventListener("keydown", (e) => seen.push(e))
      append(...nodes)
    })
    openLink(host, attrs, noMods, { platform: active }, () => {})
    expect(seen).toHaveLength(0)
  })
})

describe("openLink and activateLink", () => {
  it("removes the temporary anchor afterwards", () => {
    const before = host.childElementCount
    openLink(host, { href: "/a" }, noMods, { platform: platforms.linux }, () => {})
    expect(host.childElementCount).toBe(before)
    expect(host.querySelector("a")).toBeNull()
  })

  it("the click never reaches the host's listeners", () => {
    const hostClick = vi.fn()
    host.addEventListener("click", hostClick)
    document.addEventListener("click", hostClick)
    const { env } = envWith()
    activateLink({ tag: "div", href: "/a" }, host, press(), env)
    activateLink({ tag: "div", href: "/a" }, host, press({ metaKey: true }), env)
    document.removeEventListener("click", hostClick)
    expect(hostClick).not.toHaveBeenCalled()
  })

  it("is hidden from the accessibility tree while it exists", () => {
    let hidden: string | null = null
    openLink(host, { href: "/a" }, noMods, { platform: platforms.linux }, (_e, a) => {
      hidden = a.getAttribute("aria-hidden")
    })
    expect(hidden).toBe("true")
  })

  it("same-tab without modifiers: onActivate once, router navigates once with the given href", () => {
    const { env, navigate } = envWith()
    const onActivate = vi.fn<(d: LinkActivation) => void>()
    activateLink(
      { tag: "div", href: "/a", routerOptions: undefined, onActivate },
      host,
      press(),
      env,
    )
    expect(onActivate).toHaveBeenCalledOnce()
    expect(onActivate).toHaveBeenCalledWith({
      href: "/a",
      modality: "keyboard",
      disposition: "same-tab",
    })
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/a", undefined)
  })

  it("elsewhere with Meta: onActivate once, router untouched", () => {
    const { env, navigate } = envWith()
    const onActivate = vi.fn<(d: LinkActivation) => void>()
    activateLink({ tag: "div", href: "/a", onActivate }, host, press({ metaKey: true }), env)
    expect(onActivate).toHaveBeenCalledOnce()
    expect(onActivate.mock.calls[0]?.[0].disposition).toBe("elsewhere")
    expect(navigate).not.toHaveBeenCalled()
  })

  it("elsewhere for target=_blank and download; same-tab for target=_self", () => {
    const { env } = envWith()
    const dispositions = (extra: object) => {
      const onActivate = vi.fn<(d: LinkActivation) => void>()
      activateLink({ tag: "div", href: "/a", onActivate, ...extra }, host, press(), env)
      return onActivate.mock.calls.map((c) => c[0].disposition)
    }
    expect(dispositions({ target: "_blank" })).toEqual(["elsewhere"])
    expect(dispositions({ download: true })).toEqual(["elsewhere"])
    expect(dispositions({ target: "_self" })).toEqual(["same-tab"])
  })

  it("does nothing when disabled or without href", () => {
    const { env, navigate } = envWith()
    const onActivate = vi.fn()
    activateLink({ tag: "div", href: "/a", disabled: true, onActivate }, host, press(), env)
    activateLink({ tag: "div", onActivate }, host, press(), env)
    expect(onActivate).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(host.childElementCount).toBe(1)
  })

  it("a part with its own role keeps it (row with a link)", () => {
    host.setAttribute("role", "row")
    host.tabIndex = 0
    const { env } = envWith()
    activateLink({ tag: "div", href: "/a" }, host, press({ metaKey: true }), env)
    expect(host.getAttribute("role")).toBe("row")
    expect(host.getAttribute("tabindex")).toBe("0")
  })

  it("resolves the href through the router mapping for the anchor, navigates with the raw one", () => {
    const navigate = vi.fn()
    const base = domEnvironment()
    const env: LinkEnv = {
      platform: base.platform,
      modality: base.modality,
      router: { navigate, href: (h) => `/base${h}` },
    }
    let seen: string | null = null
    host.addEventListener("click", () => {})
    const append = host.append.bind(host)
    vi.spyOn(host, "append").mockImplementation((...nodes) => {
      for (const n of nodes) if (typeof n !== "string") seen = (n as Element).getAttribute("href")
      append(...nodes)
    })
    activateLink({ tag: "div", href: "/a" }, host, press(), env)
    expect(seen).toBe("/base/a")
    expect(navigate).toHaveBeenCalledWith("/a", undefined)
  })
})

describe("shouldBrowserHandle", () => {
  const anchor = (attrs: Record<string, string> = {}) => {
    const a = document.createElement("a")
    a.setAttribute("href", "/a")
    for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v)
    return a
  }
  const click = (init: Partial<typeof noMods & { button: number }> = {}) => ({
    button: 0,
    ...noMods,
    ...init,
  })
  const handle = (a: Element, init = {}) => shouldBrowserHandle(a, click(init), document)

  it("a plain primary click on a same-origin link is ours", () => {
    expect(handle(anchor())).toBe(false)
  })
  it.each([
    ["button 1", { button: 1 }],
    ["button 2", { button: 2 }],
    ["metaKey", { metaKey: true }],
    ["ctrlKey", { ctrlKey: true }],
    ["shiftKey", { shiftKey: true }],
    ["altKey", { altKey: true }],
  ])("%s is the browser's", (_n, init) => {
    expect(handle(anchor(), init)).toBe(true)
  })
  it.each([
    ["_blank", true],
    ["_top", true],
    ["named", true],
    ["_self", false],
    ["", false],
  ])("target %j -> %s", (target, expected) => {
    expect(handle(anchor({ target }))).toBe(expected)
  })
  it("download is the browser's", () => {
    expect(handle(anchor({ download: "" }))).toBe(true)
  })
  it("reads target as an attribute, not as a property", () => {
    const a = anchor()
    // The property is "" without the attribute: both mean no target.
    expect(a.target).toBe("")
    expect(handle(a)).toBe(false)
  })
  it("cross-origin is the browser's, same-origin absolute is ours", () => {
    expect(handle(anchor({ href: "https://other.example/x" }))).toBe(true)
    expect(handle(anchor({ href: `${location.origin}/x` }))).toBe(false)
    expect(handle(anchor({ href: "//other.example/x" }))).toBe(true)
  })
  it("no href is the browser's", () => {
    const a = anchor()
    a.removeAttribute("href")
    expect(handle(a)).toBe(true)
  })
})

describe("warnInteractiveContent", () => {
  it("warns once naming the nested element and the part", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    host.innerHTML = "<span>x</span><button>Inner</button>"
    warnInteractiveContent(host, "link")
    warnInteractiveContent(host, "link")
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toMatch(/link.*<button>/)
  })
  it("is silent for plain content", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    host.innerHTML = "<span>x</span><svg></svg>"
    warnInteractiveContent(host, "link")
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("Activation Routine For Parts With Their Own Role", () => {
  it("Row with a link keeps its role", () => {
    host.setAttribute("role", "row")
    host.tabIndex = -1
    const { env, navigate } = envWith()
    const onActivate = vi.fn<(d: LinkActivation) => void>()
    const opened: string[] = []
    const record = (e: Event) => {
      const a = e.target as HTMLAnchorElement
      if (a.tagName === "A")
        opened.push(`${a.getAttribute("href")} meta=${(e as MouseEvent).metaKey}`)
    }
    window.addEventListener("click", record, true)
    cleanups.push(() => window.removeEventListener("click", record, true))
    activateLink({ tag: "div", href: "/a", onActivate }, host, press({ metaKey: true }), env)
    expect(opened).toEqual(["/a meta=true"])
    expect(host.getAttribute("role")).toBe("row")
    expect(host.getAttribute("tabindex")).toBe("-1")
    expect(onActivate).toHaveBeenCalledExactlyOnceWith({
      href: "/a",
      modality: "keyboard",
      disposition: "elsewhere",
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it("Fallback uses the same routine: a div's props carry role link and activate through it", () => {
    const { env } = envWith()
    const p = linkProps({ tag: "div", href: "/a" }, env)
    expect(p["role"]).toBe("link")
    expect(p["tabindex"]).toBe(0)
    // The fallback's click handler does nothing itself: activation is activateLink's.
    expect(p["href"]).toBeUndefined()
  })
})
