/** @jsxImportSource solid-js */
// Color Slider parts (design §5): a Slider bound to one channel of a colour. The colour value
// (Echo rule, hue memory, commits) is the shared colour-value machine; every Slider part is
// rendered as it is, with the binding's props and appearance.
import {
  type Color,
  type ColorChangeDetails,
  type ColorChannel,
  type ColorCommitDetails,
  type ColorInput,
  type ColorNameProp,
  type ColorSpace,
  colorValueMachine,
  colorValueOf,
  getChannel,
  type MessageOverrides,
  makeColor,
  withChannel,
  workingOf,
} from "@rind-ui/core"
import {
  COLOR_PICKER_SCOPE,
  type ColorSliderMessages,
  channelSliderNaming,
  colorSliderConnect,
  colorSliderMessages,
  colorSliderSpace,
  colorVariables,
} from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  mergeProps as solidMerge,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useColorProp } from "../color-input"
import { TransparencyGrid as Grid } from "../color-swatch/color-swatch"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import {
  SliderNamingContext,
  type SliderRootProps,
  SliderRootSurfaceContext,
  type SliderThumbProps,
  type SliderValue,
} from "../slider/slider"
import * as Slider from "../slider/slider.parts"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "color-slider": ColorSliderMessages
  }
}

type Style = Record<string, unknown>
const styleOf = (s: object) => (normalizeProps({ style: s }) as { style?: Style }).style ?? {}

interface Ctx {
  readonly data: Accessor<Readonly<Record<`data-${string}`, string>>>
  readonly trackStyle: Accessor<Style>
  readonly thumbStyle: Accessor<Style>
  readonly setLabelled: (on: boolean) => void
}
const ColorSliderContext = createContext<Ctx>()
function useColorSlider(part: string): Ctx {
  const ctx = useContext(ColorSliderContext)
  if (!ctx) throw new Error(`ColorSlider.${part} must be inside ColorSlider.Root`)
  return ctx
}

export type ColorSliderRootProps = Omit<
  SliderRootProps,
  | "value"
  | "defaultValue"
  | "onValueChange"
  | "onValueCommit"
  | "min"
  | "max"
  | "step"
  | "largeStep"
  | "formatOptions"
  | "messages"
  | "minStepsBetweenThumbs"
  | "thumbCollision"
  | "render"
  | "children"
> & {
  /** The edited channel: red, green, blue, hue, saturation, lightness, brightness or alpha. */
  readonly channel: ColorChannel
  readonly value?: ColorInput | null | undefined
  /** Default `hsb(0, 100%, 100%)`. */
  readonly defaultValue?: ColorInput | null | undefined
  /** Each applied change, in the space of the colour you passed. */
  readonly onValueChange?: ((color: Color, details: ColorChangeDetails) => void) | undefined
  /** Once at the end of each interaction that changed the colour. */
  readonly onValueCommit?: ((color: Color, details: ColorCommitDetails) => void) | undefined
  /** The working space. Default: the colour's when it has the channel. */
  readonly colorSpace?: ColorSpace | undefined
  /** Replaces the colour name in the value text. */
  readonly colorName?: ColorNameProp | undefined
  /** Channel names, value text and colour words. */
  readonly messages?: MessageOverrides<ColorSliderMessages> | undefined
  /** The parts: Label, ValueText, Control, Track, Thumb, Description. */
  readonly children?: JSX.Element
}

const DEFAULT = makeColor("hsb", [0, 100, 100])

