/** @jsxImportSource solid-js */
// Markup parity with React: the closed popover picker, and an inline picker with every part
// (area, channel sliders, hex input, eye dropper, swatches, format select and value text).
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { clientParity } from "../../fixtures/parity"
import { ColorPicker, type ColorPickerRootProps } from "../index"

const SWATCHES = ["#FF3D8B", "#2EC27E", "#3D8BFF"]
type P = Record<string, unknown>

const body = (): JSX.Element => (
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
    <ColorPicker.ChannelInput channel="hex" />
    <ColorPicker.EyeDropperTrigger>Pick</ColorPicker.EyeDropperTrigger>
    <ColorPicker.SwatchGroup>
      <For each={SWATCHES}>
        {(c) => (
          <ColorPicker.SwatchTrigger color={c}>
            <ColorPicker.Swatch color={c} aria-hidden="true" />
            <ColorPicker.SwatchIndicator />
          </ColorPicker.SwatchTrigger>
        )}
      </For>
    </ColorPicker.SwatchGroup>
    <ColorPicker.FormatSelect />
    <ColorPicker.FormatTrigger />
  </>
)
const reactBody = () => [
  r(R.ColorPicker.Area, { key: "a" }, r(R.ColorPicker.AreaBackground), r(R.ColorPicker.AreaThumb)),
  r(
    R.ColorPicker.ChannelSlider,
    { key: "h", channel: "hue" },
    r(R.ColorPicker.ChannelSliderTrack, null, r(R.ColorPicker.ChannelSliderThumb)),
  ),
  r(
    R.ColorPicker.ChannelSlider,
    { key: "al", channel: "alpha" },
    r(
      R.ColorPicker.ChannelSliderTrack,
      null,
      r(R.ColorPicker.TransparencyGrid),
      r(R.ColorPicker.ChannelSliderThumb),
    ),
  ),
  r(R.ColorPicker.ChannelInput, { key: "i", channel: "hex" }),
  r(R.ColorPicker.EyeDropperTrigger, { key: "e" }, "Pick"),
  r(
    R.ColorPicker.SwatchGroup,
    { key: "s" },
    SWATCHES.map((c) =>
      r(
        R.ColorPicker.SwatchTrigger,
        { key: c, color: c },
        r(R.ColorPicker.Swatch, { color: c, "aria-hidden": "true" }),
        r(R.ColorPicker.SwatchIndicator),
      ),
    ),
  ),
  r(R.ColorPicker.FormatSelect, { key: "f" }),
  r(R.ColorPicker.FormatTrigger, { key: "t" }),
]

const solid = (p: P) => (): JSX.Element => (
  <div>
    <ColorPicker.Root id="fill" defaultValue="#3D8BFF" {...(p as ColorPickerRootProps)}>
      <ColorPicker.Label>Background</ColorPicker.Label>
      <ColorPicker.Control>
        {p["inline"] ? null : (
          <ColorPicker.Trigger>
            <ColorPicker.ValueSwatch />
          </ColorPicker.Trigger>
        )}
        <ColorPicker.ValueText />
      </ColorPicker.Control>
      <ColorPicker.Portal>
        <ColorPicker.Positioner>
          <ColorPicker.Content>{body()}</ColorPicker.Content>
        </ColorPicker.Positioner>
      </ColorPicker.Portal>
    </ColorPicker.Root>
  </div>
)
const react = (p: P) =>
  r(
    "div",
    null,
    r(
      R.ColorPicker.Root,
      { id: "fill", defaultValue: "#3D8BFF", ...p } as never,
      r(R.ColorPicker.Label, null, "Background"),
      r(
        R.ColorPicker.Control,
        null,
        p["inline"] ? null : r(R.ColorPicker.Trigger, null, r(R.ColorPicker.ValueSwatch)),
        r(R.ColorPicker.ValueText),
      ),
      r(
        R.ColorPicker.Portal,
        null,
        r(R.ColorPicker.Positioner, null, r(R.ColorPicker.Content, null, ...reactBody())),
      ),
    ),
  )

describe("Solid ColorPicker matches React", () => {
  it("a closed popover picker, in a form", async () => {
    for (const p of [
      {},
      { name: "fill", defaultValue: "#FF3D8B80", defaultFormat: "rgb" },
    ] as P[]) {
      await clientParity(react(p), solid(p))
    }
  })
  it("an inline picker with every part", async () => {
    for (const p of [
      { inline: true, defaultValue: "#123456" },
      { inline: true },
      { inline: true, defaultValue: "#2EC27E", readOnly: true },
    ] as P[]) {
      await clientParity(react(p), solid(p))
    }
  })
})
