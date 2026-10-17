"use client"

import { type Color, formatColor } from "@rind-ui/core"
import { Button, ColorPicker, type ColorPickerRootProps, Dialog } from "@rind-ui/react"
import { useEffect, useRef, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = {
  "color-picker": { closed: "Basic", open: "Open" },
  // Its parts' own states: the area, the colour field (a draft that does not parse).
  "color-area": { idle: "AreaAxes" },
  "color-field": { idle: "FieldOnly", invalid: "FieldInvalid" },
}

const SWATCHES = ["#FF3D8B", "#FF8F3D", "#F5D90A", "#2EC27E", "#3D8BFF", "#8B3DFF"]

function Body({ swatches = true }: { readonly swatches?: boolean }) {
  return (
    <>
      <ColorPicker.Area>
        <ColorPicker.AreaBackground />
        <ColorPicker.AreaThumb />
      </ColorPicker.Area>
      <ColorPicker.ChannelSlider channel="hue">
        <ColorPicker.ChannelSliderTrack>
          <ColorPicker.ChannelSliderThumb />
        </ColorPicker.ChannelSliderTrack>
      </ColorPicker.ChannelSlider>
      <ColorPicker.ChannelSlider channel="alpha">
        <ColorPicker.ChannelSliderTrack>
          <ColorPicker.TransparencyGrid />
          <ColorPicker.ChannelSliderThumb />
        </ColorPicker.ChannelSliderTrack>
      </ColorPicker.ChannelSlider>
      <div className="row">
        <ColorPicker.ChannelInput channel="hex" />
        <ColorPicker.EyeDropperTrigger>Pick</ColorPicker.EyeDropperTrigger>
      </div>
      {swatches ? (
        <ColorPicker.SwatchGroup>
          {SWATCHES.map((c) => (
            <ColorPicker.SwatchTrigger key={c} color={c}>
              <ColorPicker.Swatch color={c} aria-hidden="true" />
              <ColorPicker.SwatchIndicator />
            </ColorPicker.SwatchTrigger>
          ))}
        </ColorPicker.SwatchGroup>
      ) : null}
    </>
  )
}

function Popup(props: ColorPickerRootProps & { readonly children?: React.ReactNode }) {
  return (
    <ColorPicker.Root defaultValue="#3D8BFF" {...props}>
      <ColorPicker.Label>Background</ColorPicker.Label>
      <ColorPicker.Control>
        <ColorPicker.Trigger>
          <ColorPicker.ValueSwatch />
        </ColorPicker.Trigger>
        <ColorPicker.ValueText />
      </ColorPicker.Control>
      <ColorPicker.Portal>
        <ColorPicker.Positioner>
          <ColorPicker.Content>{props.children ?? <Body />}</ColorPicker.Content>
        </ColorPicker.Positioner>
      </ColorPicker.Portal>
    </ColorPicker.Root>
  )
}

export function Basic() {
  return <Popup />
}

export function Open() {
  return <Popup defaultOpen />
}

export function Inline() {
  const [color, setColor] = useState("rgba(61, 139, 255, 1)")
  return (
    <ColorPicker.Root
      inline
      format="rgb"
      value={color}
      onValueChange={(c: Color) => setColor(formatColor(c, "rgb"))}
    >
      <ColorPicker.Label>Stroke</ColorPicker.Label>
      <ColorPicker.Content>
        <ColorPicker.ValueText />
        <Body swatches={false} />
      </ColorPicker.Content>
    </ColorPicker.Root>
  )
}

export function CloseOnSelect() {
  return (
    <Popup closeOnSelect>
      <ColorPicker.SwatchGroup>
        {SWATCHES.map((c) => (
          <ColorPicker.SwatchTrigger key={c} color={c}>
            <ColorPicker.Swatch color={c} aria-hidden="true" />
            <ColorPicker.SwatchIndicator />
          </ColorPicker.SwatchTrigger>
        ))}
      </ColorPicker.SwatchGroup>
    </Popup>
  )
}

export function Formats() {
  return (
    <Popup defaultFormat="hsl">
      <ColorPicker.FormatSelect />
      <ColorPicker.View format="hex">
        <ColorPicker.ChannelInput channel="hex" />
      </ColorPicker.View>
      <ColorPicker.View format="hsl">
        <div className="row">
          <ColorPicker.ChannelInput channel="hue" />
          <ColorPicker.ChannelInput channel="saturation" />
          <ColorPicker.ChannelInput channel="lightness" />
        </div>
      </ColorPicker.View>
      <ColorPicker.View format="rgb">
        <div className="row">
          <ColorPicker.ChannelInput channel="red" />
          <ColorPicker.ChannelInput channel="green" />
          <ColorPicker.ChannelInput channel="blue" />
        </div>
      </ColorPicker.View>
      <ColorPicker.View format="hsb">
        <div className="row">
          <ColorPicker.ChannelInput channel="hue" />
          <ColorPicker.ChannelInput channel="saturation" />
          <ColorPicker.ChannelInput channel="brightness" />
        </div>
      </ColorPicker.View>
    </Popup>
  )
}

export function Modal() {
  return <Popup modal />
}

const CHANNELS_IT: Readonly<Record<string, string>> = {
  hue: "Tonalità",
  saturation: "Saturazione",
  brightness: "Luminosità",
  lightness: "Chiarezza",
  alpha: "Opacità",
  red: "Rosso",
  green: "Verde",
  blue: "Blu",
}

const ITALIAN = {
  trigger: ({ colorName }: { readonly colorName: string }) => `Scegli il colore, ${colorName}`,
  dialogLabel: "Scegli un colore",
  eyeDropper: "Preleva un colore dallo schermo",
  picked: ({ colorName }: { readonly colorName: string }) => `Prelevato ${colorName}`,
  areaLabel: "Area colore",
  roleDescription: "cursore 2D",
  red: "rosso",
  orange: "arancione",
  yellow: "giallo",
  green: "verde",
  blue: "blu",
  purple: "viola",
  pink: "rosa",
  vibrant: "vivace",
  dark: "scuro",
  light: "chiaro",
  channelName: (channel: string) => CHANNELS_IT[channel] ?? channel,
  // Italian puts the adjectives after the hue.
  colorName: ({
    lightness,
    chroma,
    hue,
  }: {
    readonly lightness: string
    readonly chroma: string
    readonly hue: string
  }) => [hue, chroma, lightness].filter(Boolean).join(" "),
}

export function Translated() {
  return (
    <ColorPicker.Root defaultValue="#3D8BFF" messages={ITALIAN} locale="it-IT">
      <ColorPicker.Label>Sfondo</ColorPicker.Label>
      <ColorPicker.Control>
        <ColorPicker.Trigger>
          <ColorPicker.ValueSwatch />
        </ColorPicker.Trigger>
        <ColorPicker.ValueText />
      </ColorPicker.Control>
      <ColorPicker.Portal>
        <ColorPicker.Positioner>
          <ColorPicker.Content>
            <ColorPicker.Area>
              <ColorPicker.AreaBackground />
              <ColorPicker.AreaThumb />
            </ColorPicker.Area>
            <ColorPicker.ChannelSlider channel="hue">
              <ColorPicker.ChannelSliderTrack>
                <ColorPicker.ChannelSliderThumb />
              </ColorPicker.ChannelSliderTrack>
            </ColorPicker.ChannelSlider>
            <div className="row">
              <ColorPicker.ChannelInput channel="hex" />
              <ColorPicker.EyeDropperTrigger>Preleva</ColorPicker.EyeDropperTrigger>
            </div>
          </ColorPicker.Content>
        </ColorPicker.Positioner>
      </ColorPicker.Portal>
    </ColorPicker.Root>
  )
}

/** The driver opens the picker, types a hex and picks a swatch the way a user would. */
export function DriverExample() {
  return <Popup />
}

export function InADialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Edit theme</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Title>Theme</Dialog.Title>
            <Popup />
            <Dialog.CloseTrigger>Done</Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function InAForm() {
  const [sent, setSent] = useState("")
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        setSent(String(new FormData(e.currentTarget).get("fill")))
      }}
    >
      <Popup name="fill" />
      <div className="row">
        <Button type="submit">Submit</Button>
        <Button type="reset">Reset</Button>
      </div>
      <p className="note">{sent}</p>
    </form>
  )
}

