/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type ClipboardCopyDetails,
  type ClipboardCopyState,
  type ClipboardEvent,
  type ClipboardMessages,
  clipboardCapability,
  clipboardConnect,
  clipboardInputCopy,
  clipboardMachine,
  clipboardMessages,
  type MessageOverrides,
  partId,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  useContext,
} from "solid-js"
import { IconChildren } from "../icons"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    clipboard: ClipboardMessages
  }
}

/** What every part's `render` receives. */
export interface ClipboardRenderState {
  readonly copyState: ClipboardCopyState
  readonly value: string
}

type Api = ReturnType<typeof clipboardConnect>
type Optional = "label" | "input"

interface Ctx {
  readonly api: Accessor<Api>
  readonly send: (event: ClipboardEvent) => void
  readonly state: ClipboardRenderState
  readonly setCopyAnchor: (el: Element | null) => void
  readonly registry: PartRegistry<Optional>
  readonly ids: Accessor<{ readonly label: string; readonly input: string }>
}
const ClipboardContext = createContext<Ctx>()
function useClipboard(part: string): Ctx {
  const ctx = useContext(ClipboardContext)
  if (!ctx) throw new Error(`Clipboard.${part} must be inside Clipboard.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<ClipboardRenderState> | undefined
  readonly children?: JSX.Element | ((state: ClipboardRenderState) => JSX.Element)
}

export type ClipboardRootProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** What a press copies; read when the write starts. */
  readonly value: string
  /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
  readonly copyFeedbackDuration?: number | undefined
  readonly disabled?: boolean | undefined
  /** Once per result, after the write settled (or the Input's own copy). */
  readonly onCopy?: ((details: ClipboardCopyDetails) => void) | undefined
  /** With text in the Trigger, set `copy` to that text (label in name). */
  readonly messages?: MessageOverrides<ClipboardMessages> | undefined
  /** Default: the provider's locale (the announcement's language). */
  readonly locale?: string | undefined
}

function Root(props: ClipboardRootProps) {
  const [own, rest] = splitProps(props, [
    "value",
    "copyFeedbackDuration",
    "disabled",
    "onCopy",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment(announcerCapability, clipboardCapability)
  const messages = useMessages("clipboard", clipboardMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  const registry = usePartRegistry<Optional>({ scope: "clipboard", root: instance() })
  let copyAnchor: Element | null = null
  const disabled = () => own.disabled === true
  const { view, send } = useMachine(
    clipboardMachine,
    () => ({
      value: own.value,
      messages: messages(),
      id: instance(),
      lang: locale().locale,
      copyFeedbackDuration: own.copyFeedbackDuration,
      disabled: disabled(),
      onCopy: (d: ClipboardCopyDetails) => own.onCopy?.(d),
      getCopyAnchor: () => copyAnchor as HTMLElement | null,
    }),
    env,
  )
  const ids = createMemo(() => ({
    label: partId("clipboard", instance(), "label"),
    input: partId("clipboard", instance(), "input"),
    trigger: partId("clipboard", instance(), "trigger"),
  }))
  const labelId = useRenderedId(registry, "label")
  const inputId = useRenderedId(registry, "input")
  const state = reactive<ClipboardRenderState>(() => ({
    copyState: view().state as ClipboardCopyState,
    value: own.value,
  }))
  const api = createMemo(() =>
    clipboardConnect(
      {
        instance: instance(),
        state: view().state as ClipboardCopyState,
        value: own.value,
        disabled: disabled(),
        messages: messages(),
        ids: {
          label: labelId() ?? ids().label,
          input: inputId() ?? ids().input,
          trigger: ids().trigger,
        },
        rendered: { label: labelId() !== undefined, input: inputId() !== undefined },
      },
      env,
    ),
  )
  const ctx: Ctx = {
    api,
    send,
    state,
    setCopyAnchor: (el) => {
      copyAnchor = el
    },
    registry,
    ids,
  }
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(rest.id === undefined ? {} : { id: rest.id }) },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <ClipboardContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ClipboardContext.Provider>
  )
}

export type ClipboardLabelProps = PartProps<JSX.LabelHTMLAttributes<HTMLLabelElement>>

function Label(props: ClipboardLabelProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useClipboard("Label")
  const own = () => rest.id ?? ctx.ids().label
  useRegisterPart(ctx.registry, "label", own)
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().label()), id: own() }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: connect sets `for` to the Input's id
    <label {...p}>{children()}</label>
  ))
}

export type ClipboardControlProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Control(props: ClipboardControlProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useClipboard("Control")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().control()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** Focus state with the modality it arrived by (keyboard focus shows the ring). */
function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  return { env, focused, setFocused, modality }
}

export type ClipboardInputProps = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "children"> & {
  readonly render?: RenderProp<ClipboardRenderState> | undefined
}

function Input(props: ClipboardInputProps) {
  const [local, rest] = splitProps(props, ["render"])
  const ctx = useClipboard("Input")
  const own = () => rest.id ?? ctx.ids().input
  useRegisterPart(ctx.registry, "input", own)
  const { env, focused, setFocused, modality } = useFocus()
  // The pointer press that focuses the Input selects the whole value after its mouseup (which
  // would collapse a selection made on focus, in Safari and Chrome); later presses keep the
  // native selection.
  let selectOnUp = false
  const merged = createMemo(() => {
    const api = normalizeProps(ctx.api().input({ focused: focused(), modality: modality() }))
    // Like React's controlled input, the `value` attribute follows the value (markup, reset).
    if (typeof api["value"] === "string") api["attr:value"] = api["value"]
    return mergeProps(
      {
        ...joinHandlers(api, {
          onPointerDown: (e: PointerEvent) => {
            if (document.activeElement !== e.currentTarget) selectOnUp = true
          },
          onMouseUp: (e: MouseEvent) => {
            if (!selectOnUp) return
            selectOnUp = false
            e.preventDefault()
            ;(e.currentTarget as HTMLInputElement).select()
          },
          onFocusIn: (e: FocusEvent) => {
            setFocused(true)
            if (env.modality.modality() !== "pointer" && env.modality.modality() !== "touch") {
              ;(e.currentTarget as HTMLInputElement).select()
            }
          },
          onFocusOut: () => {
            setFocused(false)
            selectOnUp = false
          },
          onCopy: (e: Event) => {
            const input = e.currentTarget as HTMLInputElement
            ctx.send(
              clipboardInputCopy({
                value: input.value,
                selectionStart: input.selectionStart,
                selectionEnd: input.selectionEnd,
              }),
            )
          },
        }),
        id: own(),
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

export type ClipboardTriggerProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

function Trigger(props: ClipboardTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useClipboard("Trigger")
  const [el, setEl] = createSignal<Element | null>(null)
  // The rendered tag: the element's own once mounted when `render` substitutes it.
  const [measured, setMeasured] = createSignal<string | undefined>()
  afterMount(() => {
    const node = el()
    if (local.render && node) setMeasured(node.tagName.toLowerCase())
  })
  const tag = () => (local.render ? (measured() ?? "button") : "button")
  const { focused, setFocused, modality } = useFocus()
  const native = () => tag() === "button" || tag() === "input"
  const merged = createMemo(() => {
    const api = normalizeProps(
      ctx.api().trigger({ focused: focused(), modality: modality(), tag: tag() }),
    )
    // A consumer name replaces the default one, labelled-by included (spec "Trigger Name").
    if (rest["aria-label"] !== undefined && rest["aria-labelledby"] === undefined) {
      api["aria-labelledby"] = undefined
    }
    return mergeProps(
      {
        ...joinHandlers(api, {
          // The write starts in the click's task (WebKit's user-activation rule); an assistive
          // technology press is a bare click too.
          onClick: () => ctx.send({ type: "COPY" }),
          // A substituted non-button element: Enter and Space click it, as a button would.
          onKeyDown: (e: KeyboardEvent) => {
            if (native() || e.repeat) return
            if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
            if (e.key === " ") e.preventDefault()
          },
          onKeyUp: (e: KeyboardEvent) => {
            if (!native() && e.key === " ") (e.currentTarget as HTMLElement).click()
          },
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        }),
        ref: (node: Element) => {
          setEl(node)
          ctx.setCopyAnchor(node)
        },
      },
      rest,
    )
  })
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export type ClipboardIndicatorProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>> & {
  /** Rendered while copied (else `children`). */
  readonly copied?: JSX.Element
  /** Rendered on error (else `children`). */
  readonly failed?: JSX.Element
}

function Indicator(props: ClipboardIndicatorProps) {
  const [local, rest] = splitProps(props, ["render", "children", "copied", "failed"])
  const ctx = useClipboard("Indicator")
  const copyState = () => ctx.state.copyState
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().indicator()), rest))
  // Else the provider's icon for the state (Copy, Check, X); else nothing: the theme draws it.
  const children = () => {
    const s = copyState()
    const base = resolveChildren(local.children, ctx.state)
    const own =
      s === "copied" ? (local.copied ?? base) : s === "error" ? (local.failed ?? base) : base
    return (
      <IconChildren name={s === "copied" ? "check" : s === "error" ? "x" : "copy"}>
        {own}
      </IconChildren>
    )
  }
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type ClipboardValueTextProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function ValueText(props: ClipboardValueTextProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useClipboard("ValueText")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().valueText()), rest))
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.state.value
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The parts, by name: `clipboard.parts.ts` re-exports them as the `Clipboard` namespace. */
export { Control, Indicator, Input, Label, Root, Trigger, ValueText }
