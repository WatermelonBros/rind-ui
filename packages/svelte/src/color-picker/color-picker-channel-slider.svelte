<script lang="ts">
import type { Color } from "@rind-ui/core"
import ColorSliderRoot from "../color-slider/color-slider-root.svelte"
import type { ColorSliderRootProps } from "../color-slider/types"
import { colorPicker } from "./context"

// The picker's Color Slider for `channel`.
const props: Omit<ColorSliderRootProps, "value" | "defaultValue"> = $props()
const ctx = colorPicker.get()
const m = $derived(ctx.messages())
const s = $derived(ctx.state())
const name = $derived(ctx.colorName())
</script>

<ColorSliderRoot
  {...props}
  value={ctx.color()}
  disabled={s.disabled}
  readonly={s.readOnly}
  dir={ctx.dir()}
  locale={ctx.locale()}
  {...name === undefined ? {} : { colorName: name }}
  messages={{ ...m, valueText: m.sliderValueText }}
  onValueChange={(c: Color) =>
    ctx.send({ type: "COLOR.SET", color: c, reason: "SLIDER", channel: props.channel })}
  onValueCommit={() => ctx.send({ type: "COLOR.COMMIT", reason: "SLIDER" })}
/>
