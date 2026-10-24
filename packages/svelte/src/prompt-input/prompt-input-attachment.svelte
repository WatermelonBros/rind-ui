<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { promptChip, promptInput } from "./context"
import type { PromptInputSpanProps } from "./types"

const { child, children, ...rest }: PromptInputSpanProps = $props()
const host = promptInput.get()
const chip = promptChip.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().chip(chip().key)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
