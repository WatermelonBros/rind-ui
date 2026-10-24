<script lang="ts">
import ColorSwatchRoot from "../color-swatch/color-swatch-root.svelte"
import { swatchNaming } from "../color-swatch/context"
import type { ColorSwatchProps } from "../color-swatch/types"
import { colorPicker, SWATCH } from "./context"

// A Color Swatch (a colour to show, named by its colour name).
const props: ColorSwatchProps = $props()
const ctx = colorPicker.get()
swatchNaming.set(SWATCH)
</script>

<ColorSwatchRoot messages={ctx.messages()} {...props} />
