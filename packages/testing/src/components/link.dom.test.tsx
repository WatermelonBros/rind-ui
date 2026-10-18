import { domEnvironment } from "@rind-ui/core"
import { Link, RouterProvider } from "@rind-ui/react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import type { ComponentPropsWithRef } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { collectDom } from "../collect"
import {
  checkGeneric,
  expectRindWarning,
  fakeRouter,
  getLink,
  interceptNativeNavigation,
  navigationLog,
  platforms,
} from "../index"

const platform = domEnvironment().platform
const MOD = platform.apple ? "Meta" : "Control"
// user-event sends no keypress (so no click) for Ctrl+Enter, only for Meta+Enter: keyboard
// new-tab tests use the Apple key so they run the same everywhere.
const appleDriver = (name: string) =>
  getLink(document.body, { name }, { platform: platforms.apple })
const driver = (name: string) => getLink(document.body, { name }, { platform })
const linkEl = (name?: string) => screen.getByRole("link", name ? { name } : {})

beforeEach(() => {
  // The driver installs it too; tests that use user-event alone need it before the first click.
  interceptNativeNavigation(window)
  navigationLog().length = 0
})

/** Mimics react-router's Link: its own onClick navigates unless the click was prevented. */
function RouterLikeLink({
  to,
  navigate,
  ...props
}: ComponentPropsWithRef<"a"> & { to: string; navigate: (to: string) => void }) {
  return (
    <a
      {...props}
      href={to}
      onClick={(e) => {
        props.onClick?.(e)
        if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault()
          navigate(to)
        }
      }}
    />
  )
}

/** Counts the clicks that reach the window, whoever handles them. */
function countClicks() {
  let n = 0
  const on = () => n++
  window.addEventListener("click", on)
  return { count: () => n, stop: () => window.removeEventListener("click", on) }
}

describe("Link smoke", () => {
  it("routes a click once, keyboard Enter once, new tab is left to the browser", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/docs">Docs</Link>
      </RouterProvider>,
    )
    const link = driver("Docs")
    await link.follow()
    expect(router.calls).toEqual([{ href: "/docs", routerOptions: undefined }])
    await link.via("keyboard").follow()
    expect(router.calls).toHaveLength(2)
    await link.followInNewTab()
    expect(router.calls).toHaveLength(2)
    await link.middleClick()
    expect(router.calls).toHaveLength(2)
    expect(screen.getByRole("link").getAttribute("href")).toBe("/docs")
  })

  it("div fallback activates once per input", async () => {
    // the broken or partial setup this test exercises logs it
    expectRindWarning(/link: rendered as <div>/)
    const router = fakeRouter({ href: (h) => `/base${h}` })
    render(
      <RouterProvider navigate={router.navigate} {...(router.href ? { href: router.href } : {})}>
        <Link href="/a" render={<div />}>
          A
        </Link>
      </RouterProvider>,
    )
    const el = screen.getByRole("link")
    expect(el.getAttribute("tabindex")).toBe("0")
    const link = driver("A")
    await link.follow()
    await link.via("keyboard").follow()
    await link.via("virtual").follow()
    expect(router.calls.map((c) => c.href)).toEqual(["/a", "/a", "/a"])
    await link.followInNewTab()
    expect(router.calls).toHaveLength(3)
  })

  it("disabled link fails follow with isDisabled", async () => {
    render(
      <Link href="/a" disabled>
        Off
      </Link>,
    )
    const el = screen.getByRole("link")
    expect(el.hasAttribute("href")).toBe(false)
    expect(el.getAttribute("tabindex")).toBe("-1")
    await expect(driver("Off").follow()).rejects.toThrow(
      /link\.follow \[pointer\].*"isDisabled":true/,
    )
  })
})

