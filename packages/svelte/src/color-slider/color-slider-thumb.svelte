<script lang="ts">
import Part from "../slider/slider-thumb.svelte"
import { colorSlider, joinStyle } from "./context"
import type { ColorSliderThumbProps } from "./types"

const { style, ...props }: ColorSliderThumbProps = $props()
const ctx = colorSlider.get()
</script>

<Part index={0} {...ctx.data()} {...props as Record<string, unknown>} style={joinStyle(ctx.thumbStyle(), style as string)} />
