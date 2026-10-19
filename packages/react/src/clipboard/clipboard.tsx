import {
  type ClipboardCopyDetails,
  type ClipboardCopyState,
  type ClipboardEvent,
  type ClipboardMessages,
  clipboardConnect,
  clipboardInputCopy,
  clipboardMachine,
  clipboardMessages,
  type MessageOverrides,
  partId,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { useIconChildren } from "../icons"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
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
  readonly api: Api
  readonly send: (event: ClipboardEvent) => void
  readonly state: ClipboardRenderState
  readonly copyAnchor: { current: HTMLElement | null }
  readonly registry: PartRegistry<Optional>
  readonly ids: { readonly label: string; readonly input: string }
}
const ClipboardContext = createContext<Ctx | null>(null)
function useClipboard(part: string): Ctx {
  const ctx = useContext(ClipboardContext)
  if (!ctx) throw new Error(`Clipboard.${part} must be inside Clipboard.Root`)
  return ctx
}

export type ClipboardRootProps = ComponentPropsWithRef<"div"> & {
  /** What a press copies; read when the write starts. */
  readonly value: string
  /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
  readonly copyFeedbackDuration?: number
  readonly disabled?: boolean
  /** Once per result, after the write settled (or the Input's own copy). */
  readonly onCopy?: (details: ClipboardCopyDetails) => void
  /** With text in the Trigger, set `copy` to that text (label in name). */
  readonly messages?: MessageOverrides<ClipboardMessages>
  /** Default: the provider's locale (the announcement's language). */
  readonly locale?: string
  readonly render?: RenderProp<ClipboardRenderState>
}

function Root({
  value,
  copyFeedbackDuration,
  disabled = false,
  onCopy,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: ClipboardRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment()
  const messages = useMessages("clipboard", clipboardMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const registry = usePartRegistry<Optional>({ scope: "clipboard", root: instance })
  const copyAnchor = useRef<HTMLElement | null>(null)
  const { view, send } = useMachine(clipboardMachine, {
    value,
    messages,
    id: instance,
    lang: locale,
    copyFeedbackDuration,
    disabled,
    onCopy,
    getCopyAnchor: () => copyAnchor.current,
  })
  const ids = {
    label: partId("clipboard", instance, "label"),
    input: partId("clipboard", instance, "input"),
    trigger: partId("clipboard", instance, "trigger"),
  }
  const labelId = useRenderedId(registry, "label")
  const inputId = useRenderedId(registry, "input")
  const state: ClipboardRenderState = { copyState: view.state, value }
  const api = clipboardConnect(
    {
      instance,
      state: view.state,
      value,
      disabled,
      messages,
      ids: { label: labelId ?? ids.label, input: inputId ?? ids.input, trigger: ids.trigger },
      rendered: { label: labelId !== undefined, input: inputId !== undefined },
    },
    env,
  )
  const ctx: Ctx = { api, send, state, copyAnchor, registry, ids }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  return (
    <ClipboardContext value={ctx}>
      {renderPart("div", { ...props, children }, render, state)}
    </ClipboardContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<ClipboardRenderState>
}

function Label({ render, id, ...rest }: PartProps<"label">) {
  const ctx = useClipboard("Label")
  const own = id ?? ctx.ids.label
  useRegisterPart(ctx.registry, "label", own)
  return renderPart(
    "label",
    mergeProps({ ...normalizeProps(ctx.api.label()), id: own }, rest),
    render,
    ctx.state,
  )
}

function Control({ render, ...rest }: PartProps<"div">) {
  const ctx = useClipboard("Control")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.control()), rest), render, ctx.state)
}

/** Focus state with the modality it arrived by (keyboard focus shows the ring). */
function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  return { env, focused, setFocused, modality }
}

function Input({ render, id, ref, ...rest }: PartProps<"input">) {
  const ctx = useClipboard("Input")
  const own = id ?? ctx.ids.input
  useRegisterPart(ctx.registry, "input", own)
  const { env, focused, setFocused, modality } = useFocus()
  // The pointer press that focuses the Input selects the whole value after its mouseup (which
  // would collapse a selection made on focus, in Safari and Chrome); later presses keep the
  // native selection.
  const selectOnUp = useRef(false)
  const api = normalizeProps(ctx.api.input({ focused, modality }))
  const props = mergeProps(
    {
      ...joinHandlers(api, {
        onPointerDown: (e: React.PointerEvent<HTMLInputElement>) => {
          if (document.activeElement !== e.currentTarget) selectOnUp.current = true
        },
        onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => {
          if (!selectOnUp.current) return
          selectOnUp.current = false
          e.preventDefault()
          e.currentTarget.select()
        },
        onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
          setFocused(true)
          if (env.modality.modality() !== "pointer" && env.modality.modality() !== "touch") {
            e.currentTarget.select()
          }
        },
        onBlur: () => {
          setFocused(false)
          selectOnUp.current = false
        },
        onCopy: (e: React.ClipboardEvent<HTMLInputElement>) => {
          const input = e.currentTarget
          ctx.send(
            clipboardInputCopy({
              value: input.value,
              selectionStart: input.selectionStart,
              selectionEnd: input.selectionEnd,
            }),
          )
        },
      }),
      id: own,
      ref,
    },
    rest,
  )
  return renderPart("input", props, render, ctx.state)
}

function Trigger({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useClipboard("Trigger")
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const { focused, setFocused, modality } = useFocus()
  const api = normalizeProps(ctx.api.trigger({ focused, modality, tag }))
  // A consumer name replaces the default one, labelled-by included (spec "Trigger Name").
  if (rest["aria-label"] !== undefined && rest["aria-labelledby"] === undefined) {
    api["aria-labelledby"] = undefined
  }
  const native = tag === "button" || tag === "input"
  const props = mergeProps(
    {
      ...joinHandlers(api, {
        // The write starts in the click's task (WebKit's user-activation rule); an assistive
        // technology press is a bare click too.
        onClick: () => ctx.send({ type: "COPY" }),
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
      ref: composeRefs(composeRefs(el, ctx.copyAnchor), ref),
    },
    rest,
  )
  return renderPart("button", { ...props, children }, render, ctx.state)
}

export type ClipboardIndicatorProps = PartProps<"span"> & {
  /** Rendered while copied (else `children`). */
  readonly copied?: ReactNode
  /** Rendered on error (else `children`). */
  readonly failed?: ReactNode
}

function Indicator({ render, children, copied, failed, ...rest }: ClipboardIndicatorProps) {
  const ctx = useClipboard("Indicator")
  const state = ctx.state.copyState
  const own =
    state === "copied" ? (copied ?? children) : state === "error" ? (failed ?? children) : children
  // Else the provider's icon for the state (Copy, Check, X); else nothing: the theme draws it.
  const shown = useIconChildren(
    state === "copied" ? "check" : state === "error" ? "x" : "copy",
    own,
  )
  const props = mergeProps(normalizeProps(ctx.api.indicator()), rest)
  return renderPart("span", { ...props, children: shown }, render, ctx.state)
}

function ValueText({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useClipboard("ValueText")
  const props = mergeProps(normalizeProps(ctx.api.valueText()), rest)
  return renderPart("span", { ...props, children: children ?? ctx.state.value }, render, ctx.state)
}

export const Clipboard = { Root, Label, Control, Input, Trigger, Indicator, ValueText }