describe("Native Anchor By Default", () => {
  it("Enter reaches the router link's own onClick: one navigation, provider router untouched (react-spectrum#9868, #2525)", async () => {
    const router = fakeRouter()
    const navigate = vi.fn()
    const clicks = countClicks()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/docs" render={<RouterLikeLink to="/docs" navigate={navigate} />}>
          Docs
        </Link>
      </RouterProvider>,
    )
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(linkEl())
    await user.keyboard("{Enter}")
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/docs")
    expect(router.calls).toHaveLength(0)
    // No loop (mui/base-ui#5432): one click event, one navigation, nothing left for the browser.
    expect(clicks.count()).toBe(1)
    expect(navigationLog()).toEqual([])
    clicks.stop()
  })

  it("a pointer click on a rendered router link is not routed twice (react-spectrum#2525)", async () => {
    const router = fakeRouter()
    const navigate = vi.fn()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/docs" render={<RouterLikeLink to="/docs" navigate={navigate} />}>
          Docs
        </Link>
      </RouterProvider>,
    )
    await driver("Docs")
      .follow()
      .catch(() => {})
    await userEvent.setup().click(linkEl())
    expect(navigate).toHaveBeenCalled()
    expect(router.calls).toHaveLength(0)
    expect(navigationLog()).toEqual([])
  })

  it("an enabled anchor has no tabindex and no role (react-spectrum#9631)", () => {
    render(<Link href="/a">A</Link>)
    const el = linkEl()
    expect(el.tagName).toBe("A")
    expect(el.hasAttribute("tabindex")).toBe(false)
    expect(el.hasAttribute("role")).toBe(false)
    expect(el.getAttribute("href")).toBe("/a")
  })

  it("passes target, rel, download, ping, referrerPolicy and hrefLang through", () => {
    render(
      <Link
        href="/a"
        target="_blank"
        rel="noopener"
        download="f.txt"
        ping="/p"
        referrerPolicy="no-referrer"
        hrefLang="it"
      >
        A
      </Link>,
    )
    const el = linkEl()
    expect(
      ["target", "rel", "download", "ping", "referrerpolicy", "hreflang"].map((a) =>
        el.getAttribute(a),
      ),
    ).toEqual(["_blank", "noopener", "f.txt", "/p", "no-referrer", "it"])
  })

  it("Space does nothing and is not prevented", async () => {
    const router = fakeRouter()
    const seen: boolean[] = []
    const on = (e: KeyboardEvent) => {
      if (e.key === " ") seen.push(e.defaultPrevented)
    }
    window.addEventListener("keydown", on)
    window.addEventListener("keyup", on)
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/a">A</Link>
      </RouterProvider>,
    )
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard(" ")
    window.removeEventListener("keydown", on)
    window.removeEventListener("keyup", on)
    expect(seen).toEqual([false, false])
    expect(router.calls).toHaveLength(0)
    expect(navigationLog()).toEqual([])
  })

  it("Enter's keydown is never prevented", async () => {
    let prevented: boolean | undefined
    const on = (e: KeyboardEvent) => {
      if (e.key === "Enter") prevented = e.defaultPrevented
    }
    window.addEventListener("keydown", on)
    render(<Link href="/a">A</Link>)
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard("{Enter}")
    window.removeEventListener("keydown", on)
    expect(prevented).toBe(false)
  })
})

describe("Non-Anchor Fallback", () => {
  it("a div activates on Enter, click and bare click, once each, with role and tabindex (kobaltedev/kobalte#712)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Link href="/a" render={<div />}>
        A
      </Link>,
    )
    const el = linkEl("A")
    expect(el.tagName).toBe("DIV")
    expect(el.getAttribute("role")).toBe("link")
    expect(el.getAttribute("tabindex")).toBe("0")
    const link = driver("A")
    await link.via("keyboard").follow()
    expect(navigationLog()).toHaveLength(1)
    await link.follow()
    expect(navigationLog()).toHaveLength(2)
    await link.via("virtual").follow()
    expect(navigationLog()).toHaveLength(3)
    for (const n of navigationLog()) {
      expect(n.href.endsWith("/a")).toBe(true)
      expect(n.newTab).toBe(false)
    }
  })

  it("Space does not activate a div", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Link href="/a" render={<div />}>
        A
      </Link>,
    )
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard(" ")
    expect(navigationLog()).toEqual([])
  })

  it("a modifier on a non-anchor opens elsewhere at the resolved href (react-spectrum#6347)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const router = fakeRouter({ href: (h) => `/base${h}` })
    render(
      <RouterProvider navigate={router.navigate} {...(router.href ? { href: router.href } : {})}>
        <Link href="/a" render={<div />}>
          A
        </Link>
      </RouterProvider>,
    )
    await driver("A").followInNewTab()
    await appleDriver("A").via("keyboard").followInNewTab()
    expect(router.calls).toHaveLength(0)
    expect(navigationLog()).toHaveLength(2)
    for (const n of navigationLog()) {
      expect(n.href.endsWith("/base/a")).toBe(true)
      expect(n.newTab).toBe(true)
    }
  })

  it("warns in development that the element loses the browser's link features", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Link href="/a" render={<span />}>
        A
      </Link>,
    )
    expect(warn.mock.calls.some((c) => /link.*<span>/.test(String(c[0])))).toBe(true)
  })
})

