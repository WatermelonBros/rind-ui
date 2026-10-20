// Navigations as tests observe them: a page-wide log written by `fakeRouter` (client
// routing) and, in the DOM adapter, by the native-link interceptor (which cancels the
// browser's navigation so the test page stays). The Playwright adapter reads the same log
// and also watches real URL changes and new pages.

import type { Href, Router, RouterOptions } from "@rind-ui/core"

export interface Navigation {
  readonly href: string
  /** Opened elsewhere: another tab or window, or a download. */
  readonly newTab: boolean
  readonly via: "router" | "browser"
}

export const NAVIGATIONS: unique symbol = Symbol.for("rind-ui.navigations") as never

/** The page-wide log, created on first use. */
export function navigationLog(): Navigation[] {
  let log = Reflect.get(globalThis, NAVIGATIONS) as Navigation[] | undefined
  if (!log) {
    log = []
    Reflect.set(globalThis, NAVIGATIONS, log)
  }
  return log
}

export interface FakeRouterCall {
  readonly href: Href
  readonly routerOptions: RouterOptions | undefined
}

export interface FakeRouter extends Router {
  /** Every `navigate` call, in order. */
  readonly calls: readonly FakeRouterCall[]
}

/**
 * A `Router` that records `navigate` calls (and the page-wide navigation log drivers read),
 * with an optional `href` mapping (a basename). For `RouterProvider` or a raw environment.
 */
export function fakeRouter(options: { readonly href?: (href: Href) => string } = {}): FakeRouter {
  const calls: FakeRouterCall[] = []
  return {
    calls,
    navigate(href, routerOptions) {
      calls.push({ href, routerOptions })
      navigationLog().push({ href: String(href), newTab: false, via: "router" })
    },
    ...(options.href ? { href: options.href } : {}),
  }
}

/** Where the browser would open this activation of `a`, from the event and the anchor. */
function opensElsewhere(a: HTMLAnchorElement, e: MouseEvent): boolean {
  const target = a.getAttribute("target")
  return (
    e.type === "auxclick" ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey ||
    a.hasAttribute("download") ||
    (target !== null && target !== "" && target !== "_self")
  )
}

/** `a` points at an element of the current document (only the hash differs, and it exists). */
function samePageFragment(win: Window, a: HTMLAnchorElement): boolean {
  const here = new URL(win.location.href)
  const to = new URL(a.href, here)
  here.hash = ""
  const hash = to.hash
  to.hash = ""
  if (hash === "" || to.href !== here.href) return false
  return win.document.getElementById(decodeURIComponent(hash.slice(1))) !== null
}

const intercepted = new WeakSet<Window>()
const handled = new WeakSet<Event>()

/**
 * Records every link activation the page leaves to the browser, then cancels it: the test
 * page is never unloaded and no tab opens. Runs after the page's own handlers (window
 * bubble phase; at the target for rind-ui's non-bubbling temporary anchors).
 */
export function interceptNativeNavigation(win: Window & typeof globalThis): void {
  if (intercepted.has(win)) return
  intercepted.add(win)
  const anchorOf = (e: MouseEvent) =>
    e
      .composedPath()
      .find(
        (n): n is HTMLAnchorElement => n instanceof win.HTMLAnchorElement && n.hasAttribute("href"),
      )
  const finish = (e: MouseEvent) => {
    if (e.type === "auxclick" && e.button !== 1) return
    const a = anchorOf(e)
    if (!a || e.defaultPrevented || handled.has(e)) return
    handled.add(e)
    const newTab = opensElsewhere(a, e)
    navigationLog().push({ href: a.href, newTab, via: "browser" })
    // A jump to an element of this same document never unloads it: the jump is the behaviour
    // under test (a table of contents), so it happens.
    if (!newTab && samePageFragment(win, a)) return
    e.preventDefault()
  }
  // The window is the last node a bubbling event reaches, whoever registered first.
  win.addEventListener("click", finish)
  win.addEventListener("auxclick", finish)
  // rind-ui's temporary anchor: its click does not reach the window (it never bubbles, or is
  // stopped at the anchor), so it is decided there, after the anchor's own listener.
  win.addEventListener(
    "click",
    (e) => {
      const a = anchorOf(e)
      if (a?.hasAttribute("data-rind-synthetic-link")) {
        a.addEventListener("click", finish, { once: true })
      }
    },
    true,
  )
}

/** Whether `log` gained a matching navigation after index `from`. */
export function navigatedSince(
  log: readonly Navigation[],
  from: number,
  options: { readonly newTab?: boolean } = {},
): boolean {
  return log.slice(from).some((n) => n.newTab === (options.newTab === true))
}
