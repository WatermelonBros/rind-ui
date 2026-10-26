"use client"

// Floating Panel (add-floating-panel): two machines composed by the parts. Open and close are the
// Dialog's (non-modal, an outside press never closes it), through the Dialog family's parts;
// the rect (position, size, stage) is the floating-panel machine's. A drag is seen by the machine
// at its start and end only: each move is written to the Positioner's CSS variables.

import {
  type ChangeDetails,
  type DialogMessages,
  type DialogProps,
  describeKey,
  dialogMachine,
  type FloatingPanelEvent,
  type FloatingPanelMessages,
  type FloatingPanelState,
  floatingPanelConnect,
  floatingPanelKeyEvent,
  floatingPanelMachine,
  floatingPanelMessages,
  isDragPress,
  limitsOf,
  type MessageOverrides,
  type PanelStage,
  type PartProps,
  partId,
  rectOf,
  trackPointer,
} from "@rind-ui/core"
import { clampRect, type Rect, type ResizeAxis, resizeRect } from "@rind-ui/core/internal"
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createDialogRoot, useDialog } from "../dialog/dialog"
import * as Dialog from "../dialog/dialog.parts"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    "floating-panel": FloatingPanelMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

const DialogFamilyRoot = createDialogRoot({
  scope: "floating-panel",
  kind: "dialog",
  machine: dialogMachine,
})

/** A position in the boundary's content box, in px. */
export interface FloatingPanelPoint {
  readonly x: number
  readonly y: number
}
/** A size in px. */
export interface FloatingPanelSize {
  readonly width: number
  readonly height: number
}

/** What every part's `render` receives. */
export interface FloatingPanelRenderState {
  readonly open: boolean
  readonly stage: PanelStage
  readonly dragging: boolean
  readonly resizing: boolean
}

type Api = ReturnType<typeof floatingPanelConnect>

interface Ctx {
  readonly api: Api
  readonly state: FloatingPanelRenderState
  readonly send: (event: FloatingPanelEvent) => void
  readonly rect: Rect
  readonly positioner: { current: HTMLElement | null }
  readonly dragTrigger: { current: HTMLElement | null }
  readonly body: { current: HTMLElement | null }
  readonly dir: "ltr" | "rtl"
  /** Starts a pointer drag (move, or resize on `axis`), previewed on the CSS variables. */
  readonly startDrag: (e: PointerEvent<HTMLElement>, axis?: ResizeAxis) => void
  /** Cancels a pointer drag in progress (Escape); false when none. */
  readonly cancelDrag: () => boolean
}
const PanelContext = createContext<Ctx | null>(null)
function usePanel(part: string): Ctx {
  const ctx = useContext(PanelContext)
  if (!ctx) throw new Error(`FloatingPanel.${part} must be inside FloatingPanel.Root`)
  return ctx
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the panel's state. */
  readonly render?: RenderProp<FloatingPanelRenderState>
}

export type FloatingPanelRootProps = Pick<
  DialogProps,
  "open" | "defaultOpen" | "onOpenChange" | "initialFocus" | "finalFocus"
> &
  Own<"div"> & {
    /** Controlled position in the boundary. */
    readonly position?: FloatingPanelPoint
    /** Uncontrolled position. Default { x: 0, y: 0 }. */
    readonly defaultPosition?: FloatingPanelPoint
    /** Once per drag, per key step. */
    readonly onPositionChange?: (
      position: FloatingPanelPoint,
      details: ChangeDetails<FloatingPanelEvent>,
    ) => void
    /** Controlled size. */
    readonly size?: FloatingPanelSize
    /** Uncontrolled size. Default 360×240. */
    readonly defaultSize?: FloatingPanelSize
    /** Once per resize, per key step. */
    readonly onSizeChange?: (
      size: FloatingPanelSize,
      details: ChangeDetails<FloatingPanelEvent>,
    ) => void
    /** Controlled stage. */
    readonly stage?: PanelStage
    /** Uncontrolled stage. Default "default". */
    readonly defaultStage?: PanelStage
    /** Minimised, maximised or restored. */
    readonly onStageChange?: (stage: PanelStage, details: ChangeDetails<FloatingPanelEvent>) => void
    /** The smallest size. Default 200×120. */
    readonly minSize?: FloatingPanelSize
    /** The largest size (default: the boundary). */
    readonly maxSize?: FloatingPanelSize
    /** Pixels kept inside the boundary on each axis. Default 48. */
    readonly minVisible?: number
    /** Pixels per arrow key. Default 10. */
    readonly step?: number
    /** Pixels per Shift+arrow. Default 50. */
    readonly largeStep?: number
    /** Can be moved. Default true. */
    readonly draggable?: boolean
    /** Can be resized. Default true. */
    readonly resizable?: boolean
    /** No move, resize or stage change. */
    readonly disabled?: boolean
    /** Content, Positioner stay mounted (hidden) while closed. */
    readonly keepMounted?: boolean
    /** Overrides the strings (also through the provider). */
    readonly messages?: MessageOverrides<FloatingPanelMessages>
  }

