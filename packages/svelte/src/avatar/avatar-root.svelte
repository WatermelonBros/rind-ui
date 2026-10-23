<script lang="ts">
import { avatarConnect, checkAvatarName, isAvatarHidden, isAvatarNamed } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { useImageStatusRoot } from "../image-status.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { avatarContext } from "./context"
import type { AvatarRootProps, AvatarState } from "./types"

const { fallbackDelay, onStatusChange, id, child, children, ...rest }: AvatarRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const own = $derived(rest as Readonly<Record<string, unknown>>) // read by name
const image = useImageStatusRoot(
  () => ({ fallbackDelay, onStatusChange }),
  () => checkAvatarName(own, instance),
)
const api = $derived(
  avatarConnect({
    instance,
    status: image.status,
    named: isAvatarNamed(own),
    hidden: isAvatarHidden(own),
  }),
)
const current: AvatarState = $derived({ status: image.status })
avatarContext.set({
  api: () => api,
  host: image.host,
  state: () => current,
  fallback: () => image.fallback,
  name: () => (typeof rest["aria-label"] === "string" ? rest["aria-label"] : undefined),
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
