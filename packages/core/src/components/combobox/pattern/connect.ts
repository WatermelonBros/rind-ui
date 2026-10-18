// combobox-pattern connect helpers (design §2): the input's combobox attributes, and the
// listbox parts under the host's scope with their own tab stop and keyboard removed (active
// descendant through the input), plus the popup, positioner, empty and loading props. The
// input's `aria-expanded` comes from the host's `exposed`, so a popup-less host spreads it.

import type { CompositeEnv } from "../../../collection/composite"
import type { CollectionKey } from "../../../collection/key"
import type { Collection } from "../../../collection/list"
import type { LoadingStatus } from "../../../collection/machine"
import { isSelected, type SelectionValue } from "../../../collection/selection"
import { CRITICAL, dataFlag, type PartProps } from "../../../connect/props"
import type { Modality } from "../../../contract/env"
import { contentPlacementProps, positionerProps } from "../../../dom/position/connect"
import type { ListboxEvent } from "../../listbox/listbox.machine"
import { listboxParts } from "../../listbox/listbox.parts"
import type { PatternContext, PatternEvent, PatternMessages } from "./machine"
import { patternIds } from "./machine"

export interface PatternConnectView {
  readonly scope: string
  readonly instance: string
  readonly open: boolean
  /** The listbox is shown (open and not in the empty state): `aria-expanded`. */
  readonly exposed: boolean
  /** Open, no options, not loading or stale: the Empty part shows. */
  readonly empty: boolean
  /** The popup (or the list in place) is rendered. */
  readonly present: boolean
  readonly results: Collection<unknown>
  readonly context: PatternContext
  readonly selection: SelectionValue
  readonly selectionMode: "single" | "multiple" | "none"
  readonly disabled: boolean
  readonly loading?: LoadingStatus | undefined
  readonly modality: Modality
  readonly dir: "ltr" | "rtl"
  readonly autoComplete: "list" | "both"
  readonly messages: Pick<PatternMessages, "listboxLabel">
  readonly mounted: {
    readonly label: boolean
    readonly empty: boolean
    readonly description?: ((key: CollectionKey) => boolean) | undefined
  }
  /** The engine has the Popover API (known after mount): the positioner joins the top layer. */
  readonly topLayer?: boolean | undefined
  /** The host's attributes of every part (scope, flags, its own `data-state`). */
  readonly common: (part: string) => PartProps
  /** A press on a listed option (never on a closing popup). */
  readonly choose: (key: CollectionKey, modality: Modality) => void
  /** Focus left the component from the popup. */
  readonly blur: () => void
  /** The list's pointer highlights also come as HIGHLIGHT (a list in place). */
  readonly forwardHighlight?: boolean | undefined
  readonly send: (event: PatternEvent) => void
}

export type PatternConnectEnv = CompositeEnv & {
  readonly dom: { getById(id: string): Element | null }
}