describe("Disabled Links", () => {
  it("middle click on a disabled link opens nothing (ariakit#7153)", () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/a" disabled>
          Off
        </Link>
      </RouterProvider>,
    )
    const el = linkEl()
    expect(el.hasAttribute("href")).toBe(false)
    fireEvent(el, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }))
    expect(navigationLog()).toEqual([])
    expect(router.calls).toHaveLength(0)
  })

  it("never calls a consumer onClick or navigates, whatever the input (react-spectrum#8827)", async () => {
    const router = fakeRouter()
    const onClick = vi.fn()
    const onActivate = vi.fn()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/a" disabled onClick={onClick} onActivate={onActivate}>
          Off
        </Link>
      </RouterProvider>,
    )
    const el = linkEl()
    const user = userEvent.setup()
    await user.click(el)
    fireEvent.click(el)
    fireEvent.contextMenu(el)
    el.focus()
    await user.keyboard("{Enter}")
    expect(onClick).not.toHaveBeenCalled()
    expect(onActivate).not.toHaveBeenCalled()
    expect(router.calls).toHaveLength(0)
    expect(navigationLog()).toEqual([])
  })

  it("has role, aria-disabled, data-disabled and tabindex -1; Tab skips it, focus() reaches it (react-spectrum#3998)", async () => {
    render(
      <>
        <button type="button">Before</button>
        <Link href="/a" disabled>
          Off
        </Link>
        <button type="button">After</button>
      </>,
    )
    const el = linkEl("Off")
    expect(el.getAttribute("role")).toBe("link")
    expect(el.getAttribute("aria-disabled")).toBe("true")
    expect(el.hasAttribute("data-disabled")).toBe(true)
    expect(el.getAttribute("tabindex")).toBe("-1")
    const user = userEvent.setup()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Before" }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }))
    act(() => el.focus())
    expect(document.activeElement).toBe(el)
  })

  it("focusableWhenDisabled: Tab reaches it, aria-disabled, Enter does nothing", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <button type="button">Before</button>
        <Link href="/a" disabled focusableWhenDisabled>
          Off
        </Link>
      </RouterProvider>,
    )
    const el = linkEl("Off")
    expect(el.getAttribute("tabindex")).toBe("0")
    const user = userEvent.setup()
    await user.tab()
    await user.tab()
    expect(document.activeElement).toBe(el)
    expect(el.getAttribute("aria-disabled")).toBe("true")
    await user.keyboard("{Enter}")
    expect(router.calls).toHaveLength(0)
    expect(navigationLog()).toEqual([])
  })

  it("a disabled non-anchor does not activate", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const onActivate = vi.fn()
    render(
      <Link href="/a" disabled render={<div />} onActivate={onActivate}>
        Off
      </Link>,
    )
    const el = linkEl()
    const user = userEvent.setup()
    await user.click(el)
    fireEvent.click(el)
    expect(onActivate).not.toHaveBeenCalled()
    expect(navigationLog()).toEqual([])
  })

  it("carries its attributes in every state of the driver: follow() fails naming action, modality and isDisabled", async () => {
    render(
      <Link href="/a" disabled>
        Off
      </Link>,
    )
    const link = driver("Off")
    await expect(link.via("keyboard").follow()).rejects.toThrow(
      /follow.*keyboard.*"isDisabled":true/s,
    )
    await expect(link.via("virtual").follow()).rejects.toThrow(
      /follow.*virtual.*"isDisabled":true/s,
    )
  })
})

