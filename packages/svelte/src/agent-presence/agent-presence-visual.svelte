<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { agentPresenceContext } from "./context"
import type { AgentPresenceDivProps } from "./types"

const { child, children, ...rest }: AgentPresenceDivProps = $props()
const ctx = agentPresenceContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().visual()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
