<script lang="ts">
import type { Color } from "@rind-ui/core"
import ChannelInput from "../color-field/color-channel-field-input.svelte"
import ChannelRoot from "../color-field/color-channel-field-root.svelte"
import FieldInput from "../color-field/color-field-input.svelte"
import FieldRoot from "../color-field/color-field-root.svelte"
import { colorPicker } from "./context"
import type { ColorPickerChannelInputProps } from "./types"

// A Color Field (`hex`, `css`) or a Color Channel Field, bound to the picker.
const { channel, alpha, "aria-label": ariaLabel, ...rest }: ColorPickerChannelInputProps = $props()
const ctx = colorPicker.get()
const m = $derived(ctx.messages())
const s = $derived(ctx.state())
</script>

{#if channel === "hex" || channel === "css"}
  <FieldRoot
    value={ctx.color()}
    format={channel}
    alpha={alpha ?? ctx.color().alpha < 1}
    disabled={s.disabled}
    readonly={s.readOnly}
    messages={m}
    onValueChange={(c: Color | null) => {
      if (!c) return
      ctx.send({ type: "COLOR.SET", color: c, reason: "INPUT", channel })
      ctx.send({ type: "COLOR.COMMIT", reason: "INPUT" })
    }}><FieldInput aria-label={ariaLabel ?? m.formatName(channel)} {...rest} /></FieldRoot
  >
{:else}
  <ChannelRoot
    {channel}
    value={ctx.color()}
    disabled={s.disabled}
    readonly={s.readOnly}
    locale={ctx.locale()}
    onValueChange={(c: Color) => ctx.send({ type: "COLOR.SET", color: c, reason: "INPUT", channel })}
    onValueCommit={() => ctx.send({ type: "COLOR.COMMIT", reason: "INPUT" })}
    ><ChannelInput aria-label={ariaLabel ?? m.channelName(channel)} {...rest as Record<string, unknown>} /></ChannelRoot
  >
{/if}