describe("Current Link", () => {
  it("current=page keeps href and navigates", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/a" current="page">
          A
        </Link>
      </RouterProvider>,
    )
    const el = linkEl()
    expect(el.getAttribute("aria-current")).toBe("page")
    expect(el.hasAttribute("data-current")).toBe(true)
    expect(el.getAttribute("href")).toBe("/a")
    await driver("A").follow()
    expect(router.calls).toHaveLength(1)
    expect(await driver("A").current()).toBe("page")
  })

  it("current=true emits aria-current=true; false and absent emit neither", () => {
    render(
      <>
        <Link href="/t" current>
          T
        </Link>
        <Link href="/f" current={false}>
          F
        </Link>
        <Link href="/n">N</Link>
      </>,
    )
    expect(linkEl("T").getAttribute("aria-current")).toBe("true")
    for (const name of ["F", "N"]) {
      expect(linkEl(name).hasAttribute("aria-current")).toBe(false)
      expect(linkEl(name).hasAttribute("data-current")).toBe(false)
    }
  })
})

describe("Browser-Handled Activations", () => {
  it("modifier-click and modifier+Enter leave the router out and open a new tab", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/a">A</Link>
      </RouterProvider>,
    )
    await driver("A").followInNewTab()
    await appleDriver("A").via("keyboard").followInNewTab()
    expect(router.calls).toHaveLength(0)
    expect(navigationLog().map((n) => n.newTab)).toEqual([true, true])
  })

  it("Alt-click: no router call, the browser's default runs (react-spectrum#6614)", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/a">A</Link>
      </RouterProvider>,
    )
    const user = userEvent.setup()
    await user.keyboard("{Alt>}")
    await user.click(linkEl())
    await user.keyboard("{/Alt}")
    expect(router.calls).toHaveLength(0)
    expect(navigationLog()).toHaveLength(1)
    expect(navigationLog()[0]?.newTab).toBe(true)
  })

  it("an external link with target=_blank is not routed (react-spectrum#6557)", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="https://example.org/" target="_blank">
          Ext
        </Link>
      </RouterProvider>,
    )
    await userEvent.setup().click(linkEl())
    expect(router.calls).toHaveLength(0)
    expect(navigationLog()).toEqual([
      { href: "https://example.org/", newTab: true, via: "browser" },
    ])
  })

  it("an external link without target is left to the browser too", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="https://example.org/">Ext</Link>
      </RouterProvider>,
    )
    await userEvent.setup().click(linkEl())
    expect(router.calls).toHaveLength(0)
    expect(navigationLog()).toHaveLength(1)
  })

  it("a download link is left to the browser", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/f.pdf" download>
          F
        </Link>
      </RouterProvider>,
    )
    await userEvent.setup().click(linkEl())
    expect(router.calls).toHaveLength(0)
    expect(navigationLog()[0]?.newTab).toBe(true)
  })

  it("a consumer onClick that prevents default stops the router and the browser (react-spectrum#7566)", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/a" onClick={(e) => e.preventDefault()}>
          A
        </Link>
      </RouterProvider>,
    )
    await userEvent.setup().click(linkEl())
    expect(router.calls).toHaveLength(0)
    expect(navigationLog()).toEqual([])
  })

  it("without a router a consumer preventDefault stops the browser", async () => {
    const onActivate = vi.fn()
    render(
      <Link href="/a" onClick={(e) => e.preventDefault()} onActivate={onActivate}>
        A
      </Link>,
    )
    await userEvent.setup().click(linkEl())
    expect(navigationLog()).toEqual([])
    expect(onActivate).not.toHaveBeenCalled()
  })
})

