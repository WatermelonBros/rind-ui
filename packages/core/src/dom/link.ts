// Every link part's attributes and click handling (openspec link-navigation), so Link,
// Breadcrumbs, Pagination and Navigation Menu cannot drift: a native <a href> by default,
// client routing that never double-navigates (the part's handler runs last and respects
// `defaultPrevented`), browser-handled modifier clicks, href resolution that never rewrites
// external URLs, the disabled-link rule, and the non-anchor fallback built on one
// activation routine.

import type { ModifierState, PressEvent } from "../a11y/events"
import { dataFlag, type PartProps } from "../connect/props"
import type { Modality } from "../contract/env"
import type { DomEnv, ModalityEnv, PlatformInfo } from "../env/capabilities"
import type { Href, RouterCapability, RouterOptions } from "../env/router"
import { quirkActive } from "./quirk-conditions"

declare const process: { env: { NODE_ENV?: string } }

export type LinkCurrent = boolean | "page" | "step" | "location" | "date" | "time"
export type LinkDisposition = "same-tab" | "elsewhere"

export interface LinkActivation {
  readonly href: Href
  readonly modality: Modality
  readonly disposition: LinkDisposition
}

export interface LinkInput {
  readonly href?: Href | undefined
  readonly target?: string | undefined
  readonly rel?: string | undefined
  readonly download?: boolean | string | undefined
  readonly ping?: string | undefined
  readonly referrerPolicy?: string | undefined
  readonly hrefLang?: string | undefined
  readonly routerOptions?: RouterOptions | undefined
  readonly disabled?: boolean | undefined
  readonly focusableWhenDisabled?: boolean | undefined
  readonly current?: LinkCurrent | undefined
  /** Once per activation that is not disabled and not prevented. */
  readonly onActivate?: ((details: LinkActivation) => void) | undefined
  /** The document's origin; undefined on the server and while hydrating (`isExternal`). */
  readonly origin?: string | undefined
  /** The rendered tag (lowercase); the server render passes the default element's. */
  readonly tag: string
}

export type LinkEnv = RouterCapability & ModalityEnv & PlatformInfo & Partial<DomEnv>

const SCHEME = /^[a-z][a-z\d+.-]*:|^\/\//i

/** The rendered href: the router's `href()` for relative and root-relative values only. */
export function resolveHref(href: Href, env: RouterCapability): string {
  const value = String(href)
  const map = env.router?.href
  return !map || SCHEME.test(value) ? value : map(href)
}

/**
 * The resolved URL points at another origin. `origin` is the document's, unknown on the
 * server and while hydrating: then only a non-http(s) scheme (`mailto:`, `tel:`) can be
 * judged, and an http(s) URL is decided once the origin is known, so the server render and
 * the hydrating one agree.
 */
export function isExternal(resolved: string, origin: string | undefined): boolean {
  if (!SCHEME.test(resolved)) return false
  try {
    const url = new URL(resolved, origin ?? "http://localhost/")
    if (!/^https?:$/.test(url.protocol)) return true
    if (origin === undefined) return false
    return origin === "null" || url.origin !== origin
  } catch {
    return true
  }
}

/**
 * The browser opens this activation itself (another tab, a download, another origin):
 * not a primary click, a modifier held, a `target` attribute other than `_self` (read as an
 * attribute, not a property), `download`, or a cross-origin URL.
 */
export function shouldBrowserHandle(
  el: Element,
  e: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
  doc: Document,
): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return true
  const target = el.getAttribute("target")
  if (target !== null && target !== "" && target !== "_self") return true
  if (el.hasAttribute("download")) return true
  const href = el.getAttribute("href")
  if (href === null) return true
  try {
    return new URL(href, doc.baseURI).origin !== doc.location.origin
  } catch {
    return true
  }
}

/** The link's own attributes copied onto a temporary anchor. */
function anchorAttributes(input: LinkInput, resolved: string): Record<string, string> {
  const out: Record<string, string> = { href: resolved }
  if (input.target) out["target"] = input.target
  if (input.rel) out["rel"] = input.rel
  if (input.download !== undefined && input.download !== false) {
    out["download"] = input.download === true ? "" : input.download
  }
  if (input.ping) out["ping"] = input.ping
  if (input.referrerPolicy) out["referrerpolicy"] = input.referrerPolicy
  if (input.hrefLang) out["hreflang"] = input.hrefLang
  return out
}

/**
 * Opens `href` as a real anchor would, with the event's modifier keys: a temporary anchor
 * is appended to `host`, activated and removed. Its click runs the same handler as a
 * native link (routing, dispositions). WebKit drops modifiers on synthetic clicks: there a
 * keyboard Enter is dispatched instead (`webkit-synthetic-click-modifiers`).
 */
