/** @jsxImportSource solid-js */
import {
  checkMeterValue,
  checkRangeName,
  type MessageOverrides,
  type MeterMessages,
  type MeterValueTextArgs,
  type MeterZone,
  meterConnect,
  meterMachine,
  meterMessages,
  meterZone,
  partId,
  quirkActive,
  type RangeOrientation,
  rangeFillerProps,
  rangeValueText,
  resolveRangeValue,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  type JSX,
  splitProps,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    meter: MeterMessages
  }
}

/** What every part's `render` receives. */
export interface MeterRenderState {
  readonly value: number
  readonly percent: number
  readonly zone: MeterZone | undefined
  readonly valueText: string | undefined
}

interface Ctx {
  readonly api: Accessor<ReturnType<typeof meterConnect>>
  readonly registry: PartRegistry<"label">
  readonly instance: Accessor<string>
  readonly state: MeterRenderState
}
const MeterContext = createContext<Ctx>()
function useMeter(part: string): Ctx {
  const ctx = useContext(MeterContext)
  if (!ctx) throw new Error(`Meter.${part} must be inside Meter.Root`)
  return ctx
}

export type MeterRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Required: a meter is never indeterminate. */
  readonly value: number
  readonly min?: number | undefined
  readonly max?: number | undefined
  /** HTML `<meter>` regions: `low`, `high` and where the `optimum` lies. */
  readonly low?: number | undefined
  readonly high?: number | undefined
  readonly optimum?: number | undefined
  readonly orientation?: RangeOrientation | undefined
  /** Default `{ style: "percent" }`: the fraction; any other style formats the value. */
  readonly formatOptions?: Intl.NumberFormatOptions | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  readonly messages?: MessageOverrides<MeterMessages> | undefined
  readonly render?: RenderProp<MeterRenderState> | undefined
  readonly children?: JSX.Element
}

function Root(props: MeterRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "min",
    "max",
    "low",
    "high",
    "optimum",
    "orientation",
    "formatOptions",
    "locale",
    "messages",
    "render",
    "id",
    "children",
  ])
  const instance = useRootId(() => local.id)
  const env = useEnvironment()
  const messages = useMessages("meter", meterMessages, () => local.messages)
  const locale = useLocale(() => local.locale)
  const consumerNamed = () =>
    rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  // A consumer name replaces the Label: then the Label is not expected on the server.
  const registry = usePartRegistry<"label">(
    consumerNamed()
      ? { scope: "meter", root: instance() }
      : { scope: "meter", root: instance(), expected: ["label"] },
  )
  useMachine(meterMachine, () => ({
    value: local.value,
    min: local.min,
    max: local.max,
    low: local.low,
    high: local.high,
    optimum: local.optimum,
  }))
  const range = createMemo(() => {
    const resolved = resolveRangeValue(
      { value: local.value, min: local.min, max: local.max },
      "meter",
    )
    // A missing value renders as min (development error below): never indeterminate.
    return resolved.value === null ? { ...resolved, value: resolved.min } : resolved
  })
  const zone = createMemo(() =>
    meterZone(range(), { low: local.low, high: local.high, optimum: local.optimum }),
  )
  const text = createMemo(() =>
    rangeValueText<MeterValueTextArgs>(
      range(),
      { locale: locale().locale, formatOptions: local.formatOptions },
      messages().valueText,
      { zone: zone() },
    ),
  )
  const labelledBy = useRenderedId(registry, "label")
  const api = createMemo(() =>
    meterConnect({
      instance: instance(),
      range: range(),
      zone: zone(),
      text: text(),
      orientation: local.orientation ?? "horizontal",
      labelledBy: consumerNamed() ? undefined : labelledBy(),
    }),
  )
  const state = reactive<MeterRenderState>(() => ({
    value: range().value ?? range().min,
    percent: range().percent,
    zone: zone(),
    valueText: text(),
  }))
  afterMount(() => {
    // Once per change of what they read (the Label registers while rendering).
    createEffect(() => {
      const hasLabel = labelledBy() !== undefined
      rest["aria-hidden"]
      checkRangeName(
        "meter",
        rest as Readonly<Record<string, unknown>>,
        hasLabel || consumerNamed(),
      )
    })
    createEffect(() => checkMeterValue(local.value))
  })
  const filler = quirkActive("nvda-progressbar-name", env) ? (
    <span {...normalizeProps(rangeFillerProps)}>{rangeFillerProps.children}</span>
  ) : null
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().root()), ...(local.id === undefined ? {} : { id: local.id }) },
      rest,
    ),
  )
  const children = () => (
    <>
      {local.children}
      {filler}
    </>
  )
  return (
    <MeterContext.Provider value={{ api, registry, instance, state }}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </MeterContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<MeterRenderState> | undefined
  readonly children?: JSX.Element
}

/** The name: Root is `aria-labelledby` it while it is rendered. */
function Label(props: PartProps<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "id", "children"])
  const ctx = useMeter("Label")
  const labelId = () => local.id ?? partId("meter", ctx.instance(), "label")
  useRegisterPart(ctx.registry, "label", labelId)
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().label(labelId())), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The visible value text, `aria-hidden` (Root carries it as `aria-valuetext`). */
function ValueText(props: PartProps<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useMeter("ValueText")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().valueText()), rest))
  const children = (): JSX.Element => {
    const given = local.children
    return given ?? ctx.state.valueText
  }
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function Track(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useMeter("Track")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().track()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The fill, sized by `--rind-meter-percent`. */
function Indicator(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useMeter("Indicator")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().indicator()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** A scalar measurement within a known range, with optional low/high/optimum regions. */
/** The parts, by name: `meter.parts.ts` re-exports them as the `Meter` namespace. */
export { Indicator, Label, Root, Track, ValueText }
