<script lang="ts">
import {
  headingConnect,
  resolveHeadingLevel,
  tooDeep,
  warnEmptyHeading,
  warnTooDeep,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { headingLevel } from "./context"
import type { HeadingProps, HeadingState } from "./types"

const { level: explicit, id, child, children, ...rest }: HeadingProps = $props()

const uid = $props.id()
const context = headingLevel.maybe()
const level = $derived(resolveHeadingLevel(explicit, context?.()))
const el = elementRef(() => `h${level}`)
let warnedDeep = false
$effect(() => {
  const ctx = context?.()
  if (explicit === undefined && tooDeep(ctx) && ctx !== undefined && !warnedDeep) {
    warnedDeep = true
    warnTooDeep(ctx)
  }
  if (el.current) warnEmptyHeading(el.current)
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(headingConnect({ level, tag: el.tag, instance: id ?? uid })),
        ...(id === undefined ? {} : { id }),
        ...el.props,
      },
      rest,
    ),
  ),
)
const current: HeadingState = $derived({ level })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the heading's attributes. -->
  <svelte:element this={`h${level}`} {...merged as HTMLAttributes<HTMLHeadingElement>}>{@render children?.(current)}</svelte:element>
{/if}