/** The props that were given (exactOptionalPropertyTypes: no explicit undefined). */
const defined = <T extends object>(o: T) =>
  // Sound: dropping the undefined entries only narrows each optional property.
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>
  }

function Root({
  open,
  defaultOpen,
  onOpenChange,
  initialFocus,
  finalFocus,
  keepMounted,
  messages: own,
  ...rest
}: FloatingPanelRootProps) {
  const messages = useMessages("floating-panel", floatingPanelMessages, own)
  const dialogMessages: MessageOverrides<DialogMessages> = { close: messages.close }
  return (
    <DialogFamilyRoot
      {...defined({ open, defaultOpen, onOpenChange, initialFocus, finalFocus, keepMounted })}
      modal={false}
      closeOnInteractOutside={false}
      messages={dialogMessages}
    >
      <PanelRoot {...rest} messages={messages} />
    </DialogFamilyRoot>
  )
}

function PanelRoot({
  position,
  defaultPosition,
  onPositionChange,
  size,
  defaultSize,
  onSizeChange,
  stage,
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
  messages,
  render,
  ref,
  children,
  ...rest
}: Omit<FloatingPanelRootProps, "messages"> & { readonly messages: FloatingPanelMessages }) {
  const dialog = useDialog("FloatingPanel.Root")
  const open = useSelector(dialog.service, (v) => v.matches("open"))
  const env = useEnvironment()
  const { dir } = useLocale()
  const machineProps = {
    position,
    defaultPosition,
    onPositionChange,
    size,
    defaultSize,
    onSizeChange,
    stage,
    defaultStage,
    onStageChange,
    minSize,
    maxSize,
    minVisible,
    step,
    largeStep,
    draggable,
    resizable,
    disabled,
  }
  const { view, send } = useMachine(floatingPanelMachine, machineProps, {})
  const rect = rectOf(machineProps, view.values.position, view.values.size)
  const current = view.values.stage ?? "default"
  const positioner = useRef<HTMLElement | null>(null)
  const dragTrigger = useRef<HTMLElement | null>(null)
  const body = useRef<HTMLElement | null>(null)
  const api = floatingPanelConnect(
    {
      instance: dialog.root,
      open,
      state: view.state as FloatingPanelState,
      rect,
      stage: current,
      disabled,
      draggable,
      resizable,
      messages,
      ids: {
        content: partId("floating-panel", dialog.root, "content"),
        title: partId("floating-panel", dialog.root, "title"),
        description: partId("floating-panel", dialog.root, "description"),
        hint: partId("floating-panel", dialog.root, "drag-hint"),
      },
      rendered: { description: dialog.rendered.description !== undefined },
    },
    env,
  )
  // The boundary: the Positioner's containing block (its content box), or the viewport.
  useEffect(() => {
    const el = positioner.current
    if (!open || !el) return
    const parent = el.offsetParent
    const doc = el.ownerDocument
    const target =
      parent && parent !== doc.body && parent !== doc.documentElement ? parent : doc.documentElement
    const measure = () => {
      const cs = getComputedStyle(target)
      const pad = (a: string, b: string) =>
        Number.parseFloat(cs.getPropertyValue(a)) + Number.parseFloat(cs.getPropertyValue(b))
      const viewport = target === doc.documentElement
      send({
        type: "BOUNDARY",
        width: viewport
          ? target.clientWidth
          : target.clientWidth - pad("padding-left", "padding-right"),
        height: viewport
          ? target.clientHeight
          : target.clientHeight - pad("padding-top", "padding-bottom"),
      })
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(target)
    return () => ro.disconnect()
  }, [open, send])
  // The variables after every commit: a drag's preview never outlives it.
  const latest = useRef(rect)
  latest.current = rect
  const writeVars = (r: Rect) => {
    const el = positioner.current
    if (!el) return
    el.style.setProperty("--rind-floating-panel-x", `${Math.round(r.x)}px`)
    el.style.setProperty("--rind-floating-panel-y", `${Math.round(r.y)}px`)
    el.style.setProperty("--rind-floating-panel-width", `${Math.round(r.width)}px`)
    el.style.setProperty("--rind-floating-panel-height", `${Math.round(r.height)}px`)
  }
  const drag = useRef<(() => void) | null>(null)
  // Not during a drag: a commit then (DRAG.START, a focus change) would undo the preview.
  useIsoLayoutEffect(() => {
    if (!drag.current) writeVars(latest.current)
  })
  const limits = () => limitsOf(machineProps, view.context.boundary)
  const startDrag = (e: PointerEvent<HTMLElement>, axis?: ResizeAxis) => {
    if (!isDragPress(e) || drag.current || view.state !== "idle" || disabled) return
    // The machine's guards (canMove, canResize), checked here so a refused press tracks nothing.
    if (axis ? !resizable || current !== "default" : !draggable || current === "maximized") return
    send(axis ? { type: "DRAG.START", mode: "resize", axis } : { type: "DRAG.START", mode: "move" })
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY }
    const from = latest.current
    let total = { dx: 0, dy: 0 }
    drag.current = trackPointer<{ type: "move"; dx: number; dy: number }>(
      e.currentTarget,
      e.pointerId,
      (m) => {
        if (m.type === "move") {
          total = { dx: m.dx, dy: m.dy }
          const b = view.context.boundary
          const l = limits()
          const preview = axis
            ? resizeRect(from, axis, m.dx, m.dy, l)
            : { ...from, x: from.x + m.dx, y: from.y + m.dy }
          writeVars(b.width > 0 && b.height > 0 && !axis ? clampRect(preview, l) : preview)
          return
        }
        drag.current = null
        if (m.type === "up") send({ type: "DRAG.END", ...total })
        else {
          send({ type: "DRAG.CANCEL" })
          writeVars(latest.current)
        }
      },
      (p) => ({ type: "move", dx: p.clientX - start.x, dy: p.clientY - start.y }),
    )
  }
  const cancelDrag = () => {
    const stop = drag.current
    if (!stop) return false
    stop()
    drag.current = null
    send({ type: "DRAG.CANCEL" })
    writeVars(latest.current)
    return true
  }
  useEffect(() => () => drag.current?.(), [])
  // Minimised: the Body is hidden, so focus inside it goes to the DragTrigger.
  useIsoLayoutEffect(() => {
    if (current !== "minimized") return
    const active = body.current?.ownerDocument.activeElement
    if (active && body.current?.contains(active)) dragTrigger.current?.focus()
  }, [current])
  const state: FloatingPanelRenderState = {
    open,
    stage: current,
    dragging: view.state === "moving",
    resizing: view.state === "resizing",
  }
  const ctx: Ctx = {
    api,
    state,
    send,
    rect,
    positioner,
    dragTrigger,
    body,
    dir,
    startDrag,
    cancelDrag,
  }
  return (
    <PanelContext value={ctx}>
      {renderPart(
        "div",
        mergeProps({ ...normalizeProps(api.root()), ref }, { ...rest, children }),
        render,
        state,
      )}
    </PanelContext>
  )
}

