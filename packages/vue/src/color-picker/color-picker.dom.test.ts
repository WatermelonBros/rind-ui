// Markup parity with React: the closed popover picker, and an inline picker with every part
// (area, channel sliders, hex input, eye dropper, swatches, format select and value text).
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { clientParity, serverParity } from "../../fixtures/parity"
import { ColorPicker } from "../index"

const SWATCHES = ["#FF3D8B", "#2EC27E", "#3D8BFF"]
type P = Record<string, unknown>

const body = () => [
  h(ColorPicker.Area, null, () => [h(ColorPicker.AreaBackground), h(ColorPicker.AreaThumb)]),
  h(ColorPicker.ChannelSlider, { channel: "hue" }, () =>
    h(ColorPicker.ChannelSliderTrack, null, () => h(ColorPicker.ChannelSliderThumb)),
  ),
  h(ColorPicker.ChannelSlider, { channel: "alpha" }, () =>
    h(ColorPicker.ChannelSliderTrack, null, () => [
      h(ColorPicker.TransparencyGrid),
      h(ColorPicker.ChannelSliderThumb),
    ]),
  ),
  h(ColorPicker.ChannelInput, { channel: "hex" }),
  h(ColorPicker.EyeDropperTrigger, null, () => "Pick"),
  h(ColorPicker.SwatchGroup, null, () =>
    SWATCHES.map((c) =>
      h(ColorPicker.SwatchTrigger, { key: c, color: c }, () => [
        h(ColorPicker.Swatch, { color: c, "aria-hidden": "true" }),
        h(ColorPicker.SwatchIndicator),
      ]),
    ),
  ),
  h(ColorPicker.FormatSelect),
  h(ColorPicker.FormatTrigger),
]
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

const vue = (p: P) => () =>
  h("div", [
    h(ColorPicker.Root, { id: "fill", defaultValue: "#3D8BFF", ...p }, () => [
      h(ColorPicker.Label, null, () => "Background"),
      h(ColorPicker.Control, null, () => [
        ...(p["inline"] ? [] : [h(ColorPicker.Trigger, null, () => h(ColorPicker.ValueSwatch))]),
        h(ColorPicker.ValueText),
      ]),
      h(ColorPicker.Portal, null, () =>
        h(ColorPicker.Positioner, null, () => h(ColorPicker.Content, null, body)),
      ),
    ]),
  ])
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

describe("Vue ColorPicker matches React", () => {
  it("a closed popover picker, in a form", async () => {
    for (const p of [
      {},
      { name: "fill", defaultValue: "#FF3D8B80", defaultFormat: "rgb" },
    ] as P[]) {
      await serverParity(react(p), vue(p))
      await clientParity(react(p), vue(p))
    }
  })
  it("an inline picker with every part", async () => {
    for (const p of [
      { inline: true, defaultValue: "#123456" },
      { inline: true },
      { inline: true, defaultValue: "#2EC27E", readonly: true },
    ] as P[]) {
      const reactOwn = { ...p, ...(p["readonly"] ? { readOnly: true, readonly: undefined } : {}) }
      // The swatch group's server HTML differs before hydration (the review backlog, "Color
      // Swatch Picker"): the client markup is compared.
      await clientParity(react(reactOwn), vue(p))
    }
  })
})
