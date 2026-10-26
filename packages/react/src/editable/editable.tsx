"use client"

// Editable (add-editable): a Preview (a button showing the value) that becomes an Input. Enter
// commits (Ctrl/⌘+Enter in a textarea), Escape restores the value at entry, an outside press
// submits or cancels by `submitMode`; a hidden input carries the committed value to forms.

import {
  type ActivationMode,
  activates,
  type ChangeDetails,
  type EditableEvent,
  type EditableMessages,
  type EditableState,
  type EditReason,
  editableConnect,
  editableMachine,
  editableMessages,
  focusSafely,
  hiddenFormInput,
  type MessageOverrides,
  partId,
  type SubmitMode,
  watchLeave,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import {
  type PartRegistry,
  usePartRegistry,
  useRegisterPart,
  useRenderedId,
  useRootId,
} from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    editable: EditableMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** What every part's `render` receives. */
export interface EditableRenderState {
  readonly state: EditableState
  readonly editing: boolean
  readonly value: string
  readonly draft: string
}

type Api = ReturnType<typeof editableConnect>

interface Ctx {
  readonly api: Api
  readonly send: (event: EditableEvent) => void
  readonly state: EditableRenderState
  readonly activationMode: ActivationMode
  readonly registry: PartRegistry<"label">
  readonly labelId: string
  readonly inputEl: { current: HTMLElement | null }
  readonly previewEl: { current: HTMLElement | null }
}
const EditableContext = createContext<Ctx | null>(null)
function useEditable(part: string): Ctx {
  const ctx = useContext(EditableContext)
  if (!ctx) throw new Error(`Editable.${part} must be inside Editable.Root`)
  return ctx
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<EditableRenderState>
}

export type EditableRootProps = Omit<PartProps<"div">, "defaultValue" | "onChange"> & {
  /** Controlled committed value. */
  readonly value?: string
  /** Uncontrolled committed value. Default "". */
  readonly defaultValue?: string
  /** A commit; `details.event.reason` says how. */
  readonly onValueChange?: (value: string, details: ChangeDetails<EditableEvent>) => void
  /** Controlled edit state. */
  readonly edit?: boolean
  /** Uncontrolled edit state. Default false. */
  readonly defaultEdit?: boolean
  /** Entering or leaving edit; `cancel()` keeps the user where they are (validation). */
  readonly onEditChange?: (edit: boolean, details: ChangeDetails<EditableEvent>) => void
  /** Each edit of the draft. */
  readonly onDraftChange?: (draft: string) => void
  /** How the Preview enters edit (Enter and Space always do, except `none`). Default "click". */
  readonly activationMode?: ActivationMode
  /** Whether an outside press submits (both, blur) or cancels (enter, none). Default "both". */
  readonly submitMode?: SubmitMode
  /** Select the text on entering edit. Default true. */
  readonly selectOnFocus?: boolean
  /** Shown when the value is empty. */
  readonly placeholder?: string | { readonly edit: string; readonly preview: string }
  /** The Input's maximum length. */
  readonly maxLength?: number
  /** No edit; not submitted. */
  readonly disabled?: boolean
  /** Shown and submitted; no edit. */
  readonly readOnly?: boolean
  /** An empty value blocks submit. */
  readonly required?: boolean
  /** Marks the field invalid. */
  readonly invalid?: boolean
  /** The form field's name. */
  readonly name?: string
  /** The form id, when the Editable is outside it. */
  readonly form?: string
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<EditableMessages>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  edit,
  defaultEdit,
  onEditChange,
  onDraftChange,
  activationMode = "click",
  submitMode,
  selectOnFocus = true,
  placeholder,
  maxLength,
  disabled = false,
  readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  messages: ownMessages,
  render,
  id,
  ref,
  children,
  ...rest
}: EditableRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment()
  const messages = useMessages("editable", editableMessages, ownMessages)
  const registry = usePartRegistry<"label">({ scope: "editable", root: instance })
  const ownLabel = useRenderedId(registry, "label")
  const ids = {
    label: partId("editable", instance, "label"),
    preview: partId("editable", instance, "preview"),
    input: partId("editable", instance, "input"),
    hidden: partId("editable", instance, "hidden-input"),
  }
  const rootEl = useRef<HTMLElement | null>(null)
  const inputEl = useRef<HTMLElement | null>(null)
  const previewEl = useRef<HTMLElement | null>(null)
  const hiddenEl = useRef<HTMLInputElement | null>(null)
  const [formInput] = useState(() => hiddenFormInput({ input: () => hiddenEl.current }, env))
  const selectRef = useRef(selectOnFocus)
  selectRef.current = selectOnFocus
  // After the render that shows the Input (or the Preview): the element is not hidden yet now.
  const later = (fn: () => void) => env.scheduler.requestAnimationFrame(fn)
  const { view, send } = useMachine(editableMachine, {
    value,
    defaultValue,
    onValueChange,
    edit,
    defaultEdit,
    onEditChange,
    onDraftChange,
    activationMode,
    submitMode,
    disabled,
    readOnly,
    focusInput: () => {
      const entry = current
      later(() => {
        const el = inputEl.current
        if (!el) return
        void focusSafely(el, env, "programmatic", env.modality.modality())
        // Keys typed in the frame before (Enter on EditTrigger, then typing) are kept, not selected.
        const fresh =
          (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
          el.value === entry
        if (selectRef.current && fresh) el.select()
      })
    },
    focusPreview: () =>
      later(() => {
        if (previewEl.current)
          void focusSafely(previewEl.current, env, "programmatic", env.modality.modality())
      }),
  })
  const current = view.values.value ?? ""
  const latest = useRef(current)
  latest.current = current
  const api = editableConnect(
    {
      instance,
      state: view.state as EditableState,
      value: current,
      draft: view.context.draft,
      placeholder,
      disabled,
      readOnly,
      required,
      invalid,
      name,
      maxLength,
      messages,
      ids: { ...ids, label: ownLabel ?? ids.label },
      rendered: { label: ownLabel !== undefined },
    },
    env,
  )
  const editing = api.editing
  // The hidden input mirrors the committed value after every commit; a form reset restores it.
  useIsoLayoutEffect(() => {
    formInput.sync({ value: latest.current }, { dispatch: false })
  })
  useEffect(
    () =>
      formInput.track({
        onReset: () => send({ type: "RESET" }),
        current: () => ({ value: latest.current }),
      }),
    [formInput, send],
  )
  // While editing, a press or focus outside the Root (Area, Control, triggers) is OUTSIDE.
  useEffect(() => {
    const el = rootEl.current
    if (!editing || !el) return
    return watchLeave(el, () => send({ type: "OUTSIDE" }))
  }, [editing, send])
  const state: EditableRenderState = {
    state: view.state as EditableState,
    editing,
    value: current,
    draft: view.context.draft,
  }
  const ctx: Ctx = {
    api,
    send,
    state,
    activationMode,
    registry,
    labelId: ids.label,
    inputEl,
    previewEl,
  }
  const props = mergeProps(
    {
      ...normalizeProps(api.root()),
      ...(id === undefined ? {} : { id }),
      ref: composeRefs(rootEl, ref),
    },
    rest,
  )
  const { value: _hidden, ...hidden } = normalizeProps(api.hiddenInput())
  return (
    <EditableContext value={ctx}>
      {renderPart(
        "div",
        {
          ...props,
          children: (
            <>
              {children}
              {/* The value is written as a property by hiddenFormInput; a reset re-syncs it. */}
              <input {...hidden} {...(form === undefined ? {} : { form })} ref={hiddenEl} />
            </>
          ),
        },
        render,
        state,
      )}
    </EditableContext>
  )
}

/** Names the Preview and the Input. */
function Label({ render, id, ...rest }: PartProps<"label">) {
  const ctx = useEditable("Label")
  const own = id ?? ctx.labelId
  useRegisterPart(ctx.registry, "label", own)
  return renderPart(
    "label",
    mergeProps({ ...normalizeProps(ctx.api.label()), id: own }, rest),
    render,
    ctx.state,
  )
}

/** The cell the Preview and the Input share (no layout jump). */
function Area({ render, ...rest }: PartProps<"div">) {
  const ctx = useEditable("Area")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.area()), rest), render, ctx.state)
}

