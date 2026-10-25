// Markup parity with React: the closed popover picker, and an inline picker with every part
// (area, channel sliders, hex input, eye dropper, swatches, format select and value text).
import { Component } from "@angular/core"
import * as R from "@rind-ui/react"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { both, clientParity } from "../../fixtures/parity"
import { ColorPicker } from "./index"

const SWATCHES = ["#FF3D8B", "#2EC27E", "#3D8BFF"]
type P = Record<string, unknown>

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

const BODY = `<div rindColorPickerArea>
          <div rindColorPickerAreaBackground></div>
          <div rindColorPickerAreaThumb></div>
        </div>
        <div rindColorPickerChannelSlider channel="hue">
          <div rindColorPickerChannelSliderTrack><div rindColorPickerChannelSliderThumb></div></div>
        </div>
        <div rindColorPickerChannelSlider channel="alpha">
          <div rindColorPickerChannelSliderTrack>
            <div rindColorPickerTransparencyGrid></div>
            <div rindColorPickerChannelSliderThumb></div>
          </div>
        </div>
        <div rindColorPickerChannelInput channel="hex"></div>
        <button rindColorPickerEyeDropperTrigger>Pick</button>
        <div rindColorPickerSwatchGroup>
          @for (c of swatches; track c) {
            <div rindColorPickerSwatchTrigger [color]="c">
              <div rindColorPickerSwatch [color]="c" aria-hidden="true"></div>
              <span rindColorPickerSwatchIndicator></span>
            </div>
          }
        </div>
        <select rindColorPickerFormatSelect></select>
        <button rindColorPickerFormatTrigger></button>`

/** The configuration the next fixture renders. */
let current: P = {}

@Component({
  selector: "rind-f",
  imports: [ColorPicker],
  template: `<div>
    @if (p["inline"]) {
      <div
        rindColorPickerRoot
        id="fill"
        inline
        [defaultValue]="$any(p['defaultValue'] ?? '#3D8BFF')"
        [readonly]="p['readOnly'] === true"
      >
        <label rindColorPickerLabel>Background</label>
        <div rindColorPickerControl><span rindColorPickerValueText></span></div>
        <div rindColorPickerContent>
          ${BODY}
        </div>
      </div>
    } @else {
      <div
        rindColorPickerRoot
        id="fill"
        [defaultValue]="$any(p['defaultValue'] ?? '#3D8BFF')"
        [defaultFormat]="$any(p['defaultFormat'])"
        [name]="$any(p['name'])"
      >
        <label rindColorPickerLabel>Background</label>
        <div rindColorPickerControl>
          <button rindColorPickerTrigger><div rindColorPickerValueSwatch></div></button>
          <span rindColorPickerValueText></span>
        </div>
        <ng-template rindColorPickerPortal>
          <div rindColorPickerPositioner>
            <div rindColorPickerContent>
              ${BODY}
            </div>
          </div>
        </ng-template>
      </div>
    }
  </div>`,
})
class Fixture {
  readonly p = current
  readonly swatches = SWATCHES
}

// The channel inputs (a Number Input each) and the format views.
const reactChannels = () =>
  r(
    R.ColorPicker.Root,
    { id: "fill", inline: true, defaultValue: "#3D8BFF", defaultFormat: "hsl" } as never,
    r(R.ColorPicker.Label, null, "Background"),
    r(
      R.ColorPicker.Content,
      null,
      r(
        R.ColorPicker.View,
        { format: "hsl" },
        r(R.ColorPicker.ChannelInput, { channel: "hue" }),
        r(R.ColorPicker.ChannelInput, { channel: "saturation", "aria-label": "Sat" }),
      ),
      r(R.ColorPicker.View, { format: "rgb" }, r(R.ColorPicker.ChannelInput, { channel: "red" })),
    ),
  )

@Component({
  selector: "rind-f",
  imports: [ColorPicker],
  template: `<div rindColorPickerRoot id="fill" inline defaultValue="#3D8BFF" defaultFormat="hsl">
    <label rindColorPickerLabel>Background</label>
    <div rindColorPickerContent>
      <div rindColorPickerView format="hsl">
        <div rindColorPickerChannelInput channel="hue"></div>
        <div rindColorPickerChannelInput channel="saturation" aria-label="Sat"></div>
      </div>
      <div rindColorPickerView format="rgb"><div rindColorPickerChannelInput channel="red"></div></div>
    </div>
  </div>`,
})
class Channels {}

describe("Angular ColorPicker matches React", () => {
  it("channel inputs in format views", async () => {
    await clientParity(reactChannels(), Channels)
  })
  for (const p of [{}, { name: "fill", defaultValue: "#FF3D8B80", defaultFormat: "rgb" }] as P[]) {
    it(`a closed popover picker ${JSON.stringify(p)}`, async () => {
      current = p
      await both(react(p), Fixture)
    })
  }
  for (const p of [
    { inline: true, defaultValue: "#123456" },
    { inline: true },
    { inline: true, defaultValue: "#2EC27E", readOnly: true },
  ] as P[]) {
    it(`an inline picker with every part ${JSON.stringify(p)}`, async () => {
      current = p
      // The swatch group's server HTML differs before hydration (the review backlog, "Color
      // Swatch Picker"): the client markup is compared.
      await clientParity(react(p), Fixture)
    })
  }
})
