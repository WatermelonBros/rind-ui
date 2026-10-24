<script lang="ts">
import Background from "../../src/color-area/color-area-background.svelte"
import Root from "../../src/color-area/color-area-root.svelte"
import Thumb from "../../src/color-area/color-area-thumb.svelte"
import type { ColorAreaRootProps } from "../../src/color-area/types"
import Provider from "./provider.svelte"

const { root = {} }: { root?: Record<string, unknown> } = $props()
const rootProps = $derived(root as ColorAreaRootProps)
</script>

<Provider
  ><form
    ><Root aria-label="Fill" xName="x" yName="y" style="width: 200px; height: 200px" {...rootProps}
      ><Background style="position: absolute; inset: 0" /><Thumb style="width: 16px; height: 16px" /></Root
    ><button type="reset">Reset</button></form
  ></Provider
>
