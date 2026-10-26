<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { agentPresenceContext } from "./context"
import type { AgentPresenceSpanProps } from "./types"

const { child, children, ...rest }: AgentPresenceSpanProps = $props()
const ctx = agentPresenceContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().label()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{@render children?.(ctx.state())}</span>
{/if}
