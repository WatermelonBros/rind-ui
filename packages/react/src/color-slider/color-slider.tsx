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
  type ColorSliderMessages,
  type ColorSpace,
  colorSliderConnect,
  colorSliderMessages,
  colorSliderSpace,
  colorValueMachine,
  colorValueOf,
  colorVariables,
  getChannel,
  type MessageOverrides,
  makeColor,
  withChannel,
  workingOf,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useColorProp } from "../color-input"
import { TransparencyGrid as Grid } from "../color-swatch/color-swatch"
import { normalizeProps } from "../normalize-props"
import { useLocale, useMessages } from "../provider"
import { Slider, type SliderRootProps, type SliderThumbProps } from "../slider/slider"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    "color-slider": ColorSliderMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

type Style = Record<string, unknown>
const style = (s: object) => (normalizeProps({ style: s }) as { style?: Style }).style ?? {}

interface Ctx {
  readonly data: Readonly<Record<`data-${string}`, string>>
  readonly trackStyle: Style
  readonly thumbStyle: Style
  readonly setLabelled: (on: boolean) => void
}
const ColorSliderContext = createContext<Ctx | null>(null)
function useColorSlider(part: string): Ctx {
  const ctx = useContext(ColorSliderContext)
  if (!ctx) throw new Error(`ColorSlider.${part} must be inside ColorSlider.Root`)
  return ctx
}

export type ColorSliderRootProps = Omit<
  SliderRootProps<number>,
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
> & {
  readonly channel: ColorChannel
  readonly value?: ColorInput
  /** Default `hsb(0, 100%, 100%)`. */
  readonly defaultValue?: ColorInput
  readonly onValueChange?: (color: Color, details: ColorChangeDetails) => void
  readonly onValueCommit?: (color: Color, details: ColorCommitDetails) => void
  readonly colorSpace?: ColorSpace
  readonly colorName?: ColorNameProp
  readonly messages?: MessageOverrides<ColorSliderMessages>
  readonly children?: ReactNode
}

const DEFAULT = makeColor("hsb", [0, 100, 100])

/** One channel of a colour edited with a Slider whose track is the channel's gradient. */
function Root({
  channel,
  value: valueProp,
  defaultValue: defaultProp,
  onValueChange,
  onValueCommit,
  colorSpace,
  colorName,
  messages: ownMessages,
  orientation = "horizontal",
  locale: ownLocale,
  dir: ownDir,
  style: ownStyle,
  children,
  ...rest
}: ColorSliderRootProps) {
  const { locale, dir } = useLocale(ownLocale, ownDir)
  const messages = useMessages("color-slider", colorSliderMessages, ownMessages)
  const value = useColorProp(valueProp, "value", "color-slider")
  const defaultValue = useColorProp(defaultProp, "defaultValue", "color-slider")
  const [first] = useState(() => value ?? defaultValue)
  const space = colorSliderSpace(channel, colorSpace, first)
  const callbacks = useRef({ onValueChange, onValueCommit })
  callbacks.current = { onValueChange, onValueCommit }
  const machineProps = {
    value,
    defaultValue,
    space,
    fallback: DEFAULT,
    onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
      // A form reset restores the default without a callback (as every form control).
      if (d.reason === "RESET") return
      const reason = (d.event as { reason?: string }).reason ?? d.reason
      callbacks.current.onValueChange?.(c, { reason, space, cancel: d.cancel })
    },
    onValueCommit: (c: Color, d: ColorCommitDetails) => callbacks.current.onValueCommit?.(c, d),
  }
  const { view, send } = useMachine(colorValueMachine, machineProps, {})
  const color = workingOf(machineProps, view.context, colorValueOf(machineProps, view.values.value))
  const memory = view.context.memory
  const api = colorSliderConnect({
    color,
    channel,
    memory,
    orientation,
    dir,
    messages,
    locale,
    colorName,
  })
  const [labelled, setLabelled] = useState(false)
  const latest = useRef({ color, memory })
  latest.current = { color, memory }
  const ctx: Ctx = {
    data: api.data,
    trackStyle: style(api.trackStyle),
    thumbStyle: style(api.thumbStyle),
    setLabelled,
  }
  return (
    <ColorSliderContext value={ctx}>
      <Slider.Root
        {...rest}
        {...api.data}
        value={api.slider.value}
        // What the hidden input's value attribute and a form reset show.
        {...(defaultValue ? { defaultValue: getChannel(defaultValue, channel) } : {})}
        min={api.slider.min}
        max={api.slider.max}
        step={api.slider.step}
        largeStep={api.slider.largeStep}
        orientation={orientation}
        dir={dir}
        locale={locale}
        style={{ ...style(api.surfaceStyle), ...style(colorVariables(color)), ...ownStyle }}
        // Unlabelled: the group is named by the channel too, so it can be found by name.
        aria-label={
          labelled || rest["aria-labelledby"] !== undefined
            ? rest["aria-label"]
            : (rest["aria-label"] ?? api.channelName)
        }
        messages={{
          valueText: ({ value: v }) => api.valueText(v),
          // Unlabelled: the thumb is named by the channel (Reado's sliders had no name).
          thumbLabel: () => (labelled ? "" : api.channelName),
        }}
        onValueChange={(n, d) =>
          // The Slider's form reset is the colour's: every channel back to the default.
          d.event.type === "RESET"
            ? send({ type: "RESET" })
            : send({
                type: "SET",
                color: withChannel(latest.current.color, channel, n, latest.current.memory),
                reason: "SLIDER",
              })
        }
        onValueCommit={(_n, d) => send({ type: "COMMIT", reason: String(d.reason) })}
      >
        {children}
      </Slider.Root>
    </ColorSliderContext>
  )
}

function Label(props: ComponentPropsWithRef<typeof Slider.Label>) {
  const ctx = useColorSlider("Label")
  const { setLabelled } = ctx
  useIsoLayoutEffect(() => {
    setLabelled(true)
    return () => setLabelled(false)
  }, [setLabelled])
  return <Slider.Label {...ctx.data} {...props} />
}

function ValueText(props: ComponentPropsWithRef<typeof Slider.ValueText>) {
  return <Slider.ValueText {...useColorSlider("ValueText").data} {...props} />
}

function Control(props: ComponentPropsWithRef<typeof Slider.Control>) {
  return <Slider.Control {...useColorSlider("Control").data} {...props} />
}

function Track({ style: own, ...props }: ComponentPropsWithRef<typeof Slider.Track>) {
  const ctx = useColorSlider("Track")
  return <Slider.Track {...ctx.data} {...props} style={{ ...ctx.trackStyle, ...own }} />
}

export type ColorSliderThumbProps = Omit<SliderThumbProps, "index">

function Thumb({ style: own, ...props }: ColorSliderThumbProps) {
  const ctx = useColorSlider("Thumb")
  return <Slider.Thumb index={0} {...ctx.data} {...props} style={{ ...ctx.thumbStyle, ...own }} />
}

function Description(props: ComponentPropsWithRef<typeof Slider.Description>) {
  return <Slider.Description {...useColorSlider("Description").data} {...props} />
}

function TransparencyGrid(props: ComponentPropsWithRef<typeof Grid>) {
  return <Grid scope="slider" {...useColorSlider("TransparencyGrid").data} {...props} />
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
