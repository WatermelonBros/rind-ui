<script lang="ts">
import { drawerIndentProps, drawerStack } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import type { DrawerPartProps } from "./types"

// `data-active` while a modal drawer is open in the document; the progress after mount.
const { child, children, ...rest }: DrawerPartProps = $props()
const env = useEnvironment()
const el = elementRef("div")
let active = $state(false)
// After mount: the server and the first client render carry no variable (base-ui#4509).
$effect(() => {
  const stack = drawerStack(env)
  active = stack.active()
  return stack.subscribe(() => {
    active = stack.active()
  })
})
$effect(() => {
  const node = el.current
  if (node instanceof HTMLElement) return drawerStack(env).registerIndent(node)
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(drawerIndentProps("indent", active)), ...el.props }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
