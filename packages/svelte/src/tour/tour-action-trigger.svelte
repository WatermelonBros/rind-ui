<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"
import { tourApi, tourHost } from "./context.svelte"
import Text from "./text.svelte"
import type { TourActionTriggerProps } from "./types"

const { action, child, children, ...rest }: TourActionTriggerProps = $props()
const ctx = tourHost.get()
const env = useEnvironment()
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") tourApi(ctx).api.pressAction(action)
  },
})
const el = elementRef("button")
// Whether the button renders no content of its own (an icon-only button).
let empty = $state(false)
$effect(() => {
  void tourApi(ctx)
  const node = el.current
  empty = (node?.textContent ?? "").trim() === ""
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            tourApi(ctx).api.actionTrigger(action, {
              focused,
              modality: modality.current,
              pressed: press.pressed,
              empty,
            }),
          ),
          press.props,
          {
            onfocus: () => {
              focused = true
            },
            onblur: () => {
              focused = false
            },
          },
        ),
        ...el.props,
      },
      // Sound: an action's attrs are button attributes.
      { ...action.attrs, ...rest } as never,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{#if children}{@render children()}{:else}<Text value={action.label} />{/if}</button>
{/if}
