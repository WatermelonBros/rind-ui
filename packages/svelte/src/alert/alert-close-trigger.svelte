<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { alertContext } from "./context"
import type { AlertCloseTriggerProps } from "./types"

const { child, children, ...rest }: AlertCloseTriggerProps = $props()
const ctx = alertContext.get()
const env = useEnvironment()
// Modality tracking runs while a trigger is mounted, so focus-visible is known on focus.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
// Named by its own label or text (an icon-only trigger gets `messages.dismiss`): read from
// the rendered element, the only place snippet text exists.
let text = $state(false)
$effect(() => {
  const node = el.current
  void children
  text = node instanceof HTMLElement && hasText(node)
})
function hasText(node: Node): boolean {
  return Array.from(node.childNodes).some((c) =>
    c.nodeType === 3
      ? (c.textContent ?? "").trim() !== ""
      : c instanceof Element && c.getAttribute("aria-hidden") !== "true" && hasText(c),
  )
}
const named = $derived(
  rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined || text,
)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.connect().closeTrigger({ named, focused, modality: modality.current }),
          ),
          {
            onfocusin: () => (focused = true),
            onfocusout: () => (focused = false),
            onclick: () => {
              const r = ctx.root()
              const active = r?.ownerDocument.activeElement
              ctx.send({ type: "CLOSE", focusInside: !!r && !!active && r.contains(active) })
            },
          },
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
const current = $derived({ open: ctx.open() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
