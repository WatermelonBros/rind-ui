/** @jsxImportSource solid-js */
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
  readonly api: Accessor<ReturnType<typeof progressConnect>>
  readonly registry: PartRegistry<"label">
  readonly instance: Accessor<string>
  readonly state: ProgressRenderState
}
const ProgressContext = createContext<Ctx>()
function useProgress(part: string): Ctx {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error(`Progress.${part} must be inside Progress.Root`)
  return ctx
}

export type ProgressRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** `null` / `undefined` (the default): indeterminate. 0 is a value. */
  readonly value?: number | null | undefined
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly orientation?: RangeOrientation | undefined
  /** Default `{ style: "percent" }`: the fraction; any other style formats the value. */
  readonly formatOptions?: Intl.NumberFormatOptions | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  /** Announce `messages.complete` when the value reaches `max`. Never on mount. */
  readonly announceCompletion?: boolean | undefined
  readonly messages?: MessageOverrides<ProgressMessages> | undefined
  readonly render?: RenderProp<ProgressRenderState> | undefined
  readonly children?: JSX.Element
}

function Root(props: ProgressRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "min",
    "max",
    "orientation",
    "formatOptions",
    "locale",
    "announceCompletion",
    "messages",
    "render",
    "id",
    "children",
  ])
  const instance = useRootId(() => local.id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("progress", progressMessages, () => local.messages)
  const locale = useLocale(() => local.locale)
  const consumerNamed = () =>
    rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  // A consumer name replaces the Label: then the Label is not expected on the server.
  const registry = usePartRegistry<"label">(
    consumerNamed()
      ? { scope: "progress", root: instance() }
      : { scope: "progress", root: instance(), expected: ["label"] },
  )
  useMachine(
    progressMachine,
    () => ({
      value: local.value ?? null,
      min: local.min,
      max: local.max,
      announceCompletion: local.announceCompletion,
      messages: messages(),
      id: instance(),
      lang: locale().locale,
    }),
    env,
  )
  const range = createMemo(() =>
    resolveRangeValue({ value: local.value ?? null, min: local.min, max: local.max }, "progress"),
  )
  const text = createMemo(() =>
    rangeValueText(
      range(),
      { locale: locale().locale, formatOptions: local.formatOptions },
      messages().valueText,
    ),
  )
  const labelledBy = useRenderedId(registry, "label")
  const api = createMemo(() =>
    progressConnect({
      instance: instance(),
      range: range(),
      text: text(),
      orientation: local.orientation ?? "horizontal",
      labelledBy: consumerNamed() ? undefined : labelledBy(),
    }),
  )
  const state = reactive<ProgressRenderState>(() => ({
    state: api().state,
    value: range().value,
    percent: range().percent,
    valueText: text(),
  }))
  afterMount(() =>
    // After mount, once per change of what it reads (the Label registers in its own mount).
    createEffect(() => {
      const hasLabel = labelledBy() !== undefined
      rest["aria-hidden"]
      checkRangeName(
        "progress",
        rest as Readonly<Record<string, unknown>>,
        hasLabel || consumerNamed(),
      )
    }),
  )
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
    <ProgressContext.Provider value={{ api, registry, instance, state }}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </ProgressContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<ProgressRenderState> | undefined
  readonly children?: JSX.Element
}

/** The name: Root is `aria-labelledby` it while it is rendered. */
function Label(props: PartProps<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "id", "children"])
  const ctx = useProgress("Label")
  const labelId = () => local.id ?? partId("progress", ctx.instance(), "label")
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
  const ctx = useProgress("ValueText")
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
  const ctx = useProgress("Track")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().track()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The fill, sized by `--rind-progress-percent`. */
function Indicator(props: PartProps<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useProgress("Indicator")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().indicator()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The ring's `svg` (`aria-hidden`); holds CircleTrack and CircleIndicator. */
function Circle(props: PartProps<JSX.SvgSVGAttributes<SVGSVGElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useProgress("Circle")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().circle()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    // biome-ignore lint/a11y/noSvgWithoutTitle: aria-hidden by Progress's own props
    <svg {...p}>{children()}</svg>
  ))
}

function CircleTrack(props: PartProps<JSX.CircleSVGAttributes<SVGCircleElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useProgress("CircleTrack")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().circleTrack()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <circle {...p}>{children()}</circle>
  ))
}

/** The ring's arc: `stroke-dashoffset` = 100 − percent on a `pathLength` of 100. */
function CircleIndicator(props: PartProps<JSX.CircleSVGAttributes<SVGCircleElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useProgress("CircleIndicator")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().circleIndicator()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <circle {...p}>{children()}</circle>
  ))
}

/** A task's advance, determinate or indeterminate, as a bar or a ring. Never a live region. */
/** The parts, by name: `progress.parts.ts` re-exports them as the `Progress` namespace. */
export { Circle, CircleIndicator, CircleTrack, Indicator, Label, Root, Track, ValueText }
