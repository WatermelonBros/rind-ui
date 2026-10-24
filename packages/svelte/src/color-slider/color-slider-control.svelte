<script lang="ts">
import Part from "../slider/slider-control.svelte"
import { colorSlider } from "./context"

const props: Record<string, unknown> = $props()
const ctx = colorSlider.get()
</script>

<Part {...ctx.data()} {...props as Record<string, unknown>} />
