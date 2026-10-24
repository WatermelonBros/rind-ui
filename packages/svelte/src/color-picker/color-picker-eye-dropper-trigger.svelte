<script lang="ts">
import { announcerCapability, isEyeDropperSupported, pickScreenColor } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { colorPicker } from "./context"
import { useFocusAttrs } from "./focus-attrs.svelte"
import type { ColorPickerButtonProps } from "./types"

// Opens the browser's eye dropper; hidden where there is none (ark#2764).
const { child, children, ...rest }: ColorPickerButtonProps = $props()
const ctx = colorPicker.get()
const env = useEnvironment(announcerCapability)
let supported = $state(false)
const focus = useFocusAttrs()
// After mount: the server and the first client render agree (hidden).
$effect(() => {
  supported = isEyeDropperSupported(globalThis.window)
})
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(
        { ...normalizeProps(ctx.api().eyeDropperTrigger(supported)), ...focus() },
        {
          onclick: async () => {
            const hex = await pickScreenColor(globalThis.window)
            if (!hex) return
            ctx.send({ type: "EYEDROPPER.RESULT", hex })
            env.announcer.announce({
              message: ctx.messages().picked({ colorName: ctx.api().colorName }),
              priority: "polite",
              key: `color-picker-${ctx.instance()}`,
              lang: ctx.locale(),
            })
          },
        },
      ),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...attrs(merged)}>{@render children?.(ctx.state())}</button>
{/if}