/** Groups the triggers. */
function Control({ render, ...rest }: PartProps<"div">) {
  const ctx = useEditable("Control")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.control()), rest), render, ctx.state)
}

/** Focus state with the modality it arrived by. */
function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  return { focused, setFocused, modality }
}

/** The value as a button; a press, double-click or focus enters edit by `activationMode`. */
function Preview({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useEditable("Preview")
  const { focused, setFocused, modality } = useFocus()
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const mode = ctx.activationMode
  const enter = (kind: "press" | "dblclick" | "focus" | "key", reason: EditReason) => {
    if (activates(mode, kind)) ctx.send({ type: "EDIT", reason })
  }
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.preview({ tag, focused, modality })), {
        onClick: (e: React.MouseEvent<HTMLElement>) => {
          // A click without a pointer (an assistive technology's press) is the key path.
          if (e.detail === 0) enter("key", "preview-key")
          else enter("press", "preview-press")
        },
        onDoubleClick: () => enter("dblclick", "preview-dblclick"),
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          if (e.key !== "Enter" && e.key !== " ") return
          // The native button's own click from the key would enter a second time.
          e.preventDefault()
          if (!e.repeat) enter("key", "preview-key")
        },
        onFocus: () => {
          setFocused(true)
          enter("focus", "preview-focus")
        },
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(composeRefs(el, ctx.previewEl), ref),
    },
    rest,
  )
  return renderPart(
    "button",
    { ...props, children: children ?? ctx.api.previewText },
    render,
    ctx.state,
  )
}

