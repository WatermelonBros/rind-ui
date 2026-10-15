// Toolbar parts (design §2, §4): a `toolbar` root that owns the axis arrows and Home/End
// for its own controls only (toolbarKeyAction), roving props for every control — its own
// Button / Link / Item and the items of hosted composites — keyed by the control's
// element id, groups and separators. Controls keep their own components' behaviour.

import { tabStop } from "../../collection/composite"
import type { CollectionKey } from "../../collection/key"
import type { Collection } from "../../collection/list"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { describeKey } from "../../dom/keyboard"
import { isTextField, textFieldCaret } from "../../dom/text-field"
import type { PlatformInfo } from "../../env/capabilities"
import { partId } from "../../ids"
import { separatorProps } from "../separator/separator.connect"
import { toolbarKeyAction } from "./toolbar.keys"
import type { ToolbarEvent } from "./toolbar.machine"

export type ToolbarPart = "root" | "button" | "link" | "item" | "group" | "separator"

export const toolbarIds = (root: string) => ({
  list: partId("toolbar", root, "root"),
  /** Controls are keyed by their element id. */
  item: (key: CollectionKey) => key as string,
})

export interface ToolbarConnectInput {
  readonly instance: string
  readonly collection: Collection<unknown>
  readonly highlightedKey: CollectionKey | null
  /** Focus is inside the toolbar (data-highlighted shows only then). */
  readonly focusWithin: boolean
  /** Controls not registered yet (server render, first paint). */
  readonly pending: boolean
  readonly orientation: "horizontal" | "vertical"
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
}

/** One control's own state. */
export interface ToolbarControlState {
  /** The control's element id (its key). */
  readonly id: string
  /** Disabled by itself, its group or the toolbar. */
  readonly disabled: boolean
  /** Server render: whether this is the first control rendered. */
  readonly first: boolean
}

export type ToolbarEnv = PlatformInfo & {
  readonly locale: { dir(): "ltr" | "rtl" }
  readonly modality: { modality(): Modality }
}

export function toolbarConnect(
  input: ToolbarConnectInput,
  send: (event: ToolbarEvent) => void,
  env: ToolbarEnv,
) {
  const ids = toolbarIds(input.instance)
  const c = input.collection
  const stop = tabStop({
    collection: c,
    highlightedKey: input.highlightedKey,
    highlightSource: null,
    selection: new Set(),
    selectionMode: "none",
    focusableWhenDisabled: input.focusableWhenDisabled,
  })
  const common = { "data-orientation": input.orientation }
  /** The roving props every control takes (own or hosted). */
  const control = (s: ToolbarControlState): PartProps => {
    const key = s.id as CollectionKey // controls are keyed by their element id
    return {
      ...common,
      // Every control, own or hosted (contract queries list them in document order).
      "data-host": "toolbar",
      tabindex: input.pending ? (s.first ? 0 : -1) : key === stop ? 0 : -1,
      "data-disabled": dataFlag(s.disabled),
      "data-highlighted": dataFlag(input.focusWithin && input.highlightedKey === key),
      onFocus: () => send({ type: "FOCUS", key, modality: env.modality.modality() }),
    }
  }
  return {
    root: (): PartProps => ({
      ...scopeAttrs("toolbar", "root", input.instance),
      ...common,
      id: ids.list,
      role: "toolbar",
      "aria-orientation": input.orientation === "vertical" ? "vertical" : undefined,
      "data-disabled": dataFlag(input.disabled),
      onKeyDown: (event: unknown) => {
        const e = event as KeyboardEvent
        const target = e.target as Element | null
        const move = toolbarKeyAction(
          { ...describeKey(e, env), defaultPrevented: e.defaultPrevented },
          {
            // Only the toolbar's own controls: never keys from popups or nested content.
            isControl: target !== null && target.id !== "" && c.has(target.id as CollectionKey),
            textField: target && isTextField(target) ? textFieldCaret(target) : null,
          },
          { orientation: input.orientation, dir: env.locale.dir(), platform: env.platform },
        )
        if (move === null) return
        e.preventDefault()
        send({ type: "NAVIGATE", move })
      },
      onFocusOut: (event: unknown) => {
        const e = event as FocusEvent
        const root = e.currentTarget as Element | null
        if (!root?.contains(e.relatedTarget as Node | null)) send({ type: "BLUR" })
      },
    }),
    /** Roving props for a control part (`button`, `link`, `item`) or a hosted item. */
    control,
    /** The part's own scope attributes (hosted items keep their component's). */
    part: (part: "button" | "link" | "item", id: string): PartProps => ({
      ...scopeAttrs("toolbar", part, input.instance),
      "data-key": id,
    }),
    group: (disabled: boolean): PartProps => ({
      ...scopeAttrs("toolbar", "group", input.instance),
      ...common,
      role: "group",
      "data-disabled": dataFlag(disabled),
    }),
    /** Perpendicular to the toolbar by default; an explicit orientation wins. */
    separator: (own: { orientation?: unknown; tag: string }): PartProps =>
      separatorProps({
        orientation: own.orientation,
        defaultOrientation: input.orientation === "horizontal" ? "vertical" : "horizontal",
        tag: own.tag,
        context: "toolbar",
        scope: "toolbar",
        instance: input.instance,
      }),
  }
}
