<script lang="ts">
import { fieldsetConnect, labelInteraction, legendScope, partId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterPart } from "../use-ids.svelte"
import { fieldsetScope } from "./context"
import { fieldsetParts } from "./parts-context"
import type { FieldsetLegendProps } from "./types"

const { id, child, children, ...rest }: FieldsetLegendProps = $props()
const ctx = fieldsetParts.get()
const env = useEnvironment()
const own = $derived(id ?? partId("fieldset", ctx.instance(), "legend"))
useRegisterPart(ctx.registry, "legend", () => own)
const el = elementRef("legend")
// HTML exempts only the fieldset's first <legend> child. The server assumes the default
// markup (first); after mount the real position decides.
let first = $state(true)
$effect(() => {
  const node = el.current
  const legend = node?.parentElement
    ? Array.from(node.parentElement.children).find((c) => c.tagName === "LEGEND")
    : undefined
  first = node?.tagName === "LEGEND" && legend === node
})
// HTML: controls in the first legend are exempt from this Fieldset's disabled state.
fieldsetScope.set(() => (first ? legendScope(ctx.scope()) : ctx.scope()))
// A legend activates nothing: only the label double-click selection guard.
const { onMouseDown } = labelInteraction(env, { target: () => null, forwardsFocus: () => false })
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
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.legend(own)), onmousedown: onMouseDown, ...el.props }, rest),
  ),
)
const current = $derived({ disabled: ctx.disabled(), invalid: ctx.invalid() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <legend {...attrs(merged)}>{@render children?.(current)}</legend>
{/if}
