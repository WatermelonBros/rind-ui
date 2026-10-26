// Floating Panel (add-floating-panel): two machines composed by the parts. Open and close are the
// Dialog's (non-modal, an outside press never closes it), through the Dialog family's parts;
// the rect (position, size, stage) is the floating-panel machine's. A drag is seen by the machine
// at its start and end only: each move is written to the Positioner's CSS variables.
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
} from "@angular/core"
import {
  type ChangeDetails,
  type DialogMessages,
  describeKey,
  dialogMachine,
  dialogMessages,
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
  type Modality,
  type PanelStage,
  partId,
  rectOf,
  trackPointer,
} from "@rind-ui/core"
import { clampRect, type Rect, type ResizeAxis, resizeRect } from "@rind-ui/core/internal"
import { bindProps, joinHandlers } from "../bind-props"
import {
  DIALOG,
  DialogCloseTrigger,
  DialogContent,
  DialogDescription,
  DialogPortal,
  DialogPositioner,
  DialogRootBase,
  DialogTitle,
  DialogTrigger,
  injectDialog,
} from "../dialog/dialog"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { RindProps } from "../rind-props"

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

/** The panel's state, for the template (`#p="rindFloatingPanelRoot"`, `p.panelState()`). */
export interface FloatingPanelRenderState {
  readonly open: boolean
  readonly stage: PanelStage
  readonly dragging: boolean
  readonly resizing: boolean
}

const FLOATING_PANEL = new InjectionToken<FloatingPanelRoot>("rind-ui.floating-panel")

function injectPanel(part: string): FloatingPanelRoot {
  injectDialog(part)
  const root = inject(FLOATING_PANEL, { optional: true })
  if (!root) throw new Error(`${part} must be inside rindFloatingPanelRoot`)
  return root
}

const optionalNumber = (v: unknown) => (v == null || v === "" ? undefined : numberAttribute(v))

/**
 * A non-modal window the user moves, resizes, minimises and maximises:
 * `<div rindFloatingPanelRoot>` with a Trigger and (usually in `<ng-template rindDialogPortal>`)
 * a Positioner holding the Content: Header (DragTrigger, Title, Control with StageTriggers and
 * the CloseTrigger), Body and ResizeTriggers.
 */
@Directive({
  selector: "[rindFloatingPanelRoot]",
  exportAs: "rindFloatingPanelRoot",
  providers: [
    { provide: DIALOG, useExisting: forwardRef(() => FloatingPanelRoot) },
    { provide: FLOATING_PANEL, useExisting: forwardRef(() => FloatingPanelRoot) },
  ],
})
export class FloatingPanelRoot extends DialogRootBase {
  /** Never modal: the page stays usable. */
  override readonly isModal = computed(() => false)
  readonly messages = input<MessageOverrides<FloatingPanelMessages>>()
  /** Controlled position in the boundary (`[(position)]`). */
  readonly position = input<FloatingPanelPoint>()
  /** Uncontrolled position. Default { x: 0, y: 0 }. */
  readonly defaultPosition = input<FloatingPanelPoint>()
  /** Controlled size (`[(size)]`). */
  readonly size = input<FloatingPanelSize>()
  /** Uncontrolled size. Default 360×240. */
  readonly defaultSize = input<FloatingPanelSize>()
  /** Controlled stage (`[(stage)]`). */
  readonly stage = input<PanelStage>()
  /** Uncontrolled stage. Default "default". */
  readonly defaultStage = input<PanelStage>()
  /** The smallest size. Default 200×120. */
  readonly minSize = input<FloatingPanelSize>()
  /** The largest size (default: the boundary). */
  readonly maxSize = input<FloatingPanelSize>()
  /** Pixels kept inside the boundary on each axis. Default 48. */
  readonly minVisible = input(undefined, { transform: optionalNumber })
  /** Pixels per arrow key. Default 10. */
  readonly step = input(undefined, { transform: optionalNumber })
  /** Pixels per Shift+arrow. Default 50. */
  readonly largeStep = input(undefined, { transform: optionalNumber })
  /** Can be moved. Default true. */
  readonly draggable = input(true, { transform: booleanAttribute })
  /** Can be resized. Default true. */
  readonly resizable = input(true, { transform: booleanAttribute })
  /** No move, resize or stage change. */
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Once per drag, per key step (`[(position)]`). */
  readonly positionChange = output<FloatingPanelPoint>()
  readonly positionChangeDetails = output<{
    value: FloatingPanelPoint
    details: ChangeDetails<FloatingPanelEvent>
  }>()
  /** Once per resize, per key step (`[(size)]`). */
  readonly sizeChange = output<FloatingPanelSize>()
  readonly sizeChangeDetails = output<{
    value: FloatingPanelSize
    details: ChangeDetails<FloatingPanelEvent>
  }>()
  /** Minimised, maximised or restored (`[(stage)]`). */
  readonly stageChange = output<PanelStage>()
  readonly stageChangeDetails = output<{
    value: PanelStage
    details: ChangeDetails<FloatingPanelEvent>
  }>()

