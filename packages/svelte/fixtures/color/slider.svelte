<script lang="ts">
import Control from "../../src/color-slider/color-slider-control.svelte"
import Root from "../../src/color-slider/color-slider-root.svelte"
import Thumb from "../../src/color-slider/color-slider-thumb.svelte"
import Track from "../../src/color-slider/color-slider-track.svelte"
import type { ColorSliderRootProps } from "../../src/color-slider/types"
import Provider from "./provider.svelte"

const { root }: { root: Record<string, unknown> } = $props()
const rootProps = $derived(root as ColorSliderRootProps)
const vertical = $derived(root["orientation"] === "vertical")
</script>

<Provider
  ><form
    ><Root name="v" {...rootProps}
      ><Control style={vertical ? "width: 20px; height: 200px" : "width: 200px; height: 20px"}
        ><Track style="position: absolute; inset: 0"
          ><Thumb style="width: 16px; height: 16px; --rind-slider-thumb-size: 16px" /></Track
        ></Control
      ></Root
    ><button type="reset">Reset</button></form
  ></Provider
>
