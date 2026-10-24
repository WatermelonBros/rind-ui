<script lang="ts">
import Part from "../slider/slider-value-text.svelte"
import { colorSlider } from "./context"

const props: Record<string, unknown> = $props()
const ctx = colorSlider.get()
</script>

<Part {...ctx.data()} {...props as Record<string, unknown>} />
