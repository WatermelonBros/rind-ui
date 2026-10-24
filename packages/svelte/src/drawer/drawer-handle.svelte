<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"
import { useDrawer } from "./context"
import type { DrawerPartProps } from "./types"

// Inside the content: a button cycling the snap points (two or more), else decorative.
const { child, children, ...rest }: DrawerPartProps = $props()
const { extras } = useDrawer()
const env = useEnvironment()
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") extras().pressHandle(e.modality)
  },
  disabled: () => !extras().handleIsButton,
})
const isButton = $derived(extras().handleIsButton)
const merged = $derived.by(() => {
  const own = normalizeProps(
    extras().handle({ focused, modality: modality.current, pressed: press.pressed }),
  )
  if (!isButton) return stripMarker(mergeProps(own, rest))
  return stripMarker(
    mergeProps(
      joinHandlers(own, press.props, {
        onfocus: () => (focused = true),
        onblur: () => (focused = false),
      }),
      rest,
    ),
  )
})
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else if isButton}
  <button {...merged as HTMLButtonAttributes}>{@render children?.()}</button>
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