/** One channel of a colour edited with a Slider whose track is the channel's gradient. */
function Root(props: ColorSliderRootProps) {
  const [local, rest] = splitProps(props, [
    "channel",
    "value",
    "defaultValue",
    "onValueChange",
    "onValueCommit",
    "colorSpace",
    "colorName",
    "messages",
    "orientation",
    "locale",
    "dir",
    "children",
  ])
  const loc = useLocale(
    () => local.locale,
    () => local.dir,
  )
  const messages = useMessages("color-slider", colorSliderMessages, () => local.messages)
  const value = useColorProp(() => local.value, "value", "color-slider")
  const defaultValue = useColorProp(() => local.defaultValue, "defaultValue", "color-slider")
  const orientation = () => local.orientation ?? "horizontal"
  const space = untrack(() =>
    colorSliderSpace(local.channel, local.colorSpace, value() ?? defaultValue()),
  )
  const machineProps = createMemo(() => ({
    value: value(),
    defaultValue: defaultValue(),
    space,
    fallback: DEFAULT,
    onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
      // A form reset restores the default without a callback (as every form control).
      if (d.reason === "RESET") return
      const reason = (d.event as { reason?: string }).reason ?? d.reason
      local.onValueChange?.(c, { reason, space, cancel: d.cancel } as ColorChangeDetails)
    },
    onValueCommit: (c: Color, d: ColorCommitDetails) => local.onValueCommit?.(c, d),
  }))
  const { view, send } = useMachine(colorValueMachine, machineProps, {})
  const color = createMemo(() =>
    workingOf(machineProps(), view().context, colorValueOf(machineProps(), view().values.value)),
  )
  const api = createMemo(() =>
    colorSliderConnect({
      color: color(),
      channel: local.channel,
      memory: view().context.memory,
      orientation: orientation(),
      dir: loc().dir,
      messages: messages(),
      locale: loc().locale,
      colorName: local.colorName,
    }),
  )
  const [labelled, setLabelled] = createSignal(false)
  const ctx: Ctx = {
    data: () => api().data,
    trackStyle: () => styleOf(api().trackStyle),
    thumbStyle: () => styleOf(api().thumbStyle),
    setLabelled,
  }
  const sliderMessages = {
    valueText: ({ value: v }: { value: number }) => untrack(api).valueText(v),
    // Unlabelled: the thumb is named by the channel (Reado's sliders had no name).
    thumbLabel: () => (labelled() ? "" : untrack(api).channelName),
  }
  const style = createMemo(
    () =>
      mergeProps(
        { style: { ...styleOf(api().surfaceStyle), ...styleOf(colorVariables(color())) } },
        { style: rest.style },
      )["style"],
  )
  // Solid's own merge: the Slider reads these props lazily, one by one (a spread of a memo
  // beside the children would rebuild the whole slider on every change).
  const sliderProps = solidMerge(rest, dataOf(ctx), {
    get style() {
      return style()
    },
    // Unlabelled: the group is named by the channel too, so it can be found by name.
    get "aria-label"() {
      return labelled() || rest["aria-labelledby"] !== undefined
        ? rest["aria-label"]
        : (rest["aria-label"] ?? api().channelName)
    },
    get value() {
      return api().slider.value
    },
    // What the hidden input's value attribute and a form reset show.
    get defaultValue() {
      const d = defaultValue()
      return d ? getChannel(d, local.channel) : undefined
    },
    get min() {
      return api().slider.min
    },
    get max() {
      return api().slider.max
    },
    get step() {
      return api().slider.step
    },
    get largeStep() {
      return api().slider.largeStep
    },
    get orientation() {
      return orientation()
    },
    get dir() {
      return loc().dir
    },
    get locale() {
      return loc().locale
    },
    messages: sliderMessages,
    onValueChange: (n: SliderValue, d: { event: { type: string } }) =>
      // The Slider's form reset is the colour's: every channel back to the default.
      d.event.type === "RESET"
        ? send({ type: "RESET" })
        : send({
            type: "SET",
            color: withChannel(
              untrack(color),
              local.channel,
              Number(n),
              untrack(view).context.memory,
            ),
            reason: "SLIDER",
          }),
    onValueCommit: (_n: SliderValue, d: { reason: unknown }) =>
      send({ type: "COMMIT", reason: String(d.reason) }),
    get children() {
      return local.children
    },
  })
  return (
    <ColorSliderContext.Provider value={ctx}>
      <SliderRootSurfaceContext.Provider value={true}>
        <SliderNamingContext.Provider value={channelSliderNaming}>
          <Slider.Root {...(sliderProps as SliderRootProps)} />
        </SliderNamingContext.Provider>
      </SliderRootSurfaceContext.Provider>
    </ColorSliderContext.Provider>
  )
}

/**
 * The binding's data attributes as lazy props. Two fixed getters, not a reactive object: a
 * lookup of any other key (`render`, `children`) must not depend on the colour.
 */
const dataOf = (ctx: Ctx) => ({
  get "data-channel"() {
    return ctx.data()["data-channel"]
  },
  get "data-space"() {
    return ctx.data()["data-space"]
  },
})

/** The Slider part's props with the binding's data attributes (consumer props win). */
const withData = <P extends object>(ctx: Ctx, props: P) => solidMerge(dataOf(ctx), props) as P

function Label(props: Parameters<typeof Slider.Label>[0]) {
  const ctx = useColorSlider("Label")
  afterMount(() => {
    ctx.setLabelled(true)
    onCleanup(() => ctx.setLabelled(false))
  })
  return <Slider.Label {...withData(ctx, props)} />
}

function ValueText(props: Parameters<typeof Slider.ValueText>[0]) {
  return <Slider.ValueText {...withData(useColorSlider("ValueText"), props)} />
}

function Control(props: Parameters<typeof Slider.Control>[0]) {
  return <Slider.Control {...withData(useColorSlider("Control"), props)} />
}

function Track(props: Parameters<typeof Slider.Track>[0]) {
  const ctx = useColorSlider("Track")
  const style = createMemo(
    () => mergeProps({ style: ctx.trackStyle() }, { style: props.style })["style"],
  )
  return (
    <Slider.Track
      {...(solidMerge(dataOf(ctx), props, {
        get style() {
          return style()
        },
      }) as typeof props)}
    />
  )
}

export type ColorSliderThumbProps = Omit<SliderThumbProps, "index">

function Thumb(props: ColorSliderThumbProps) {
  const ctx = useColorSlider("Thumb")
  const style = createMemo(
    () => mergeProps({ style: ctx.thumbStyle() }, { style: props.style })["style"],
  )
  return (
    <Slider.Thumb
      {...(solidMerge({ index: 0 }, dataOf(ctx), props, {
        get style() {
          return style()
        },
      }) as SliderThumbProps)}
    />
  )
}

function Description(props: Parameters<typeof Slider.Description>[0]) {
  return <Slider.Description {...withData(useColorSlider("Description"), props)} />
}

function TransparencyGrid(props: Parameters<typeof Grid>[0]) {
  // The picker's scope last: a consumer prop never moves the part out of it.
  return (
    <Grid
      {...(solidMerge(dataOf(useColorSlider("TransparencyGrid")), props, {
        scope: COLOR_PICKER_SCOPE,
      }) as typeof props)}
    />
  )
}

export const ColorSlider = {
  Root,
  Label,
  ValueText,
  Control,
  Track,
  Thumb,
  Description,
  TransparencyGrid,
}