// Sound: a part's props are a plain props object (mergeProps' input).
const asProps = (p: object) => p as Readonly<Record<string, unknown>>

/** Opens and closes the panel. */
function Trigger(props: Parameters<typeof Dialog.Trigger>[0]) {
  return <Dialog.Trigger {...props} />
}

/** Placed by `--rind-floating-panel-x/-y/-width/-height`. */
function Positioner({ ref, ...props }: Parameters<typeof Dialog.Positioner>[0]) {
  const ctx = usePanel("Positioner")
  return (
    <Dialog.Positioner
      {...mergeProps(
        { ...normalizeProps(ctx.api.positioner()), ref: composeRefs(ctx.positioner, ref) },
        asProps(props),
      )}
    />
  )
}

/** The non-modal dialog, named by the Title. */
function Content(props: Parameters<typeof Dialog.Content>[0]) {
  const ctx = usePanel("Content")
  // The Dialog's own role, name and description references stand: only the panel's attributes.
  const {
    role: _role,
    "aria-labelledby": _l,
    "aria-describedby": _d,
    tabindex: _t,
    id: _id,
    ...own
  } = normalizeProps(ctx.api.content())
  return <Dialog.Content {...mergeProps(own, asProps(props))} />
}

function simplePart(name: string, part: (api: Api) => PartProps, tag: "div" | "p") {
  function Part({ render, ...rest }: Own<"div">) {
    const ctx = usePanel(name)
    return renderPart(tag, mergeProps(normalizeProps(part(ctx.api)), rest), render, ctx.state)
  }
  Part.displayName = `FloatingPanel.${name}`
  return Part
}

/** The title bar. */
const Header = simplePart("Header", (api) => api.header(), "div")
/** Groups the stage and close triggers. */
const Control = simplePart("Control", (api) => api.control(), "div")

