<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"
import { codeBlockContext } from "./context"
import type { CodeBlockTriggerProps } from "./types"

const {
  kind,
  child,
  children,
  ...rest
}: CodeBlockTriggerProps & { readonly kind: "copyTrigger" | "wrapTrigger" | "collapseTrigger" } =
  $props()
const ctx = codeBlockContext.get()
const env = useEnvironment()
const el = elementRef("button")
$effect(() => {
  if (kind === "copyTrigger")
    ctx.copyAnchor.current = el.current instanceof HTMLElement ? el.current : null
})
const press = usePress({
  env,
  send: (e) => {
    if (e.type !== "PRESS") return
    ctx.send({
      type:
        kind === "copyTrigger" ? "COPY" : kind === "wrapTrigger" ? "WRAP.TOGGLE" : "EXPAND.TOGGLE",
    })
  },
})
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.api()[kind]({
              tag: el.tag,
              named: children !== undefined,
              focused,
              modality: modality.current,
            }),
          ),
          press.props,
          { onfocus: () => (focused = true), onblur: () => (focused = false) },
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(ctx.state())}</button>
{/if}