export function patternConnect(v: PatternConnectView, env: PatternConnectEnv) {
  const ids = patternIds(v.scope, v.instance)
  const { send, context: c } = v
  // Composite events become the host's: a press is a choice, nothing else selects.
  const list = listboxParts(
    {
      scope: v.scope,
      instance: v.instance,
      collection: v.results,
      context: c,
      selection: v.selection,
      selectionMode: v.selectionMode,
      selectionBehavior: "toggle",
      orientation: "vertical",
      strategy: "active-descendant",
      disabled: v.disabled,
      loading: v.loading,
      typingAhead: () => false,
      actions: false,
      focused: false,
      modality: v.modality,
      mounted: {
        label: v.mounted.label,
        empty: v.mounted.empty,
        description: v.mounted.description ?? (() => false),
      },
      send: (e: ListboxEvent) => {
        // Presses on a closing popup choose nothing (Results While Closing).
        if (!v.open) return
        if (e.type === "SELECT") v.choose(e.key, e.modality)
        else if (e.type === "POINTER_MOVE" || (v.forwardHighlight && e.type === "HIGHLIGHT"))
          send(e)
      },
    },
    env,
  )
  const loadingNow = v.loading === "loading" || v.loading === "loading-more"
  const lagging = c.typingLag !== null && c.highlightSource === "typing"
  const popupState = v.open ? "open" : "closed"
  /** A mouse press on the component's own surfaces never takes focus from the input. */
  const keepFocus = (event: unknown) => {
    const e = event as MouseEvent
    if (e.button === 0) e.preventDefault()
  }
  /** Focus moving into the control (chips, buttons) or the popup stays inside. */
  const insideControl = (target: unknown) =>
    target !== null &&
    [ids.control, ids.positioner].some(
      (id) => env.dom.getById(id)?.contains(target as Node | null) === true,
    )

  return {
    ids,
    keepFocus,
    insideControl,
    /** The input's combobox attributes (combobox-pattern "Roles And Relations"). */
    input: (): PartProps => ({
      "data-state": v.exposed ? "open" : "closed",
      role: "combobox",
      autoComplete: "off",
      autoCorrect: "off",
      autoCapitalize: "none",
      spellCheck: "false",
      "aria-autocomplete": v.autoComplete,
      "aria-expanded": String(v.exposed),
      "aria-controls": v.present ? ids.list : undefined,
      "aria-activedescendant":
        v.exposed && !lagging && c.highlightedKey !== null && v.results.has(c.highlightedKey)
          ? ids.item(c.highlightedKey)
          : undefined,
      [CRITICAL]: ["aria-expanded", "aria-activedescendant"],
    }),
    positioner: (): PartProps => {
      const placed = positionerProps(
        c.placement,
        { positioner: ids.positioner, anchor: ids.control },
        { dir: v.dir },
      )
      return {
        ...v.common("positioner"),
        "data-state": popupState,
        ...placed,
        // The top layer (the adapter calls showPopover): above every page stacking context,
        // while staying in place in the DOM (reading and swipe order). The UA's popover box
        // rules are reset; positioning resolves a fixed strategy for an open popover.
        ...(v.topLayer
          ? {
              popover: "manual",
              // The reset first: the placement's own top / left / position come after it.
              style: {
                inset: "auto",
                margin: "0",
                border: "0",
                padding: "0",
                background: "transparent",
                color: "inherit",
                overflow: "visible",
                ...(placed["style"] as Record<string, string>),
              },
            }
          : {}),
        "data-empty": dataFlag(v.empty),
        "data-loading": dataFlag(loadingNow),
        // Without an Empty part the whole surface hides in the empty state.
        hidden: v.empty && !v.mounted.empty ? true : undefined,
      }
    },
    popup: (): PartProps => ({
      ...v.common("popup"),
      "data-state": popupState,
      ...contentPlacementProps(c.placement),
      id: ids.popup,
      // A scrolling region must be focusable (axe scrollable-region-focusable): by script
      // only, never in the tab order; a mouse press never focuses it (keepFocus).
      tabindex: -1,
      onBlur: (event: unknown) => {
        if (!insideControl((event as FocusEvent).relatedTarget)) v.blur()
      },
      "data-empty": dataFlag(v.empty),
      "data-loading": dataFlag(loadingNow),
      onMouseDown: keepFocus,
    }),
    list: (): PartProps => {
      const {
        onKeyDown: _k,
        onFocusIn: _f,
        onFocusOut: _o,
        tabindex: _t,
        "aria-activedescendant": _a,
        ...own
      } = list.list(v.mounted.label ? {} : { "aria-label": v.messages.listboxLabel })
      return {
        ...own,
        "aria-label": v.mounted.label ? undefined : v.messages.listboxLabel,
        "aria-labelledby": v.mounted.label ? ids.label : undefined,
        "aria-describedby": undefined,
        // Focusable by script only, should a skin make the list the scrolling region.
        tabindex: -1,
        onPointerLeave: (event: unknown) => {
          if ((event as PointerEvent).pointerType !== "touch") send({ type: "LIST.POINTER_LEAVE" })
        },
        // The empty state hides the listbox (it is not exposed), never unmounts it.
        hidden: v.present && !v.exposed ? true : undefined,
      }
    },
    item: (key: CollectionKey): PartProps => {
      const own = list.item(key)
      return {
        ...own,
        "data-state":
          v.selectionMode === "none"
            ? undefined
            : isSelected(v.results, v.selection, key)
              ? "checked"
              : "unchecked",
        // Nothing can be selected: explicitly never selected (optionsNeverSelected).
        ...(v.selectionMode === "none" ? { "aria-selected": "false" } : {}),
        // A typing highlight (inline mount, a new query) shows the ring under the keyboard,
        // never after a pointer interaction.
        ...(c.highlightSource === "typing" && c.highlightedKey === key
          ? { "data-focus-visible": dataFlag(v.modality === "keyboard") }
          : {}),
        // Roving focus never applies: the input keeps focus.
        onFocus: undefined,
      }
    },
    itemText: list.itemText,
    itemDescription: list.itemDescription,
    itemIndicator: (key: CollectionKey): PartProps => ({
      ...list.itemIndicator(key),
      "data-state": isSelected(v.results, v.selection, key) ? "checked" : "unchecked",
    }),
    section: list.section,
    sectionLabel: list.sectionLabel,
    separator: list.separator,
    loadMore: list.loadMore,
    /** Loading content: a sibling of the listbox, never inside it, no live role. */
    loading: (): PartProps => ({
      ...v.common("loading"),
      hidden: loadingNow ? undefined : true,
    }),
    empty: (): PartProps => ({
      ...v.common("empty"),
      id: ids.empty,
      hidden: v.empty ? undefined : true,
    }),
  }
}

export type PatternApi = ReturnType<typeof patternConnect>