export function openLink(
  host: Element,
  attributes: Record<string, string>,
  modifiers: ModifierState,
  env: PlatformInfo,
  onClick: (e: MouseEvent, anchor: HTMLAnchorElement) => void,
): void {
  const doc = host.ownerDocument
  const a = doc.createElement("a")
  for (const [k, v] of Object.entries(attributes)) a.setAttribute(k, v)
  // Off-screen and out of the accessibility tree for the instant it exists.
  a.setAttribute("aria-hidden", "true")
  // Lets test environments tell it from the page's own anchors (its click never bubbles).
  a.setAttribute("data-rind-synthetic-link", "")
  a.tabIndex = -1
  a.style.position = "absolute"
  a.style.opacity = "0"
  // The click must not reach the host: its press handler would take it for an AT click and
  // activate again. WebKit's simulated click (keydown path) bubbles, so stop it here.
  let clicked = false
  const listener = (e: MouseEvent) => {
    clicked = true
    e.stopPropagation()
    onClick(e, a)
  }
  a.addEventListener("click", listener)
  host.append(a)
  try {
    const modified =
      modifiers.metaKey || modifiers.ctrlKey || modifiers.shiftKey || modifiers.altKey
    const { metaKey, ctrlKey, shiftKey, altKey } = modifiers
    if (modified && quirkActive("webkit-synthetic-click-modifiers", env)) {
      // WebKit turns an Enter keydown on an anchor into a click that keeps its modifiers;
      // it matches on the legacy `keyIdentifier`, absent from KeyboardEventInit.
      const init = { key: "Enter", keyIdentifier: "Enter", metaKey, ctrlKey, shiftKey, altKey }
      a.dispatchEvent(new KeyboardEvent("keydown", init))
    }
    // Builds that do not simulate the click from a synthetic keydown (Playwright's WebKit).
    if (!clicked) {
      a.dispatchEvent(
        new MouseEvent("click", {
          bubbles: false,
          cancelable: true,
          detail: 1,
          metaKey,
          ctrlKey,
          shiftKey,
          altKey,
        }),
      )
    }
  } finally {
    a.removeEventListener("click", listener)
    a.remove()
  }
}

/** The routing step of a click on an anchor (native or temporary). */
function route(
  input: LinkInput,
  env: LinkEnv,
  anchor: Element,
  e: Pick<
    MouseEvent,
    "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "defaultPrevented"
  > & {
    preventDefault(): void
  },
  modality: Modality,
): void {
  // A router link rendered through `render`, or the consumer, already handled it.
  if (e.defaultPrevented || input.href === undefined) return
  const elsewhere = shouldBrowserHandle(anchor, e, anchor.ownerDocument)
  input.onActivate?.({
    href: input.href,
    modality,
    disposition: elsewhere ? "elsewhere" : "same-tab",
  })
  if (elsewhere || !env.router) return
  e.preventDefault()
  env.router.navigate(input.href, input.routerOptions)
}

/**
 * Activates a link from a part that keeps its own role (a grid row, a tree item) or from
 * the `role="link"` fallback: the same routing, modifier and disposition rules as a native
 * anchor, through a temporary anchor. `onActivate` is called once.
 */
export function activateLink(input: LinkInput, host: Element, e: PressEvent, env: LinkEnv): void {
  if (input.disabled || input.href === undefined) return
  openLink(host, anchorAttributes(input, resolveHref(input.href, env)), e, env, (click, a) =>
    route(input, env, a, click, e.modality),
  )
}

/** Interactive content inside a link (a button, a link, a field) breaks it for AT users. */
const INTERACTIVE =
  "a[href], button, input, select, textarea, details, iframe, [tabindex]:not([tabindex='-1']), [contenteditable]:not([contenteditable='false']), [role=button], [role=link]"

/** Development: warns once per element when a link part contains interactive content. */
export function warnInteractiveContent(el: Element, part: string): void {
  if (process.env.NODE_ENV === "production") return
  if (warned.has(el)) return
  const nested = el.querySelector(INTERACTIVE)
  if (!nested) return
  warned.add(el)
  console.warn(
    `[rind-ui] ${part}: contains interactive content (<${nested.tagName.toLowerCase()}>); a link must not contain buttons, links or fields`,
  )
}
const warned = new WeakSet<Element>()

/**
 * A link part's props: the attributes of the spec's tables plus the click handling. Press,
 * hover and focus attributes are added by the part from the shared modules. The non-anchor
 * fallback activates through `activateLink` on the press module's PRESS event.
 */
export function linkProps(input: LinkInput, env: LinkEnv): PartProps {
  const anchor = input.tag === "a"
  const disabled = input.disabled === true
  const current = input.current === undefined || input.current === false ? undefined : input.current
  const resolved = input.href === undefined || disabled ? undefined : resolveHref(input.href, env)
  const external = resolved !== undefined && isExternal(resolved, input.origin)
  // TalkBack cannot reach an unfocusable link (talkback-unfocusable-link): -1, never absent.
  const tabindex = disabled
    ? input.focusableWhenDisabled
      ? 0
      : quirkActive("talkback-unfocusable-link", env)
        ? -1
        : undefined
    : anchor
      ? undefined
      : 0
  const passThrough = anchor && !disabled
  return {
    href: passThrough ? resolved : undefined,
    target: passThrough ? input.target : undefined,
    rel: passThrough ? input.rel : undefined,
    download: passThrough
      ? input.download === true
        ? ""
        : input.download || undefined
      : undefined,
    ping: passThrough ? input.ping : undefined,
    referrerpolicy: passThrough ? input.referrerPolicy : undefined,
    hreflang: passThrough ? input.hrefLang : undefined,
    role: disabled || !anchor ? "link" : undefined,
    tabindex,
    "aria-disabled": disabled ? "true" : undefined,
    "aria-current": current === undefined ? undefined : current === true ? "true" : current,
    "data-current": dataFlag(current !== undefined),
    "data-disabled": dataFlag(disabled),
    "data-external": dataFlag(external),
    onClick: (event: unknown) => {
      const e = event as MouseEvent
      if (disabled) {
        // No navigation by any input; consumer handlers are dropped by the part.
        e.preventDefault()
        return
      }
      const el = e.currentTarget as Element | null
      if (!anchor || !el || el.tagName !== "A") return
      // The tracker classified this click already (Enter's click has detail 0 too).
      route(input, env, el, e, env.modality.modality())
    },
    onAuxClick: (event: unknown) => {
      const e = event as MouseEvent
      if (disabled) {
        e.preventDefault()
        return
      }
      // Middle click: the browser opens it; only reported.
      if (e.button === 1 && anchor && input.href !== undefined) {
        input.onActivate?.({ href: input.href, modality: "pointer", disposition: "elsewhere" })
      }
    },
  }
}