describe("Client-Side Routing", () => {
  it("one navigation per click, with the given href and routerOptions", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/a">A</Link>
      </RouterProvider>,
    )
    await userEvent.setup().click(linkEl())
    expect(router.calls).toEqual([{ href: "/a", routerOptions: undefined }])
    expect(navigationLog().filter((n) => n.via === "browser")).toEqual([])
  })

  it("without a router the browser navigates natively", async () => {
    render(<Link href="/a">A</Link>)
    await userEvent.setup().click(linkEl())
    expect(navigationLog()).toHaveLength(1)
    expect(navigationLog()[0]).toMatchObject({ via: "browser", newTab: false })
  })

  it("the innermost provider wins (react-spectrum#6557)", async () => {
    const outer = fakeRouter()
    const inner = fakeRouter()
    render(
      <RouterProvider navigate={outer.navigate}>
        <RouterProvider navigate={inner.navigate}>
          <Link href="/a">A</Link>
        </RouterProvider>
      </RouterProvider>,
    )
    await userEvent.setup().click(linkEl())
    expect(inner.calls).toHaveLength(1)
    expect(outer.calls).toHaveLength(0)
  })

  it("a Next.js-style router.push receives (href, undefined)", async () => {
    const push = vi.fn()
    render(
      <RouterProvider navigate={push}>
        <Link href="/about">About</Link>
      </RouterProvider>,
    )
    await userEvent.setup().click(linkEl())
    expect(push).toHaveBeenCalledExactlyOnceWith("/about", undefined)
  })
})

describe("Href Resolution", () => {
  const base = (h: string) => `/app${h}`

  it("renders the basename and navigates with the given href (react-spectrum#5335)", async () => {
    const router = fakeRouter({ href: base })
    render(
      <RouterProvider navigate={router.navigate} href={base}>
        <Link href="/a">A</Link>
      </RouterProvider>,
    )
    expect(linkEl().getAttribute("href")).toBe("/app/a")
    expect(await driver("A").href()).toBe("/app/a")
    await userEvent.setup().click(linkEl())
    expect(router.calls).toEqual([{ href: "/a", routerOptions: undefined }])
  })

  it("does not rewrite external URLs (react-spectrum#6397, #6803)", () => {
    render(
      <RouterProvider navigate={() => {}} href={base}>
        <Link href="https://example.org/x">E</Link>
        <Link href="mailto:a@b.c">M</Link>
        <Link href="tel:1">T</Link>
        <Link href="//cdn.example.org/y">C</Link>
      </RouterProvider>,
    )
    expect(["E", "M", "T", "C"].map((n) => linkEl(n).getAttribute("href"))).toEqual([
      "https://example.org/x",
      "mailto:a@b.c",
      "tel:1",
      "//cdn.example.org/y",
    ])
  })

  it("href() is called only for parts with an href (react-spectrum#9490)", () => {
    const href = vi.fn(base)
    render(
      <RouterProvider navigate={() => {}} href={href}>
        <Link>No href</Link>
        <Link href="/a" disabled>
          Disabled
        </Link>
      </RouterProvider>,
    )
    expect(href).not.toHaveBeenCalled()
  })

  it("toggling href between a value and undefined throws nothing (react-spectrum#7028, #7220)", () => {
    const href = vi.fn(base)
    const tree = (h?: string) => (
      <RouterProvider navigate={() => {}} href={href}>
        <Link {...(h === undefined ? {} : { href: h })}>A</Link>
      </RouterProvider>
    )
    const view = render(tree("/a"))
    // An anchor without href has no link role: query the element itself.
    const a = () => view.container.querySelector("a") as HTMLAnchorElement
    expect(a().getAttribute("href")).toBe("/app/a")
    view.rerender(tree(undefined))
    expect(a().hasAttribute("href")).toBe(false)
    view.rerender(tree("/a"))
    expect(a().getAttribute("href")).toBe("/app/a")
    expect(href).toHaveBeenCalledTimes(2)
  })

  it("resolves the same way for the non-anchor fallback", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <RouterProvider navigate={() => {}} href={base}>
        <Link href="/a" render={<div />}>
          A
        </Link>
      </RouterProvider>,
    )
    await driver("A").followInNewTab()
    expect(navigationLog()[0]?.href.endsWith("/app/a")).toBe(true)
  })
})

