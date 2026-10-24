<script lang="ts">
import Part from "../slider/slider-label.svelte"
import { colorSlider } from "./context"

const props: Record<string, unknown> = $props()
const ctx = colorSlider.get()
$effect(() => {
  ctx.setLabelled(true)
  return () => ctx.setLabelled(false)
})
</script>

<Part {...ctx.data()} {...props as Record<string, unknown>} />
