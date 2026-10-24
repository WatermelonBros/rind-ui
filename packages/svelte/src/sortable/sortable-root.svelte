<script lang="ts">
import {
  announcerCapability,
  partId,
  sortableConnect,
  sortableDrag,
  sortableMachine,
  sortableMessages,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { sortableHost } from "./context"
import type { SortableRenderState, SortableRootProps } from "./types"

const {
  items,
  onReorder,
  orientation = "vertical",
  handle = true,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: SortableRootProps = $props()
const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const locale = useLocale(() => ownLocale)
const messages = useMessages("sortable", sortableMessages, () => ownMessages)
const el = elementRef("ul")
let labels = $state.raw<ReadonlyMap<string, string>>(new Map())
let disabledKeys = $state.raw<ReadonlySet<string>>(new Set())
let drag = $state.raw<{
  readonly delta: { x: number; y: number }
  readonly indicator: number
  readonly target: number
  readonly room: number
} | null>(null)
const machine = useMachine(
  sortableMachine,
  () => ({
    id: instance,
    items,
    onReorder,
    disabledKeys,
    labels,
    messages: messages(),
    lang: locale.current.locale,
  }),
  env,
)
const register = (key: string, label: string | undefined, disabled: boolean) => {
  if (label !== undefined && labels.get(key) !== label) labels = new Map(labels).set(key, label)
  if (disabledKeys.has(key) !== disabled) {
    const next = new Set(disabledKeys)
    if (disabled) next.add(key)
    else next.delete(key)
    disabledKeys = next
  }
}
const startDrag = (key: string, e: PointerEvent) => {
  const root = el.current
  if (!(root instanceof HTMLElement) || (e.pointerType === "mouse" && e.button !== 0)) return
  const els = items
    .map((k) =>
      root.querySelector<HTMLElement>(
        `[data-scope="sortable"][data-part="item"][data-instance="${CSS.escape(instance)}"][data-value="${CSS.escape(k)}"]`,
      ),
    )
    .filter((node): node is HTMLElement => node !== null)
  const index = items.indexOf(key)
  if (index < 0) return
  // the room the picked item leaves: its size along the axis plus the list's gap (layout
  // pixels: the same the others' transforms are written in)
  const horizontal = orientation === "horizontal"
  const picked = els[index]
  const cs = getComputedStyle(root)
  const gap = Number.parseFloat(horizontal ? cs.columnGap : cs.rowGap) || 0
  const room = picked ? (horizontal ? picked.offsetWidth : picked.offsetHeight) + gap : 0
  sortableDrag(e, {
    items: els,
    index,
    axis: horizontal ? "x" : "y",
    root,
    onStart: () => machine.send({ type: "DRAG.START", key }),
    onMove: (delta, target, indicator) => {
      drag = { delta, indicator, target, room }
      machine.send({ type: "DRAG.OVER", index: target })
    },
    onEnd: (drop) => {
      drag = null
      machine.send(drop ? { type: "DRAG.END" } : { type: "CANCEL" })
    },
  })
}
const view = $derived(machine.view)
const api = $derived(
  sortableConnect({
    instance,
    state: view.state as "idle" | "moving" | "dragging",
    items,
    orientation,
    active: view.context.active,
    disabled: (k) => disabledKeys.has(k),
    label: (k) => labels.get(k) ?? k,
    drag: view.state === "dragging" ? drag : null,
    ids: { instructions: partId("sortable", instance, "instructions") },
    messages: messages(),
  }),
)
const current = $derived<SortableRenderState>({
  orientation,
  active: view.context.active,
  dragging: view.state === "dragging",
})
sortableHost.set({
  api: () => api,
  state: () => current,
  send: machine.send,
  orientation: () => orientation,
  handleDrags: () => handle,
  register,
  startDrag,
  isMovable: (k) => !disabledKeys.has(k),
})
const merged = $derived(
  stripMarker(
    mergeProps(
      { ...normalizeProps(api.root()), ...el.props, ...(id === undefined ? {} : { id }) },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <ul {...attrs(merged)}>{@render children?.(current)}</ul>
{/if}
<span {...attrs(normalizeProps(api.instructions()))}>{api.instructionsText}</span>
