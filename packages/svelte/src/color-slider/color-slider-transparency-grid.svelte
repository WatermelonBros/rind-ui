<script lang="ts">
import { COLOR_PICKER_SCOPE } from "@rind-ui/core/internal"
import Grid from "../color-swatch/transparency-grid.svelte"
import { colorSlider } from "./context"

// The picker's scope last: a consumer prop never moves the part out of it.
const props: Record<string, unknown> = $props()
const ctx = colorSlider.get()
</script>

<Grid {...ctx.data()} {...props as Record<string, unknown>} scope={COLOR_PICKER_SCOPE} />
