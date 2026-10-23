<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { stepperContext, stepperItem, useFocusState } from "./context.svelte"
import type { StepperButtonProps } from "./types"

const { child, children, ...rest }: StepperButtonProps = $props()
const ctx = stepperContext.get()
const item = stepperItem.get()
const { focus, handlers } = useFocusState()
const button = $derived(ctx.api().triggerIsButton(item.index()))
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().trigger(item.index(), item.described(), focus())), {
        ...handlers,
        ...(button ? { onclick: () => ctx.send({ type: "SELECT", index: item.index() }) } : {}),
      }),
      rest,
    ),
  ),
)
</script>

{#snippet content()}{@render children?.(ctx.state())}<span {...attrs(normalizeProps(ctx.api().statusProps()))}
    >{ctx.api().statusText(item.index())}</span
  >{/snippet}

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else if button}
  <button {...merged as HTMLButtonAttributes}>{@render content()}</button>
{:else}
  <!-- A step the user cannot reach is text, not a disabled button (no dead tab stop). -->
  <span {...attrs(merged)}>{@render content()}</span>
{/if}
