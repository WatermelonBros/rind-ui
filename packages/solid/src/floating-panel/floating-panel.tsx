/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import {
  createDialogRoot,
  type DialogButtonProps,
  type DialogContentProps,
  type DialogDivProps,
  type DialogTitleProps,
  useDialog,
} from "../dialog/dialog"
import * as Dialog from "../dialog/dialog.parts"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    "floating-panel": FloatingPanelMessages
  }
}

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
  readonly api: Accessor<Api>
  readonly state: FloatingPanelRenderState
  readonly send: (event: FloatingPanelEvent) => void
  readonly setPositioner: (el: HTMLElement | null) => void
  readonly setDragTrigger: (el: HTMLElement | null) => void
  readonly setBody: (el: HTMLElement | null) => void
  readonly dir: Accessor<"ltr" | "rtl">
  /** Starts a pointer drag (move, or resize on `axis`), previewed on the CSS variables. */
  readonly startDrag: (e: PointerEvent, axis?: ResizeAxis) => void
  /** Cancels a pointer drag in progress (Escape); false when none. */
  readonly cancelDrag: () => boolean
}
const PanelContext = createContext<Ctx>()
function usePanel(part: string): Ctx {
  const ctx = useContext(PanelContext)
  if (!ctx) throw new Error(`FloatingPanel.${part} must be inside FloatingPanel.Root`)
  return ctx
}

type Own<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the panel's state. */
  readonly render?: RenderProp<FloatingPanelRenderState> | undefined
  readonly children?: JSX.Element | ((state: FloatingPanelRenderState) => JSX.Element)
}

export type FloatingPanelRootProps = Pick<
  DialogProps,
  "open" | "defaultOpen" | "onOpenChange" | "initialFocus" | "finalFocus"
> &
  Own<JSX.HTMLAttributes<HTMLDivElement>> & {
    /** Controlled position in the boundary. */
    readonly position?: FloatingPanelPoint | undefined
    /** Uncontrolled position. Default { x: 0, y: 0 }. */
    readonly defaultPosition?: FloatingPanelPoint | undefined
    /** Once per drag, per key step. */
    readonly onPositionChange?:
      | ((position: FloatingPanelPoint, details: ChangeDetails<FloatingPanelEvent>) => void)
      | undefined
    /** Controlled size. */
    readonly size?: FloatingPanelSize | undefined
    /** Uncontrolled size. Default 360×240. */
    readonly defaultSize?: FloatingPanelSize | undefined
    /** Once per resize, per key step. */
    readonly onSizeChange?:
      | ((size: FloatingPanelSize, details: ChangeDetails<FloatingPanelEvent>) => void)
      | undefined
    /** Controlled stage. */
    readonly stage?: PanelStage | undefined
    /** Uncontrolled stage. Default "default". */
    readonly defaultStage?: PanelStage | undefined
    /** Minimised, maximised or restored. */
    readonly onStageChange?:
      | ((stage: PanelStage, details: ChangeDetails<FloatingPanelEvent>) => void)
      | undefined
    /** The smallest size. Default 200×120. */
    readonly minSize?: FloatingPanelSize | undefined
    /** The largest size (default: the boundary). */
    readonly maxSize?: FloatingPanelSize | undefined
    /** Pixels kept inside the boundary on each axis. Default 48. */
    readonly minVisible?: number | undefined
    /** Pixels per arrow key. Default 10. */
    readonly step?: number | undefined
    /** Pixels per Shift+arrow. Default 50. */
    readonly largeStep?: number | undefined
    /** Can be moved. Default true. */
    readonly draggable?: boolean | undefined
    /** Can be resized. Default true. */
    readonly resizable?: boolean | undefined
    /** No move, resize or stage change. */
    readonly disabled?: boolean | undefined
    /** Content, Positioner stay mounted (hidden) while closed. */
    readonly keepMounted?: boolean | undefined
    /** Overrides the strings (also through the provider). */
    readonly messages?: MessageOverrides<FloatingPanelMessages> | undefined
  }

