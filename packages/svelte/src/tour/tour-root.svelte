<script lang="ts">
// Tour: a guided tour over the page, steps that point at real elements or centred dialogs.
// `useTour` owns the machine; Root provides it (its own, or a `tour` handle) to the parts.
// Wiring only: the machine owns the run, the core parts own every attribute.
import { getLayerStack, type HeadingLevel, type LayerMeta, tourLayerId } from "@rind-ui/core"
import { untrack } from "svelte"
import { useEnvironment } from "../provider"
import { tourHost } from "./context.svelte"
import type { TourRootProps, UseTourProps } from "./types"
import { useTour } from "./use-tour.svelte"

const { tour: given, children, ...own }: TourRootProps = $props()
// Sound: without `tour`, the props are UseTourProps (the union's other branch).
const uid = $props.id()
const tour = untrack(() => given) ?? useTour(() => own as UseTourProps, uid)
const env = useEnvironment()
const shared = $state({
  contentMounted: false,
  titleLevel: 2 as HeadingLevel,
  rendered: {} as { title?: string | undefined; description?: string | undefined },
  meta: undefined as LayerMeta | undefined,
})
// The stack's metadata for this tour's layer, followed while a step is shown.
$effect(() => {
  shared.meta = undefined
  if (tour.view.state !== "active") return
  const layer = tourLayerId(tour.root)
  return untrack(() => {
    const node = env.dom.getRootNode()
    const stack = getLayerStack("body" in node ? node : node.ownerDocument)
    const read = () => {
      shared.meta = stack.get(layer)?.meta()
    }
    read()
    return stack.subscribe(read)
  })
})
tourHost.set({ tour, shared })
</script>

{@render children?.()}
