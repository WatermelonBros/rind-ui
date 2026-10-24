<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { promptChip, promptInput } from "./context"
import type { PromptInputSpanProps } from "./types"

const { child, children, ...rest }: PromptInputSpanProps = $props()
const host = promptInput.get()
const chip = promptChip.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().chipText()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}
    >{#if children}{@render children()}{:else}{chip().attachment.name}{/if}</span
  >
{/if}
