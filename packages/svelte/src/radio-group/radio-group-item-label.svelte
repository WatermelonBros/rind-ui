<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { radioGroupContext, radioItemContext } from "./context"
import type { RadioGroupItemLabelProps } from "./types"

const { child, children, ...rest }: RadioGroupItemLabelProps = $props()
const ctx = radioGroupContext.get()
const item = radioItemContext.get()
$effect(() =>
  untrack(() => {
    item.setLabelRendered(true)
    return () => item.setLabelRendered(false)
  }),
)
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps(
        ctx.api().itemLabel(item.key(), {
          disabled: item.disabled(),
          labelable: item.controlTag() === "button" || item.controlTag() === "input",
        }),
      ),
      rest,
    ),
  ),
)
const current = $derived({ checked: ctx.value() === item.key(), disabled: item.disabled() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <label {...attrs(merged)}>{@render children?.(current)}</label>
{/if}