/** Names the panel. */
function Title(props: Parameters<typeof Dialog.Title>[0]) {
  const ctx = usePanel("Title")
  const { id: _id, ...own } = normalizeProps(ctx.api.title())
  return <Dialog.Title {...mergeProps(own, asProps(props))} />
}

/** Describes the panel. */
function Description(props: Parameters<typeof Dialog.Description>[0]) {
  const ctx = usePanel("Description")
  const { id: _id, ...own } = normalizeProps(ctx.api.description())
  return <Dialog.Description {...mergeProps(own, asProps(props))} />
}

/** The content; inert while minimised. */
function Body({ render, ref, ...rest }: Own<"div">) {
  const ctx = usePanel("Body")
  return renderPart(
    "div",
    mergeProps({ ...normalizeProps(ctx.api.body()), ref: composeRefs(ctx.body, ref) }, rest),
    render,
    ctx.state,
  )
}

/** Focus state with the modality it arrived by. */
function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  return { focused, setFocused, modality }
}

/** Drag to move; arrows move, Alt+arrows resize, Enter maximises. */
function DragTrigger({ render, ref, children, ...rest }: Own<"button">) {
  const ctx = usePanel("DragTrigger")
  const env = useEnvironment()
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const { focused, setFocused, modality } = useFocus()
  const own = normalizeProps(ctx.api.dragTrigger({ tag, focused, modality }))
  const props = mergeProps(
    {
      ...joinHandlers(own, {
        onPointerDown: (e: PointerEvent<HTMLElement>) => ctx.startDrag(e),
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          const dragging = ctx.state.dragging || ctx.state.resizing
          const event = floatingPanelKeyEvent(describeKey(e.nativeEvent, env), {
            dir: ctx.dir,
            dragging,
          })
          if (!event) return
          e.preventDefault()
          // Escape ends the drag only: the panel stays open.
          if (event.type === "DRAG.CANCEL") {
            e.stopPropagation()
            if (!ctx.cancelDrag()) ctx.send(event)
            return
          }
          ctx.send(event)
        },
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(composeRefs(el, ctx.dragTrigger), ref),
    },
    rest,
  )
  return renderPart(
    "button",
    {
      ...props,
      children: (
        <>
          {children}
          <span {...normalizeProps(ctx.api.dragHint())}>{ctx.api.hintText}</span>
        </>
      ),
    },
    render,
    ctx.state,
  )
}

export type FloatingPanelStageTriggerProps = Own<"button"> & {
  /** The stage it switches to; pressed again from there, it restores. */
  readonly stage: "minimized" | "maximized"
}

/** `stage` minimized or maximized; from there it restores. */
function StageTrigger({ stage, render, ref, ...rest }: FloatingPanelStageTriggerProps) {
  const ctx = usePanel("StageTrigger")
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const { focused, setFocused, modality } = useFocus()
  const own = normalizeProps(ctx.api.stageTrigger(stage, { tag, focused, modality }))
  const target = own["data-stage-target"] as PanelStage
  return renderPart(
    "button",
    mergeProps(
      {
        ...joinHandlers(own, {
          onClick: () => ctx.send({ type: "STAGE", stage: target }),
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
        }),
        ref: composeRefs(el, ref),
      },
      rest,
    ),
    render,
    ctx.state,
  )
}

/** Closes the panel (the Dialog's close button: its name, focus return and press). */
const CloseTrigger = Dialog.CloseTrigger

export type FloatingPanelResizeTriggerProps = Own<"div"> & {
  /** The edge or corner it moves. */
  readonly axis: ResizeAxis
}

/** A pointer handle on an edge or corner (`axis`); hidden from assistive technology. */
function ResizeTrigger({ axis, render, ...rest }: FloatingPanelResizeTriggerProps) {
  const ctx = usePanel("ResizeTrigger")
  return renderPart(
    "div",
    mergeProps(
      joinHandlers(normalizeProps(ctx.api.resizeTrigger(axis)), {
        onPointerDown: (e: PointerEvent<HTMLElement>) => ctx.startDrag(e, axis),
      }),
      rest,
    ),
    render,
    ctx.state,
  )
}

/** Renders the panel elsewhere in the document (default: the body). */
const Portal = Dialog.Portal

/** The parts, by name: `floating-panel.parts.ts` re-exports them as the namespace. */
export {
  Body,
  CloseTrigger,
  Content,
  Control,
  Description,
  DragTrigger,
  Header,
  Portal,
  Positioner,
  ResizeTrigger,
  Root,
  StageTrigger,
  Title,
  Trigger,
}
