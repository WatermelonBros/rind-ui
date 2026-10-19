// Prompt Input parts: a native form and textarea, one Submit button that becomes Stop, the
// attach button and its file chooser, the attachments as `input-chips` (scope
// "prompt-input"), and the count. Keys go through `describeKey` (the IME guard). Everything
// derived (submittable, the limit, recall, the Enter decision) is computed here, not in parts.

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
import type { PlatformInfo, SchedulerEnv } from "../../env/capabilities"
import { partId } from "../../ids"
import { type InputChipsEnv, inputChipsConnect } from "../input-chips/input-chips"
import type { FieldControlProps } from "../shared/field-control"
import {
  attachmentChips,
  derivePromptInput,
  type PromptAttachment,
  type PromptInputContext,
  type PromptInputEvent,
  type PromptInputProps,
  type PromptInputState,
  type PromptSubmitKey,
  type PromptValueReason,
} from "./prompt-input.machine"
import type { PromptInputMessages } from "./prompt-input.messages"

export interface PromptInputConnectView {
  readonly instance: string
  readonly state: PromptInputState
  readonly context: PromptInputContext
  readonly value: string
  readonly attachments: readonly PromptAttachment[]
  /** The machine props the derivations read. */
  readonly props: Pick<PromptInputProps, "disabled" | "readOnly" | "limit" | "count" | "history">
  readonly submitKey: PromptSubmitKey
  /** The primary pointer is coarse (a phone or a tablet): Enter is a newline. */
  readonly touchPrimary: boolean
  readonly accept?: string | undefined
  readonly multiple: boolean
  readonly name: string
  readonly filesName: string
  /** The Textarea's id (its own `id`, else the instance's). */
  readonly textareaId: string
  /** A CharacterCount is mounted. */
  readonly countMounted: boolean
  readonly modality: Modality
  readonly dir: "ltr" | "rtl"
  readonly locale: string
  readonly messages: PromptInputMessages
  /** The button that has DOM focus (focus attributes). */
  readonly focusedButton: "submit" | "attach-trigger" | null
  readonly setFocusedButton: (part: "submit" | "attach-trigger" | null) => void
  /** The consumer gave a form `action`: a submit is not prevented (form actions). */
  readonly nativeAction: boolean
  /** The error a synchronous `onSubmit` threw during the last send, taken once. */
  readonly takeThrown: () => { readonly error: unknown } | null
  /** The reason of the machine's own write whose `input` event is being handled, if any. */
  readonly takeReason: () => PromptValueReason | undefined
  readonly send: (event: PromptInputEvent) => void
}

export type PromptInputConnectEnv = InputChipsEnv & PlatformInfo & SchedulerEnv

export const promptInputIds = (instance: string) => ({
  root: partId("prompt-input", instance, "root"),
  textarea: partId("prompt-input", instance, "textarea"),
  submit: partId("prompt-input", instance, "submit"),
  picker: partId("prompt-input", instance, "file-picker"),
  files: partId("prompt-input", instance, "files"),
  count: partId("prompt-input", instance, "character-count"),
})

type Key = KeyboardEvent

const INTERACTIVE = "button, textarea, input, select, a[href], [tabindex], [contenteditable]"

const join = (...ids: readonly (string | undefined)[]) => ids.filter(Boolean).join(" ") || undefined

