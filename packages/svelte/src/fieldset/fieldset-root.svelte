<script lang="ts">
import {
  type FieldsetPart,
  type FieldsetScope,
  fieldsetConnect,
  scopeDisabled,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLFieldsetAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { fieldsetScope } from "./context"
import { fieldsetParts } from "./parts-context"
import type { FieldsetRootProps } from "./types"

const {
  disabled: own = false,
  invalid = false,
  id,
  "aria-describedby": describedBy,
  child,
  children,
  ...rest
}: FieldsetRootProps = $props()

const parent = fieldsetScope.maybe()
const scope: FieldsetScope = $derived({ disabled: own, parent: parent?.() ?? null })
const disabled = $derived(scopeDisabled(scope))
const uid = $props.id()
const instance = $derived(id ?? uid)
// No expected parts: a relation to a Description or ErrorMessage exists only once it is
// rendered (ark#3707), so the server never points at a missing id.
const registry = usePartRegistry<FieldsetPart>(
  untrack(() => ({ scope: "fieldset", root: instance })),
)
const el = elementRef("fieldset")
// The server assumes the default markup; after mount, the real first child decides.
let nativeLegend = $state(true)
$effect(() => {
  const first = el.current?.firstElementChild
  nativeLegend = first?.tagName === "LEGEND" && first.getAttribute("data-part") === "legend"
})
const legend = useRenderedId(registry, "legend")
const description = useRenderedId(registry, "description")
const error = useRenderedId(registry, "error-message")
fieldsetScope.set(() => scope)
fieldsetParts.set({
  instance: () => instance,
  registry,
  disabled: () => disabled,
  invalid: () => invalid,
  scope: () => scope,
})
const api = $derived(
  fieldsetConnect({
    instance,
    disabled,
    invalid,
    rootTag: el.tag,
    nativeLegend,
    ids: {
      legend: legend.current,
      description: description.current,
      "error-message": error.current,
    },
    describedBy: describedBy ?? undefined,
  }),
)
const merged = $derived(
  stripMarker(
    mergeProps(
      { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ...el.props },
      rest,
    ),
  ),
)
const current = $derived({ disabled, invalid })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the fieldset's attributes. -->
  <fieldset {...merged as HTMLFieldsetAttributes}>{@render children?.(current)}</fieldset>
{/if}
