<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { suggestionsContext } from "./context"
import type { SuggestionsItemProps } from "./types"

const { value, disabled = false, child, children, ...rest }: SuggestionsItemProps = $props()
const ctx = suggestionsContext.get()
const uid = $props.id()
const key = $derived(value ?? uid)
const env = useEnvironment()
// Tracks the modality from mount, so the first keyboard focus is already visible.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const el = elementRef("button")
$effect(() => {
  const node = el.current
  const k = key
  if (node) return untrack(() => ctx.register(uid, { el: node, key: k }))
})
// Where the focus was when the press began (a pointer press moves it onto the item).
let wasInside = false
const begin = () => {
  wasInside = ctx.contains(el.current?.ownerDocument.activeElement ?? null)
}
const merged = $derived.by(() => {
  const tag = el.tag
  const native = tag === "button" || tag === "input"
  const api = normalizeProps(
    ctx.api().item({
      key,
      index: ctx.indexOf(uid),
      disabled,
      tag,
      focused,
      modality: modality.current,
    }),
  )
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(api, {
          onpointerdown: begin,
          onclick: (e: MouseEvent) => {
            // A click without a pointerdown (a keyboard press, an assistive technology): the
            // focus is where it is now.
            if (e.detail === 0) begin()
            const node = e.currentTarget as HTMLElement
            const label = node.querySelector('[data-scope="suggestions"][data-part="label"]')
            ctx.press({
              key,
              value: value ?? (label ?? node).textContent?.trim() ?? "",
              index: ctx.indexOf(uid),
              itemDisabled: disabled,
              focusWasInside: wasInside,
            })
            wasInside = false
          },
          // A substituted non-button element: Enter and Space click it, as a button would.
          onkeydown: (e: KeyboardEvent) => {
            if (native || e.repeat) return
            if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
            if (e.key === " ") e.preventDefault()
          },
          onkeyup: (e: KeyboardEvent) => {
            if (!native && e.key === " ") (e.currentTarget as HTMLElement).click()
          },
          onfocus: () => (focused = true),
          onblur: () => (focused = false),
        }),
        ...el.props,
      },
      rest,
    ),
  )
})
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.(ctx.state())}</button>
{/if}
