<script lang="ts">
import { partId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { fieldParts } from "./context.svelte"
import type { FieldDescriptionProps } from "./types"

const { id, child, children, ...rest }: FieldDescriptionProps = $props()
const ctx = fieldParts.get()
const own = $derived(id ?? partId("field", ctx.instance(), "description"))
useRegisterPart(ctx.registry, "description", () => own)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().description(own)), rest)))
const current = $derived({
  valid: ctx.api().display === "valid",
  invalid: ctx.api().display === "invalid",
  validating: false,
})
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <p {...attrs(merged)}>{@render children?.(current)}</p>
{/if}
