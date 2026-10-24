<script lang="ts">
import {
  type ChangeDetails,
  focusSafely,
  isDragPress,
  type Modality,
  pointerDragSession,
  resolveConstraints,
  type SplitterCommitDetails,
  type SplitterConstraints,
  type SplitterDragMessage,
  type SplitterEvent,
  sameConstraints,
  splitterConnect,
  splitterDelta,
  splitterDragAxis,
  splitterMachine,
  splitterSizes,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { splitterContext } from "./context"
import type { SplitterRootProps, SplitterState } from "./types"

let {
  panels,
  sizes = $bindable(),
  defaultSizes,
  onSizesChange,
  onSizesCommit,
  orientation = "horizontal",
  step,
  disabled = false,
  dir: ownDir,
  id,
  child,
  children,
  ...rest
}: SplitterRootProps = $props()

const px = (style: CSSStyleDeclaration, name: string) =>
  Number.parseFloat(style.getPropertyValue(name)) || 0
/** The Root's content box on the axis, and that minus its handles (the panels' space). */
function measure(root: HTMLElement, handles: readonly (Element | null)[], vertical: boolean) {
  const style = root.ownerDocument.defaultView?.getComputedStyle(root)
  const box = vertical
    ? root.clientHeight - (style ? px(style, "padding-top") + px(style, "padding-bottom") : 0)
    : root.clientWidth - (style ? px(style, "padding-left") + px(style, "padding-right") : 0)
  let taken = 0
  for (const h of handles) {
    if (!h?.isConnected) continue
    const r = h.getBoundingClientRect()
    taken += vertical ? r.height : r.width
  }
  const space = box - taken
  return space > 0 && box > 0 ? { space, scale: box / space } : null
}
const env = useEnvironment()
const uid = $props.id()
const instance = $derived(id ?? uid)
const locale = useLocale(
  () => undefined,
  () => ownDir,
)
const el = elementRef("div")
const handles: (Element | null)[] = []
let layout = $state.raw<{ space: number; scale: number } | null>(null)
// Same content, same array: the machine's onProps compares content anyway.
let constraints: SplitterConstraints[] = untrack(() => resolveConstraints(panels, null))
const resolvedPanels = $derived.by(() => {
  const resolved = resolveConstraints(panels, layout?.space ?? null)
  if (!sameConstraints(constraints, resolved)) constraints = resolved
  return constraints
})
let handleDisabled: readonly boolean[] = $state([])
const setHandleDisabled = (index: number, off: boolean | undefined) => {
  const prev = untrack(() => handleDisabled)
  if ((prev[index] === true) === (off === true)) return
  const next = [...prev]
  next[index] = off === true
  handleDisabled = next
}
const drag = pointerDragSession()
let pressed: number | null = null
const focusHandle = (index: number, modality: Modality) => {
  const h = handles[index]
  if (h instanceof HTMLElement) void focusSafely(h, env, "programmatic", modality)
}
const machineProps = () => ({
  sizes,
  defaultSizes,
  panels: resolvedPanels,
  step,
  disabled,
  handleDisabled,
  onSizesChange: (next: readonly number[], details: ChangeDetails<SplitterEvent>) => {
    let cancelled = false
    onSizesChange?.(next, {
      ...details,
      cancel: () => {
        cancelled = true
        details.cancel()
      },
    })
    if (!cancelled && sizes !== undefined) sizes = next
  },
  onSizesCommit: (v: readonly number[], d: SplitterCommitDetails) => onSizesCommit?.(v, d),
})
const machine = useMachine(splitterMachine, machineProps, {
  drag: {
    track: (forward: (m: SplitterDragMessage) => void) =>
      drag.track((m) => {
        if (m.type !== "move") return forward(m)
        if (pressed === null) return
        forward({
          type: "move",
          delta: splitterDelta(pressed, m.fraction, orientation, layout?.scale ?? 1),
        })
      }),
  },
  focusHandle,
})
const current = $derived(splitterSizes(machineProps(), machine.view.values.sizes))
const focused = $derived(machine.view.context.focused)
const modality = useModality(env.modality, () => focused !== null)
const dragging = $derived(machine.view.matches("dragging"))
const api = $derived(
  splitterConnect({
    instance,
    orientation,
    dir: locale.current.dir,
    sizes: current,
    panels: resolvedPanels,
    disabled,
    handleDisabled,
    focused,
    modality: modality.current,
    draggingHandle: dragging ? machine.view.context.handle : null,
  }),
)
// The panels' space: pixel constraints and the pointer scale follow every resize (RRP#720).
$effect(() => {
  const node = el.current
  const vertical = orientation === "vertical"
  if (!(node instanceof HTMLElement)) return
  return untrack(() => {
    const update = () => {
      const next = measure(node, handles, vertical)
      if (layout?.space !== next?.space || layout?.scale !== next?.scale) layout = next
    }
    update()
    const win = node.ownerDocument.defaultView
    if (!win || typeof win.ResizeObserver !== "function") return
    const observer = new win.ResizeObserver(update)
    observer.observe(node)
    for (const h of handles) if (h) observer.observe(h)
    return () => observer.disconnect()
  })
})
const splitterState: SplitterState = $derived({ sizes: current, dragging, disabled, orientation })
splitterContext.set({
  api: () => api,
  state: () => splitterState,
  send: machine.send,
  handles,
  orientation: () => orientation,
  dir: () => locale.current.dir,
  setHandleDisabled,
  press: (e) => {
    const node = el.current
    if (!(node instanceof HTMLElement) || !isDragPress(e) || drag.active) return false
    pressed = drag.press(node, e, splitterDragAxis({ orientation, dir: locale.current.dir }))
    return true
  },
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(api.root()), ...el.props }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: splitterState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(splitterState)}</div>
{/if}
