"use client"

import {
  announcerCapability,
  checkRangeName,
  type MessageOverrides,
  type ProgressMessages,
  type ProgressState,
  partId,
  progressConnect,
  progressMachine,
  progressMessages,
  quirkActive,
  type RangeOrientation,
  rangeFillerProps,
  rangeValueText,
  resolveRangeValue,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react"
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
    progress: ProgressMessages
  }
}

/** What every part's `render` receives. */
export interface ProgressRenderState {
  readonly state: ProgressState
  /** The clamped value; `null` when indeterminate. */
  readonly value: number | null
  readonly percent: number
  readonly valueText: string | undefined
}

interface Ctx {
  readonly api: ReturnType<typeof progressConnect>
  readonly registry: PartRegistry<"label">
  readonly instance: string
  readonly state: ProgressRenderState
}
const ProgressContext = createContext<Ctx | null>(null)
function useProgress(part: string): Ctx {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error(`Progress.${part} must be inside Progress.Root`)
  return ctx
}

export type ProgressRootProps = ComponentPropsWithRef<"div"> & {
  /** `null` / `undefined` (the default): indeterminate. 0 is a value. */
  readonly value?: number | null | undefined
  readonly min?: number
  readonly max?: number
  readonly orientation?: RangeOrientation
  /** Default `{ style: "percent" }`: the fraction; any other style formats the value. */
  readonly formatOptions?: Intl.NumberFormatOptions
  /** Default: the provider's locale. */
  readonly locale?: string
  /** Announce `messages.complete` when the value reaches `max`. Never on mount. */
  readonly announceCompletion?: boolean
  readonly messages?: MessageOverrides<ProgressMessages>
  readonly render?: RenderProp<ProgressRenderState>
}

function Root({
  value = null,
  min,
  max,
  orientation = "horizontal",
  formatOptions,
  locale: ownLocale,
  announceCompletion,
  messages: ownMessages,
  render,
  id,
  children,
  ...rest
}: ProgressRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("progress", progressMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const own = rest as Readonly<Record<string, unknown>> // the element's own props, read by name
  const consumerNamed = own["aria-label"] !== undefined || own["aria-labelledby"] !== undefined
  // A consumer name replaces the Label: then the Label is not expected on the server.
  const registry = usePartRegistry<"label">(
    consumerNamed
      ? { scope: "progress", root: instance }
      : { scope: "progress", root: instance, expected: ["label"] },
  )
  useMachine(
    progressMachine,
    {
      value,
      min,
      max,
      announceCompletion,
      messages,
      id: instance,
      lang: locale,
    },
    env,
  )
  const range = resolveRangeValue({ value, min, max }, "progress")
  const text = rangeValueText(range, { locale, formatOptions }, messages.valueText)
  const labelledBy = useRenderedId(registry, "label")
  const api = progressConnect({
    instance,
    range,
    text,
    orientation,
    labelledBy: consumerNamed ? undefined : labelledBy,
  })
  const state: ProgressRenderState = useMemo(
    () => ({ state: api.state, value: range.value, percent: range.percent, valueText: text }),
    [api.state, range.value, range.percent, text],
  )
  const hasLabel = labelledBy !== undefined
  const hidden = own["aria-hidden"]
  // After commit, once per change of what it reads (the Label registers in a layout effect).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `own` is read through these keys
  useEffect(() => {
    checkRangeName("progress", own, hasLabel || consumerNamed)
  }, [hasLabel, consumerNamed, hidden])
  const filler = quirkActive("nvda-progressbar-name", env) ? (
    <span {...normalizeProps(rangeFillerProps)} />
  ) : null
  const ctx = useMemo(() => ({ api, registry, instance, state }), [api, registry, instance, state])
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) },
    rest,
  )
  return (
    <ProgressContext value={ctx}>
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
    </ProgressContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<ProgressRenderState>
}

/** The name: Root is `aria-labelledby` it while it is rendered. */
function Label({ render, id, ...rest }: PartProps<"span">) {
  const ctx = useProgress("Label")
  const labelId = id ?? partId("progress", ctx.instance, "label")
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
  const ctx = useProgress("ValueText")
  const content: ReactNode = children ?? ctx.state.valueText
  return renderPart(
    "span",
    { ...mergeProps(normalizeProps(ctx.api.valueText()), rest), children: content },
    render,
    ctx.state,
  )
}

function Track({ render, ...rest }: PartProps<"div">) {
  const ctx = useProgress("Track")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.track()), rest), render, ctx.state)
}

/** The fill, sized by `--rind-progress-percent`. */
function Indicator({ render, ...rest }: PartProps<"div">) {
  const ctx = useProgress("Indicator")
  return renderPart("div", mergeProps(normalizeProps(ctx.api.indicator()), rest), render, ctx.state)
}

/** The ring's `svg` (`aria-hidden`); holds CircleTrack and CircleIndicator. */
function Circle({ render, ...rest }: PartProps<"svg">) {
  const ctx = useProgress("Circle")
  return renderPart("svg", mergeProps(normalizeProps(ctx.api.circle()), rest), render, ctx.state)
}

function CircleTrack({ render, ...rest }: PartProps<"circle">) {
  const ctx = useProgress("CircleTrack")
  return renderPart(
    "circle",
    mergeProps(normalizeProps(ctx.api.circleTrack()), rest),
    render,
    ctx.state,
  )
}

/** The ring's arc: `stroke-dashoffset` = 100 − percent on a `pathLength` of 100. */
function CircleIndicator({ render, ...rest }: PartProps<"circle">) {
  const ctx = useProgress("CircleIndicator")
  return renderPart(
    "circle",
    mergeProps(normalizeProps(ctx.api.circleIndicator()), rest),
    render,
    ctx.state,
  )
}

/** A task's advance, determinate or indeterminate, as a bar or a ring. Never a live region. */
export const Progress = {
  Root,
  Label,
  ValueText,
  Track,
  Indicator,
  Circle,
  CircleTrack,
  CircleIndicator,
}
