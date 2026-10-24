<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tagsInputHost } from "./context"
import type { TagsInputControlProps } from "./types"

const { child, children, ...rest }: TagsInputControlProps = $props()
const host = tagsInputHost.get()
// The carriers reflect every change; a user change dispatches input and change.
$effect(() => {
  const values = host.tags()
  untrack(() => {
    host.formInput.sync({ values }, { dispatch: host.pending.current })
    host.pending.current = false
  })
})
$effect(() =>
  untrack(() =>
    host.formInput.track({ onReset: host.reset, current: () => ({ values: host.tags() }) }),
  ),
)
const constraint = (node: HTMLInputElement) => {
  host.setConstraint(node)
  return () => host.setConstraint(null)
}
const api = $derived(host.api())
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.control()), rest)))
</script>

<!-- Carriers are positional: duplicates are allowed. -->
{#snippet content()}{@render children?.()}<span {...attrs(normalizeProps(api.chipsSummary()))}
    >{api.summaryText}</span
  ><input {...attrs(normalizeProps(api.hiddenInput()))} {@attach constraint} />{#each api.carriers() as c, i (i)}<input
      {...attrs(normalizeProps(c))}
    />{/each}{/snippet}

{#if child}
  {@render child({ props: { ...merged, children: content }, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render content()}</div>
{/if}
