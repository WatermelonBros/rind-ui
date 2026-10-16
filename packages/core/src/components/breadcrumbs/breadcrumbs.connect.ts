// Breadcrumbs has no machine (design §1): the current item and the collapsed range are a
// pure function of the trail (`deriveTrail`), and every part's attributes follow from it.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Href, RouterOptions } from "../../env/router"

declare const process: { env: { NODE_ENV?: string } }

const dev = () => process.env.NODE_ENV !== "production"

export type BreadcrumbsCurrentValue = "page" | "location" | "date" | "time" | true

/** One crumb of the trail, in order. */
export interface BreadcrumbsTrailItem {
  readonly key: string
  /** `true` makes it current; `false` on the last item opts out of the default. */
  readonly current?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly href?: Href | undefined
  readonly routerOptions?: RouterOptions | undefined
  readonly textValue: string
}

export interface BreadcrumbsTrailInput {
  readonly items: readonly BreadcrumbsTrailItem[]
  readonly maxItems?: number | undefined
  /** Default 1. */
  readonly itemsBeforeCollapse?: number | undefined
  /** Default 1. */
  readonly itemsAfterCollapse?: number | undefined
}

export interface BreadcrumbsTrail {
  readonly currentKey: string | null
  /** The collapsed keys, in order (empty when nothing is collapsed). */
  readonly collapsed: readonly string[]
  /** The last item still shown, which carries the hidden trailing separator. */
  readonly lastVisibleKey: string | null
}

/**
 * The current key and the collapsed range (design §2). Current: the first `current: true`,
 * else the last item unless it says `current: false`. Collapse: the items between the first
 * `itemsBeforeCollapse` and the last `itemsAfterCollapse`, only past `maxItems`, never the
 * current item, and only when at least two items would be hidden.
 */
export function deriveTrail(input: BreadcrumbsTrailInput): BreadcrumbsTrail {
  const { items, maxItems } = input
  const n = items.length
  const explicit = items.find((it) => it.current === true)
  const last = items[n - 1]
  const currentKey = explicit?.key ?? (last && last.current !== false ? last.key : null)
  const before = Math.max(0, input.itemsBeforeCollapse ?? 1)
  const after = Math.max(0, input.itemsAfterCollapse ?? 1)
  let collapsed: string[] = []
  if (maxItems !== undefined && n > maxItems && n - before - after >= 2) {
    for (let i = before; i < n - after; i++) {
      const key = items[i]?.key
      // The range ends before the current item: it is never collapsed.
      if (key === undefined || key === currentKey) break
      collapsed.push(key)
    }
    if (collapsed.length < 2) collapsed = []
  }
  const hidden = new Set(collapsed)
  const visible = items.filter((it) => !hidden.has(it.key))
  return { currentKey, collapsed, lastVisibleKey: visible[visible.length - 1]?.key ?? null }
}

/** One Item's flags in the trail; also its `render` state. */
export interface BreadcrumbsItemState {
  readonly current: boolean
  readonly currentValue: BreadcrumbsCurrentValue
  readonly collapsed: boolean
  readonly disabled: boolean
  readonly last: boolean
}

export function breadcrumbsItemState(
  trail: BreadcrumbsTrail,
  key: string,
  disabled: boolean,
  currentValue: BreadcrumbsCurrentValue,
): BreadcrumbsItemState {
  return {
    current: trail.currentKey === key,
    currentValue,
    collapsed: trail.collapsed.includes(key),
    disabled,
    last: trail.lastVisibleKey === key,
  }
}

export interface BreadcrumbsConnectInput {
  readonly instance: string
  readonly trail: BreadcrumbsTrail
  /** The consumer labelled the Root itself (`aria-label` / `aria-labelledby`). */
  readonly labelled: boolean
  readonly label: string
}

export function breadcrumbsConnect(input: BreadcrumbsConnectInput) {
  const { instance, trail } = input
  const attrs = (part: string) => scopeAttrs("breadcrumbs", part, instance)
  return {
    root: (): PartProps => ({
      ...attrs("root"),
      "aria-label": input.labelled ? undefined : input.label,
      "data-collapsed": dataFlag(trail.collapsed.length > 0),
    }),
    list: (): PartProps => attrs("list"),
    item: (state: BreadcrumbsItemState): PartProps => ({
      ...attrs("item"),
      hidden: state.collapsed ? true : undefined,
      "data-current": dataFlag(state.current),
      "data-disabled": dataFlag(state.disabled),
      "data-collapsed": dataFlag(state.collapsed),
    }),
    /** The current item without `href` (design §3): text, focusable, no role, no press. */
    currentText: (state: BreadcrumbsItemState): PartProps => ({
      ...attrs("link"),
      "aria-current": state.currentValue === true ? "true" : state.currentValue,
      tabIndex: -1,
      "data-current": "",
    }),
    separator: (state: BreadcrumbsItemState): PartProps => ({
      ...attrs("separator"),
      "aria-hidden": "true",
      "data-last": dataFlag(state.last),
    }),
    /**
     * Null while nothing is collapsed: the Ellipsis renders only then. `label` is its
     * trigger's name (`data-label` lets the contract find that trigger).
     */
    ellipsis: (label: string): PartProps | null =>
      trail.collapsed.length === 0
        ? null
        : {
            ...attrs("ellipsis"),
            "data-count": String(trail.collapsed.length),
            "data-label": label,
          },
  }
}

const POPUP_ROLES = '[role="listbox"], [role="menu"], [role="combobox"]'

/** Development: Breadcrumbs inside a listbox, menu or combobox popup (react-spectrum#7790). */
export function warnBreadcrumbsInPopup(root: Element): void {
  if (!dev() || !root.parentElement?.closest(POPUP_ROLES)) return
  console.warn(
    `[rind-ui] breadcrumbs "${root.getAttribute("data-instance")}": rendered inside a listbox, menu or combobox popup, where a navigation landmark and its links are not reachable; render it outside the popup`,
  )
}

/** Development: the current Item contains no element with `aria-current`. */
export function warnCurrentWithoutAria(item: Element): void {
  if (!dev() || item.hasAttribute("aria-current") || item.querySelector("[aria-current]")) return
  console.warn(
    `[rind-ui] breadcrumbs: the current item "${item.textContent?.trim() ?? ""}" has no element with aria-current; render Breadcrumbs.Link, or set aria-current on its control from the Item's render state`,
  )
}
