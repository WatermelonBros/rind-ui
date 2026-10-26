<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { mentionsHost } from "./context"
import type { MentionsPartProps } from "./types"

/** Names the triggers ("Type @ to insert a mention"); the textarea's description. */
const { child, children, ...rest }: MentionsPartProps = $props()
const host = mentionsHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().descriptionPart()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: host.state() })}
{:else}
  <p {...attrs(merged)}>{#if children}{@render children(host.state())}{:else}{host.api().description}{/if}</p>
{/if}
