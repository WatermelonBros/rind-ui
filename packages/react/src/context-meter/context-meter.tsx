"use client"

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
import { type ComponentPropsWithRef, createContext, type ReactNode, useContext } from "react"
import { mergeProps } from "../merge-props"
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
  readonly api: Api
  readonly state: ContextMeterRenderState
  readonly registry: PartRegistry<"label">
  readonly labelId: string
}
const ContextMeterContext = createContext<Ctx | null>(null)
function useContextMeter(part: string): Ctx {
  const ctx = useContext(ContextMeterContext)
  if (!ctx) throw new Error(`ContextMeter.${part} must be inside ContextMeter.Root`)
  return ctx
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the part's state. */
  readonly render?: RenderProp<ContextMeterRenderState>
}

export type ContextMeterRootProps = PartProps<"div"> & {
  /** Tokens used. */
  readonly used: number
  /** The window size; null when unknown (text, no meter role). */
  readonly max: number | null
  /** The warning threshold (fraction). Default 0.75. */
  readonly warnAt?: number
  /** The full threshold (fraction). Default 0.95. */
  readonly fullAt?: number
  /** Announce a rising threshold crossing, once. Default "polite". */
  readonly announce?: "off" | "polite"
  /** A new value (a new thread) re-arms the thresholds. */
  readonly resetKey?: string
  /** A rising crossing (compact the thread here). */
  readonly onThreshold?: (level: ContextMeterLevel) => void
  /** How the numbers are written. Default: compact notation. */
  readonly formatOptions?: Intl.NumberFormatOptions
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<ContextMeterMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
}

function Root({
  used,
  max,
  warnAt,
  fullAt,
  announce,
  resetKey,
  onThreshold,
  formatOptions,
  messages: ownMessages,
  locale: ownLocale,
  render,
  id,
  ref,
  children,
  ...rest
}: ContextMeterRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("context-meter", contextMeterMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const registry = usePartRegistry<"label">({ scope: "context-meter", root: instance })
  const labelId = partId("context-meter", instance, "label")
  const rendered = useRenderedId(registry, "label")
  useMachine(
    contextMeterMachine,
    {
      used,
      max,
      warnAt,
      fullAt,
      announce,
      resetKey,
      onThreshold: (l: ContextMeterLevel) => onThreshold?.(l),
      messages,
      id: instance,
      lang: locale,
    },
    env,
  )
  const api = contextMeterConnect({
    instance,
    used,
    max,
    warnAt,
    fullAt,
    locale,
    formatOptions,
    messages,
    ids: { label: rendered ?? labelId },
    rendered: { label: rendered !== undefined },
  })
  const state: ContextMeterRenderState = {
    state: api.state,
    percent: api.percent,
    valueText: api.valueText,
  }
  const ctx: Ctx = { api, state, registry, labelId }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  return (
    <ContextMeterContext value={ctx}>
      {renderPart("div", { ...props, children }, render, state)}
    </ContextMeterContext>
  )
}

export type ContextMeterLabelProps = PartProps<"span">

function Label({ render, id, ...rest }: ContextMeterLabelProps) {
  const ctx = useContextMeter("Label")
  const own = id ?? ctx.labelId
  useRegisterPart(ctx.registry, "label", own)
  return renderPart(
    "span",
    mergeProps({ ...normalizeProps(ctx.api.label()), id: own }, rest),
    render,
    ctx.state,
  )
}

export type ContextMeterValueTextProps = PartProps<"span">

/** The short visible value ("17%"); its content replaces it. */
function ValueText({ render, children, ...rest }: ContextMeterValueTextProps) {
  const ctx = useContextMeter("ValueText")
  const props = mergeProps(normalizeProps(ctx.api.valueTextPart()), rest)
  return renderPart(
    "span",
    { ...props, children: children ?? ctx.api.shortText },
    render,
    ctx.state,
  )
}

export type ContextMeterDivProps = PartProps<"div">

function Track({ render, ...rest }: ContextMeterDivProps) {
  const ctx = useContextMeter("Track")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.track()), rest), render, ctx.state)
}

function Indicator({ render, ...rest }: ContextMeterDivProps) {
  const ctx = useContextMeter("Indicator")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.indicator()), rest), render, ctx.state)
}

export type ContextMeterBreakdownProps = PartProps<"dl">

/** Where the tokens went: a `dl` of BreakdownItems. */
function Breakdown({ render, ...rest }: ContextMeterBreakdownProps) {
  const ctx = useContextMeter("Breakdown")
  return renderPart("dl", mergeProps(normalizeProps(ctx.api.breakdown()), rest), render, ctx.state)
}

export type ContextMeterBreakdownItemProps = PartProps<"div"> & {
  /** Identifies the row (`data-key`); `key` is reserved. */
  readonly itemKey: string
  /** The `dt`: what the tokens went to ("System prompt"). */
  readonly label?: ReactNode
  /** The `dd`: how many ("2.1K tokens"). */
  readonly amount?: ReactNode
}

/** One `dt`/`dd` pair; `children` replace the pair. */
function BreakdownItem({
  itemKey,
  label,
  amount,
  render,
  children,
  ...rest
}: ContextMeterBreakdownItemProps) {
  const ctx = useContextMeter("BreakdownItem")
  const props = mergeProps(normalizeProps(ctx.api.breakdownItem(itemKey)), rest)
  return renderPart(
    "div",
    {
      ...props,
      children: children ?? (
        <>
          <dt>{label}</dt>
          <dd>{amount}</dd>
        </>
      ),
    },
    render,
    ctx.state,
  )
}

/** The parts, by name: `context-meter.parts.ts` re-exports them as the `ContextMeter` namespace. */
export { Breakdown, BreakdownItem, Indicator, Label, Root, Track, ValueText }
