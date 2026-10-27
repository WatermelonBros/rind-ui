// Floating Panel parts (add-floating-panel): two machines composed here. Open and close are the
// Dialog's (non-modal, never closed by an outside press), through the Dialog family's parts; the
// rect is the floating-panel machine's. A drag is seen by the machine at its start and end only:
// each move is written to the Positioner's CSS variables.
import {
  type ChangeDetails,
  type DialogChangeDetails,
  type DialogProps,
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
  type PanelStage,
  type PartProps,
  partId,
  rectOf,
  trackPointer,
} from "@rind-ui/core"
import { clampRect, type Rect, type ResizeAxis, resizeRect } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import {
  Content as DialogContent,
  Description as DialogDescription,
  Positioner as DialogPositioner,
  Title as DialogTitle,
  setupDialogRoot,
} from "../dialog/dialog"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "floating-panel": FloatingPanelMessages
  }
}

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

/** What every part's slot receives. */
export interface FloatingPanelRenderState {
  readonly open: boolean
  readonly stage: PanelStage
  readonly dragging: boolean
  readonly resizing: boolean
}

type Api = ReturnType<typeof floatingPanelConnect>

interface Ctx {
  readonly api: () => Api
  readonly state: () => FloatingPanelRenderState
  readonly send: (event: FloatingPanelEvent) => void
  readonly positioner: ShallowRef<HTMLElement | null>
  readonly dragTrigger: ShallowRef<HTMLElement | null>
  readonly body: ShallowRef<HTMLElement | null>
  readonly dir: () => "ltr" | "rtl"
  readonly startDrag: (e: PointerEvent, axis?: ResizeAxis) => void
  readonly cancelDrag: () => boolean
}

const PanelKey: InjectionKey<Ctx> = Symbol("rind-ui.floating-panel")
function usePanel(part: string): Ctx {
  const ctx = inject(PanelKey, null)
  if (!ctx) throw new Error(`FloatingPanel.${part} must be inside FloatingPanel.Root`)
  return ctx
}

type Slots = SlotsType<{ default?: (state: FloatingPanelRenderState) => VNodeChild }>

