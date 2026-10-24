<script lang="ts">
import Indicator from "../../src/color-swatch-picker/color-swatch-picker-indicator.svelte"
import Item from "../../src/color-swatch-picker/color-swatch-picker-item.svelte"
import ColorSwatchPicker from "../../src/color-swatch-picker/color-swatch-picker-root.svelte"
import Swatch from "../../src/color-swatch-picker/color-swatch-picker-swatch.svelte"
import Provider from "./provider.svelte"

const SWATCHES = ["#FF0000", "#00FF00", "#0000FF"]
const { cfg = {} }: { cfg?: { defaultValue?: string; disabled?: readonly string[] } } = $props()
</script>

<Provider
  ><form
    ><ColorSwatchPicker
      aria-label="Palette"
      name="c"
      {...cfg.defaultValue ? { defaultValue: cfg.defaultValue } : {}}
      >{#each SWATCHES as c (c)}<Item color={c} disabled={cfg.disabled?.includes(`${c}FF`) === true}
          ><Swatch /><Indicator>✓</Indicator></Item
        >{/each}</ColorSwatchPicker
    ><button type="button">After</button></form
  ></Provider
>
