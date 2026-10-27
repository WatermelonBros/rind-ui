<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import HoverCardTrigger from "../hover-card/hover-card-trigger.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { citationContext } from "./context"
import type { CitationTriggerProps } from "./types"

/**
 * The marker: a link for an http(s) source, else a button that pins the card; named "Source 1:
 * title". Plain text while the source is pending.
 */
const { child, children, ...rest }: CitationTriggerProps = $props()
const ctx = citationContext.get()
// Hover Card owns `aria-expanded` on its trigger (open = pinned || hover): not overridden.
const own = $derived.by(() => {
  const { "aria-expanded": _expanded, ...rest } = normalizeProps(ctx.api().trigger())
  return rest
})
const pendingProps = $derived(stripMarker(mergeProps(own, rest)))
const markerProps = $derived(
  mergeProps(
    joinHandlers(own, {
      onclick: () => {
        if (ctx.api().kind === "button") ctx.press()
      },
    }),
    rest,
  ),
)
</script>

{#if ctx.api().kind === "pending"}
  {#if child}
    {@render child({ props: pendingProps, state: ctx.state() })}
  {:else}
    <span {...attrs(pendingProps)}>{#if children}{@render children(ctx.state())}{:else}{ctx.api().markerText}{/if}</span>
  {/if}
{:else if child}
  <HoverCardTrigger {...markerProps}>
    {#snippet child({ props })}{@render child?.({ props, state: ctx.state() })}{/snippet}
  </HoverCardTrigger>
{:else if ctx.api().kind === "button"}
  <HoverCardTrigger {...markerProps}>
    {#snippet child({ props })}<button {...props} type="button">{#if children}{@render children(ctx.state())}{:else}{ctx.api().markerText}{/if}</button>{/snippet}
  </HoverCardTrigger>
{:else}
  <HoverCardTrigger {...markerProps}>{#if children}{@render children(ctx.state())}{:else}{ctx.api().markerText}{/if}</HoverCardTrigger>
{/if}
