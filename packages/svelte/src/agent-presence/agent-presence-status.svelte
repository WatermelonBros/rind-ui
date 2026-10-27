<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { agentPresenceContext } from "./context"
import type { AgentPresenceSpanProps } from "./types"

/** The state in words ("Listening"); not a live region. Rendered hidden when not composed. */
const { id, child, children, ...rest }: AgentPresenceSpanProps = $props()
const ctx = agentPresenceContext.get()
const own = $derived(id ?? ctx.statusId())
useRegisterPart(ctx.registry, "status", () => own)
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().status()), id: own }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{ctx.api().statusText}{/if}</span>
{/if}
