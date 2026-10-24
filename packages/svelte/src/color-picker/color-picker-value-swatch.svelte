<script lang="ts">
import ColorSwatchRoot from "../color-swatch/color-swatch-root.svelte"
import { swatchNaming } from "../color-swatch/context"
import type { ColorSwatchProps } from "../color-swatch/types"
import { colorPicker, inTrigger, VALUE_SWATCH } from "./context"

// The picker's colour as a swatch (decorative inside the Trigger).
const props: Omit<ColorSwatchProps, "color"> = $props()
const ctx = colorPicker.get()
const decorative = inTrigger.maybe() === true
swatchNaming.set(VALUE_SWATCH)
</script>

<ColorSwatchRoot
  color={ctx.color()}
  messages={ctx.messages()}
  {...decorative ? { "aria-hidden": "true" as const, role: "presentation" } : {}}
  {...props}
/>
