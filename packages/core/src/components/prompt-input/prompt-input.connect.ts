// Prompt Input parts: a native form and textarea, one Submit button that becomes Stop, the
// attach button and its file chooser, the attachments as `input-chips` (scope
// "prompt-input"), and the count. Keys go through `describeKey` (the IME guard).

import { focusAttrs } from "../../a11y/focus"
import { isMod } from "../../a11y/keys"
import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import {
  dragHasFiles,
  dragLeftRoot,
  filesFromClipboard,
  filesFromDrop,
} from "../../dom/file-intake"
import { describeKey } from "../../dom/keyboard"
import type { PlatformInfo } from "../../env/capabilities"
import { partId } from "../../ids"
import { type Chip, type InputChipsEnv, inputChipsConnect } from "../input-chips/input-chips"
import type {
  PromptAttachment,
  PromptInputContext,
  PromptInputEvent,
  PromptSubmitKey,
} from "./prompt-input.machine"
import type { PromptInputMessages } from "./prompt-input.messages"

export type PromptInputState = "idle" | "composing" | "submitting" | "streaming" | "stopped"

export interface PromptInputConnectView {
  readonly instance: string
  readonly state: PromptInputState
  readonly context: PromptInputContext
  readonly value: string
  readonly attachments: readonly PromptAttachment[]
  readonly chips: readonly Chip[]
  readonly disabled: boolean
  readonly readOnly: boolean
  /** The machine's `submittable` guard, for the attributes (the machine still decides). */
  readonly submittable: boolean
  readonly overLimit: boolean
  /** The effective submit key (touch-primary devices: Enter is a newline). */
  readonly submitKey: PromptSubmitKey
  /** Enter alone submits (decides `enterkeyhint`). */
  readonly enterSubmits: boolean
  /** What ArrowUp / ArrowDown would recall; `browsing`: the draft is a recalled entry. */
  readonly recall: { readonly older: boolean; readonly newer: boolean; readonly browsing: boolean }
  readonly accept?: string | undefined
  readonly multiple: boolean
  readonly name: string
  readonly filesName: string
  /** The used / limit text of a CharacterCount, when one is mounted. */
  readonly count: { readonly used: number; readonly limit: number | undefined } | null
  readonly mounted: { readonly label: boolean; readonly description: boolean }
  readonly modality: Modality
  readonly dir: "ltr" | "rtl"
  readonly locale: string
  readonly messages: PromptInputMessages
  /** The button that has DOM focus (focus attributes). */
  readonly focusedButton: "submit" | "attach-trigger" | null
  readonly setFocusedButton: (part: "submit" | "attach-trigger" | null) => void
  /** The consumer gave a form `action`: a submit is not prevented (React form actions). */
  readonly nativeAction: boolean
  readonly send: (event: PromptInputEvent) => void
}

export type PromptInputConnectEnv = InputChipsEnv & PlatformInfo

export const promptInputIds = (instance: string) => ({
  root: partId("prompt-input", instance, "root"),
  label: partId("prompt-input", instance, "label"),
  description: partId("prompt-input", instance, "description"),
  textarea: partId("prompt-input", instance, "textarea"),
  submit: partId("prompt-input", instance, "submit"),
  picker: partId("prompt-input", instance, "file-picker"),
  files: partId("prompt-input", instance, "files"),
  count: partId("prompt-input", instance, "character-count"),
})

type Key = KeyboardEvent

const INTERACTIVE = "button, textarea, input, select, a[href], [tabindex], [contenteditable]"