/** An inline picker: the parts laid out on the page, no Popover. */
function InlinePicker(
  props: ColorPickerRootProps & { readonly label: string; readonly children: React.ReactNode },
) {
  const { label, children, ...rest } = props
  return (
    <ColorPicker.Root inline {...rest}>
      <ColorPicker.Label>{label}</ColorPicker.Label>
      <ColorPicker.Content>{children}</ColorPicker.Content>
    </ColorPicker.Root>
  )
}

export function AreaAxes() {
  return (
    <InlinePicker label="Highlight" defaultValue="hsb(30, 80%, 90%)">
      <ColorPicker.Area xChannel="hue" yChannel="saturation">
        <ColorPicker.AreaBackground />
        <ColorPicker.AreaThumb />
      </ColorPicker.Area>
      <ColorPicker.ChannelSlider channel="brightness">
        <ColorPicker.ChannelSliderTrack>
          <ColorPicker.ChannelSliderThumb />
        </ColorPicker.ChannelSliderTrack>
      </ColorPicker.ChannelSlider>
    </InlinePicker>
  )
}

export function ChannelSliders() {
  return (
    <InlinePicker label="Text colour" defaultValue="rgb(51, 102, 153)">
      {(
        [
          ["red", "Red"],
          ["green", "Green"],
          ["blue", "Blue"],
        ] as const
      ).map(([channel, label]) => (
        <ColorPicker.ChannelSlider key={channel} channel={channel}>
          <ColorPicker.ChannelSliderLabel>{label}</ColorPicker.ChannelSliderLabel>
          <ColorPicker.ChannelSliderValueText />
          <ColorPicker.ChannelSliderTrack>
            <ColorPicker.ChannelSliderThumb />
          </ColorPicker.ChannelSliderTrack>
        </ColorPicker.ChannelSlider>
      ))}
      <ColorPicker.ChannelSlider channel="hue" orientation="vertical">
        <ColorPicker.ChannelSliderTrack>
          <ColorPicker.ChannelSliderThumb />
        </ColorPicker.ChannelSliderTrack>
      </ColorPicker.ChannelSlider>
    </InlinePicker>
  )
}

