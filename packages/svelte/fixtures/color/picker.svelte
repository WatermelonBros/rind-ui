<script lang="ts">
import { ColorPicker, type ColorPickerRootProps } from "../../src/index"
import Provider from "./provider.svelte"

// The model's picker (in a form), or the parity picker (with every part, a div around).
const {
  root = {},
  full = false,
  provider = true,
}: { root?: Record<string, unknown>; full?: boolean; provider?: boolean } = $props()
const rootProps = $derived(root as ColorPickerRootProps)
const SWATCHES = ["#FF3D8B", "#2EC27E", "#3D8BFF"]
</script>

{#snippet body()}{#if full}<ColorPicker.Area><ColorPicker.AreaBackground /><ColorPicker.AreaThumb /></ColorPicker.Area
    ><ColorPicker.ChannelSlider channel="hue"
      ><ColorPicker.ChannelSliderTrack><ColorPicker.ChannelSliderThumb /></ColorPicker.ChannelSliderTrack
      ></ColorPicker.ChannelSlider
    ><ColorPicker.ChannelSlider channel="alpha"
      ><ColorPicker.ChannelSliderTrack
        ><ColorPicker.TransparencyGrid /><ColorPicker.ChannelSliderThumb /></ColorPicker.ChannelSliderTrack
      ></ColorPicker.ChannelSlider
    ><ColorPicker.ChannelInput channel="hex" /><ColorPicker.EyeDropperTrigger>Pick</ColorPicker.EyeDropperTrigger
    ><ColorPicker.SwatchGroup
      >{#each SWATCHES as c (c)}<ColorPicker.SwatchTrigger color={c}
          ><ColorPicker.Swatch color={c} aria-hidden="true" /><ColorPicker.SwatchIndicator
          /></ColorPicker.SwatchTrigger
        >{/each}</ColorPicker.SwatchGroup
    ><ColorPicker.FormatSelect /><ColorPicker.FormatTrigger />{:else}<ColorPicker.FormatTrigger
    /><ColorPicker.ChannelInput channel="hex" />{/if}{/snippet}

{#snippet picker()}<ColorPicker.Root {...rootProps}
    ><ColorPicker.Label>{full ? "Background" : "Fill"}</ColorPicker.Label><ColorPicker.Control
      >{#if !root["inline"]}<ColorPicker.Trigger><ColorPicker.ValueSwatch /></ColorPicker.Trigger
        >{/if}<ColorPicker.ValueText /></ColorPicker.Control
    ><ColorPicker.Portal
      ><ColorPicker.Positioner><ColorPicker.Content>{@render body()}</ColorPicker.Content></ColorPicker.Positioner
      ></ColorPicker.Portal
    ></ColorPicker.Root
  >{/snippet}

{#if provider}<Provider
    ><form>{@render picker()}<button type="reset">Reset</button></form></Provider
  >{:else}<div>{@render picker()}</div>{/if}