describe("Activation Reports", () => {
  it("a middle click is elsewhere", async () => {
    const onActivate = vi.fn()
    render(
      <Link href="/a" onActivate={onActivate}>
        A
      </Link>,
    )
    await driver("A").middleClick()
    expect(onActivate).toHaveBeenCalledExactlyOnceWith({
      href: "/a",
      modality: "pointer",
      disposition: "elsewhere",
    })
  })

  // BUG (reported): a native anchor's Enter click has detail 0, which linkProps reports as
  // "virtual" before it looks at the modality tracker (link.ts onClick).
  it("Enter is same-tab with the keyboard modality", async () => {
    const onActivate = vi.fn()
    render(
      <Link href="/a" onActivate={onActivate}>
        A
      </Link>,
    )
    await driver("A").via("keyboard").follow()
    expect(onActivate).toHaveBeenCalledOnce()
    expect(onActivate.mock.calls[0]?.[0]).toEqual({
      href: "/a",
      modality: "keyboard",
      disposition: "same-tab",
    })
  })

  // BUG (reported): Link never subscribes to the modality tracker while mounted (fixtures do:
  // `useEffect(() => env.modality.subscribe(() => {}), [env])`), so the pointerdown that
  // precedes the first focus is missed and the default "keyboard" modality is reported.
  it("a click is same-tab with the pointer modality; a modifier click is elsewhere", async () => {
    const onActivate = vi.fn()
    render(
      <Link href="/a" onActivate={onActivate}>
        A
      </Link>,
    )
    await driver("A").follow()
    await driver("A").followInNewTab()
    expect(onActivate.mock.calls.map((c) => [c[0].modality, c[0].disposition])).toEqual([
      ["pointer", "same-tab"],
      ["pointer", "elsewhere"],
    ])
  })
})

describe("Press State Clears", () => {
  it("Enter on a _blank link whose keyup never arrives: blur clears data-pressed (react-spectrum#6094, #8364)", async () => {
    render(
      <Link href="/a" target="_blank">
        A
      </Link>,
    )
    const el = linkEl()
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard("{Enter>}")
    await act(() => el.blur())
    expect(el.hasAttribute("data-pressed")).toBe(false)
  })

  it("a hidden document clears it too", async () => {
    render(
      <Link href="/a" target="_blank">
        A
      </Link>,
    )
    const el = linkEl()
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard("{Enter>}")
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
    await act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    hidden.mockRestore()
    expect(el.hasAttribute("data-pressed")).toBe(false)
  })

  it("the press ends with the key", async () => {
    render(<Link href="/a">A</Link>)
    const el = linkEl()
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard("{Enter}")
    expect(el.hasAttribute("data-pressed")).toBe(false)
  })
})

