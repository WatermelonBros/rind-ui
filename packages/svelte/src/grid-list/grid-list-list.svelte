<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { gridListHost, gridListList } from "./context.svelte"
import type { GridListPartProps } from "./types"

const { child, children, ...rest }: GridListPartProps = $props()
const host = gridListHost.get()
const env = useEnvironment()
// The modality is tracked from mount: the first press on a row is seen as a pointer press.
$effect(() => env.modality.subscribe(() => {}))
gridListList.set(true)
const el = elementRef("div")
$effect(() => {
  const node = el.current
  if (!DEV || !node) return
  queueMicrotask(() => {
    if (!node.isConnected) return
    if (!node.hasAttribute("aria-label") && !node.hasAttribute("aria-labelledby")) {
      console.warn(
        "[rind-ui] GridList: the list has no accessible name; render a Label or pass aria-label / aria-labelledby.",
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
