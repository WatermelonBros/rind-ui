<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { stepperContext, stepperItem } from "./context.svelte"
import type { StepperItemProps } from "./types"

const { index, disabled = false, completed, child, children, ...rest }: StepperItemProps = $props()
const ctx = stepperContext.get()
// Registered after mount, as React (docs/review-backlog.md: the server HTML lacks them).
$effect(() => {
  const i = index
  const off = disabled
  return untrack(() => ctx.registry.disabled(i, off))
})
$effect(() => {
  const i = index
  const done = completed
  return untrack(() => ctx.registry.completed(i, done))
})
let described = $state(false)
stepperItem.set({
  index: () => index,
  described: () => described,
  setDescribed: (on) => {
    described = on
  },
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().item(index)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <li {...attrs(merged)}>{@render children?.(ctx.state())}</li>
{/if}
