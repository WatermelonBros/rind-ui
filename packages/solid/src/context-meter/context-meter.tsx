/** @jsxImportSource solid-js */
// Context Meter (add-context-meter): the attributes come from the props (connect is pure); the
// machine only announces a rising threshold crossing, once, and re-arms on `resetKey`.
import {
  announcerCapability,
  type ContextMeterLevel,
  type ContextMeterMessages,
  type ContextMeterState,
  contextMeterConnect,
  contextMeterMachine,
  contextMeterMessages,
  type MessageOverrides,
  partId,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createMemo,
  type JSX,
  splitProps,
  useContext,
} from "solid-js"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "context-meter": ContextMeterMessages
  }
}

/** What every part's `render` receives. */
export interface ContextMeterRenderState {
  readonly state: ContextMeterState
  /** 0–100, one decimal. */
  readonly percent: number
  /** The value in words ("17K of 100K tokens, 17%"). */
  readonly valueText: string
}

type Api = ReturnType<typeof contextMeterConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly state: ContextMeterRenderState
  readonly registry: PartRegistry<"label">
  readonly labelId: Accessor<string>
}
const ContextMeterContext = createContext<Ctx>()
function useContextMeter(part: string): Ctx {
  const ctx = useContext(ContextMeterContext)
  if (!ctx) throw new Error(`ContextMeter.${part} must be inside ContextMeter.Root`)
  return ctx
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the part's state. */
  readonly render?: RenderProp<ContextMeterRenderState> | undefined
  readonly children?: JSX.Element | ((state: ContextMeterRenderState) => JSX.Element)
}

export type ContextMeterRootProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** Tokens used. */
  readonly used: number
  /** The window size; null when unknown (text, no meter role). */
  readonly max: number | null
  /** The warning threshold (fraction). Default 0.75. */
  readonly warnAt?: number | undefined
  /** The full threshold (fraction). Default 0.95. */
  readonly fullAt?: number | undefined
  /** Announce a rising threshold crossing, once. Default "polite". */
  readonly announce?: "off" | "polite" | undefined
  /** A new value (a new thread) re-arms the thresholds. */
  readonly resetKey?: string | undefined
  /** A rising crossing (compact the thread here). */
  readonly onThreshold?: ((level: ContextMeterLevel) => void) | undefined
  /** How the numbers are written. Default: compact notation. */
  readonly formatOptions?: Intl.NumberFormatOptions | undefined
  readonly messages?: MessageOverrides<ContextMeterMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}

function Root(props: ContextMeterRootProps) {
  const [own, rest] = splitProps(props, [
    "used",
    "max",
    "warnAt",
    "fullAt",
    "announce",
    "resetKey",
    "onThreshold",
    "formatOptions",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("context-meter", contextMeterMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  const registry = usePartRegistry<"label">({ scope: "context-meter", root: instance() })
  const labelId = createMemo(() => partId("context-meter", instance(), "label"))
  const rendered = useRenderedId(registry, "label")
  useMachine(
    contextMeterMachine,
    () => ({
      used: own.used,
      max: own.max,
      warnAt: own.warnAt,
      fullAt: own.fullAt,
      announce: own.announce,
      resetKey: own.resetKey,
      onThreshold: (l: ContextMeterLevel) => own.onThreshold?.(l),
      messages: messages(),
      id: instance(),
      lang: locale().locale,
    }),
    env,
  )
  const api = createMemo(() =>
    contextMeterConnect({
      instance: instance(),
      used: own.used,
      max: own.max,
      warnAt: own.warnAt,
      fullAt: own.fullAt,
      locale: locale().locale,
      formatOptions: own.formatOptions,
      messages: messages(),
      ids: { label: rendered() ?? labelId() },
      rendered: { label: rendered() !== undefined },
    }),
  )
  const state = reactive<ContextMeterRenderState>(() => ({
    state: api().state,
    percent: api().percent,
    valueText: api().valueText,
  }))
  const ctx: Ctx = { api, state, registry, labelId }
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(rest.id === undefined ? {} : { id: rest.id }) },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <ContextMeterContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ContextMeterContext.Provider>
  )
}

export type ContextMeterLabelProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function Label(props: ContextMeterLabelProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useContextMeter("Label")
  const id = () => rest.id ?? ctx.labelId()
  useRegisterPart(ctx.registry, "label", id)
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().label()), id: id() }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type ContextMeterValueTextProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

/** The short visible value ("17%"); its content replaces it. */
function ValueText(props: ContextMeterValueTextProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useContextMeter("ValueText")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().valueTextPart()), rest))
  const children = () => resolveChildren(local.children, ctx.state) ?? ctx.api().shortText
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type ContextMeterDivProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Track(props: ContextMeterDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useContextMeter("Track")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().track()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function Indicator(props: ContextMeterDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useContextMeter("Indicator")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().indicator()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type ContextMeterBreakdownProps = PartProps<JSX.HTMLAttributes<HTMLDListElement>>

/** Where the tokens went: a `dl` of BreakdownItems. */
function Breakdown(props: ContextMeterBreakdownProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useContextMeter("Breakdown")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().breakdown()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => <dl {...p}>{children()}</dl>)
}

export type ContextMeterBreakdownItemProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** Identifies the row (`data-key`). */
  readonly itemKey: string
  /** The `dt`: what the tokens went to ("System prompt"). */
  readonly label?: JSX.Element
  /** The `dd`: how many ("2.1K tokens"). */
  readonly amount?: JSX.Element
}

/** One `dt`/`dd` pair; `children` replace the pair. */
function BreakdownItem(props: ContextMeterBreakdownItemProps) {
  const [local, rest] = splitProps(props, ["itemKey", "label", "amount", "render", "children"])
  const ctx = useContextMeter("BreakdownItem")
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().breakdownItem(local.itemKey)), rest),
  )
  const children = () =>
    resolveChildren(local.children, ctx.state) ?? (
      <>
        <dt>{local.label}</dt>
        <dd>{local.amount}</dd>
      </>
    )
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The parts, by name: `context-meter.parts.ts` re-exports them as the `ContextMeter` namespace. */
export { Breakdown, BreakdownItem, Indicator, Label, Root, Track, ValueText }