function Root(props: FloatingPanelRootProps) {
  const [dialogProps, own, rest] = splitProps(
    props,
    ["open", "defaultOpen", "onOpenChange", "initialFocus", "finalFocus", "keepMounted"],
    ["messages"],
  )
  const messages = useMessages("floating-panel", floatingPanelMessages, () => own.messages)
  const dialogMessages = createMemo<MessageOverrides<DialogMessages>>(() => ({
    close: messages().close,
  }))
  return (
    <DialogFamilyRoot
      {...dialogProps}
      modal={false}
      closeOnInteractOutside={false}
      messages={dialogMessages()}
    >
      <PanelRoot {...rest} messages={messages} />
    </DialogFamilyRoot>
  )
}

type PanelRootProps = Omit<FloatingPanelRootProps, "messages"> & {
  readonly messages: Accessor<FloatingPanelMessages>
}

function PanelRoot(props: PanelRootProps) {
  const [own, rest] = splitProps(props, [
    "position",
    "defaultPosition",
    "onPositionChange",
    "size",
    "defaultSize",
    "onSizeChange",
    "stage",
    "defaultStage",
    "onStageChange",
    "minSize",
    "maxSize",
    "minVisible",
    "step",
    "largeStep",
    "draggable",
    "resizable",
    "disabled",
    "messages",
    "render",
    "children",
  ])
  const dialog = useDialog("FloatingPanel.Root")
  const open = createMemo(() => dialog.view().matches("open"))
  const env = useEnvironment()
  const loc = useLocale(() => undefined)
  const draggable = () => own.draggable !== false
  const resizable = () => own.resizable !== false
  const disabled = () => own.disabled === true
  const machineProps = createMemo(() => ({
    position: own.position,
    defaultPosition: own.defaultPosition,
    onPositionChange: own.onPositionChange,
    size: own.size,
    defaultSize: own.defaultSize,
    onSizeChange: own.onSizeChange,
    stage: own.stage,
    defaultStage: own.defaultStage,
    onStageChange: own.onStageChange,
    minSize: own.minSize,
    maxSize: own.maxSize,
    minVisible: own.minVisible,
    step: own.step,
    largeStep: own.largeStep,
    draggable: draggable(),
    resizable: resizable(),
    disabled: disabled(),
  }))
  const { view, send } = useMachine(floatingPanelMachine, machineProps, {})
  const rect = createMemo(() => rectOf(machineProps(), view().values.position, view().values.size))
  const current = createMemo<PanelStage>(() => view().values.stage ?? "default")
  const [positioner, setPositioner] = createSignal<HTMLElement | null>(null)
  let dragTrigger: HTMLElement | null = null
  let body: HTMLElement | null = null
  const api = createMemo(() => {
    const root = dialog.root()
    return floatingPanelConnect(
      {
        instance: root,
        open: open(),
        state: view().state as FloatingPanelState,
        rect: rect(),
        stage: current(),
        disabled: disabled(),
        draggable: draggable(),
        resizable: resizable(),
        messages: own.messages(),
        ids: {
          content: partId("floating-panel", root, "content"),
          title: partId("floating-panel", root, "title"),
          description: partId("floating-panel", root, "description"),
          hint: partId("floating-panel", root, "drag-hint"),
        },
        rendered: { description: dialog.rendered().description !== undefined },
      },
      env,
    )
  })
  // The boundary: the Positioner's containing block (its content box), or the viewport.
  afterMount(() => {
    createEffect(() => {
      const el = positioner()
      if (!open() || !el) return
      const parent = el.offsetParent
      const doc = el.ownerDocument
      const target =
        parent && parent !== doc.body && parent !== doc.documentElement
          ? parent
          : doc.documentElement
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
      onCleanup(() => ro.disconnect())
    })
  })
  const writeVars = (r: Rect) => {
    const el = untrack(positioner)
    if (!el) return
    el.style.setProperty("--rind-floating-panel-x", `${Math.round(r.x)}px`)
    el.style.setProperty("--rind-floating-panel-y", `${Math.round(r.y)}px`)
    el.style.setProperty("--rind-floating-panel-width", `${Math.round(r.width)}px`)
    el.style.setProperty("--rind-floating-panel-height", `${Math.round(r.height)}px`)
  }
  let drag: (() => void) | null = null
  // Not during a drag: a change then (DRAG.START, a focus change) would undo the preview.
  createEffect(() => {
    const r = rect()
    positioner()
    if (!drag) writeVars(r)
  })
  const startDrag = (e: PointerEvent, axis?: ResizeAxis) => {
    const stage = untrack(current)
    if (!isDragPress(e) || drag || untrack(view).state !== "idle" || untrack(disabled)) return
    // The machine's guards (canMove, canResize), checked here so a refused press tracks nothing.
    if (
      axis
        ? !untrack(resizable) || stage !== "default"
        : !untrack(draggable) || stage === "maximized"
    )
      return
    send(axis ? { type: "DRAG.START", mode: "resize", axis } : { type: "DRAG.START", mode: "move" })
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY }
    const from = untrack(rect)
    let total = { dx: 0, dy: 0 }
    drag = trackPointer<{ type: "move"; dx: number; dy: number }>(
      e.currentTarget as Element,
      e.pointerId,
      (m) => {
        if (m.type === "move") {
          total = { dx: m.dx, dy: m.dy }
          const b = untrack(view).context.boundary
          const l = limitsOf(untrack(machineProps), b)
          const preview = axis
            ? resizeRect(from, axis, m.dx, m.dy, l)
            : { ...from, x: from.x + m.dx, y: from.y + m.dy }
          writeVars(b.width > 0 && b.height > 0 && !axis ? clampRect(preview, l) : preview)
          return
        }
        drag = null
        if (m.type === "up") send({ type: "DRAG.END", ...total })
        else {
          send({ type: "DRAG.CANCEL" })
          writeVars(untrack(rect))
        }
      },
      (p) => ({ type: "move", dx: p.clientX - start.x, dy: p.clientY - start.y }),
    )
  }
  const cancelDrag = () => {
    const stop = drag
    if (!stop) return false
    stop()
    drag = null
    send({ type: "DRAG.CANCEL" })
    writeVars(untrack(rect))
    return true
  }
  onCleanup(() => drag?.())
  // Minimised: the Body is hidden, so focus inside it goes to the DragTrigger.
  createEffect(
    on(current, (stage) => {
      if (stage !== "minimized") return
      const active = body?.ownerDocument.activeElement
      if (active && body?.contains(active)) dragTrigger?.focus()
    }),
  )
  const state = reactive<FloatingPanelRenderState>(() => ({
    open: open(),
    stage: current(),
    dragging: view().state === "moving",
    resizing: view().state === "resizing",
  }))
  const ctx: Ctx = {
    api,
    state,
    send,
    setPositioner,
    setDragTrigger: (el) => {
      dragTrigger = el
    },
    setBody: (el) => {
      body = el
    },
    dir: () => loc().dir,
    startDrag,
    cancelDrag,
  }
  const merged = createMemo(() => mergeProps(normalizeProps(api().root()), rest))
  const children = () => resolveChildren(own.children, state)
  return (
    <PanelContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </PanelContext.Provider>
  )
}

