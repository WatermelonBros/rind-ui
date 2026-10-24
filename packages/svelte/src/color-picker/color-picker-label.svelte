<script lang="ts">
import { focusSafely } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { colorPicker } from "./context"
import type { ColorPickerLabelProps } from "./types"

// Names the Control, the Trigger and the content; a press focuses the Trigger.
const { child, children, ...rest }: ColorPickerLabelProps = $props()
const ctx = colorPicker.get()
const env = useEnvironment()
$effect(() => {
  ctx.setLabelRendered(true)
  return () => ctx.setLabelRendered(false)
})
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().label()), {
        onmousedown: (e: MouseEvent) => {
          // A pointer press focuses the Trigger (inline: the first text input) without a ring.
          e.preventDefault()
          const target =
            ctx.triggerEl.current ??
            document
              .getElementById(ctx.api().inlineContent()["id"] as string)
              ?.querySelector("input")
          if (target) void focusSafely(target as HTMLElement, env, "programmatic", "pointer")
        },
      }),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <label {...attrs(merged)}>{@render children?.(ctx.state())}</label>
{/if}
