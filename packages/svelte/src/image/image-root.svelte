<script lang="ts">
import { checkImageAltGiven, imageConnect } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { useImageStatusRoot } from "../image-status.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { imageContext } from "./context"
import type { ImageRootProps, ImageState } from "./types"

const { alt, fallbackDelay, onStatusChange, id, child, children, ...rest }: ImageRootProps =
  $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const image = useImageStatusRoot(
  () => ({ fallbackDelay, onStatusChange }),
  () => checkImageAltGiven(alt, instance),
)
// `alt` is required in the types; untyped callers can still omit it.
const api = $derived(
  imageConnect({ instance, status: image.status, alt: typeof alt === "string" ? alt : undefined }),
)
const current: ImageState = $derived({ status: image.status })
imageContext.set({
  api: () => api,
  host: image.host,
  state: () => current,
  fallback: () => image.fallback,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <span {...attrs(merged)}>{@render children?.(current)}</span>
{/if}
