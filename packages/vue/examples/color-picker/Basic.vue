<script setup lang="ts">
import { ColorPicker } from "@rind-ui/vue"

const swatches = ["#FF3D8B", "#FF8F3D", "#F5D90A", "#2EC27E", "#3D8BFF", "#8B3DFF"]
</script>

<template>
  <ColorPicker.Root default-value="#3D8BFF">
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
            <ColorPicker.SwatchTrigger v-for="c in swatches" :key="c" :color="c">
              <ColorPicker.Swatch :color="c" aria-hidden="true" />
              <ColorPicker.SwatchIndicator />
            </ColorPicker.SwatchTrigger>
          </ColorPicker.SwatchGroup>
        </ColorPicker.Content>
      </ColorPicker.Positioner>
    </ColorPicker.Portal>
  </ColorPicker.Root>
</template>