export function Swatches() {
  return (
    <InlinePicker label="Tag colour" defaultValue="#2EC27E">
      <ColorPicker.SwatchGroup>
        {SWATCHES.map((c) => (
          <ColorPicker.SwatchTrigger key={c} color={c}>
            <ColorPicker.Swatch color={c} aria-hidden="true" />
            <ColorPicker.SwatchIndicator />
          </ColorPicker.SwatchTrigger>
        ))}
      </ColorPicker.SwatchGroup>
      <div className="row">
        <ColorPicker.ValueSwatch />
        <ColorPicker.ValueText />
      </div>
    </InlinePicker>
  )
}

export function FieldOnly() {
  return (
    <InlinePicker label="Brand colour" defaultValue="#FF3D8B">
      <ColorPicker.ChannelInput channel="hex" />
    </InlinePicker>
  )
}

export function FieldInvalid() {
  const input = useRef<HTMLInputElement>(null)
  // A draft that does not parse, committed on mount (typing then Enter), so the page holds it.
  useEffect(() => {
    const el = input.current
    if (!el) return
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, "12345")
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  }, [])
  return (
    <InlinePicker label="Accent" defaultValue="#FF3D8B">
      <ColorPicker.ChannelInput channel="hex" ref={input} />
    </InlinePicker>
  )
}

export function ChannelFields() {
  return (
    <InlinePicker label="Stroke" defaultValue="hsb(200, 60%, 70%)">
      <div className="row">
        {(["hue", "saturation", "brightness"] as const).map((channel) => (
          <ColorPicker.ChannelInput key={channel} channel={channel} />
        ))}
      </div>
    </InlinePicker>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Popover",
    description: "A trigger named with the colour; the content in a Popover.",
  },
  Open: { title: "Open", description: "The content, open.", hidden: true },
  Inline: {
    title: "Inline, controlled",
    description: "A string re-parsed every render: hue and thumbs stay continuous.",
  },
  CloseOnSelect: { title: "Close on select", description: "A swatch pick closes the Popover." },
  Formats: { title: "Formats", description: "`FormatSelect` and `View` per format." },
  Modal: { title: "Modal", description: "`modal`: the page behind is inert while it is open." },
  Translated: {
    title: "Translated",
    description: "Every string and colour word from `messages`, in Italian.",
  },
  DriverExample: { title: "Driver example", hidden: true },
  InADialog: {
    title: "In a dialog",
    description: "Outside presses close the picker, not the dialog.",
  },
  InAForm: { title: "In a form", description: "Submits the canonical `#RRGGBB`; reset restores." },
  AreaAxes: {
    title: "Area axes",
    description:
      'An inline picker; `xChannel="hue"`, `yChannel="saturation"` and a brightness slider.',
  },
  ChannelSliders: {
    title: "Channel sliders",
    description: "Red, green and blue on one colour, each labelled; a vertical hue slider.",
  },
  Swatches: {
    title: "Swatches",
    description: "A swatch group: arrows move and pick; one tab stop.",
  },
  FieldOnly: {
    title: "Field only",
    description: "A hex field: free text until Enter or blur; `#` optional, any case.",
  },
  FieldInvalid: {
    title: "Invalid entry",
    description: "A draft that is not a colour keeps the last colour and marks the field invalid.",
  },
  ChannelFields: {
    title: "Channel fields",
    description: "Hue, saturation and brightness as numbers.",
  },
}
