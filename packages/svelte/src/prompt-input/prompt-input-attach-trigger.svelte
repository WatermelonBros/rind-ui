<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { promptInput } from "./context"
import type { PromptInputButtonProps } from "./types"

const { child, children, ...rest }: PromptInputButtonProps = $props()
const host = promptInput.get()

const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().attachTrigger()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...attrs(merged)}>{@render children?.()}</button>
{/if}
