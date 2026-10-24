<script lang="ts">
// Image Viewer parts: wiring only. The machine owns zoom and pan, connect every attribute;
// core's zoom gestures read the pointer, wheel and pinch on the viewport.
import {
  announcerCapability,
  type ChangeDetails,
  type ImageViewerEvent,
  imageViewerConnect,
  imageViewerMachine,
  imageViewerMessages,
  maxZoomOf,
  minZoomOf,
  partId,
  roomOf,
  viewerPlacement,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { imageViewer } from "./context"
import type { ImageViewerRootProps } from "./types"

let {
  zoom = $bindable(),
  defaultZoom,
  onZoomChange,
  minZoom,
  maxZoom,
  step,
  doubleClickZoom,
  wheel = "page",
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: ImageViewerRootProps = $props()
const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const loc = useLocale(() => ownLocale)
const messages = useMessages("image-viewer", imageViewerMessages, () => ownMessages)
let label = $state("")
const machineProps = () => ({
  id: instance,
  zoom,
  defaultZoom,
  onZoomChange: (z: number, d: ChangeDetails<ImageViewerEvent>) => {
    onZoomChange?.(z, d)
    if (zoom !== undefined) zoom = z
  },
  minZoom,
  maxZoom,
  step,
  doubleClickZoom,
  messages: messages(),
  lang: loc.current.locale,
})
const machine = useMachine(imageViewerMachine, machineProps, env)
const view = $derived(machine.view)
const current = $derived(view.values.zoom)
const api = $derived(
  imageViewerConnect({
    instance,
    state: view.state as "loading" | "idle" | "panning" | "settling",
    placement: viewerPlacement(
      view.context.natural,
      view.context.viewport,
      current,
      view.context.offset,
    ),
    minZoom: minZoomOf(machineProps()),
    maxZoom: maxZoomOf(machineProps()),
    label,
    ids: { instructions: partId("image-viewer", instance, "instructions") },
    messages: messages(),
    locale: loc.current.locale,
  }),
)
const viewerState = $derived({
  zoom: current,
  zoomed: current > minZoomOf(machineProps()),
  panning: view.state === "panning",
})
imageViewer.set({
  api: () => api,
  state: () => viewerState,
  send: machine.send,
  setLabel: (l) =>
    untrack(() => {
      label = l
    }),
  room: () => roomOf(current, view.context),
  viewport: () => view.context.viewport,
  wheelZooms: () => wheel === "zoom",
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
const instructions = $derived(api.instructions())
</script>

{#snippet content()}{@render children?.(viewerState)}<span {...attrs(normalizeProps(instructions))}
    >{api.instructionsText}</span
  >{/snippet}

{#if child}
  {@render child({ props: { ...merged, children: content }, state: viewerState })}
{:else}
  <div {...attrs(merged)}>{@render content()}</div>
{/if}
