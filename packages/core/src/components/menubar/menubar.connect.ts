// Menubar parts (design §5): the root (role menubar, the bar's keys) and what the bar adds
// to each menu's trigger: the roving tab stop, `data-key`, `data-highlighted`, the opening
// keys. The trigger itself is the menu's (role menuitem in menubar mode).

import { type KeyContext, toLogicalKey } from "../../a11y/keys"
import { tabStop } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { keyDir } from "../../dom/direction"
import { describeKey, isTypeaheadKey } from "../../dom/keyboard"
import type { PlatformInfo } from "../../env/capabilities"
import { partId } from "../../ids"
import type { MenubarEvent } from "./menubar.machine"

export interface MenubarConnectInput {
  readonly instance: string
  readonly collection: Collection<unknown>
  readonly highlightedKey: CollectionKey | null
  /** Focus is on a bar item (data-highlighted shows only then). */
  readonly focusWithin: boolean
  /** Items not registered yet (server render, first paint). */
  readonly pending: boolean
  /** The open menu's key, or null. */
  readonly value: string | null
  readonly orientation: "horizontal" | "vertical"
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  readonly modal: boolean
}

/** One bar item's own state. */
export interface MenubarItemState {
  readonly key: CollectionKey
  readonly disabled: boolean
  /** Server render: the first item rendered. */
  readonly first: boolean
}

export type MenubarEnv = PlatformInfo & {
  readonly locale: { dir(): "ltr" | "rtl" }
  readonly modality: { modality(): Modality }
}

export const menubarIds = (instance: string) => ({
  root: partId("menubar", instance, "root"),
})

/** The bar's own move for a keydown on one of its items, or null (not its key). */
function barMove(
  e: KeyboardEvent,
  env: MenubarEnv,
  orientation: "horizontal" | "vertical",
): "next" | "previous" | "first" | "last" | null {
  const k = describeKey(e, env)
  if (k.alt || k.ctrl || k.meta || k.composing) return null
  const ctx: KeyContext = { dir: keyDir(e, env.locale.dir()), orientation, platform: env.platform }
  const logical = toLogicalKey(k, ctx)
  if (logical === "NEXT") return "next"
  if (logical === "PREV") return "previous"
  if (logical === "FIRST") return "first"
  if (logical === "LAST") return "last"
  return null
}

export function menubarConnect(
  input: MenubarConnectInput,
  send: (event: MenubarEvent) => void,
  env: MenubarEnv,
) {
  const c = input.collection
  const stop = tabStop({
    collection: c,
    highlightedKey: input.highlightedKey,
    highlightSource: null,
    selection: new Set(),
    selectionMode: "none",
    focusableWhenDisabled: input.focusableWhenDisabled,
  })
  const vertical = input.orientation === "vertical"
  const ownItem = (target: EventTarget | null) => {
    const el = target as Element | null
    const key = el?.getAttribute?.("data-key") ?? null
    return key !== null &&
      el?.closest('[data-scope="menubar"][data-part="root"]') !== null &&
      c.has(key as CollectionKey)
      ? (key as CollectionKey)
      : null
  }
  return {
    root: (): PartProps => ({
      ...scopeAttrs("menubar", "root", input.instance),
      id: menubarIds(input.instance).root,
      role: "menubar",
      "aria-orientation": vertical ? "vertical" : undefined,
      "data-orientation": input.orientation,
      "data-state": input.value === null ? "closed" : "open",
      "data-disabled": dataFlag(input.disabled),
      "data-modal": dataFlag(input.modal),
      // The bar's keys, only on its own items and only while no menu is open (an open
      // menu's keys are its own; huntabyte/bits-ui#1593).
      onKeyDown: (event: unknown) => {
        const e = event as KeyboardEvent
        if (e.defaultPrevented) return
        const key = ownItem(e.target)
        if (key === null) return
        // Tab from a bar item closes the open menu; the key's default moves on.
        if (e.key === "Tab" && input.value !== null) {
          send({ type: "CLOSE", reason: "tab-key" })
          return
        }
        if (input.value !== null) return
        const moveTo = barMove(e, env, input.orientation)
        if (moveTo !== null) {
          e.preventDefault()
          send({ type: "NAVIGATE", move: moveTo })
          return
        }
        const k = describeKey(e, env)
        if (isTypeaheadKey(k)) {
          e.preventDefault()
          send({
            type: "TYPEAHEAD",
            char: k.key,
            composing: false,
            modifiers: { ctrl: false, meta: false, alt: false },
          })
        }
      },
      onFocusOut: (event: unknown) => {
        const e = event as FocusEvent
        const root = e.currentTarget as Element | null
        if (!root?.contains(e.relatedTarget as Node | null)) send({ type: "BLUR" })
      },
    }),
    /** What the bar adds to an item's menu trigger. */
    item: (s: MenubarItemState): PartProps => {
      const disabled = input.disabled || s.disabled
      // Role, aria-expanded, data-state, aria-disabled and its scope (data-scope="menu",
      // the menu's instance: the menu's parts resolve through it) are the menu trigger's.
      return {
        "data-host": "menubar",
        "data-key": s.key,
        "data-orientation": input.orientation,
        tabindex: input.pending ? (s.first ? 0 : -1) : s.key === stop ? 0 : -1,
        "data-highlighted": dataFlag(input.focusWithin && input.highlightedKey === s.key),
        onFocus: () => send({ type: "FOCUS", key: s.key, modality: env.modality.modality() }),
        // The arrow opening keys: on the item, with no menu open (kobaltedev/kobalte#332).
        onKeyDown: (event: unknown) => {
          const e = event as KeyboardEvent
          if (e.target !== e.currentTarget || input.value !== null || disabled) return
          const k = describeKey(e, env)
          if (k.alt || k.ctrl || k.meta || k.composing) return
          const expand =
            vertical &&
            ((keyDir(e, env.locale.dir()) === "rtl" && e.key === "ArrowLeft") ||
              (keyDir(e, env.locale.dir()) !== "rtl" && e.key === "ArrowRight"))
          // Enter and Space are the trigger's press (TRIGGER_PRESS with its modality).
          const edge =
            expand || (!vertical && e.key === "ArrowDown")
              ? "first"
              : !vertical && e.key === "ArrowUp"
                ? "last"
                : null
          if (edge === null) return
          e.preventDefault()
          send({ type: "TRIGGER_KEY", key: s.key, edge })
        },
        // Mouse and pen hover switch while a menu is open (never touch, never closed).
        onPointerMove: (event: unknown) => {
          const e = event as PointerEvent
          if (input.value === null || input.value === s.key || disabled) return
          if (e.pointerType !== "mouse" && e.pointerType !== "pen") return
          send({ type: "TRIGGER_HOVER", key: s.key })
        },
      }
    },
  }
}

declare const process: { env: { NODE_ENV?: string } }
const warnedInBar = new WeakSet<Element>()

/**
 * Development: a menu's content rendered inside its menubar (no Portal) puts `role="menu"`
 * among the bar's children, which a menubar may not own (axe aria-required-children,
 * base-ui#4004). One warning per bar.
 */
export function warnMenuInMenubar(content: Element): void {
  if (process.env.NODE_ENV === "production") return
  const bar = content.parentElement?.closest('[role="menubar"]')
  if (!bar || warnedInBar.has(bar)) return
  warnedInBar.add(bar)
  console.warn(
    "[rind-ui] menubar: a menu's content is rendered inside the bar; wrap it in Menu.Portal (a menubar may only own its items).",
  )
}
