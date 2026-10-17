// input-chips (spec input-chips): the chips of a text-input control for the values it
// holds — toolbar, roving chips, remove buttons, Backspace arm-then-remove, removal focus,
// the summary node and the removal announcement. Not a machine: a host spreads the actions
// and guards, owns its values and handles CHIP.REMOVE itself.

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"
import { partId } from "../../ids"

export interface InputChipsMessages {
  readonly chipsLabel: string
  /** Same key and default as Tag Group's. */
  readonly removeLabel: (text: string) => string
  /** The input's description; `locale` for plural rules. */
  readonly tagsSummary: (texts: readonly string[], locale?: string) => string
  /** Same key and default as Tag Group's. */
  readonly removedAnnouncement: (text: string) => string
}

export const inputChipsMessages: InputChipsMessages = {
  chipsLabel: "Selected",
  removeLabel: (text) => `Remove ${text}`,
  tagsSummary: (texts) => texts.join(", "),
  removedAnnouncement: (text) => `${text} removed`,
}

export type InputChipsEvent =
  /** Focus moved onto a chip (arrow keys or a press). */
  | { readonly type: "CHIP.NAVIGATE"; readonly key: string; readonly modality: Modality }
  | { readonly type: "CHIP.REMOVE"; readonly key: string }
  /** A printable key or a paste on a chip: the text goes to the input. */
  | { readonly type: "CHIP.TYPE"; readonly text: string }
  /** Backspace in the empty input with the caret at the start. */
  | { readonly type: "BACKSPACE_EMPTY" }
  | { readonly type: "CHIP.BLUR" }

export interface InputChipsContext {
  /** The chip that has DOM focus. */
  readonly focusedChip: string | null
  readonly focusedChipModality: Modality | null
  /** The chip the next Backspace removes. */
  readonly armedChip: string | null
}

export const initialInputChipsContext = (): InputChipsContext => ({
  focusedChip: null,
  focusedChipModality: null,
  armedChip: null,
})

export interface Chip {
  readonly key: string
  readonly text: string
  readonly disabled: boolean
}

/** The last chip Backspace may arm (disabled chips are skipped). */
export const lastRemovable = (chips: readonly Chip[]) =>
  [...chips].reverse().find((c) => !c.disabled)?.key ?? null

/** Where focus goes after removing `key`: the next enabled chip, else the previous, else the input. */
export function focusAfterRemoval(chips: readonly Chip[], key: string): string | null {
  const i = chips.findIndex((c) => c.key === key)
  const after = chips.slice(i + 1).find((c) => !c.disabled)
  const before = [...chips.slice(0, i)].reverse().find((c) => !c.disabled)
  return after?.key ?? before?.key ?? null
}

/** The host's context writer, as the host machine's actions receive it. */
export interface InputChipsActionArgs {
  readonly event: { readonly type: string }
  readonly context: InputChipsContext
  set(key: keyof InputChipsContext, value: never): void
}

/** Actions a host spreads (its own CHIP.REMOVE handler removes the value). */
export const inputChipsActions = {
  /** Any caret move, press or text change in the input, and focus leaving: disarm. */
  disarm: (a: InputChipsActionArgs) => a.set("armedChip", null as never),
  focusChip: (a: InputChipsActionArgs) => {
    const e = a.event as InputChipsEvent
    if (e.type !== "CHIP.NAVIGATE") return
    a.set("focusedChip", e.key as never)
    a.set("focusedChipModality", e.modality as never)
    a.set("armedChip", null as never)
  },
  blurChip: (a: InputChipsActionArgs) => {
    a.set("focusedChip", null as never)
    a.set("focusedChipModality", null as never)
  },
}

export interface InputChipsView {
  readonly scope: string
  readonly instance: string
  readonly chips: readonly Chip[]
  readonly context: InputChipsContext
  readonly dir: "ltr" | "rtl"
  readonly messages: InputChipsMessages
  readonly locale?: string | undefined
  /** The summary describes the input also with no chips ("No tags"). */
  readonly describeEmpty?: boolean | undefined
  /** The host's input and control ids (removal focus, inside test). */
  readonly inputId: string
  readonly controlId: string
  readonly send: (event: InputChipsEvent) => void
  /** The host's "focus left the component" (sent when focus leaves a chip for outside). */
  readonly blurHost: () => void
}

export interface InputChipsEnv {
  readonly dom: { getById(id: string): Element | null }
  readonly modality: { modality(): Modality }
}

export const inputChipsIds = (scope: string, instance: string) => ({
  chips: partId(scope, instance, "chips"),
  summary: partId(scope, instance, "chips-summary"),
  chip: (key: string) => `${partId(scope, instance, "chip")}-${encodeURIComponent(key)}`,
})

type Key = KeyboardEvent

