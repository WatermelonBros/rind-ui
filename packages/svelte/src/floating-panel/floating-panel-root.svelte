<script lang="ts">
import {
  type ChangeDetails,
  dialogMachine,
  dialogMessages,
  type FloatingPanelEvent,
  type FloatingPanelState,
  floatingPanelConnect,
  floatingPanelMachine,
  floatingPanelMessages,
  isDragPress,
  limitsOf,
  type PanelStage,
  partId,
  rectOf,
  trackPointer,
} from "@rind-ui/core"
import {
  clampRect,
  type Rect,
  type ResizeAxis,
  resizeRect,
  stripMarker,
} from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { isOpen, useDialogRoot } from "../dialog/context.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { floatingPanelContext } from "./context"
import type {
  FloatingPanelPoint,
  FloatingPanelRenderState,
  FloatingPanelRootProps,
  FloatingPanelSize,
} from "./types"

let {
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  initialFocus,
  finalFocus,
  keepMounted = false,
  position = $bindable(),
  defaultPosition,
  onPositionChange,
  size = $bindable(),
  defaultSize,
  onSizeChange,
  stage = $bindable(),
  defaultStage,
  onStageChange,
  minSize,
  maxSize,
  minVisible,
  step,
  largeStep,
  draggable = true,
  resizable = true,
  disabled = false,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: FloatingPanelRootProps = $props()

const uid = $props.id()
const env = useEnvironment()
const locale = useLocale(() => undefined)
const messages = useMessages("floating-panel", floatingPanelMessages, () => ownMessages)
const strings = useMessages("dialog", dialogMessages, () => ({ close: messages().close }))
const dialog = useDialogRoot(
  { scope: "floating-panel", kind: "dialog", machine: dialogMachine },
  {
    role: () => "dialog",
    open: () => open,
    setOpen: (next) => {
      if (open !== undefined) open = next
    },
    defaultOpen: () => defaultOpen,
    onOpenChange: () => onOpenChange,
    modal: () => false,
    closeOnEscape: () => undefined,
    closeOnInteractOutside: () => false,
    initialFocus: () => initialFocus,
    finalFocus: () => finalFocus,
    onEscapeKeyDown: () => undefined,
    onInteractOutside: () => undefined,
    id: () => id ?? undefined,
    uid,
    keepMounted: () => keepMounted,
    messages: strings,
  },
)
const host = dialog.host
const opened = $derived(isOpen(host))
const machineProps = () => ({
  position,
  defaultPosition,
  onPositionChange: (p: FloatingPanelPoint, d: ChangeDetails<FloatingPanelEvent>) => {
    onPositionChange?.(p, d)
    if (position !== undefined) position = p
  },
  size,
  defaultSize,
  onSizeChange: (s: FloatingPanelSize, d: ChangeDetails<FloatingPanelEvent>) => {
    onSizeChange?.(s, d)
    if (size !== undefined) size = s
  },
  stage,
  defaultStage,
  onStageChange: (s: PanelStage, d: ChangeDetails<FloatingPanelEvent>) => {
    onStageChange?.(s, d)
    if (stage !== undefined) stage = s
  },
  minSize,
  maxSize,
  minVisible,
  step,
  largeStep,
  draggable,
  resizable,
  disabled,
})
const machine = useMachine(floatingPanelMachine, machineProps, {})
const rect = $derived(
  rectOf(machineProps(), machine.view.values.position, machine.view.values.size),
)
const current = $derived(machine.view.values.stage ?? "default")
const positioner: { current: HTMLElement | null } = { current: null }
const dragTrigger: { current: HTMLElement | null } = { current: null }
const body: { current: HTMLElement | null } = { current: null }
const api = $derived(
  floatingPanelConnect(
    {
      instance: host.root(),
      open: opened,
      state: machine.view.state as FloatingPanelState,
      rect,
      stage: current,
      disabled,
      draggable,
      resizable,
      messages: messages(),
      ids: {
        content: partId("floating-panel", host.root(), "content"),
        title: partId("floating-panel", host.root(), "title"),
        description: partId("floating-panel", host.root(), "description"),
        hint: partId("floating-panel", host.root(), "drag-hint"),
      },
      rendered: { description: host.shared.rendered.description !== undefined },
    },
    env,
  ),
)
// The boundary: the Positioner's containing block (its content box), or the viewport. The
// Positioner mounts after this Root: measured once it is there.
let positionerMounted = $state(false)
$effect(() => {
  const el = positionerMounted ? positioner.current : null
  if (!opened || !el) return
  return untrack(() => {
    const parent = el.offsetParent
    const doc = el.ownerDocument
    const target =
      parent && parent !== doc.body && parent !== doc.documentElement ? parent : doc.documentElement
    const measure = () => {
      const viewport = target === doc.documentElement
      const cs = getComputedStyle(target)
      const pad = (a: string, b: string) =>
        viewport
          ? 0
          : Number.parseFloat(cs.getPropertyValue(a)) + Number.parseFloat(cs.getPropertyValue(b))
      machine.send({
        type: "BOUNDARY",
        width: target.clientWidth - pad("padding-left", "padding-right"),
        height: target.clientHeight - pad("padding-top", "padding-bottom"),
      })
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(target)
    return () => ro.disconnect()
  })
})
const writeVars = (r: Rect) => {
  const el = positioner.current
  if (!el) return
  el.style.setProperty("--rind-floating-panel-x", `${Math.round(r.x)}px`)
  el.style.setProperty("--rind-floating-panel-y", `${Math.round(r.y)}px`)
  el.style.setProperty("--rind-floating-panel-width", `${Math.round(r.width)}px`)
  el.style.setProperty("--rind-floating-panel-height", `${Math.round(r.height)}px`)
}
let drag: (() => void) | null = null
// Not during a drag: an update then would undo the preview.
$effect(() => {
  const r = rect
  void machine.view.state
  untrack(() => {
    if (!drag) writeVars(r)
  })
})
const startDrag = (e: PointerEvent, axis?: ResizeAxis) => {
  if (!isDragPress(e) || drag || machine.view.state !== "idle" || disabled) return
  // The machine's guards (canMove, canResize), checked here so a refused press tracks nothing.
  if (axis ? !resizable || current !== "default" : !draggable || current === "maximized") return
  machine.send(
    axis ? { type: "DRAG.START", mode: "resize", axis } : { type: "DRAG.START", mode: "move" },
  )
  e.preventDefault()
  const start = { x: e.clientX, y: e.clientY }
  const from = rect
  let total = { dx: 0, dy: 0 }
  drag = trackPointer<{ type: "move"; dx: number; dy: number }>(
    e.currentTarget as Element,
    e.pointerId,
    (m) => {
      if (m.type === "move") {
        total = { dx: m.dx, dy: m.dy }
        const b = machine.view.context.boundary
        const l = limitsOf(machineProps(), b)
        const preview = axis
          ? resizeRect(from, axis, m.dx, m.dy, l)
          : { ...from, x: from.x + m.dx, y: from.y + m.dy }
        writeVars(b.width > 0 && b.height > 0 && !axis ? clampRect(preview, l) : preview)
        return
      }
      drag = null
      if (m.type === "up") machine.send({ type: "DRAG.END", ...total })
      else {
        machine.send({ type: "DRAG.CANCEL" })
        writeVars(rect)
      }
    },
    (p) => ({ type: "move", dx: p.clientX - start.x, dy: p.clientY - start.y }),
  )
}
const cancelDrag = () => {
  if (!drag) return false
  drag()
  drag = null
  machine.send({ type: "DRAG.CANCEL" })
  writeVars(rect)
  return true
}
$effect(() => () => drag?.())
// Minimised: the Body is hidden, so focus inside it goes to the DragTrigger.
$effect.pre(() => {
  if (current !== "minimized") return
  untrack(() => {
    const active = body.current?.ownerDocument.activeElement
    if (active && body.current?.contains(active)) dragTrigger.current?.focus()
  })
})
const panelState: FloatingPanelRenderState = $derived({
  open: opened,
  stage: current,
  dragging: machine.view.state === "moving",
  resizing: machine.view.state === "resizing",
})
floatingPanelContext.set({
  api: () => api,
  send: machine.send,
  state: () => panelState,
  positioner: {
    get current() {
      return positioner.current
    },
    set current(el) {
      positioner.current = el
      positionerMounted = el !== null
    },
  },
  dragTrigger,
  body,
  dir: () => locale.current.dir,
  startDrag,
  cancelDrag,
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.root()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: panelState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(panelState)}</div>
{/if}