  /** @internal */
  readonly panelTexts = injectMessages("floating-panel", floatingPanelMessages, () =>
    this.messages(),
  )
  /** @internal */
  readonly panelApi: Signal<ReturnType<typeof floatingPanelConnect>>
  /** @internal */
  readonly panelSend: (event: FloatingPanelEvent) => void
  /** The panel's state, for the template. */
  readonly panelState: Signal<FloatingPanelRenderState>
  /** @internal */
  readonly direction: () => "ltr" | "rtl"
  /** @internal */
  readonly positionerEl = signal<HTMLElement | null>(null)
  /** @internal */
  dragTriggerEl: HTMLElement | null = null
  /** @internal */
  bodyEl: HTMLElement | null = null
  /** @internal Starts a pointer drag (move, or resize on `axis`), previewed on the CSS variables. */
  readonly startDrag: (e: PointerEvent, axis?: ResizeAxis) => void
  /** @internal Cancels a pointer drag in progress (Escape); false when none. */
  readonly cancelDrag: () => boolean

  constructor() {
    super()
    this.wire(
      { scope: "floating-panel", kind: "dialog", machine: dialogMachine },
      // The Dialog's messages, its close label the panel's.
      injectMessages<DialogMessages>("dialog", dialogMessages, () => ({
        close: this.panelTexts().close,
      })),
      // Non-modal, and an outside press never closes it.
      () => ({ modal: false, closeOnInteractOutside: false }),
    )
    const env = injectEnvironment()
    const loc = injectLocale(() => undefined)
    this.direction = () => loc().dir
    const open = computed(() => this.isOpen())
    const machineProps = () => ({
      position: this.position(),
      defaultPosition: this.defaultPosition(),
      onPositionChange: (value: FloatingPanelPoint, details: ChangeDetails<FloatingPanelEvent>) => {
        this.positionChange.emit(value)
        this.positionChangeDetails.emit({ value, details })
      },
      size: this.size(),
      defaultSize: this.defaultSize(),
      onSizeChange: (value: FloatingPanelSize, details: ChangeDetails<FloatingPanelEvent>) => {
        this.sizeChange.emit(value)
        this.sizeChangeDetails.emit({ value, details })
      },
      stage: this.stage(),
      defaultStage: this.defaultStage(),
      onStageChange: (value: PanelStage, details: ChangeDetails<FloatingPanelEvent>) => {
        this.stageChange.emit(value)
        this.stageChangeDetails.emit({ value, details })
      },
      minSize: this.minSize(),
      maxSize: this.maxSize(),
      minVisible: this.minVisible(),
      step: this.step(),
      largeStep: this.largeStep(),
      draggable: this.draggable(),
      resizable: this.resizable(),
      disabled: this.disabled(),
    })
    const { view, send } = injectMachine(floatingPanelMachine, machineProps, {})
    this.panelSend = send
    const rect = computed(() => rectOf(machineProps(), view().values.position, view().values.size))
    const current = computed<PanelStage>(() => view().values.stage ?? "default")
    this.panelApi = computed(() => {
      const root = this.root()
      return floatingPanelConnect(
        {
          instance: root,
          open: open(),
          state: view().state as FloatingPanelState,
          rect: rect(),
          stage: current(),
          disabled: this.disabled(),
          draggable: this.draggable(),
          resizable: this.resizable(),
          messages: this.panelTexts(),
          ids: {
            content: partId("floating-panel", root, "content"),
            title: partId("floating-panel", root, "title"),
            description: partId("floating-panel", root, "description"),
            hint: partId("floating-panel", root, "drag-hint"),
          },
          rendered: { description: this.rendered().description !== undefined },
        },
        env,
      )
    })
    this.panelState = computed(() => ({
      open: open(),
      stage: current(),
      dragging: view().state === "moving",
      resizing: view().state === "resizing",
    }))
    const writeVars = (r: Rect) => {
      const el = untracked(this.positionerEl)
      if (!el) return
      el.style.setProperty("--rind-floating-panel-x", `${Math.round(r.x)}px`)
      el.style.setProperty("--rind-floating-panel-y", `${Math.round(r.y)}px`)
      el.style.setProperty("--rind-floating-panel-width", `${Math.round(r.width)}px`)
      el.style.setProperty("--rind-floating-panel-height", `${Math.round(r.height)}px`)
    }
    let drag: (() => void) | null = null
    this.startDrag = (e, axis) => {
      const stage = untracked(current)
      if (!isDragPress(e) || drag || untracked(view).state !== "idle" || untracked(this.disabled))
        return
      // The machine's guards (canMove, canResize), checked here so a refused press tracks nothing.
      if (
        axis
          ? !untracked(this.resizable) || stage !== "default"
          : !untracked(this.draggable) || stage === "maximized"
      )
        return
      send(
        axis ? { type: "DRAG.START", mode: "resize", axis } : { type: "DRAG.START", mode: "move" },
      )
      e.preventDefault()
      const start = { x: e.clientX, y: e.clientY }
      const from = untracked(rect)
      let total = { dx: 0, dy: 0 }
      drag = trackPointer<{ type: "move"; dx: number; dy: number }>(
        e.currentTarget as Element,
        e.pointerId,
        (m) => {
          if (m.type === "move") {
            total = { dx: m.dx, dy: m.dy }
            const b = untracked(view).context.boundary
            const l = limitsOf(untracked(machineProps), b)
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
            writeVars(untracked(rect))
          }
        },
        (p) => ({ type: "move", dx: p.clientX - start.x, dy: p.clientY - start.y }),
      )
    }
    this.cancelDrag = () => {
      const stop = drag
      if (!stop) return false
      stop()
      drag = null
      send({ type: "DRAG.CANCEL" })
      writeVars(untracked(rect))
      return true
    }
    // Not during a drag: a change then (DRAG.START, a focus change) would undo the preview.
    effect(() => {
      const r = rect()
      this.positionerEl()
      if (!drag) writeVars(r)
    })
    // Minimised: the Body is hidden, so focus inside it goes to the DragTrigger.
    effect(() => {
      if (current() !== "minimized") return
      const body = this.bodyEl
      const active = body?.ownerDocument.activeElement
      if (active && body?.contains(active)) this.dragTriggerEl?.focus()
    })
    bindProps(() => this.panelApi().root(), {
      owns: [
        "defaultposition",
        "defaultsize",
        "defaultstage",
        "disabled",
        "draggable",
        "largestep",
        "maxsize",
        "messages",
        "minsize",
        "minvisible",
        "position",
        "resizable",
        "size",
        "stage",
        "step",
      ],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    destroy.onDestroy(() => drag?.())
    // The boundary: the Positioner's containing block (its content box), or the viewport.
    effect((onCleanup) => {
      const el = this.positionerEl()
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
      untracked(measure)
      if (typeof ResizeObserver === "undefined") return
      const ro = new ResizeObserver(measure)
      ro.observe(target)
      onCleanup(() => ro.disconnect())
    })
  }
}

/** Placed by `--rind-floating-panel-x/-y/-width/-height`: `<div rindFloatingPanelPositioner>`. */
@Directive({
  selector: "[rindFloatingPanelPositioner]",
  exportAs: "rindFloatingPanelPositioner",
  hostDirectives: [DialogPositioner],
})
export class FloatingPanelPositioner {
  constructor() {
    const root = injectPanel("rindFloatingPanelPositioner")
    const el: HTMLElement = inject(ElementRef).nativeElement
    root.positionerEl.set(el)
    inject(DestroyRef).onDestroy(() => {
      if (untracked(root.positionerEl) === el) root.positionerEl.set(null)
    })
    bindProps(() => root.panelApi().positioner())
  }
}

/** The non-modal dialog, named by the Title: `<div rindFloatingPanelContent>`. */
@Directive({
  selector: "[rindFloatingPanelContent]",
  exportAs: "rindFloatingPanelContent",
  hostDirectives: [DialogContent],
})
export class FloatingPanelContent {
  constructor() {
    const root = injectPanel("rindFloatingPanelContent")
    // The Dialog's own role, name and description references stand: only the panel's attributes.
    bindProps(() => {
      const {
        role: _role,
        "aria-labelledby": _l,
        "aria-describedby": _d,
        tabindex: _t,
        id: _id,
        ...own
      } = root.panelApi().content()
      return own
    })
  }
}

/** The title bar. */
@Directive({ selector: "[rindFloatingPanelHeader]", exportAs: "rindFloatingPanelHeader" })
export class FloatingPanelHeader {
  constructor() {
    const root = injectPanel("rindFloatingPanelHeader")
    bindProps(() => root.panelApi().header())
  }
}

/** Groups the stage and close triggers. */
@Directive({ selector: "[rindFloatingPanelControl]", exportAs: "rindFloatingPanelControl" })
export class FloatingPanelControl {
  constructor() {
    const root = injectPanel("rindFloatingPanelControl")
    bindProps(() => root.panelApi().control())
  }
}

/** Names the panel: `<h2 rindFloatingPanelTitle>`. */
@Directive({
  selector: "[rindFloatingPanelTitle]",
  exportAs: "rindFloatingPanelTitle",
  hostDirectives: [DialogTitle],
})
export class FloatingPanelTitle {
  constructor() {
    const root = injectPanel("rindFloatingPanelTitle")
    bindProps(() => {
      const { id: _id, ...own } = root.panelApi().title()
      return own
    })
  }
}

/** Describes the panel. */
@Directive({
  selector: "[rindFloatingPanelDescription]",
  exportAs: "rindFloatingPanelDescription",
  hostDirectives: [DialogDescription],
})
export class FloatingPanelDescription {
  constructor() {
    const root = injectPanel("rindFloatingPanelDescription")
    bindProps(() => {
      const { id: _id, ...own } = root.panelApi().description()
      return own
    })
  }
}

/** The content; inert while minimised. */
@Directive({ selector: "[rindFloatingPanelBody]", exportAs: "rindFloatingPanelBody" })
export class FloatingPanelBody {
  constructor() {
    const root = injectPanel("rindFloatingPanelBody")
    root.bodyEl = inject(ElementRef).nativeElement
    bindProps(() => root.panelApi().body())
  }
}

/** Focus state with the modality it arrived by, and the element's tag. */
function injectButton() {
  const env = injectEnvironment()
  const el: HTMLElement = inject(ElementRef).nativeElement
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    // Tracks the modality from mount, so the first keyboard focus is already visible.
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  return {
    env,
    el,
    focused,
    b: (): { tag: string; focused: boolean; modality: Modality } => ({
      tag: el.tagName.toLowerCase(),
      focused: focused(),
      modality: modality(),
    }),
  }
}

/**
 * Drag to move; arrows move, Alt+arrows resize, Enter maximises: `<button
 * rindFloatingPanelDragTrigger>`. It adds the hint it is described by after its content.
 */
@Component({
  selector: "[rindFloatingPanelDragTrigger]",
  exportAs: "rindFloatingPanelDragTrigger",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content /><span [rindProps]="hintProps()">{{ hintText() }}</span>`,
})
export class FloatingPanelDragTrigger {
  /** @internal */
  protected readonly hintProps: Signal<
    ReturnType<ReturnType<typeof floatingPanelConnect>["dragHint"]>
  >
  /** @internal */
  protected readonly hintText: Signal<string>
  constructor() {
    const root = injectPanel("rindFloatingPanelDragTrigger")
    const { env, el, focused, b } = injectButton()
    root.dragTriggerEl = el
    this.hintProps = computed(() => root.panelApi().dragHint())
    this.hintText = computed(() => root.panelApi().hintText)
    bindProps(() =>
      joinHandlers(root.panelApi().dragTrigger(b()), {
        onPointerDown: (e: PointerEvent) => root.startDrag(e),
        onKeyDown: (e: KeyboardEvent) => {
          const s = untracked(root.panelState)
          const event = floatingPanelKeyEvent(describeKey(e, env), {
            dir: root.direction(),
            dragging: s.dragging || s.resizing,
          })
          if (!event) return
          e.preventDefault()
          // Escape ends the drag only: the panel stays open.
          if (event.type === "DRAG.CANCEL") {
            e.stopPropagation()
            if (!root.cancelDrag()) root.panelSend(event)
            return
          }
          root.panelSend(event)
        },
        onFocusIn: () => focused.set(true),
        onFocusOut: () => focused.set(false),
      }),
    )
  }
}

/** `stage` minimized or maximized; from there it restores: `<button rindFloatingPanelStageTrigger stage="minimized">`. */
@Directive({
  selector: "[rindFloatingPanelStageTrigger]",
  exportAs: "rindFloatingPanelStageTrigger",
})
export class FloatingPanelStageTrigger {
  /** The stage it switches to; pressed again from there, it restores. */
  readonly stage = input.required<"minimized" | "maximized">()
  constructor() {
    const root = injectPanel("rindFloatingPanelStageTrigger")
    const { focused, b } = injectButton()
    bindProps(
      () => {
        const own = root.panelApi().stageTrigger(this.stage(), b())
        const target = own["data-stage-target"] as PanelStage
        return joinHandlers(own, {
          onClick: () => root.panelSend({ type: "STAGE", stage: target }),
          onFocusIn: () => focused.set(true),
          onFocusOut: () => focused.set(false),
        })
      },
      { owns: ["stage"] },
    )
  }
}

/** A pointer handle on an edge or corner (`axis`); hidden from assistive technology. */
@Directive({
  selector: "[rindFloatingPanelResizeTrigger]",
  exportAs: "rindFloatingPanelResizeTrigger",
})
export class FloatingPanelResizeTrigger {
  /** The edge or corner it moves. */
  readonly axis = input.required<ResizeAxis>()
  constructor() {
    const root = injectPanel("rindFloatingPanelResizeTrigger")
    bindProps(
      () =>
        joinHandlers(root.panelApi().resizeTrigger(this.axis()), {
          onPointerDown: (e: PointerEvent) => root.startDrag(e, untracked(this.axis)),
        }),
      { owns: ["axis"] },
    )
  }
}

/** The Floating Panel's parts (the Dialog's own Trigger, CloseTrigger and Portal). */
export const FloatingPanel = [
  FloatingPanelRoot,
  DialogTrigger,
  DialogPortal,
  FloatingPanelPositioner,
  FloatingPanelContent,
  FloatingPanelHeader,
  FloatingPanelTitle,
  FloatingPanelDescription,
  FloatingPanelBody,
  FloatingPanelControl,
  FloatingPanelDragTrigger,
  FloatingPanelStageTrigger,
  DialogCloseTrigger,
  FloatingPanelResizeTrigger,
] as const