/** A movable, resizable non-modal panel. */
const Root = defineComponent({
  name: "FloatingPanelRoot",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The base of the generated part ids. Default: a generated id. */
    id: String,
    /** Controlled visibility (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    /** Uncontrolled visibility. Default false. */
    defaultOpen: { type: Boolean, default: undefined },
    /** `null`: the overlay's rule; `false`: focus does not move; a part name or a function. */
    initialFocus: {
      type: [String, Function, Boolean] as PropType<DialogProps["initialFocus"]>,
      default: undefined,
    },
    /** `null`: back to the opener; `false`: focus does not move. */
    finalFocus: {
      type: [Function, Boolean] as PropType<DialogProps["finalFocus"]>,
      default: undefined,
    },
    /** Content and Positioner stay mounted (hidden) while closed. */
    keepMounted: Boolean,
    /** Controlled position in the boundary (`v-model:position`). */
    position: Object as PropType<FloatingPanelPoint>,
    /** Uncontrolled position. Default { x: 0, y: 0 }. */
    defaultPosition: Object as PropType<FloatingPanelPoint>,
    /** Controlled size (`v-model:size`). */
    size: Object as PropType<FloatingPanelSize>,
    /** Uncontrolled size. Default 360×240. */
    defaultSize: Object as PropType<FloatingPanelSize>,
    /** Controlled stage (`v-model:stage`). */
    stage: String as PropType<PanelStage>,
    /** Uncontrolled stage. Default "default". */
    defaultStage: String as PropType<PanelStage>,
    /** The smallest size. Default 200×120. */
    minSize: Object as PropType<FloatingPanelSize>,
    /** The largest size (default: the boundary). */
    maxSize: Object as PropType<FloatingPanelSize>,
    /** Pixels kept inside the boundary on each axis. Default 48. */
    minVisible: { type: Number, default: undefined },
    /** Pixels per arrow key. Default 10. */
    step: { type: Number, default: undefined },
    /** Pixels per Shift+arrow. Default 50. */
    largeStep: { type: Number, default: undefined },
    /** Can be moved. Default true. */
    draggable: { type: Boolean, default: true },
    /** Can be resized. Default true. */
    resizable: { type: Boolean, default: true },
    /** No move, resize or stage change. */
    disabled: Boolean,
    /** Overrides the strings (also through the provider). */
    messages: Object as PropType<MessageOverrides<FloatingPanelMessages>>,
  },
  emits: {
    /** Opened or closed, with the reason. */
    openChange: (_open: boolean, _details: DialogChangeDetails) => true,
    "update:open": (_open: boolean) => true,
    /** Once per drag, per key step. */
    positionChange: (_p: FloatingPanelPoint, _d: ChangeDetails<FloatingPanelEvent>) => true,
    "update:position": (_p: FloatingPanelPoint) => true,
    /** Once per resize, per key step. */
    sizeChange: (_s: FloatingPanelSize, _d: ChangeDetails<FloatingPanelEvent>) => true,
    "update:size": (_s: FloatingPanelSize) => true,
    /** Minimised, maximised or restored. */
    stageChange: (_s: PanelStage, _d: ChangeDetails<FloatingPanelEvent>) => true,
    "update:stage": (_s: PanelStage) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit, expose }) {
    const env = useEnvironment()
    const loc = useLocale(() => undefined)
    const messages = useMessages("floating-panel", floatingPanelMessages, () => props.messages)
    const dialogStrings = useMessages("dialog", dialogMessages, () => ({
      close: messages.value.close,
    }))
    const dialog = setupDialogRoot(
      { scope: "floating-panel", kind: "dialog", machine: dialogMachine },
      {
        role: "dialog",
        get open() {
          return props.open
        },
        get defaultOpen() {
          return props.defaultOpen
        },
        modal: false,
        closeOnEscape: undefined,
        closeOnInteractOutside: false,
        get initialFocus() {
          return props.initialFocus
        },
        get finalFocus() {
          return props.finalFocus
        },
        get id() {
          return props.id
        },
        get keepMounted() {
          return props.keepMounted
        },
        messages: undefined,
      },
      emit as never,
      expose,
      dialogStrings,
    )
    const open = () => dialog.view.value.matches("open")
    const machineProps = () => ({
      position: props.position,
      defaultPosition: props.defaultPosition,
      onPositionChange: (p: FloatingPanelPoint, d: ChangeDetails<FloatingPanelEvent>) => {
        emit("positionChange", p, d)
        emit("update:position", p)
      },
      size: props.size,
      defaultSize: props.defaultSize,
      onSizeChange: (s: FloatingPanelSize, d: ChangeDetails<FloatingPanelEvent>) => {
        emit("sizeChange", s, d)
        emit("update:size", s)
      },
      stage: props.stage,
      defaultStage: props.defaultStage,
      onStageChange: (s: PanelStage, d: ChangeDetails<FloatingPanelEvent>) => {
        emit("stageChange", s, d)
        emit("update:stage", s)
      },
      minSize: props.minSize,
      maxSize: props.maxSize,
      minVisible: props.minVisible,
      step: props.step,
      largeStep: props.largeStep,
      draggable: props.draggable,
      resizable: props.resizable,
      disabled: props.disabled,
    })
    const { view, send } = useMachine(floatingPanelMachine, machineProps, {})
    const rect = () => rectOf(machineProps(), view.value.values.position, view.value.values.size)
    const stage = () => view.value.values.stage ?? "default"
    const positioner = shallowRef<HTMLElement | null>(null)
    const dragTrigger = shallowRef<HTMLElement | null>(null)
    const body = shallowRef<HTMLElement | null>(null)
    const api = computed(() =>
      floatingPanelConnect(
        {
          instance: dialog.root(),
          open: open(),
          state: view.value.state as FloatingPanelState,
          rect: rect(),
          stage: stage(),
          disabled: props.disabled,
          draggable: props.draggable,
          resizable: props.resizable,
          messages: messages.value,
          ids: {
            content: partId("floating-panel", dialog.root(), "content"),
            title: partId("floating-panel", dialog.root(), "title"),
            description: partId("floating-panel", dialog.root(), "description"),
            hint: partId("floating-panel", dialog.root(), "drag-hint"),
          },
          rendered: { description: dialog.rendered.value.description !== undefined },
        },
        env,
      ),
    )
    // The boundary: the Positioner's containing block (its content box), or the viewport.
    watch(
      [open, positioner],
      ([isOpen, el], _old, onCleanup) => {
        if (!isOpen || !el) return
        const parent = el.offsetParent
        const doc = el.ownerDocument
        const target =
          parent && parent !== doc.body && parent !== doc.documentElement
            ? parent
            : doc.documentElement
        const measure = () => {
          const viewport = target === doc.documentElement
          const cs = getComputedStyle(target)
          const pad = (a: string, b: string) =>
            viewport
              ? 0
              : Number.parseFloat(cs.getPropertyValue(a)) +
                Number.parseFloat(cs.getPropertyValue(b))
          send({
            type: "BOUNDARY",
            width: target.clientWidth - pad("padding-left", "padding-right"),
            height: target.clientHeight - pad("padding-top", "padding-bottom"),
          })
        }
        measure()
        if (typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver(measure)
        ro.observe(target)
        onCleanup(() => ro.disconnect())
      },
      { flush: "post", immediate: true },
    )
    const writeVars = (r: Rect) => {
      const el = positioner.value
      if (!el) return
      el.style.setProperty("--rind-floating-panel-x", `${Math.round(r.x)}px`)
      el.style.setProperty("--rind-floating-panel-y", `${Math.round(r.y)}px`)
      el.style.setProperty("--rind-floating-panel-width", `${Math.round(r.width)}px`)
      el.style.setProperty("--rind-floating-panel-height", `${Math.round(r.height)}px`)
    }
    let drag: (() => void) | null = null
    // Not during a drag: an update then (DRAG.START, a focus change) would undo the preview.
    const sync = () => {
      if (!drag) writeVars(rect())
    }
    onMounted(sync)
    onUpdated(sync)
    watch(() => view.value.state, sync, { flush: "post" })
    const startDrag = (e: PointerEvent, axis?: ResizeAxis) => {
      if (!isDragPress(e) || drag || view.value.state !== "idle" || props.disabled) return
      // The machine's guards (canMove, canResize), checked here so a refused press tracks nothing.
      if (
        axis
          ? !props.resizable || stage() !== "default"
          : !props.draggable || stage() === "maximized"
      )
        return
      send(
        axis ? { type: "DRAG.START", mode: "resize", axis } : { type: "DRAG.START", mode: "move" },
      )
      e.preventDefault()
      const start = { x: e.clientX, y: e.clientY }
      const from = rect()
      let total = { dx: 0, dy: 0 }
      drag = trackPointer<{ type: "move"; dx: number; dy: number }>(
        e.currentTarget as Element,
        e.pointerId,
        (m) => {
          if (m.type === "move") {
            total = { dx: m.dx, dy: m.dy }
            const b = view.value.context.boundary
            const l = limitsOf(machineProps(), b)
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
            writeVars(rect())
          }
        },
        (p) => ({ type: "move", dx: p.clientX - start.x, dy: p.clientY - start.y }),
      )
    }
    const cancelDrag = () => {
      if (!drag) return false
      drag()
      drag = null
      send({ type: "DRAG.CANCEL" })
      writeVars(rect())
      return true
    }
    onBeforeUnmount(() => drag?.())
    // Minimised: the Body is hidden, so focus inside it goes to the DragTrigger.
    watch(
      stage,
      (s) => {
        if (s !== "minimized") return
        const active = body.value?.ownerDocument.activeElement
        if (active && body.value?.contains(active)) dragTrigger.value?.focus()
      },
      { flush: "sync" },
    )
    const state = (): FloatingPanelRenderState => ({
      open: open(),
      stage: stage(),
      dragging: view.value.state === "moving",
      resizing: view.value.state === "resizing",
    })
    provide(PanelKey, {
      api: () => api.value,
      state,
      send,
      positioner,
      dragTrigger,
      body,
      dir: () => loc.value.dir,
      startDrag,
      cancelDrag,
    })
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(api.value.root()), attrs),
        slots.default?.(state()),
        props.asChild,
      )
  },
})

