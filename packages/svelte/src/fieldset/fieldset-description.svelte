<script lang="ts">
import { fieldsetConnect, partId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { fieldsetParts } from "./parts-context"
import type { FieldsetDescriptionProps } from "./types"

const { id, child, children, ...rest }: FieldsetDescriptionProps = $props()
const ctx = fieldsetParts.get()
const own = $derived(id ?? partId("fieldset", ctx.instance(), "description"))
useRegisterPart(ctx.registry, "description", () => own)
const api = $derived(
  fieldsetConnect({
    instance: ctx.instance(),
    disabled: ctx.disabled(),
    invalid: ctx.invalid(),
    rootTag: "fieldset",
    nativeLegend: true,
    ids: {},
  }),
)
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.description(own)), rest)))
const current = $derived({ disabled: ctx.disabled(), invalid: ctx.invalid() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <p {...attrs(merged)}>{@render children?.(current)}</p>
{/if}
