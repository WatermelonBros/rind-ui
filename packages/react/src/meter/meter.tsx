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
import { type ComponentPropsWithRef, createContext, useContext, useEffect, useMemo } from "react"
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
  readonly api: ReturnType<typeof meterConnect>
  readonly registry: PartRegistry<"label">
  readonly instance: string
  readonly state: MeterRenderState
}
const MeterContext = createContext<Ctx | null>(null)
function useMeter(part: string): Ctx {
  const ctx = useContext(MeterContext)
  if (!ctx) throw new Error(`Meter.${part} must be inside Meter.Root`)
  return ctx
}

export type MeterRootProps = ComponentPropsWithRef<"div"> & {
  /** Required: a meter is never indeterminate. */
  readonly value: number
  readonly min?: number
  readonly max?: number
  /** HTML `<meter>` regions: `low`, `high` and where the `optimum` lies. */
  readonly low?: number
  readonly high?: number
  readonly optimum?: number
  readonly orientation?: RangeOrientation
  /** Default `{ style: "percent" }`: the fraction; any other style formats the value. */
  readonly formatOptions?: Intl.NumberFormatOptions
  /** Default: the provider's locale. */
  readonly locale?: string
  readonly messages?: MessageOverrides<MeterMessages>
  readonly render?: RenderProp<MeterRenderState>
}

function Root({
  value,
  min,
  max,
  low,
  high,
  optimum,
  orientation = "horizontal",
  formatOptions,
  locale: ownLocale,
  messages: ownMessages,
  render,
  id,
  children,
  ...rest
}: MeterRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment()
  const messages = useMessages("meter", meterMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const own = rest as Readonly<Record<string, unknown>> // the element's own props, read by name
  const consumerNamed = own["aria-label"] !== undefined || own["aria-labelledby"] !== undefined
  // A consumer name replaces the Label: then the Label is not expected on the server.
  const registry = usePartRegistry<"label">(
    consumerNamed
      ? { scope: "meter", root: instance }
      : { scope: "meter", root: instance, expected: ["label"] },
  )
  useMachine(meterMachine, { value, min, max, low, high, optimum })
  const resolved = resolveRangeValue({ value, min, max }, "meter")
  // A missing value renders as min (development error below): never indeterminate.
  const range = resolved.value === null ? { ...resolved, value: resolved.min } : resolved
  const zone = meterZone(range, { low, high, optimum })
  const text = rangeValueText<MeterValueTextArgs>(
    range,
    { locale, formatOptions },
    messages.valueText,
    { zone },
  )
  const labelledBy = useRenderedId(registry, "label")
  const api = meterConnect({
    instance,
    range,
    zone,
    text,
    orientation,
    labelledBy: consumerNamed ? undefined : labelledBy,
  })
  const state: MeterRenderState = useMemo(
    () => ({ value: range.value ?? range.min, percent: range.percent, zone, valueText: text }),
    [range.value, range.min, range.percent, zone, text],
  )
  const hasLabel = labelledBy !== undefined
  const hidden = own["aria-hidden"]
  // After commit, once per change of what they read (the Label registers in a layout effect).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `own` is read through these keys
  useEffect(() => {
    checkRangeName("meter", own, hasLabel || consumerNamed)
  }, [hasLabel, consumerNamed, hidden])
  useEffect(() => checkMeterValue(value), [value])
  const filler = quirkActive("nvda-progressbar-name", env) ? (
    <span {...normalizeProps(rangeFillerProps)} />
  ) : null
  const ctx = useMemo(() => ({ api, registry, instance, state }), [api, registry, instance, state])
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <MeterContext value={ctx}>
      {renderPart(
        "div",
        {
          ...props,
          children: (
            <>
              {children}
              {filler}
            </>
          ),
        },
        render,
        state,
      )}
    </MeterContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<MeterRenderState>
}

/** The name: Root is `aria-labelledby` it while it is rendered. */
function Label({ render, id, ...rest }: PartProps<"span">) {
  const ctx = useMeter("Label")
  const labelId = id ?? partId("meter", ctx.instance, "label")
  useRegisterPart(ctx.registry, "label", labelId)
  return renderPart(
    "span",
    mergeProps(normalizeProps(ctx.api.label(labelId)), rest),
    render,
    ctx.state,
  )
}

/** The visible value text, `aria-hidden` (Root carries it as `aria-valuetext`). */
function ValueText({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useMeter("ValueText")
  return renderPart(
    "span",
    {
      ...mergeProps(normalizeProps(ctx.api.valueText()), rest),
      children: children ?? ctx.state.valueText,
    },
    render,
    ctx.state,
  )
}

function Track({ render, ...rest }: PartProps<"div">) {
  const ctx = useMeter("Track")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.track()), rest), render, ctx.state)
}

/** The fill, sized by `--rind-meter-percent`. */
function Indicator({ render, ...rest }: PartProps<"div">) {
  const ctx = useMeter("Indicator")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.indicator()), rest), render, ctx.state)
}

/** A scalar measurement within a known range, with optional low/high/optimum regions. */
export const Meter = { Root, Label, ValueText, Track, Indicator }
