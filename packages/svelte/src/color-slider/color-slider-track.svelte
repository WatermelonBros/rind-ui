<script lang="ts">
import Part from "../slider/slider-track.svelte"
import { colorSlider, joinStyle } from "./context"

const { style, ...props }: Record<string, unknown> = $props()
const ctx = colorSlider.get()
</script>

<Part {...ctx.data()} {...props as Record<string, unknown>} style={joinStyle(ctx.trackStyle(), style as string)} />
