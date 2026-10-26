<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { mentionsHost } from "./context"
import type { MentionsPartProps } from "./types"

/** Loading content: a sibling of the List, shown while loading. */
const { child, children, ...rest }: MentionsPartProps = $props()
const host = mentionsHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().loading()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: host.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(host.state())}</div>
{/if}