export function inputChipsConnect(v: InputChipsView, env: InputChipsEnv) {
  const ids = inputChipsIds(v.scope, v.instance)
  const scoped = (part: string) => scopeAttrs(v.scope, part, v.instance)
  const enabled = v.chips.filter((c) => !c.disabled)
  const focusById = (id: string) => (env.dom.getById(id) as HTMLElement | null)?.focus()
  const goTo = (key: string | null, modality: Modality) => {
    if (key === null) {
      focusById(v.inputId)
      return
    }
    v.send({ type: "CHIP.NAVIGATE", key, modality })
    focusById(ids.chip(key))
  }
  const step = (key: string, delta: 1 | -1) => {
    const i = enabled.findIndex((c) => c.key === key)
    return enabled[i + delta]?.key ?? null
  }
  const remove = (key: string) => {
    const chip = v.chips.find((c) => c.key === key)
    if (!chip || chip.disabled) return
    const next = focusAfterRemoval(v.chips, key)
    v.send({ type: "CHIP.REMOVE", key })
    goTo(next, env.modality.modality())
  }
  const inside = (target: unknown) =>
    env.dom.getById(v.controlId)?.contains(target as Node | null) === true

  return {
    ids,
    /** The input's description: the summary node, while there are chips. */
    describedBy: v.chips.length > 0 || v.describeEmpty ? ids.summary : undefined,
    /**
     * The input's keys that belong to the chips; true when handled (the host then stops).
     * `atStart`: the caret is at 0 with no selection.
     */
    inputKeyDown: (e: Key, text: string, atStart: boolean): boolean => {
      if (e.key === "Backspace" && text === "" && atStart) {
        v.send({ type: "BACKSPACE_EMPTY" })
        return true
      }
      const back = v.dir === "rtl" ? "ArrowRight" : "ArrowLeft"
      if (e.key === back && atStart && !e.shiftKey && enabled.length > 0) {
        e.preventDefault()
        goTo(enabled.at(-1)?.key ?? null, "keyboard")
        return true
      }
      return false
    },
    chips: (): PartProps => ({
      ...scoped("chips"),
      id: ids.chips,
      role: "toolbar",
      "aria-label": v.messages.chipsLabel,
      // The toolbar never takes focus itself; chips are reached with arrows from the input.
      "data-empty": dataFlag(v.chips.length === 0),
    }),
    chip: (key: string): PartProps => {
      const chip = v.chips.find((c) => c.key === key)
      const focused = v.context.focusedChip === key
      return {
        ...scoped("chip"),
        id: ids.chip(key),
        tabindex: -1,
        "aria-disabled": chip?.disabled ? "true" : undefined,
        "data-disabled": dataFlag(chip?.disabled === true),
        "data-highlighted": dataFlag(focused || v.context.armedChip === key),
        "data-armed": dataFlag(v.context.armedChip === key),
        "data-focus-visible": dataFlag(focused && v.context.focusedChipModality === "keyboard"),
        onFocus: () => {
          if (v.context.focusedChip !== key) {
            v.send({ type: "CHIP.NAVIGATE", key, modality: env.modality.modality() })
          }
        },
        onBlur: (event: unknown) => {
          const related = (event as FocusEvent).relatedTarget
          v.send({ type: "CHIP.BLUR" })
          if (!inside(related)) v.blurHost()
        },
        onKeyDown: (event: unknown) => {
          const e = event as Key
          if (e.target !== e.currentTarget) return
          const next = v.dir === "rtl" ? "ArrowLeft" : "ArrowRight"
          const prev = v.dir === "rtl" ? "ArrowRight" : "ArrowLeft"
          if (e.key === prev) {
            e.preventDefault()
            const to = step(key, -1)
            if (to !== null) goTo(to, "keyboard")
          } else if (e.key === next) {
            e.preventDefault()
            goTo(step(key, 1), "keyboard")
          } else if (e.key === "Backspace" || e.key === "Delete") {
            e.preventDefault()
            remove(key)
          } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault()
            focusById(v.inputId)
            v.send({ type: "CHIP.TYPE", text: e.key })
          }
        },
        onPaste: (event: unknown) => {
          const e = event as ClipboardEvent
          const text = e.clipboardData?.getData("text/plain") ?? ""
          if (text === "") return
          e.preventDefault()
          focusById(v.inputId)
          v.send({ type: "CHIP.TYPE", text })
        },
      }
    },
    chipRemove: (key: string): PartProps => {
      const chip = v.chips.find((c) => c.key === key)
      return {
        ...scoped("chip-remove"),
        type: "button",
        tabindex: -1,
        "aria-label": v.messages.removeLabel(chip?.text ?? key),
        disabled: chip?.disabled === true || undefined,
        "data-disabled": dataFlag(chip?.disabled === true),
        // A press never takes focus from the input (the host's popup stays open).
        onMouseDown: (event: unknown) => {
          const e = event as MouseEvent
          if (e.button === 0) e.preventDefault()
        },
        onClick: () => {
          const chip2 = v.chips.find((c) => c.key === key)
          if (!chip2 || chip2.disabled) return
          v.send({ type: "CHIP.REMOVE", key })
          if (env.modality.modality() !== "touch") focusById(v.inputId)
        },
      }
    },
    summary: (): PartProps => ({
      ...scoped("chips-summary"),
      id: ids.summary,
      hidden: v.chips.length === 0 && !v.describeEmpty ? true : undefined,
      style: visuallyHiddenStyle,
    }),
    summaryText: v.messages.tagsSummary(
      v.chips.map((c) => c.text),
      v.locale,
    ),
  }
}

export type InputChipsApi = ReturnType<typeof inputChipsConnect>
