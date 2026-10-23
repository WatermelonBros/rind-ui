<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { stepperContext, useFocusState } from "./context.svelte"
import type { StepperButtonProps } from "./types"

const { child, children, ...rest }: StepperButtonProps = $props()
const ctx = stepperContext.get()
const { focus, handlers } = useFocusState()
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().nextTrigger(focus())), {
        ...handlers,
        onclick: () => ctx.send({ type: "NEXT" }),
      }),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...merged as HTMLButtonAttributes}
    >{#if children}{@render children(ctx.state())}{:else}{ctx.messages().nextLabel}{/if}</button
  >
{/if}
