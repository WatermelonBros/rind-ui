<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { promptChip, promptInput } from "./context"
import type { PromptInputButtonProps } from "./types"

const { child, children, ...rest }: PromptInputButtonProps = $props()
const host = promptInput.get()
const chip = promptChip.get()
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(host.api().chipRemove(chip().key)), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...attrs(merged)}
    >{#if children}{@render children()}{:else}<span aria-hidden="true">×</span>{/if}</button
  >
{/if}
