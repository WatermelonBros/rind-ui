// Sortable parts (add-sortable design §4): the handle is a button named for its item and
// described by the instructions (read outside forms mode too: React Aria #3220 is why the
// name says what it does); aria-pressed while picked up. Items move in the DOM (the order is
// the reading order); only a pointer drag shows a visual offset.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import type { SortableMessages } from "./sortable.messages"

export type SortablePart = "root" | "item" | "handle" | "indicator" | "move-button"
export type SortableOrientation = "vertical" | "horizontal"

export interface SortableConnectInput {
  readonly instance: string
  readonly state: "idle" | "moving" | "dragging"
  readonly items: readonly string[]
  readonly orientation: SortableOrientation
  readonly active: string | null
  readonly disabled: (key: string) => boolean
  readonly label: (key: string) => string
  /**
   * A pointer drag: the active item's offset, the indicator's position, the drop index, and
   * the room the active item takes along the axis (its size plus the gap), all in px.
   */
  readonly drag: {
    readonly delta: { readonly x: number; readonly y: number }
    readonly indicator: number
    readonly target?: number
    readonly room?: number
  } | null
  readonly ids: { readonly instructions: string }
  readonly messages: SortableMessages
}

export interface SortableFocus {
  readonly focused: boolean
  readonly modality: Modality
}
const NONE: SortableFocus = { focused: false, modality: "pointer" }

export function sortableConnect(input: SortableConnectInput) {
  const part = (name: SortablePart): PartProps => scopeAttrs("sortable", name, input.instance)
  const shared = { "data-orientation": input.orientation }
  return {
    root: (): PartProps => ({
      ...part("root"),
      ...shared,
      "data-state": input.state,
      style: { position: "relative" },
    }),
    item: (key: string): PartProps => {
      const active = input.active === key
      const dragging = active && input.state === "dragging" && input.drag !== null
      // the others between the picked item's place and the drop index step aside by its room,
      // so the gap it will drop into opens where it will land (a skin may transition it)
      const from = input.active === null ? -1 : input.items.indexOf(input.active)
      const at = input.items.indexOf(key)
      const to = input.drag?.target ?? from
      const room = input.drag?.room ?? 0
      const shift =
        input.state !== "dragging" || active || from < 0 || room === 0
          ? 0
          : from < to && at > from && at <= to
            ? -room
            : from > to && at >= to && at < from
              ? room
              : 0
      const horizontal = input.orientation === "horizontal"
      return {
        ...part("item"),
        ...shared,
        "data-value": key,
        "data-index": String(input.items.indexOf(key)),
        "data-active": dataFlag(active),
        "data-dragging": dataFlag(dragging),
        "data-disabled": dataFlag(input.disabled(key)),
        "data-shifted": dataFlag(shift !== 0),
        ...(dragging && input.drag
          ? {
              style: {
                "--rind-sortable-x": `${input.drag.delta.x}px`,
                "--rind-sortable-y": `${input.drag.delta.y}px`,
                transform: "translate(var(--rind-sortable-x), var(--rind-sortable-y))",
                position: "relative",
                zIndex: "1",
              },
            }
          : input.state === "dragging" && !active
            ? {
                style: {
                  "--rind-sortable-shift": `${shift}px`,
                  transform: horizontal
                    ? "translateX(var(--rind-sortable-shift))"
                    : "translateY(var(--rind-sortable-shift))",
                },
              }
            : {}),
      }
    },
    handle: (key: string, focus: SortableFocus = NONE): PartProps => ({
      ...part("handle"),
      ...shared,
      ...focusAttrs(focus.focused, focus.modality),
      type: "button",
      "aria-label": input.messages.handleLabel(input.label(key)),
      "aria-describedby": input.ids.instructions,
      "aria-pressed": input.active === key && input.state === "moving" ? "true" : "false",
      "aria-disabled": input.disabled(key) ? "true" : undefined,
      "data-active": dataFlag(input.active === key),
      "data-disabled": dataFlag(input.disabled(key)),
      style: { touchAction: "none" },
    }),
    instructions: (): PartProps => ({ id: input.ids.instructions, style: visuallyHiddenStyle }),
    instructionsText: input.messages.instructions,
    indicator: (): PartProps => ({
      ...part("indicator"),
      ...shared,
      "aria-hidden": "true",
      "data-hidden": dataFlag(input.drag === null),
      style: {
        position: "absolute",
        "--rind-sortable-indicator": `${input.drag?.indicator ?? 0}px`,
        ...(input.drag === null ? { display: "none" } : {}),
      },
    }),
    moveButton: (key: string, direction: "up" | "down"): PartProps => {
      const i = input.items.indexOf(key)
      const atEnd = direction === "up" ? i <= 0 : i >= input.items.length - 1
      const off = atEnd || input.disabled(key)
      return {
        ...part("move-button"),
        ...shared,
        type: "button",
        "data-direction": direction,
        "aria-label": (direction === "up" ? input.messages.moveUp : input.messages.moveDown)(
          input.label(key),
        ),
        "aria-disabled": off ? "true" : undefined,
        "data-disabled": dataFlag(off),
      }
    },
  }
}
