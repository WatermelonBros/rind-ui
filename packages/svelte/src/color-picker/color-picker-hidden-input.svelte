<script lang="ts">
import HiddenField from "./color-picker-hidden-field.svelte"
import { colorPicker } from "./context"

// Places the hidden input (it replaces the automatic one).
const ctx = colorPicker.get()
$effect(() => {
  ctx.setHiddenPart(true)
  return () => ctx.setHiddenPart(false)
})
</script>

<HiddenField />
