<script lang="ts">
import Grid from "../color-swatch/transparency-grid.svelte"
import type { TransparencyGridProps } from "../color-swatch/types"
import { colorPicker } from "./context"

// The picker's scope last: a consumer prop never moves the part out of it.
const props: Omit<TransparencyGridProps, "scope"> = $props()
colorPicker.get()
</script>

<Grid {...props} scope="color-picker" />
