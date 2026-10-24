<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { listboxHost } from "./context"
import type { ListboxPartProps } from "./types"

const { child, children, ...rest }: ListboxPartProps = $props()
const host = listboxHost.get()
const el = elementRef("div")
// Development: a list needs a name (mui/base-ui#5569). Checked once the parts registered.
$effect(() => {
  const node = el.current
  if (!DEV || !node) return
  queueMicrotask(() => {
    if (!node.isConnected) return
    if (!node.hasAttribute("aria-label") && !node.hasAttribute("aria-labelledby")) {
      console.warn(
        `[rind-ui] ${host.name}: the list has no accessible name; render a Label or pass aria-label / aria-labelledby.`,
      )
    }
  })
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(
          host.parts().list({
            "aria-label": rest["aria-label"] ?? undefined,
            "aria-labelledby": rest["aria-labelledby"] ?? undefined,
          }),
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
