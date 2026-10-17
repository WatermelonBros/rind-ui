// Tags Input parts: a native text input (no combobox role without suggestions), the chips
// of `input-chips` under scope "tags-input", the ChipInput of an edited tag, the form inputs.

import { focusAttrs } from "../../a11y/focus"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { hiddenFormInputStyle } from "../../dom/hidden-input"
import { partId } from "../../ids"
import {
  type Chip,
  focusAfterRemoval,
  type InputChipsEnv,
  inputChipsConnect,
} from "../input-chips/input-chips"
import type { FieldControlProps } from "../shared/field-control"
import { type Delimiters, defaultPasteDelimiters, hasDelimiter } from "./split"
import type { TagsInputContext, TagsInputEvent } from "./tags-input.machine"
import type { TagsInputMessages } from "./tags-input.messages"

export interface TagsInputConnectView {
  readonly instance: string
  readonly state: "idle" | "typing" | "editing"
  readonly context: TagsInputContext
  readonly tags: readonly string[]
  readonly chips: readonly Chip[]
  readonly inputValue: string
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly invalid: boolean
  readonly required: boolean
  readonly atMax: boolean
  /** The draft would become a tag (Enter is then prevented: no implicit submission). */
  readonly draftNotEmpty: boolean
  readonly delimiter: Delimiters
  readonly pasteDelimiter?: Delimiters | undefined
  readonly addOnPaste: boolean
  readonly modality: Modality
  readonly dir: "ltr" | "rtl"
  readonly locale: string
  readonly messages: TagsInputMessages
  readonly mounted: { readonly label: boolean }
  readonly name?: string | undefined
  readonly inputName?: string | undefined
  readonly form?: string | undefined
  readonly field?: FieldControlProps | undefined
  readonly fieldData?: Readonly<Record<`data-${string}`, string | undefined>> | undefined
  /** Runs `fn` and commits the render synchronously (the ChipInput exists right after). */
  readonly commitSync: (fn: () => void) => void
  readonly send: (event: TagsInputEvent) => void
}

export type TagsInputConnectEnv = InputChipsEnv

export const tagsInputIds = (instance: string) => ({
  label: partId("tags-input", instance, "label"),
  control: partId("tags-input", instance, "control"),
  input: partId("tags-input", instance, "input"),
  clear: partId("tags-input", instance, "clear-trigger"),
  chipInput: (key: string) =>
    `${partId("tags-input", instance, "chip-input")}-${encodeURIComponent(key)}`,
})

type Key = KeyboardEvent
const imeKey = (e: Key) => e.isComposing || e.keyCode === 229

