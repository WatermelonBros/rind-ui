// The page color-picker.pw.test.ts drives: the themed colour components in each configuration,
// bundled by the test itself (no site build).
import { ColorPicker } from "@rind-ui/react"
import { createRoot } from "react-dom/client"
import {
  ColorArea,
  ColorChannelField,
  ColorField,
  ColorSlider,
  ColorSwatchPicker,
} from "../../src/components/color-parts"

const PALETTE = ["#FF0000", "#00FF00", "#0000FF"]

function App() {
  return (
    <form style={{ display: "grid", gap: 24, width: 320, padding: 24 }}>
      <ColorArea.Root aria-label="Fill" xName="s" yName="b" defaultValue="hsb(200, 50%, 50%)">
        <ColorArea.Background />
        <ColorArea.Thumb />
      </ColorArea.Root>
      <ColorSlider.Root channel="hue" defaultValue="hsb(200, 50%, 50%)">
        <ColorSlider.Label>Hue</ColorSlider.Label>
        <ColorSlider.Control>
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider.Control>
      </ColorSlider.Root>
      <div dir="rtl">
        <ColorSlider.Root channel="alpha" dir="rtl" defaultValue="#33669980">
          <ColorSlider.Label>Opacity</ColorSlider.Label>
          <ColorSlider.Control>
            <ColorSlider.Track>
              <ColorSlider.TransparencyGrid />
              <ColorSlider.Thumb />
            </ColorSlider.Track>
          </ColorSlider.Control>
        </ColorSlider.Root>
      </div>
      <ColorSlider.Root channel="hue" orientation="vertical" defaultValue="hsb(120, 80%, 90%)">
        <ColorSlider.Label>Vertical hue</ColorSlider.Label>
        <ColorSlider.Control>
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider.Control>
      </ColorSlider.Root>
      <ColorPicker.Root inline defaultValue="#FF3D8B">
        <ColorPicker.Label>Chips</ColorPicker.Label>
        <ColorPicker.Content>
          <div style={{ display: "flex", gap: 8 }}>
            <ColorPicker.Swatch color="#FF3D8B" data-testid="chip" />
            <ColorPicker.Swatch color="#FF3D8B80" data-testid="chip-alpha" />
          </div>
        </ColorPicker.Content>
      </ColorPicker.Root>
      <ColorField.Root name="hex" defaultValue="#336699">
        <ColorField.Label>Hex</ColorField.Label>
        <ColorField.Input />
      </ColorField.Root>
      <ColorChannelField.Root channel="hue" defaultValue="hsb(200, 50%, 50%)">
        <ColorChannelField.Input />
      </ColorChannelField.Root>
      <ColorSwatchPicker.Root aria-label="Palette" name="palette" defaultValue="#FF0000">
        {PALETTE.map((c) => (
          <ColorSwatchPicker.Item key={c} color={c}>
            <ColorSwatchPicker.Swatch />
            <ColorSwatchPicker.Indicator />
          </ColorSwatchPicker.Item>
        ))}
      </ColorSwatchPicker.Root>
      <ColorPicker.Root name="background" defaultValue="#336699">
        <ColorPicker.Label>Background</ColorPicker.Label>
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
              <ColorPicker.ChannelInput channel="hex" />
              <ColorPicker.FormatSelect />
              <ColorPicker.SwatchGroup>
                {PALETTE.map((c) => (
                  <ColorPicker.SwatchTrigger key={c} color={c}>
                    <ColorPicker.Swatch color={c} aria-hidden="true" />
                  </ColorPicker.SwatchTrigger>
                ))}
              </ColorPicker.SwatchGroup>
            </ColorPicker.Content>
          </ColorPicker.Positioner>
        </ColorPicker.Portal>
      </ColorPicker.Root>
      <button type="reset">Reset</button>
    </form>
  )
}

const root = document.getElementById("root")
if (root) createRoot(root).render(<App />)
