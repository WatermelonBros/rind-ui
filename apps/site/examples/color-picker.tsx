"use client"

import { type Color, formatColor } from "@rind-ui/core"
import { Button, ColorPicker, type ColorPickerRootProps, Dialog } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "color-picker": { closed: "Basic", open: "Open" } }

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
              <ColorPicker.SwatchIndicator>✓</ColorPicker.SwatchIndicator>
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
            <ColorPicker.SwatchIndicator>✓</ColorPicker.SwatchIndicator>
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
}