/** A Dialog part with the panel's own props merged in. */
function withPanel(
  name: string,
  part:
    | typeof DialogPositioner
    | typeof DialogContent
    | typeof DialogTitle
    | typeof DialogDescription,
  pick: (ctx: Ctx) => Record<string, unknown>,
) {
  return defineComponent({
    name: `FloatingPanel${name}`,
    inheritAttrs: false,
    slots: Object as SlotsType<{ default?: (state: never) => VNodeChild }>,
    setup(_, { attrs, slots }) {
      const ctx = usePanel(name)
      return () => h(part as never, mergeProps(pick(ctx), attrs), slots)
    },
  })
}

const without = (p: PartProps, ...keys: string[]) => {
  const own = { ...normalizeProps(p) }
  for (const k of keys) delete own[k]
  return own
}

/** Placed by `--rind-floating-panel-x/-y/-width/-height`. */
const Positioner = withPanel("Positioner", DialogPositioner, (ctx) => ({
  ...normalizeProps(ctx.api().positioner()),
  ref: refTo(ctx.positioner),
}))
/** The non-modal dialog, named by the Title (the Dialog owns its role and references). */
const Content = withPanel("Content", DialogContent, (ctx) =>
  without(ctx.api().content(), "role", "aria-labelledby", "aria-describedby", "tabindex", "id"),
)
/** Names the panel. */
const Title = withPanel("Title", DialogTitle, (ctx) => without(ctx.api().title(), "id"))
/** Describes the panel. */
const Description = withPanel("Description", DialogDescription, (ctx) =>
  without(ctx.api().description(), "id"),
)

