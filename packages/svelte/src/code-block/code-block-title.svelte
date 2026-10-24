<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { codeBlockContext } from "./context"
import type { CodeBlockPartProps } from "./types"

const { id, child, children, ...rest }: CodeBlockPartProps = $props()
const ctx = codeBlockContext.get()
const own = $derived(id ?? ctx.titleId())
useRegisterPart(ctx.registry, "title", () => own)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().title(own)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{@render children?.(ctx.state())}</span>
{/if}
