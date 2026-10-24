<script lang="ts">
import type { Color } from "@rind-ui/core"
import ColorAreaRoot from "../color-area/color-area-root.svelte"
import type { ColorAreaRootProps } from "../color-area/types"
import { DEV } from "../dev"
import { colorPicker } from "./context"

// The picker's Color Area (its own props, without a value: the picker owns it).
const props: Omit<ColorAreaRootProps, "value" | "defaultValue"> = $props()
const ctx = colorPicker.get()
$effect(() => {
  if ("value" in props && DEV)
    console.error("[rind-ui] color-picker: a bound ColorPicker.Area takes no `value` of its own")
})
const m = $derived(ctx.messages())
const s = $derived(ctx.state())
const name = $derived(ctx.colorName())
</script>

<ColorAreaRoot
  colorSpace="hsb"
  {...props}
  value={ctx.color()}
  disabled={s.disabled}
  readOnly={s.readOnly}
  dir={ctx.dir()}
  locale={ctx.locale()}
  {...name === undefined ? {} : { colorName: name }}
  messages={{ ...m, valueText: m.areaValueText }}
  onValueChange={(c: Color) => ctx.send({ type: "COLOR.SET", color: c, reason: "AREA" })}
  onValueCommit={() => ctx.send({ type: "COLOR.COMMIT", reason: "AREA" })}
/>
