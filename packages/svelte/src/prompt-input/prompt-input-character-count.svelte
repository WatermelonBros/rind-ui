<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { promptInput } from "./context"
import type { PromptInputCharacterCountProps } from "./types"

const { max, count, child, children, ...rest }: PromptInputCharacterCountProps = $props()
const host = promptInput.get()
$effect(() => {
  host.setCount({ max, count })
  return () => host.setCount(null)
})
// Frozen at the committed draft while a composition is open (core's derivation).
const used = $derived(host.count()?.used ?? 0)
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().characterCount()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}
    >{#if children}{@render children()}{:else}{max === undefined ? `${used}` : `${used}/${max}`}{/if}</span
  >
{/if}