/** Opens and closes the panel. */
const Trigger = Dialog.Trigger

/** Placed by `--rind-floating-panel-x/-y/-width/-height`. */
function Positioner(props: DialogDivProps) {
  const [local, rest] = splitProps(props, ["children"])
  const ctx = usePanel("Positioner")
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().positioner()), ref: ctx.setPositioner }, rest),
  )
  return <Dialog.Positioner {...merged()}>{local.children}</Dialog.Positioner>
}

/** The non-modal dialog, named by the Title. */
function Content(props: DialogContentProps) {
  const [local, rest] = splitProps(props, ["children"])
  const ctx = usePanel("Content")
  const merged = createMemo(() => {
    // The Dialog's own role, name and description references stand: only the panel's attributes.
    const {
      role: _role,
      "aria-labelledby": _l,
      "aria-describedby": _d,
      tabindex: _t,
      id: _id,
      ...own
    } = normalizeProps(ctx.api().content())
    return mergeProps(own, rest)
  })
  return <Dialog.Content {...merged()}>{local.children}</Dialog.Content>
}

type DivProps = Own<JSX.HTMLAttributes<HTMLDivElement>>

function simplePart(name: string, part: (api: Api) => PartProps) {
  return function Part(props: DivProps) {
    const [local, rest] = splitProps(props, ["render", "children"])
    const ctx = usePanel(name)
    const merged = createMemo(() => mergeProps(normalizeProps(part(ctx.api())), rest))
    const children = () => resolveChildren(local.children, ctx.state)
    return renderPart(local.render, merged, ctx.state, children, (p) => (
      <div {...p}>{children()}</div>
    ))
  }
}

