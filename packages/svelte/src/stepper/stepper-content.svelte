<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { stepperContext, useFocusState } from "./context.svelte"
import type { StepperContentProps } from "./types"

const { index, child, children, ...rest }: StepperContentProps = $props()
const ctx = stepperContext.get()
const { focus, handlers } = useFocusState()
const merged = $derived(
  stripMarker(
    mergeProps(joinHandlers(normalizeProps(ctx.api().content(index, focus())), handlers), rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