export function promptInputConnect(v: PromptInputConnectView, env: PromptInputConnectEnv) {
  const ids = promptInputIds(v.instance)
  const { send, context: c } = v
  const disabled = v.props.disabled === true
  const readOnly = v.props.readOnly === true
  const busy = v.state === "submitting" || v.state === "streaming" || v.state === "stopped"
  const derived = derivePromptInput(v.props, v.value, v.attachments, c)
  const enterSubmits = v.submitKey === "enter" && !v.touchPrimary
  const byId = (id: string) => env.dom.getById(id) as HTMLElement | null
  const textareaEl = () => byId(v.textareaId) as HTMLTextAreaElement | null
  const chipList = attachmentChips(v.attachments, disabled || readOnly)
  const chips = inputChipsConnect(
    {
      scope: "prompt-input",
      instance: v.instance,
      chips: chipList,
      context: c,
      dir: v.dir,
      locale: v.locale,
      messages: v.messages,
      inputId: v.textareaId,
      controlId: ids.root,
      send,
      blurHost: () => send({ type: "BLUR" }),
    },
    env,
  )
  const common = (part: string): PartProps => ({
    ...scopeAttrs("prompt-input", part, v.instance),
    "data-state": v.state,
    "data-disabled": dataFlag(disabled),
  })
  const stateful = (part: string): PartProps => ({
    ...common(part),
    "data-empty": dataFlag(v.value === ""),
    "data-composing": dataFlag(c.composing),
    "data-over-limit": dataFlag(derived.overLimit),
  })
  /** After a send: a synchronous throw of `onSubmit` goes back to whoever submitted. */
  const rethrow = () => {
    const thrown = v.takeThrown()
    if (thrown) throw thrown.error
  }
  /** A key press, or the API: the form's own submission, so FormData and listeners see it. */
  const requestSubmit = () => {
    const form = textareaEl()?.form
    if (!form) {
      send({ type: "SUBMIT", event: null, formData: null })
      rethrow()
      return
    }
    const submitter = byId(ids.submit) as HTMLButtonElement | null
    form.requestSubmit(submitter?.type === "submit" && submitter.form === form ? submitter : null)
  }
  const openPicker = () => {
    if (disabled || readOnly) return
    ;(byId(ids.picker) as HTMLInputElement | null)?.click()
  }
  const blocked = (v.state === "idle" && !derived.submittable) || v.state === "stopped"

  return {
    ids,
    chipIds: chips.ids,
    chips: chipList,
    summaryText: chips.summaryText,
    /** Counts, limit, the submit guard and the recall options (frozen while composing). */
    derived,
    enterSubmits,
    /** The actions `usePromptInput()` exposes. */
    control: {
      submit: requestSubmit,
      stop: () => send({ type: "STOP", clickCount: 0 }),
      setValue: (value: string) => send({ type: "SET.VALUE", value }),
      /** Inserts at the caret, or over the selection (the end of the draft when unfocused). */
      insertText: (text: string) => {
        const el = textareaEl()
        const start = el?.selectionStart ?? v.value.length
        const end = el?.selectionEnd ?? start
        send({ type: "INSERT.TEXT", text, start, end })
      },
      focus: () => textareaEl()?.focus(),
      openFilePicker: openPicker,
      addFiles: (files: readonly File[]) => send({ type: "FILES.ADD", files, via: "api" }),
    },
    root: (): PartProps => ({
      ...stateful("root"),
      id: ids.root,
      ...focusAttrs(c.focused, v.modality),
      "data-dragging": dataFlag(c.dragging),
      "data-has-attachments": dataFlag(v.attachments.length > 0),
      onSubmit: (event: unknown) => {
        const e = event as SubmitEvent
        const form = e.currentTarget as HTMLFormElement | null
        if (v.state !== "idle" || !derived.submittable) {
          e.preventDefault()
          return
        }
        // Read before the draft clears.
        const formData = form ? new FormData(form) : null
        if (!v.nativeAction) e.preventDefault()
        send({ type: "SUBMIT", event: e, formData })
        rethrow()
      },
      // A form reset puts the Textarea back to its default: read it once the reset ran.
      onReset: (event: unknown) => {
        const e = event as Event
        env.scheduler.setTimeout(() => {
          const el = textareaEl()
          if (!e.defaultPrevented && el) send({ type: "RESET", value: el.value })
        }, 0)
      },
      // A press on the box (padding, gaps) focuses the Textarea.
      onPointerDown: (event: unknown) => {
        const e = event as PointerEvent
        const target = e.target as Element | null
        if (disabled || e.button !== 0 || !target || target.closest(INTERACTIVE)) return
        e.preventDefault()
        textareaEl()?.focus()
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
        if (e.dataTransfer) e.dataTransfer.dropEffect = disabled || readOnly ? "none" : "copy"
        if (!c.dragging && !disabled && !readOnly) send({ type: "DRAG.ENTER" })
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
    /**
     * The Textarea: uncontrolled (the DOM owns the value, so the machine's writes can be
     * undoable edits); `field` is the Field's wiring (name, describedby, invalid).
     */
    textarea: (field?: FieldControlProps): PartProps => ({
      ...stateful("textarea"),
      ...focusAttrs(c.focused && c.focusedChip === null, v.modality),
      id: v.textareaId,
      name: field?.name ?? v.name,
      rows: 1,
      disabled: disabled || undefined,
      readOnly: readOnly || undefined,
      required: field?.required || undefined,
      enterKeyHint: enterSubmits ? "send" : "enter",
      "aria-describedby": join(
        field?.["aria-describedby"],
        v.countMounted ? ids.count : undefined,
        chips.describedBy,
      ),
      "aria-labelledby": field?.["aria-labelledby"],
      "aria-required": field?.["aria-required"],
      "aria-errormessage": field?.["aria-errormessage"],
      "aria-invalid": derived.overLimit || field?.invalid === true ? "true" : undefined,
      onChange: (event: unknown) => {
        const e = event as { target: HTMLTextAreaElement; nativeEvent?: InputEvent }
        const native = (e.nativeEvent ?? event) as InputEvent
        const reason = v.takeReason()
        send({
          type: "INPUT",
          value: e.target.value,
          composing: native.isComposing === true,
          ...(reason ? { reason } : {}),
        })
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
        if (e.defaultPrevented || c.composing || disabled || readOnly) return
        const files = filesFromClipboard(e.clipboardData)
        if (!files) return
        e.preventDefault()
        send({ type: "FILES.ADD", files, via: "paste" })
      },
      onKeyDown: (event: unknown) => {
        const e = event as Key
        // A handler before ours (a suggestions popup) took the key.
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
            const submits = (mod && !k.alt) || (enterSubmits && plain)
            if (!submits) return
            // Before the value is read: no newline at the caret.
            e.preventDefault()
            if (!k.repeat) requestSubmit()
            return
          }
          case "ArrowUp":
          case "ArrowDown": {
            if (!plain || el.getAttribute("aria-expanded") === "true") return
            const older = e.key === "ArrowUp"
            // Browsing recalled entries steps on any caret; otherwise only from the edges.
            const edge = derived.recall.browsing || (older ? start : end)
            if (!edge || !(older ? derived.recall.older : derived.recall.newer)) return
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
    submit: (): PartProps => ({
      ...common("submit"),
      id: ids.submit,
      type: busy ? "button" : "submit",
      "aria-label": busy ? v.messages.stopLabel : v.messages.sendLabel,
      ...focusAttrs(v.focusedButton === "submit", v.modality),
      onFocus: () => v.setFocusedButton("submit"),
      onBlur: () => v.setFocusedButton(null),
      "aria-disabled": blocked && !disabled ? "true" : undefined,
      disabled: disabled || undefined,
      "data-action": busy ? "stop" : "send",
      // Agrees with aria-disabled: pressing it does nothing now.
      "data-disabled": dataFlag(disabled || blocked),
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
    }),
    attachTrigger: (): PartProps => ({
      ...common("attach-trigger"),
      type: "button",
      "aria-label": v.messages.attachLabel,
      disabled: disabled || readOnly || undefined,
      ...focusAttrs(v.focusedButton === "attach-trigger", v.modality),
      onFocus: () => v.setFocusedButton("attach-trigger"),
      onBlur: () => v.setFocusedButton(null),
      onClick: openPicker,
    }),
    // Reset after each pick, so the same file can be picked again (vercel/ai-elements#254).
    /** The chooser the AttachTrigger opens (click() works on a hidden file input). */
    picker: (): PartProps => ({
      ...scopeAttrs("prompt-input", "file-picker", v.instance),
      id: ids.picker,
      type: "file",
      hidden: true,
      multiple: v.multiple || undefined,
      accept: v.accept,
      disabled: disabled || readOnly || undefined,
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
      disabled: disabled || undefined,
    }),
    chipsPart: chips.chips,
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
      "data-over-limit": dataFlag(derived.overLimit),
    }),
  }
}

export type PromptInputApi = ReturnType<typeof promptInputConnect>