export function tagsInputConnect(v: TagsInputConnectView, env: TagsInputConnectEnv) {
  const ids = tagsInputIds(v.instance)
  const { send, context: c } = v
  const focusEl = (id: string) => (env.dom.getById(id) as HTMLElement | null)?.focus()
  const insideControl = (target: unknown) =>
    target !== null && env.dom.getById(ids.control)?.contains(target as Node | null) === true
  const chips = inputChipsConnect(
    {
      scope: "tags-input",
      instance: v.instance,
      chips: v.chips,
      context: c,
      dir: v.dir,
      locale: v.locale,
      describeEmpty: true,
      messages: v.messages,
      inputId: ids.input,
      controlId: ids.control,
      send,
      blurHost: () => send({ type: "FOCUS.LEAVE" }),
    },
    env,
  )
  const editing = v.state === "editing"
  const common = (part: string): PartProps => ({
    ...scopeAttrs("tags-input", part, v.instance),
    "data-disabled": dataFlag(v.disabled),
    "data-readonly": dataFlag(v.readOnly),
    "data-invalid": dataFlag(v.invalid),
  })
  const rootLike = (part: string): PartProps => ({
    ...v.fieldData,
    ...common(part),
    ...focusAttrs(c.focused, v.modality),
    "data-empty-value": dataFlag(v.tags.length === 0),
    "data-at-max": dataFlag(v.atMax),
    "data-state": v.state,
  })
  const edit = (key: string) => {
    v.commitSync(() => send({ type: "TAG.EDIT", key }))
    const el = env.dom.getById(ids.chipInput(key)) as HTMLInputElement | null
    if (el) {
      el.focus()
      el.select()
    }
  }
  /** After an edit ends by key: back to the chip, or the removal focus rule. */
  const afterEdit = (key: string) => {
    const still = env.dom.getById(chips.ids.chip(key))
    if (still) {
      ;(still as HTMLElement).focus()
      return
    }
    const next = focusAfterRemoval(v.chips, key)
    focusEl(next === null ? ids.input : chips.ids.chip(next))
  }

  return {
    ids,
    chipIds: chips.ids,
    summaryText: chips.summaryText,
    root: (): PartProps => rootLike("root"),
    label: (): PartProps => ({ ...common("label"), id: ids.label, htmlFor: ids.input }),
    control: (): PartProps => ({
      ...rootLike("control"),
      id: ids.control,
      // A press on the Control's own box (padding, gaps) focuses the Input.
      onPointerDown: (event: unknown) => {
        const e = event as PointerEvent
        if (e.target !== e.currentTarget || v.disabled) return
        e.preventDefault()
        focusEl(ids.input)
      },
    }),
    input: (): PartProps => ({
      ...common("input"),
      ...focusAttrs(c.focused && c.focusedChip === null && !editing, v.modality),
      id: ids.input,
      type: "text",
      value: v.inputValue,
      disabled: v.disabled || undefined,
      readOnly: v.readOnly || undefined,
      autoComplete: "off",
      autoCorrect: "off",
      autoCapitalize: "none",
      spellCheck: "false",
      name: v.inputName,
      form: v.inputName !== undefined ? v.form : undefined,
      "aria-describedby":
        [v.field?.["aria-describedby"], chips.describedBy].filter(Boolean).join(" ") || undefined,
      "aria-labelledby": v.mounted.label ? undefined : v.field?.["aria-labelledby"],
      "aria-invalid": v.invalid ? "true" : undefined,
      "aria-required": v.field?.["aria-required"],
      "aria-errormessage": v.field?.["aria-errormessage"],
      "data-refused": c.refusal?.reason,
      "data-empty": dataFlag(v.inputValue === ""),
      onChange: (event: unknown) => {
        const e = event as { target: HTMLInputElement; nativeEvent?: InputEvent }
        const el = e.target
        const native = (e.nativeEvent ?? event) as InputEvent
        send({
          type: "INPUT.CHANGE",
          text: el.value,
          inputType: native.inputType ?? "insertText",
          composing: native.isComposing === true || c.composing,
          caretAtEnd: el.selectionStart === el.value.length && el.selectionEnd === el.value.length,
        })
      },
      onCompositionStart: () => send({ type: "COMPOSITION.START" }),
      onCompositionEnd: (event: unknown) => {
        const el = (event as CompositionEvent).target as HTMLInputElement
        send({
          type: "COMPOSITION.END",
          text: el.value,
          caretAtEnd: el.selectionStart === el.value.length,
        })
      },
      onFocus: () => send({ type: "INPUT.FOCUS", modality: env.modality.modality() }),
      onBlur: (event: unknown) => {
        if (!insideControl((event as FocusEvent).relatedTarget)) send({ type: "FOCUS.LEAVE" })
      },
      onPointerDown: () => {
        if (c.armedChip !== null) send({ type: "CARET" })
      },
      onPaste: (event: unknown) => {
        const e = event as ClipboardEvent
        const text = e.clipboardData?.getData("text/plain") ?? ""
        const delimiters = v.pasteDelimiter ?? defaultPasteDelimiters(v.delimiter)
        if (!v.addOnPaste || c.composing || !hasDelimiter(text, delimiters)) return
        // Taken over: split into tags. A plain paste stays the browser's (undo keeps working).
        e.preventDefault()
        send({ type: "PASTE", text, composing: false })
      },
      onKeyDown: (event: unknown) => {
        const e = event as Key
        if (imeKey(e) || c.composing) return
        const el = e.currentTarget as HTMLInputElement
        const atStart = el.selectionStart === 0 && el.selectionEnd === 0
        if (chips.inputKeyDown(e, el.value, atStart)) return
        switch (e.key) {
          case "Enter":
            // Prevented only when it creates: an empty Enter submits the form.
            if (v.draftNotEmpty && !v.disabled && !v.readOnly) e.preventDefault()
            send({ type: "ENTER", composing: false })
            return
          case "ArrowLeft":
          case "ArrowRight":
          case "Home":
          case "End":
            if (c.armedChip !== null) send({ type: "CARET" })
            return
        }
      },
    }),
    chips: chips.chips,
    chip: (key: string): PartProps => {
      const own = chips.chip(key)
      const ownKeyDown = own["onKeyDown"] as ((e: unknown) => void) | undefined
      const isEditing = editing && c.editingKey === key
      return {
        ...own,
        "data-editing": dataFlag(isEditing),
        onKeyDown: (event: unknown) => {
          const e = event as Key
          if (e.target !== e.currentTarget) return
          if (e.key === "Enter" && !imeKey(e)) {
            e.preventDefault()
            edit(key)
            return
          }
          ownKeyDown?.(event)
        },
        onDoubleClick: () => edit(key),
      }
    },
    chipText: (key: string): PartProps => ({
      ...scopeAttrs("tags-input", "chip-text", v.instance),
      hidden: editing && c.editingKey === key ? true : undefined,
    }),
    chipRemove: (key: string): PartProps => {
      const own = chips.chipRemove(key)
      // Read-only: shown, but not actionable.
      return v.readOnly
        ? { ...own, disabled: undefined, "aria-disabled": "true", onClick: undefined }
        : own
    },
    /** Rendered only while `key` is edited. */
    chipInput: (key: string): PartProps => {
      const tag = v.chips.find((ch) => ch.key === key)?.text ?? key
      return {
        ...scopeAttrs("tags-input", "chip-input", v.instance),
        id: ids.chipInput(key),
        type: "text",
        value: c.editText,
        "aria-label": v.messages.editLabel(tag),
        "data-refused": c.editRefusal?.reason,
        autoComplete: "off",
        spellCheck: "false",
        onChange: (event: unknown) =>
          send({ type: "EDIT.CHANGE", text: (event as { target: HTMLInputElement }).target.value }),
        onKeyDown: (event: unknown) => {
          const e = event as Key
          // Keys of the edit input never reach the chip or the input around it.
          e.stopPropagation()
          if (imeKey(e)) return
          if (e.key === "Enter") {
            e.preventDefault()
            v.commitSync(() => send({ type: "EDIT.COMMIT", composing: false }))
            if (env.dom.getById(ids.chipInput(key)) === null) afterEdit(key)
          } else if (e.key === "Escape") {
            e.preventDefault()
            v.commitSync(() => send({ type: "EDIT.CANCEL", composing: false }))
            afterEdit(key)
          }
        },
        onBlur: (event: unknown) => {
          const related = (event as FocusEvent).relatedTarget
          if (c.editingKey !== key) return
          send(insideControl(related) ? { type: "EDIT.BLUR" } : { type: "FOCUS.LEAVE" })
        },
      }
    },
    clearTrigger: (): PartProps => {
      const visible = v.inputValue !== "" || v.chips.some((ch) => !ch.disabled)
      return {
        ...common("clear-trigger"),
        id: ids.clear,
        type: "button",
        tabindex: -1,
        "aria-label": v.messages.clearLabel,
        "data-visible": dataFlag(visible),
        disabled: v.disabled || undefined,
        "aria-disabled": v.readOnly ? "true" : undefined,
        onMouseDown: (event: unknown) => {
          if ((event as MouseEvent).button === 0) (event as MouseEvent).preventDefault()
        },
        onClick: () => {
          if (v.readOnly || v.disabled) return
          send({ type: "CLEAR.PRESS" })
          focusEl(ids.input)
        },
      }
    },
    chipsSummary: chips.summary,
    /** The constraint input: empty exactly while there are no tags. */
    hiddenInput: (): PartProps => ({
      ...scopeAttrs("tags-input", "hidden-input", v.instance),
      type: "text",
      "aria-hidden": "true",
      tabIndex: -1,
      autoComplete: "off",
      required: v.required || undefined,
      disabled: v.disabled || undefined,
      form: v.form,
      style: hiddenFormInputStyle,
      defaultValue: v.tags.join(","),
    }),
    /** One submitted entry per tag, in order (none without a name). */
    carriers: (): readonly PartProps[] =>
      v.name === undefined
        ? []
        : v.tags.map((tag) => ({
            type: "hidden",
            name: v.name,
            value: tag,
            form: v.form,
            disabled: v.disabled || undefined,
          })),
  }
}

export type TagsInputApi = ReturnType<typeof tagsInputConnect>