describe("Interactive Content Warning", () => {
  it("a button inside a link warns naming the part and the element (react-spectrum#2234, #7767)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Link href="/a">
        <button type="button">Inner</button>
      </Link>,
    )
    expect(warn.mock.calls.filter((c) => /link.*<button>/.test(String(c[0])))).toHaveLength(1)
  })

  it("plain content does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Link href="/a">
        <span>text</span>
      </Link>,
    )
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("Shared Link Data Attributes", () => {
  it("carries scope, part, instance and passes data-variant/size/tone through", () => {
    render(
      <Link href="/a" data-variant="ghost" data-size="sm" data-tone="brand">
        A
      </Link>,
    )
    const el = linkEl()
    expect(el.getAttribute("data-scope")).toBe("link")
    expect(el.getAttribute("data-part")).toBe("link")
    expect(el.getAttribute("data-instance")).toBeTruthy()
    expect([...["variant", "size", "tone"]].map((a) => el.getAttribute(`data-${a}`))).toEqual([
      "ghost",
      "sm",
      "brand",
    ])
  })

  it("data-external only for another origin", async () => {
    render(
      <>
        <Link href="https://other.example/x">Other</Link>
        <Link href={`${location.origin}/x`}>Same</Link>
        <Link href="/y">Rel</Link>
      </>,
    )
    expect(linkEl("Other").hasAttribute("data-external")).toBe(true)
    expect(linkEl("Same").hasAttribute("data-external")).toBe(false)
    expect(linkEl("Rel").hasAttribute("data-external")).toBe(false)
    expect(await driver("Other").isExternal()).toBe(true)
    expect(await driver("Rel").isExternal()).toBe(false)
  })

  // BUG (reported): same missing modality subscription as above.
  it("a pointer click shows data-focus and no data-focus-visible", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/a">A</Link>
      </RouterProvider>,
    )
    const el = linkEl()
    await userEvent.setup().click(el)
    expect(document.activeElement).toBe(el)
    expect(el.hasAttribute("data-focus")).toBe(true)
    expect(el.hasAttribute("data-focus-visible")).toBe(false)
    expect(await driver("A").isFocusVisible()).toBe(false)
  })

  it("keyboard focus shows data-focus-visible", async () => {
    render(<Link href="/a">A</Link>)
    await userEvent.setup().tab()
    expect(linkEl().hasAttribute("data-focus-visible")).toBe(true)
  })

  it("hover shows data-hover", async () => {
    render(<Link href="/a">A</Link>)
    const user = userEvent.setup()
    await user.hover(linkEl())
    expect(linkEl().hasAttribute("data-hover")).toBe(true)
    await user.unhover(linkEl())
    expect(linkEl().hasAttribute("data-hover")).toBe(false)
  })
})

describe("Link Contract", () => {
  it("fake router, DOM adapter: one navigate('/docs', undefined)", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/docs">Docs</Link>
      </RouterProvider>,
    )
    await driver("Docs").follow()
    expect(router.calls).toEqual([{ href: "/docs", routerOptions: undefined }])
  })

  it("keyboard twin: Enter on the focused link, the same single navigation", async () => {
    const router = fakeRouter()
    render(
      <RouterProvider navigate={router.navigate}>
        <Link href="/docs">Docs</Link>
      </RouterProvider>,
    )
    await driver("Docs").via("keyboard").follow()
    expect(document.activeElement).toBe(linkEl())
    expect(router.calls).toEqual([{ href: "/docs", routerOptions: undefined }])
  })

  it("middleClick has no keyboard implementation", async () => {
    render(<Link href="/a">A</Link>)
    await expect(driver("A").via("keyboard").middleClick()).rejects.toThrow(
      /middleClick has no "keyboard" implementation/,
    )
  })

  it("queries: href, current, isDisabled", async () => {
    render(
      <>
        <Link href="/a" current="step">
          A
        </Link>
        <Link href="/b" disabled>
          B
        </Link>
      </>,
    )
    expect(await driver("A").href()).toBe("/a")
    expect(await driver("A").current()).toBe("step")
    expect(await driver("A").isDisabled()).toBe(false)
    expect(await driver("B").isDisabled()).toBe(true)
    expect(await driver("B").href()).toBeNull()
    expect(await driver("B").current()).toBeNull()
  })

  it("uses the mod key of the platform", () => {
    expect(MOD).toBe(platform.apple ? "Meta" : "Control")
  })
})

describe("link semantics", () => {
  it("icon-only link without a name fails the generic name invariant", () => {
    render(
      <Link href="/a" id="icon">
        <svg aria-hidden="false" width="10" height="10" />
      </Link>,
    )
    const snap = collectDom({ scope: "link", instance: "icon" })
    const problems = checkGeneric({
      before: null,
      after: snap,
      baseline: snap,
      from: null,
      state: "static",
      expected: () => ({}),
      open: false,
      atInitial: true,
      anchorCount: 1,
      errors: [],
      traits: [],
      semantics: {},
      values: {},
    })
    expect(problems.join("\n")).toMatch(/link/)
    expect(problems.some((p) => /name/i.test(p))).toBe(true)
  })
})
