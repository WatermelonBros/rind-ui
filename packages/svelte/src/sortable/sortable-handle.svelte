<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { sortableHost, sortableItem } from "./context"
import type { SortableHandleProps } from "./types"

const NEXT = { vertical: "ArrowDown", horizontal: "ArrowRight" } as const
const PREV = { vertical: "ArrowUp", horizontal: "ArrowLeft" } as const

const { child, children, ...rest }: SortableHandleProps = $props()
const ctx = sortableHost.get()
const key = sortableItem.get()
const env = useEnvironment()
const el = elementRef("button")
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const picked = $derived(ctx.state().active === key() && !ctx.state().dragging)
// The item moves in the DOM as the order changes: keep focus on its handle.
$effect(() => {
  void ctx.api()
  const node = el.current
  if (picked && node instanceof HTMLElement && node.ownerDocument.activeElement !== node) {
    node.focus({ preventScroll: false })
  }
})
// A press elsewhere drops the keyboard session; the listener lives only while picked up.
$effect(() => {
  if (!picked) return
  const doc = el.current?.ownerDocument
  const onDown = (e: PointerEvent) => {
    if (!el.current?.contains(e.target as Node)) ctx.send({ type: "DROP" })
  }
  doc?.addEventListener("pointerdown", onDown, true)
  return () => doc?.removeEventListener("pointerdown", onDown, true)
})
const merged = $derived.by(() => {
  const k = key()
  const isPicked = picked
  const orientation = ctx.orientation()
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(ctx.api().handle(k, { focused, modality: modality.current })),
          {
            onfocus: () => (focused = true),
            onblur: (e: FocusEvent) => {
              focused = false
              // Moving focus elsewhere drops where it is (the order has already changed live). A
              // blur with no next target is the item moving in the DOM: its handle is refocused.
              if (isPicked && e.relatedTarget !== null) ctx.send({ type: "DROP" })
            },
            onkeydown: (e: KeyboardEvent) => {
              const next = e.key === NEXT[orientation]
              const prev = e.key === PREV[orientation]
              if (!isPicked) {
                if ((next || prev) && e.altKey) {
                  e.preventDefault()
                  ctx.send({ type: "QUICK", key: k, by: next ? 1 : -1 })
                } else if (e.key === " " || e.key === "Enter") {
                  e.preventDefault()
                  ctx.send({ type: "PICK", key: k })
                }
                return
              }
              if (next || prev) {
                e.preventDefault()
                ctx.send({ type: "MOVE", by: next ? 1 : -1 })
              } else if (e.key === "Home" || e.key === "End") {
                e.preventDefault()
                ctx.send({ type: "MOVE.TO", edge: e.key === "Home" ? "first" : "last" })
              } else if (e.key === " " || e.key === "Enter") {
                e.preventDefault()
                ctx.send({ type: "DROP" })
              } else if (e.key === "Escape") {
                e.preventDefault()
                e.stopPropagation()
                ctx.send({ type: "CANCEL" })
              } else if (e.key === "Tab") {
                ctx.send({ type: "DROP" })
              }
            },
            onpointerdown: (e: PointerEvent) => {
              if (isPicked) {
                ctx.send({ type: "DROP" })
                return
              }
              if (ctx.isMovable(k)) ctx.startDrag(k, e)
            },
            // A pointer press never picks up (Space / Enter do): the click is the drag's.
            onclick: (e: MouseEvent) => e.preventDefault(),
          },
        ),
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