/** The draft while editing (a textarea with `render`). */
function Input({ render, ref, ...rest }: PartProps<"input">) {
  const ctx = useEditable("Input")
  const { focused, setFocused, modality } = useFocus()
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("input", render, el)
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.input({ focused, modality })), {
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          ctx.send({ type: "DRAFT", draft: e.currentTarget.value }),
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          // An IME composition's Enter and Escape are the composition's.
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          if (e.key === "Enter") {
            const multiline = tag === "textarea"
            if (multiline && !(e.ctrlKey || e.metaKey)) return
            e.preventDefault()
            ctx.send({ type: "SUBMIT", reason: "enter-key" })
          } else if (e.key === "Escape") {
            e.preventDefault()
            ctx.send({ type: "CANCEL", reason: "escape-key" })
          }
        },
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(composeRefs(el, ctx.inputEl), ref),
    },
    rest,
  )
  return renderPart("input", props, render, ctx.state)
}

/** A trigger that sends `event` on press. */
function trigger(
  part: "EditTrigger" | "SubmitTrigger" | "CancelTrigger",
  own: (api: Api, f: Parameters<Api["editTrigger"]>[0]) => Record<string, unknown>,
  event: EditableEvent,
) {
  return function Trigger({ render, ref, ...rest }: PartProps<"button">) {
    const ctx = useEditable(part)
    const { focused, setFocused, modality } = useFocus()
    const el = useRef<HTMLElement | null>(null)
    const tag = useRenderedTag("button", render, el)
    const native = tag === "button" || tag === "input"
    const api = normalizeProps(own(ctx.api, { tag, focused, modality }) as never)
    // A consumer name replaces the default one, labelled-by included.
    if (rest["aria-label"] !== undefined && rest["aria-labelledby"] === undefined) {
      ;(api as Record<string, unknown>)["aria-labelledby"] = undefined
    }
    const props = mergeProps(
      {
        ...joinHandlers(api, {
          onClick: () => ctx.send(event),
          // A substituted non-button element: Enter and Space click it, as a button would.
          onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
            if (native || e.repeat) return
            if (e.key === "Enter") e.currentTarget.click()
            if (e.key === " ") e.preventDefault()
          },
          onKeyUp: (e: KeyboardEvent<HTMLElement>) => {
            if (!native && e.key === " ") e.currentTarget.click()
          },
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
        }),
        ref: composeRefs(el, ref),
      },
      rest,
    )
    return renderPart("button", props, render, ctx.state)
  }
}

/** Enters edit. */
const EditTrigger = trigger("EditTrigger", (a, f) => a.editTrigger(f), {
  type: "EDIT",
  reason: "edit-trigger",
})
/** Commits the draft. */
const SubmitTrigger = trigger("SubmitTrigger", (a, f) => a.submitTrigger(f), {
  type: "SUBMIT",
  reason: "submit-trigger",
})
/** Restores the value at entry. */
const CancelTrigger = trigger("CancelTrigger", (a, f) => a.cancelTrigger(f), {
  type: "CANCEL",
  reason: "cancel-trigger",
})

/** The parts, by name: `editable.parts.ts` re-exports them as the `Editable` namespace. */
export { Area, CancelTrigger, Control, EditTrigger, Input, Label, Preview, Root, SubmitTrigger }
