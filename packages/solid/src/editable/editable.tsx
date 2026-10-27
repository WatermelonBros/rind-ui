/** @jsxImportSource solid-js */
// Editable (add-editable): a value shown in a Preview (a button) that turns into an Input on
// activation; Enter submits, Escape restores what was there at entry, an outside press submits
// or cancels by `submitMode`. A hidden input carries the committed value into forms.
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
  hiddenFormInput,
  type MessageOverrides,
  partId,
  type SubmitMode,
  watchLeave,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    editable: EditableMessages
  }
}

/** What every part's `render` receives. */
export interface EditableRenderState {
  readonly state: EditableState
  readonly editing: boolean
  readonly value: string
  readonly draft: string
}

type Api = ReturnType<typeof editableConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly send: (event: EditableEvent) => void
  readonly state: EditableRenderState
  readonly registry: PartRegistry<"label">
  readonly ids: Accessor<{ label: string; preview: string; input: string; hidden: string }>
  readonly activationMode: () => ActivationMode | undefined
  readonly setPreview: (el: HTMLElement | null) => void
  readonly setInput: (el: HTMLElement | null) => void
}
const EditableContext = createContext<Ctx>()
function useEditable(part: string): Ctx {
  const ctx = useContext(EditableContext)
  if (!ctx) throw new Error(`Editable.${part} must be inside Editable.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<EditableRenderState> | undefined
  readonly children?: JSX.Element | ((state: EditableRenderState) => JSX.Element)
}

export type EditableRootProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** Controlled committed value. */
  readonly value?: string | undefined
  /** Uncontrolled committed value. Default "". */
  readonly defaultValue?: string | undefined
  readonly onValueChange?:
    | ((value: string, details: ChangeDetails<EditableEvent>) => void)
    | undefined
  /** Controlled edit state. */
  readonly edit?: boolean | undefined
  /** Uncontrolled edit state. Default false. */
  readonly defaultEdit?: boolean | undefined
  readonly onEditChange?:
    | ((edit: boolean, details: ChangeDetails<EditableEvent>) => void)
    | undefined
  /** Each edit of the draft. */
  readonly onDraftChange?: ((draft: string) => void) | undefined
  /** How the Preview enters edit (Enter and Space always do, except `none`). Default "click". */
  readonly activationMode?: ActivationMode | undefined
  /** Whether an outside press submits (both, blur) or cancels (enter, none). Default "both". */
  readonly submitMode?: SubmitMode | undefined
  /** Select the text on entering edit. Default true. */
  readonly selectOnFocus?: boolean | undefined
  /** Shown when the value is empty. */
  readonly placeholder?: string | { readonly edit: string; readonly preview: string } | undefined
  /** The Input's maximum length. */
  readonly maxLength?: number | undefined
  readonly disabled?: boolean | undefined
  readonly readOnly?: boolean | undefined
  /** An empty value blocks submit. */
  readonly required?: boolean | undefined
  readonly invalid?: boolean | undefined
  /** The form field's name. */
  readonly name?: string | undefined
  /** The form id, when the Editable is outside it. */
  readonly form?: string | undefined
  readonly messages?: MessageOverrides<EditableMessages> | undefined
}

function Root(props: EditableRootProps) {
  const [own, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "edit",
    "defaultEdit",
    "onEditChange",
    "onDraftChange",
    "activationMode",
    "submitMode",
    "selectOnFocus",
    "placeholder",
    "maxLength",
    "disabled",
    "readOnly",
    "required",
    "invalid",
    "name",
    "form",
    "messages",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment()
  const messages = useMessages("editable", editableMessages, () => own.messages)
  const registry = usePartRegistry<"label">({ scope: "editable", root: instance() })
  const labelId = useRenderedId(registry, "label")
  const ids = createMemo(() => ({
    label: partId("editable", instance(), "label"),
    preview: partId("editable", instance(), "preview"),
    input: partId("editable", instance(), "input"),
    hidden: partId("editable", instance(), "hidden-input"),
  }))
  let previewEl: HTMLElement | null = null
  let inputEl: HTMLElement | null = null
  const [hidden, setHidden] = createSignal<HTMLInputElement | null>(null)
  const [rootEl, setRootEl] = createSignal<HTMLElement | null>(null)
  const formInput = hiddenFormInput({ input: hidden }, env)
  const { view, send } = useMachine(
    editableMachine,
    () => ({
      ...(own.value === undefined ? {} : { value: own.value }),
      defaultValue: own.defaultValue,
      onValueChange: (v: string, d: ChangeDetails<EditableEvent>) => own.onValueChange?.(v, d),
      ...(own.edit === undefined ? {} : { edit: own.edit }),
      defaultEdit: own.defaultEdit,
      onEditChange: (e: boolean, d: ChangeDetails<EditableEvent>) => own.onEditChange?.(e, d),
      onDraftChange: (d: string) => own.onDraftChange?.(d),
      activationMode: own.activationMode,
      submitMode: own.submitMode,
      disabled: own.disabled === true,
      readOnly: own.readOnly === true,
      // After the render that shows the Input (it is hidden until then).
      focusInput: () => {
        // The committed value at entry (the draft starts from it).
        const entry = untrack(value)
        queueMicrotask(() => {
          const el = inputEl as HTMLInputElement | null
          if (!el) return
          el.focus({ preventScroll: true })
          // Keys typed before the focus landed (Enter on EditTrigger, then typing) are kept.
          if (own.selectOnFocus !== false && el.value === entry) el.select?.()
        })
      },
      focusPreview: () => queueMicrotask(() => previewEl?.focus({ preventScroll: true })),
    }),
    {},
  )
  const value = () => view().values.value ?? ""
  const api = createMemo(() =>
    editableConnect(
      {
        instance: instance(),
        state: view().state as EditableState,
        value: value(),
        draft: view().context.draft,
        placeholder: own.placeholder,
        disabled: own.disabled === true,
        readOnly: own.readOnly === true,
        required: own.required === true,
        invalid: own.invalid === true,
        name: own.name,
        maxLength: own.maxLength,
        messages: messages(),
        ids: { ...ids(), label: labelId() ?? ids().label },
        rendered: { label: labelId() !== undefined },
      },
      env,
    ),
  )
  const state = reactive<EditableRenderState>(() => ({
    state: view().state as EditableState,
    editing: api().editing,
    value: value(),
    draft: view().context.draft,
  }))
  afterMount(() => {
    // The hidden input mirrors the committed value; a form reset restores the default.
    createEffect(() => formInput.sync({ value: value() }, { dispatch: false }))
    onCleanup(
      formInput.track({
        onReset: () => send({ type: "RESET" }),
        current: () => ({ value: untrack(value) }),
      }),
    )
    // While editing, a press or focus outside the Root (Area, Control, triggers) is OUTSIDE.
    createEffect(() => {
      const el = rootEl()
      if (!api().editing || !el) return
      onCleanup(watchLeave(el, () => send({ type: "OUTSIDE" })))
    })
  })
  const ctx: Ctx = {
    api,
    send,
    state,
    registry,
    ids,
    activationMode: () => own.activationMode,
    setPreview: (el) => {
      previewEl = el
    },
    setInput: (el) => {
      inputEl = el
    },
  }
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().root()),
        ...(rest.id === undefined ? {} : { id: rest.id }),
        ref: setRootEl,
      },
      rest,
    ),
  )
  const hiddenProps = createMemo(() =>
    mergeProps(normalizeProps(api().hiddenInput()), {
      ref: setHidden,
      ...(own.form === undefined ? {} : { form: own.form }),
    }),
  )
  const children = () => (
    <>
      {resolveChildren(own.children, state)}
      <input {...hiddenProps()} />
    </>
  )
  return (
    <EditableContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </EditableContext.Provider>
  )
}

/** Focus state with the modality it arrived by (keyboard focus shows the ring). */
function useFocus() {
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  return { focused, setFocused, modality }
}

export type EditableLabelProps = PartProps<JSX.LabelHTMLAttributes<HTMLLabelElement>>

function Label(props: EditableLabelProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useEditable("Label")
  const id = () => rest.id ?? ctx.ids().label
  useRegisterPart(ctx.registry, "label", id)
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().label()), id: id() }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: connect sets `for` to the Input while editing
    <label {...p}>{children()}</label>
  ))
}

type DivProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

/** Holds the Preview and the Input. */
function Area(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useEditable("Area")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().area()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** Holds the triggers. */
function Control(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useEditable("Control")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().control()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

type ButtonProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

/** The value (or the placeholder) as a button that enters edit; its content replaces the text. */
function Preview(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useEditable("Preview")
  const { focused, setFocused, modality } = useFocus()
  const edit = (kind: "press" | "dblclick" | "focus" | "key", reason: EditReason) => {
    if (activates(ctx.activationMode(), kind)) ctx.send({ type: "EDIT", reason })
  }
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.api().preview({ tag: "button", focused: focused(), modality: modality() }),
          ),
          {
            // A keyboard press (Enter, Space) on the native button clicks it too: `detail` 0.
            onClick: (e: MouseEvent) =>
              e.detail === 0 ? edit("key", "preview-key") : edit("press", "preview-press"),
            onDblClick: () => edit("dblclick", "preview-dblclick"),
            onFocusIn: () => {
              setFocused(true)
              edit("focus", "preview-focus")
            },
            onFocusOut: () => setFocused(false),
          },
        ),
        ref: ctx.setPreview,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.api().previewText
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export type EditableInputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "children"> & {
  /** A `<textarea>` (Ctrl/⌘+Enter submits) or another element. */
  readonly render?: RenderProp<EditableRenderState> | undefined
}

/** The text field while editing; Enter submits (Ctrl/⌘+Enter in a textarea), Escape cancels. */
function Input(props: EditableInputProps) {
  const [local, rest] = splitProps(props, ["render"])
  const ctx = useEditable("Input")
  const { focused, setFocused, modality } = useFocus()
  const merged = createMemo(() => {
    const api = normalizeProps(ctx.api().input({ focused: focused(), modality: modality() }))
    // The `value` attribute follows the draft too (markup, a re-render after a reset).
    if (typeof api["value"] === "string") api["attr:value"] = api["value"]
    return mergeProps(
      {
        ...joinHandlers(api, {
          onInput: (e: InputEvent) =>
            ctx.send({ type: "DRAFT", draft: (e.currentTarget as HTMLInputElement).value }),
          onKeyDown: (e: KeyboardEvent) => {
            if (e.isComposing || e.keyCode === 229) return
            const area = (e.currentTarget as HTMLElement).tagName === "TEXTAREA"
            if (e.key === "Escape") {
              e.preventDefault()
              ctx.send({ type: "CANCEL", reason: "escape-key" })
            } else if (e.key === "Enter" && (!area || e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              ctx.send({ type: "SUBMIT", reason: "enter-key" })
            }
          },
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        }),
        ref: ctx.setInput,
      },
      rest,
    )
  })
  return renderPart(
    local.render,
    merged,
    ctx.state,
    () => undefined,
    (p) => <input {...p} />,
  )
}

/** A trigger: a button sending `event` (with its reason), named from messages and the Label. */
function trigger(
  part: string,
  own: (api: Api, f: Parameters<Api["preview"]>[0]) => Record<string, unknown>,
  event: EditableEvent,
) {
  return (props: ButtonProps) => {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = useEditable(part)
    const { focused, setFocused, modality } = useFocus()
    const merged = createMemo(() => {
      const api = normalizeProps(
        own(ctx.api(), { tag: "button", focused: focused(), modality: modality() }) as never,
      )
      // A consumer name replaces the default one, labelled-by included.
      if (rest["aria-label"] !== undefined && rest["aria-labelledby"] === undefined)
        api["aria-labelledby"] = undefined
      return mergeProps(
        {
          ...joinHandlers(api, {
            onClick: () => ctx.send(event),
            onFocusIn: () => setFocused(true),
            onFocusOut: () => setFocused(false),
          }),
        },
        rest,
      )
    })
    const children = () => resolveChildren(local.children, ctx.state)
    return renderPart(local.render, merged, ctx.state, children, (p) => (
      <button {...p}>{children()}</button>
    ))
  }
}

/** Enters edit (hidden while editing). */
const EditTrigger = trigger("EditTrigger", (a, f) => a.editTrigger(f), {
  type: "EDIT",
  reason: "edit-trigger",
})
/** Submits the draft (shown while editing). */
const SubmitTrigger = trigger("SubmitTrigger", (a, f) => a.submitTrigger(f), {
  type: "SUBMIT",
  reason: "submit-trigger",
})
/** Restores the value at entry (shown while editing). */
const CancelTrigger = trigger("CancelTrigger", (a, f) => a.cancelTrigger(f), {
  type: "CANCEL",
  reason: "cancel-trigger",
})

/** The parts, by name: `editable.parts.ts` re-exports them as the `Editable` namespace. */
export { Area, CancelTrigger, Control, EditTrigger, Input, Label, Preview, Root, SubmitTrigger }
