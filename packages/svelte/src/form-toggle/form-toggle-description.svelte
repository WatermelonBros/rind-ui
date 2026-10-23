<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { formToggleContext, stateOf, useApi } from "./context.svelte"
import type { FormToggleDescriptionProps } from "./types"

const { child, children, ...rest }: FormToggleDescriptionProps = $props()
const ctx = formToggleContext.get()
useRegisterPart(ctx.registry, "description", () => ctx.ids().description)
const apiFor = useApi(ctx)
const api = $derived(apiFor())
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.description()), rest)))
const current = $derived(stateOf(ctx, api))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
