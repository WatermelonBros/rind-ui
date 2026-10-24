<script lang="ts">
import type { Color } from "@rind-ui/core"
import Root from "../color-swatch-picker/color-swatch-picker-root.svelte"
import type { ColorSwatchPickerRootProps } from "../color-swatch-picker/types"
import { colorPicker } from "./context"

// The picker's swatches (a Color Swatch Picker bound to its colour).
const props: Omit<ColorSwatchPickerRootProps, "value" | "defaultValue"> = $props()
const ctx = colorPicker.get()
const s = $derived(ctx.state())
</script>

<Root
  {...props}
  value={ctx.color()}
  disabled={s.disabled}
  readonly={s.readOnly}
  messages={ctx.messages()}
  onValueChange={(c: Color) => {
    ctx.send({ type: "COLOR.SET", color: c, reason: "SWATCH" })
    ctx.send({ type: "COLOR.COMMIT", reason: "SWATCH" })
  }}
/>
