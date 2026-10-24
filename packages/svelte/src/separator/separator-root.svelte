<script lang="ts">
import {
  droppedNameProps,
  type SeparatorInput,
  type SeparatorOrientation,
  separatorProps,
  separatorWarnings,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { separatorHost } from "./context"
import type { SeparatorRootProps, SeparatorState } from "./types"

const {
  orientation,
  decorative = false,
  id,
  child,
  children,
  ...rest
}: SeparatorRootProps = $props()

const uid = $props.id()
const host = separatorHost.maybe()
const el = elementRef("div")
const input: SeparatorInput = $derived({
  orientation,
  defaultOrientation: host?.()?.defaultOrientation,
  decorative,
  tag: el.tag,
  context: host?.()?.context ?? "content",
  instance: id ?? uid,
  own: rest as Readonly<Record<string, unknown>>, // the element's own props, read by name
})
// Warnings once per change of what they read.
const warnKey = $derived(
  JSON.stringify([
    orientation,
    decorative,
    input.context,
    rest.tabindex,
    rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
  ]),
)
$effect(() => {
  void warnKey
  separatorWarnings(input)
})
const own = $derived(normalizeProps(separatorProps(input)))
const merged = $derived.by(() => {
  const consumer: Record<string, unknown> = { ...rest }
  for (const name of droppedNameProps(input)) delete consumer[name]
  return stripMarker(
    mergeProps({ ...own, ...(id === undefined ? {} : { id }), ...el.props }, consumer),
  )
})
const current: SeparatorState = $derived({
  orientation: own["data-orientation"] as SeparatorOrientation, // set by separatorProps
  decorative: own["data-decorative"] !== undefined,
})
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the div's attributes. -->
  <div {...merged as HTMLAttributes<HTMLDivElement>}>{@render children?.(current)}</div>
{/if}
