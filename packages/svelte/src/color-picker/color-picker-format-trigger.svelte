<script lang="ts">
import { announcerCapability, nextFormat } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs } from "../normalize-props"
import { useEnvironment } from "../provider"
import { colorPicker } from "./context"
import { useFocusAttrs } from "./focus-attrs.svelte"
import type { ColorPickerButtonProps } from "./types"

// Cycles hex → rgb → hsl → hsb and announces the new format.
const { child, children, ...rest }: ColorPickerButtonProps = $props()
const ctx = colorPicker.get()
const env = useEnvironment(announcerCapability)
const focus = useFocusAttrs()
const next = $derived(nextFormat(ctx.format()))
const merged = $derived.by(() => {
  const m = ctx.messages()
  return stripMarker(
    mergeProps(
      joinHandlers(
        {
          ...focus(),
          "data-scope": "color-picker",
          "data-part": "format-trigger",
          "data-instance": ctx.instance(),
          type: "button",
          "aria-label": m.formatTrigger({
            current: m.formatOptions(ctx.format()),
            next: m.formatOptions(next),
          }),
          disabled: ctx.state().disabled || undefined,
        },
        {
          onclick: () => {
            ctx.send({ type: "FORMAT.SET", format: next })
            env.announcer.announce({
              message: m.formatChanged({ format: m.formatOptions(next) }),
              priority: "polite",
              key: `color-picker-format-${ctx.instance()}`,
              lang: ctx.locale(),
            })
          },
        },
      ),
      rest,
    ),
  )
})
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...attrs(merged)}
    >{#if children}{@render children(ctx.state())}{:else}{ctx.messages().formatOptions(ctx.format())}{/if}</button
  >
{/if}
