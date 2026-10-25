/** @jsxImportSource solid-js */
import { ColorPicker } from "@rind-ui/solid"
import { For } from "solid-js"

const swatches = ["#FF3D8B", "#FF8F3D", "#F5D90A", "#2EC27E", "#3D8BFF", "#8B3DFF"]

export function Basic() {
  return (
    <ColorPicker.Root defaultValue="#3D8BFF">
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
            <ColorPicker.ChannelSlider channel="alpha">
              <ColorPicker.ChannelSliderTrack>
                <ColorPicker.TransparencyGrid />
                <ColorPicker.ChannelSliderThumb />
              </ColorPicker.ChannelSliderTrack>
            </ColorPicker.ChannelSlider>
            <div class="row">
              <ColorPicker.ChannelInput channel="hex" />
              <ColorPicker.EyeDropperTrigger>Pick</ColorPicker.EyeDropperTrigger>
            </div>
            <ColorPicker.SwatchGroup>
              <For each={swatches}>
                {(c) => (
                  <ColorPicker.SwatchTrigger color={c}>
                    <ColorPicker.Swatch color={c} aria-hidden="true" />
                    <ColorPicker.SwatchIndicator />
                  </ColorPicker.SwatchTrigger>
                )}
              </For>
            </ColorPicker.SwatchGroup>
          </ColorPicker.Content>
        </ColorPicker.Positioner>
      </ColorPicker.Portal>
    </ColorPicker.Root>
  )
}