/** The title bar. */
const Header = simplePart("Header", (api) => api.header())
/** Groups the stage and close triggers. */
const Control = simplePart("Control", (api) => api.control())

/** Names the panel. */
function Title(props: DialogTitleProps) {
  const [local, rest] = splitProps(props, ["children"])
  const ctx = usePanel("Title")
  const merged = createMemo(() => {
    const { id: _id, ...own } = normalizeProps(ctx.api().title())
    return mergeProps(own, rest)
  })
  return <Dialog.Title {...merged()}>{local.children}</Dialog.Title>
}

/** Describes the panel. */
function Description(props: DialogDivProps) {
  const [local, rest] = splitProps(props, ["children"])
  const ctx = usePanel("Description")
  const merged = createMemo(() => {
    const { id: _id, ...own } = normalizeProps(ctx.api().description())
    return mergeProps(own, rest)
  })
  return <Dialog.Description {...merged()}>{local.children}</Dialog.Description>
}

/** The content; inert while minimised. */
function Body(props: DivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePanel("Body")
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().body()), ref: ctx.setBody }, rest),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** Focus state with the modality it arrived by. */
function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  return { focused, setFocused, modality }
}

type ButtonProps = Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

/** Drag to move; arrows move, Alt+arrows resize, Enter maximises. */
function DragTrigger(props: ButtonProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = usePanel("DragTrigger")
  const env = useEnvironment()
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  const tag = useRenderedTag(
    () => "button",
    () => local.render,
    el,
  )
  const { focused, setFocused, modality } = useFocus()
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            ctx.api().dragTrigger({ tag: tag(), focused: focused(), modality: modality() }),
          ),
          {
            onPointerDown: (e: PointerEvent) => ctx.startDrag(e),
            onKeyDown: (e: KeyboardEvent) => {
              const dragging = ctx.state.dragging || ctx.state.resizing
              const event = floatingPanelKeyEvent(describeKey(e, env), {
                dir: ctx.dir(),
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
            onFocusIn: () => setFocused(true),
            onFocusOut: () => setFocused(false),
          },
        ),
        ref: (node: HTMLElement) => {
          setEl(node)
          ctx.setDragTrigger(node)
        },
      },
      rest,
    ),
  )
  const hint = createMemo(() => normalizeProps(ctx.api().dragHint()))
  // The hint the button is described by, after the consumer's content.
  const children = () => (
    <>
      {resolveChildren(local.children, ctx.state)}
      <span {...hint()}>{ctx.api().hintText}</span>
    </>
  )
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export type FloatingPanelStageTriggerProps = ButtonProps & {
  /** The stage it switches to; pressed again from there, it restores. */
  readonly stage: "minimized" | "maximized"
}

/** `stage` minimized or maximized; from there it restores. */
function StageTrigger(props: FloatingPanelStageTriggerProps) {
  const [local, rest] = splitProps(props, ["stage", "render", "children"])
  const ctx = usePanel("StageTrigger")
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  const tag = useRenderedTag(
    () => "button",
    () => local.render,
    el,
  )
  const { focused, setFocused, modality } = useFocus()
  const merged = createMemo(() => {
    const own = normalizeProps(
      ctx.api().stageTrigger(local.stage, { tag: tag(), focused: focused(), modality: modality() }),
    )
    const target = own["data-stage-target"] as PanelStage
    return mergeProps(
      {
        ...joinHandlers(own, {
          onClick: () => ctx.send({ type: "STAGE", stage: target }),
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        }),
        ref: setEl,
      },
      rest,
    )
  })
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** Closes the panel (the Dialog's close button: its name, focus return and press). */
const CloseTrigger: (props: DialogButtonProps) => JSX.Element = Dialog.CloseTrigger

export type FloatingPanelResizeTriggerProps = DivProps & {
  /** The edge or corner it moves. */
  readonly axis: ResizeAxis
}

/** A pointer handle on an edge or corner (`axis`); hidden from assistive technology. */
function ResizeTrigger(props: FloatingPanelResizeTriggerProps) {
  const [local, rest] = splitProps(props, ["axis", "render", "children"])
  const ctx = usePanel("ResizeTrigger")
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(normalizeProps(ctx.api().resizeTrigger(local.axis)), {
        onPointerDown: (e: PointerEvent) => ctx.startDrag(e, local.axis),
      }),
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
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