function simplePart(name: string, own: (api: Api) => PartProps) {
  return defineComponent({
    name: `FloatingPanel${name}`,
    inheritAttrs: false,
    props: { ...asChildProp },
    slots: Object as Slots,
    setup(props, { attrs, slots }) {
      const ctx = usePanel(name)
      return () =>
        renderPart(
          "div",
          mergeProps(normalizeProps(own(ctx.api())), attrs),
          slots.default?.(ctx.state()),
          props.asChild,
        )
    },
  })
}

/** The title bar. */
const Header = simplePart("Header", (api) => api.header())
/** Groups the stage and close triggers. */
const Control = simplePart("Control", (api) => api.control())

/** The content; inert while minimised. */
const Body = defineComponent({
  name: "FloatingPanelBody",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePanel("Body")
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(ctx.api().body()), ref: refTo(ctx.body) }, attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

function useFocus() {
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  return { focused, modality }
}

function useTag() {
  const el = shallowRef<Element | null>(null)
  const measured = shallowRef<string | null>(null)
  const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
  onMounted(measure)
  onUpdated(measure)
  return { el, measured }
}

/** Drag to move; arrows move, Alt+arrows resize, Enter maximises. */
const DragTrigger = defineComponent({
  name: "FloatingPanelDragTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePanel("DragTrigger")
    const env = useEnvironment()
    const { focused, modality } = useFocus()
    const { el, measured } = useTag()
    const setEl = (node: unknown) => {
      el.value = node instanceof Element ? node : null
      ctx.dragTrigger.value = node instanceof HTMLElement ? node : null
    }
    return () => {
      const own = slots.default?.(ctx.state())
      const tag = renderedTag("button", own, props.asChild, measured.value)
      const api = ctx.api()
      const children = [own, h("span", normalizeProps(api.dragHint()), api.hintText)]
      return renderPart(
        "button",
        mergeProps(
          {
            ...joinHandlers(
              normalizeProps(
                api.dragTrigger({ tag, focused: focused.value, modality: modality.value }),
              ),
              {
                onPointerdown: (e: PointerEvent) => ctx.startDrag(e),
                onKeydown: (e: KeyboardEvent) => {
                  const s = ctx.state()
                  const event = floatingPanelKeyEvent(describeKey(e, env), {
                    dir: ctx.dir(),
                    dragging: s.dragging || s.resizing,
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
                onFocusin: () => (focused.value = true),
                onFocusout: () => (focused.value = false),
              },
            ),
            ref: setEl,
          },
          attrs,
        ),
        props.asChild ? own : children,
        props.asChild,
      )
    }
  },
})

/** `stage` minimized or maximized; from there it restores. */
const StageTrigger = defineComponent({
  name: "FloatingPanelStageTrigger",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The stage it switches to; pressed again from there, it restores. */
    stage: { type: String as PropType<"minimized" | "maximized">, required: true },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePanel("StageTrigger")
    const { focused, modality } = useFocus()
    const { el, measured } = useTag()
    return () => {
      const children = slots.default?.(ctx.state())
      const tag = renderedTag("button", children, props.asChild, measured.value)
      const own = normalizeProps(
        ctx
          .api()
          .stageTrigger(props.stage, { tag, focused: focused.value, modality: modality.value }),
      )
      const target = own["data-stage-target"] as PanelStage
      return renderPart(
        "button",
        mergeProps(
          {
            ...joinHandlers(own, {
              onClick: () => ctx.send({ type: "STAGE", stage: target }),
              onFocusin: () => (focused.value = true),
              onFocusout: () => (focused.value = false),
            }),
            ref: refTo(el),
          },
          attrs,
        ),
        children,
        props.asChild,
      )
    }
  },
})

/** A pointer handle on an edge or corner (`axis`); hidden from assistive technology. */
const ResizeTrigger = defineComponent({
  name: "FloatingPanelResizeTrigger",
  inheritAttrs: false,
  props: {
    ...asChildProp,
    /** The edge or corner it moves. */
    axis: { type: String as PropType<ResizeAxis>, required: true },
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePanel("ResizeTrigger")
    return () =>
      renderPart(
        "div",
        mergeProps(
          joinHandlers(normalizeProps(ctx.api().resizeTrigger(props.axis)), {
            onPointerdown: (e: PointerEvent) => ctx.startDrag(e, props.axis),
          }),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

export {
  Body,
  Content,
  Control,
  Description,
  DragTrigger,
  Header,
  Positioner,
  ResizeTrigger,
  Root,
  StageTrigger,
  Title,
}
