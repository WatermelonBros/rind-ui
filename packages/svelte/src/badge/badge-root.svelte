<script lang="ts">
import { badgeConnect, badgeWarnings, checkBadgeHost } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import type { BadgeRootProps, BadgeState } from "./types"

const { label, id, child, children, ...rest }: BadgeRootProps = $props()

const uid = $props.id()
const el = elementRef("span")
const api = $derived(badgeConnect({ label, instance: id ?? uid }))
const content = $derived(api.content())
const hidden = $derived(api.label())
const warnKey = $derived(
  JSON.stringify([rest.role, rest["aria-live"], rest["aria-label"], rest["aria-labelledby"]]),
)
$effect(() => {
  void warnKey
  badgeWarnings(rest as Readonly<Record<string, unknown>>)
})
$effect(() => {
  if (el.current) checkBadgeHost(el.current, label)
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(api.root()), ...el.props }, rest)),
)
const current: BadgeState = $derived({ labelled: content !== null })
</script>

{#snippet body()}
  {#if content && hidden}
    <span {...attrs(normalizeProps(content))}>{@render children?.(current)}</span><span
      {...attrs(normalizeProps(hidden))}>{label}</span
    >
  {:else}
    {@render children?.(current)}
  {/if}
{/snippet}

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the span's attributes. -->
  <span {...merged as HTMLAttributes<HTMLSpanElement>}>{@render body()}</span>
{/if}