export function promptInputConnect(v: PromptInputConnectView, env: PromptInputConnectEnv) {
  const ids = promptInputIds(v.instance)
  const { send, context: c } = v
  const busy = v.state === "submitting" || v.state === "streaming" || v.state === "stopped"
  const byId = (id: string) => env.dom.getById(id) as HTMLElement | null
  const chips = inputChipsConnect(
    {
      scope: "prompt-input",
      instance: v.instance,
      chips: v.chips,
      context: c,
      dir: v.dir,
      locale: v.locale,
      messages: v.messages,
      inputId: ids.textarea,
      controlId: ids.root,
      send,
      blurHost: () => send({ type: "BLUR" }),
    },
    env,
  )
  const common = (part: string): PartProps => ({
    ...scopeAttrs("prompt-input", part, v.instance),
    "data-state": v.state,
    "data-disabled": dataFlag(v.disabled),
  })
  const stateful = (part: string): PartProps => ({
    ...common(part),
    "data-empty": dataFlag(v.value === ""),
    "data-composing": dataFlag(c.composing),
    "data-over-limit": dataFlag(v.overLimit),
  })
  /** A key press, or the API: the form's own submission, so FormData and listeners see it. */
  const requestSubmit = () => {
    const form = (byId(ids.textarea) as HTMLTextAreaElement | null)?.form
    if (!form) {
      send({ type: "SUBMIT", event: null, formData: null })
      return
    }
    const submitter = byId(ids.submit) as HTMLButtonElement | null
    form.requestSubmit(submitter?.type === "submit" && submitter.form === form ? submitter : null)
  }
  const openPicker = () => {
    if (v.disabled || v.readOnly) return
    ;(byId(ids.picker) as HTMLInputElement | null)?.click()
  }

  return {
    ids,
    chipIds: chips.ids,
    summaryText: chips.summaryText,
    requestSubmit,
    openPicker,
    root: (): PartProps => ({
      ...stateful("root"),
      id: ids.root,
      ...focusAttrs(c.focused, v.modality),
      "data-dragging": dataFlag(c.dragging),
      "data-has-attachments": dataFlag(v.attachments.length > 0),
      onSubmit: (event: unknown) => {
        const e = event as SubmitEvent
        const form = e.currentTarget as HTMLFormElement
        const idle = v.state === "idle"
        if (!idle || !v.submittable) {
          e.preventDefault()
          return
        }
        // Read before the draft clears.
        const formData = new FormData(form)
        if (!v.nativeAction) e.preventDefault()
        send({ type: "SUBMIT", event: e, formData })
      },
      // A press on the box (padding, gaps) focuses the Textarea (prompt-kit#55).
      onPointerDown: (event: unknown) => {
        const e = event as PointerEvent
        const target = e.target as Element | null
        if (v.disabled || e.button !== 0 || !target || target.closest(INTERACTIVE)) return
        e.preventDefault()
        byId(ids.textarea)?.focus()
      },
      onDragEnter: (event: unknown) => {
        const e = event as DragEvent
        if (!dragHasFiles(e.dataTransfer)) return
        e.preventDefault()
        if (!c.dragging) send({ type: "DRAG.ENTER" })
      },
      // Prevented so a drop does not navigate the tab to the file.
      onDragOver: (event: unknown) => {
        const e = event as DragEvent
        if (!dragHasFiles(e.dataTransfer)) return
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = v.disabled || v.readOnly ? "none" : "copy"
        if (!c.dragging && !v.disabled && !v.readOnly) send({ type: "DRAG.ENTER" })
      },
      onDragLeave: (event: unknown) => {
        const e = event as DragEvent
        const root = e.currentTarget as Element
        if (c.dragging && dragLeftRoot(root, e.relatedTarget)) send({ type: "DRAG.LEAVE" })
      },
      onDrop: (event: unknown) => {
        const e = event as DragEvent
        if (!dragHasFiles(e.dataTransfer)) return
        e.preventDefault()
        send({ type: "DRAG.LEAVE" })
        const files = filesFromDrop(e.dataTransfer)
        if (files.length > 0) send({ type: "FILES.ADD", files, via: "drop" })
      },
    }),
    label: (): PartProps => ({ ...common("label"), id: ids.label, htmlFor: ids.textarea }),
    description: (): PartProps => ({ ...common("description"), id: ids.description }),
    textarea: (): PartProps => ({
      ...stateful("textarea"),
      ...focusAttrs(c.focused && c.focusedChip === null, v.modality),
      id: ids.textarea,
      name: v.name,
      value: v.value,
      rows: 1,
      disabled: v.disabled || undefined,
      readOnly: v.readOnly || undefined,
      enterKeyHint: v.enterSubmits ? "send" : "enter",
      "aria-describedby":
        [
          v.mounted.description ? ids.description : undefined,
          v.count ? ids.count : undefined,
          chips.describedBy,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
      "aria-invalid": v.overLimit ? "true" : undefined,
      onChange: (event: unknown) => {
        const e = event as { target: HTMLTextAreaElement; nativeEvent?: InputEvent }
        const native = (e.nativeEvent ?? event) as InputEvent
        send({ type: "INPUT", value: e.target.value, composing: native.isComposing === true })
      },
      onCompositionStart: () => send({ type: "COMPOSITION.START" }),
      onCompositionEnd: (event: unknown) =>
        send({
          type: "COMPOSITION.END",
          value: ((event as CompositionEvent).target as HTMLTextAreaElement).value,
        }),
      onFocus: () => send({ type: "FOCUS", modality: env.modality.modality() }),
      onBlur: () => send({ type: "BLUR" }),
      onPointerDown: () => {
        if (c.armedChip !== null) send({ type: "CARET" })
      },
      onPaste: (event: unknown) => {
        const e = event as ClipboardEvent
        if (e.defaultPrevented || c.composing || v.disabled || v.readOnly) return
        const files = filesFromClipboard(e.clipboardData)
        if (!files) return
        e.preventDefault()
        send({ type: "FILES.ADD", files, via: "paste" })
      },
      onKeyDown: (event: unknown) => {
        const e = event as Key
        // A handler before ours (a Mentions popup) took the key.
        if (e.defaultPrevented) return
        // React's event has no `isComposing`: the native one carries it.
        const k = describeKey((event as { nativeEvent?: Key }).nativeEvent ?? e, env)
        if (k.composing || c.composing) return
        const el = e.currentTarget as HTMLTextAreaElement
        const start = el.selectionStart === 0 && el.selectionEnd === 0
        const end = el.selectionStart === el.value.length && el.selectionEnd === el.value.length
        if (chips.inputKeyDown(e, el.value, start)) return
        const mod = isMod(k, env.platform)
        const plain = !k.shift && !k.alt && !k.ctrl && !k.meta
        switch (e.key) {
          case "Enter": {
            if (v.submitKey === "none") return
            const submits = (mod && !k.alt) || (v.enterSubmits && plain)
            if (!submits) return
            // Before the value is read: no newline at the caret (lobehub#9176).
            e.preventDefault()
            if (!k.repeat) requestSubmit()
            return
          }
          case "ArrowUp":
          case "ArrowDown": {
            if (!plain || el.getAttribute("aria-expanded") === "true") return
            const older = e.key === "ArrowUp"
            // Browsing recalled entries steps on any caret; otherwise only from the edges.
            const edge = v.recall.browsing || (older ? start : end)
            if (!edge || !(older ? v.recall.older : v.recall.newer)) return
            e.preventDefault()
            send({ type: "RECALL", direction: older ? "older" : "newer" })
            return
          }
          case "ArrowLeft":
          case "ArrowRight":
          case "Home":
          case "End":
            if (c.armedChip !== null) send({ type: "CARET" })
            return
        }
      },
    }),
    submit: (): PartProps => {
      const blocked = (v.state === "idle" && !v.submittable) || v.state === "stopped"
      return {
        ...common("submit"),
        id: ids.submit,
        type: busy ? "button" : "submit",
        "aria-label": busy ? v.messages.stopLabel : v.messages.sendLabel,
        ...focusAttrs(v.focusedButton === "submit", v.modality),
        onFocus: () => v.setFocusedButton("submit"),
        onBlur: () => v.setFocusedButton(null),
        "aria-disabled": blocked && !v.disabled ? "true" : undefined,
        disabled: v.disabled || undefined,
        "data-action": busy ? "stop" : "send",
        // Agrees with aria-disabled: pressing it does nothing now.
        "data-disabled": dataFlag(v.disabled || blocked),
        onClick: (event: unknown) => {
          const e = event as MouseEvent
          if (busy) {
            e.preventDefault()
            if (v.state !== "stopped") send({ type: "STOP", clickCount: e.detail })
            return
          }
          // Not submittable: no native submission (and no constraint bubble).
          if (blocked) e.preventDefault()
        },
      }
    },
    attachTrigger: (): PartProps => ({
      ...common("attach-trigger"),
      type: "button",
      "aria-label": v.messages.attachLabel,
      disabled: v.disabled || v.readOnly || undefined,
      ...focusAttrs(v.focusedButton === "attach-trigger", v.modality),
      onFocus: () => v.setFocusedButton("attach-trigger"),
      onBlur: () => v.setFocusedButton(null),
      onClick: openPicker,
    }),
    /** The chooser the AttachTrigger opens: reset after each pick (ai-elements#254). */
    picker: (): PartProps => ({
      ...scopeAttrs("prompt-input", "file-picker", v.instance),
      id: ids.picker,
      type: "file",
      // Not rendered: AttachTrigger opens it (click() works on a hidden file input).
      hidden: true,
      multiple: v.multiple || undefined,
      accept: v.accept,
      disabled: v.disabled || v.readOnly || undefined,
      onChange: (event: unknown) => {
        const input = (event as Event).target as HTMLInputElement
        const files = Array.from(input.files ?? [])
        input.value = ""
        if (files.length > 0) send({ type: "FILES.ADD", files, via: "picker" })
      },
    }),
    /** Carries the attached files into FormData (synced by the adapter). */
    files: (): PartProps => ({
      ...scopeAttrs("prompt-input", "files", v.instance),
      id: ids.files,
      type: "file",
      name: v.filesName,
      multiple: true,
      hidden: true,
      disabled: v.disabled || undefined,
    }),
    chips: chips.chips,
    chip: (key: string): PartProps => ({
      ...chips.chip(key),
      "data-pending": dataFlag(v.attachments.some((a) => a.id === key && a.pending === true)),
    }),
    chipText: (): PartProps => scopeAttrs("prompt-input", "chip-text", v.instance),
    chipRemove: chips.chipRemove,
    chipsSummary: chips.summary,
    characterCount: (): PartProps => ({
      ...common("character-count"),
      id: ids.count,
      "data-over-limit": dataFlag(v.overLimit),
    }),
  }
}

export type PromptInputApi = ReturnType<typeof promptInputConnect>
