<script lang="ts">
// The portal's host element, mounted in the target: it carries the logical parent's dir, lang,
// data-rind-theme and data-theme, kept in sync.
import { portalHostAttributes, syncPortalHost } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { Snippet } from "svelte"
import type { ChildArgs } from "../child"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs } from "../normalize-props"

const {
  rest,
  child,
  children,
  observe,
  parent,
}: {
  rest: Record<string, unknown>
  child: Snippet<[ChildArgs<undefined>]> | undefined
  children: Snippet | undefined
  observe: boolean
  parent: () => Element | null
} = $props()
const el = elementRef("div")
// Read on every update of the content: a logical parent that changes (a dialog's opener, set
// on open) is followed at once; the host's observer only sees attribute mutations.
const attributes = $derived.by(() => {
  void rest
  void children
  return portalHostAttributes(parent())
})
$effect(() => {
  const host = el.current
  if (host) return syncPortalHost(host, parent, observe)
})
const merged = $derived(
  stripMarker(mergeProps({ "data-rind-portal": "", ...attributes, ...el.props }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
