// Splitter parts: wiring only. The machine owns the sizes (percent), connect every attribute.
// Here the Root measures the panels' space for pixel constraints and the pointer scale, and a
// Handle's press is measured once by pointer-drag on the Root, then each move fraction is
// turned into a percent delta from the press.
import {
  blurEvent,
  type ChangeDetails,
  describeKey,
  focusEvent,
  focusSafely,
  isDragPress,
  type Modality,
  pointerDragSession,
  resolveConstraints,
  type SplitterCommitDetails,
  type SplitterConstraints,
  type SplitterDragMessage,
  type SplitterEvent,
  type SplitterOrientation,
  type SplitterPanel,
  sameConstraints,
  splitterConnect,
  splitterDelta,
  splitterDragAxis,
  splitterKeyEvent,
  splitterMachine,
  splitterSizes,
  warnUnnamedHandle,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { changeEmitter } from "../emit-change"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

export interface SplitterState {
  readonly sizes: readonly number[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly orientation: SplitterOrientation
}

interface Ctx {
  readonly api: () => ReturnType<typeof splitterConnect>
  readonly state: () => SplitterState
  readonly send: (e: SplitterEvent) => void
  readonly handles: (Element | null)[]
  readonly press: (e: PointerEvent) => boolean
  readonly setHandleDisabled: (index: number, disabled: boolean | undefined) => void
  readonly orientation: () => SplitterOrientation
  readonly dir: () => "ltr" | "rtl"
}
const SplitterKey: InjectionKey<Ctx> = Symbol("rind-ui.splitter")
function useSplitter(part: string): Ctx {
  const ctx = inject(SplitterKey, null)
  if (!ctx) throw new Error(`Splitter.${part} must be inside Splitter.Root`)
  return ctx
}

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

type Slots = SlotsType<{ default?: (state: SplitterState) => VNodeChild }>

/** Resizable panels on one axis (APG Window Splitter). */
const Root = defineComponent({
  name: "SplitterRoot",
  inheritAttrs: false,
  props: {
    /** One entry per panel: `min`, `max`, `collapsible`, `collapsedSize`. */
    panels: { type: Array as PropType<readonly SplitterPanel[]>, required: true },
    /** Controlled sizes in percent, one per panel, summing to 100 (`v-model:sizes`). */
    sizes: Array as PropType<readonly number[]>,
    /** Uncontrolled initial sizes (default an equal split). */
    defaultSizes: Array as PropType<readonly number[]>,
    /** The panel axis. Default: `horizontal` (side by side). */
    orientation: { type: String as PropType<SplitterOrientation>, default: "horizontal" },
    /** Percent per arrow key. Default: 5. */
    step: Number,
    /** No handle moves or is focusable. */
    disabled: Boolean,
    /** Reading direction; mirrors a horizontal Splitter. Default: the provider's. */
    dir: String as PropType<"ltr" | "rtl">,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** Every change (each pointer move); not when the parent changes `sizes`. */
    sizesChange: (_sizes: readonly number[], _details: ChangeDetails<SplitterEvent>) => true,
    "update:sizes": (_sizes: readonly number[]) => true,
    /** Once at the end of each interaction that changed the sizes: the hook to save a layout. */
    sizesCommit: (_sizes: readonly number[], _details: SplitterCommitDetails) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment()
    const instance = useRootId(() => props.id)
    const locale = useLocale(
      () => undefined,
      () => props.dir,
    )
    const vertical = () => props.orientation === "vertical"
    const root = shallowRef<Element | null>(null)
    const handles: (Element | null)[] = []
    const layout = shallowRef<{ space: number; scale: number } | null>(null)
    // Same content, same array: the machine's onProps compares content anyway.
    let constraints: SplitterConstraints[] = resolveConstraints(props.panels, null)
    const panels = computed(() => {
      const resolved = resolveConstraints(props.panels, layout.value?.space ?? null)
      if (!sameConstraints(constraints, resolved)) constraints = resolved
      return constraints
    })
    const handleDisabled = shallowRef<readonly boolean[]>([])
    const setHandleDisabled = (index: number, off: boolean | undefined) => {
      const prev = handleDisabled.value
      if ((prev[index] === true) === (off === true)) return
      const next = [...prev]
      next[index] = off === true
      handleDisabled.value = next
    }
    const drag = pointerDragSession()
    let pressed: number | null = null
    const focusHandle = (index: number, modality: Modality) => {
      const el = handles[index]
      if (el instanceof HTMLElement) void focusSafely(el, env, "programmatic", modality)
    }
    const onSizesChange = changeEmitter<readonly number[], SplitterEvent>(
      (v, d) => emit("sizesChange", v, d),
      (v) => emit("update:sizes", v),
    )
    const machineProps = () => ({
      sizes: props.sizes,
      defaultSizes: props.defaultSizes,
      panels: panels.value,
      step: props.step,
      disabled: props.disabled,
      handleDisabled: handleDisabled.value,
      onSizesChange,
      onSizesCommit: (v: readonly number[], d: SplitterCommitDetails) => emit("sizesCommit", v, d),
    })
    const { view, send } = useMachine(splitterMachine, machineProps, {
      drag: {
        track: (forward: (m: SplitterDragMessage) => void) =>
          drag.track((m) => {
            if (m.type !== "move") return forward(m)
            if (pressed === null) return
            forward({
              type: "move",
              delta: splitterDelta(
                pressed,
                m.fraction,
                props.orientation,
                layout.value?.scale ?? 1,
              ),
            })
          }),
      },
      focusHandle,
    })
    const current = computed(() => splitterSizes(machineProps(), view.value.values.sizes))
    const focused = () => view.value.context.focused
    const modality = useModality(env.modality, () => focused() !== null)
    const dragging = () => view.value.matches("dragging")
    const api = computed(() =>
      splitterConnect({
        instance: instance(),
        orientation: props.orientation,
        dir: locale.value.dir,
        sizes: current.value,
        panels: panels.value,
        disabled: props.disabled,
        handleDisabled: handleDisabled.value,
        focused: focused(),
        modality: modality.value,
        draggingHandle: dragging() ? view.value.context.handle : null,
      }),
    )
    // The panels' space: pixel constraints and the pointer scale follow every resize (RRP#720).
    onMounted(() =>
      watch(
        vertical,
        (v, _old, onCleanup) => {
          const el = root.value
          if (!(el instanceof HTMLElement)) return
          const update = () => {
            const next = measure(el, handles, v)
            const prev = layout.value
            if (prev?.space !== next?.space || prev?.scale !== next?.scale) layout.value = next
          }
          update()
          const win = el.ownerDocument.defaultView
          if (!win || typeof win.ResizeObserver !== "function") return
          const observer = new win.ResizeObserver(update)
          observer.observe(el)
          for (const h of handles) if (h) observer.observe(h)
          onCleanup(() => observer.disconnect())
        },
        { immediate: true },
      ),
    )
    const state = (): SplitterState => ({
      sizes: current.value,
      dragging: dragging(),
      disabled: props.disabled,
      orientation: props.orientation,
    })
    provide(SplitterKey, {
      api: () => api.value,
      state,
      send,
      handles,
      orientation: () => props.orientation,
      dir: () => locale.value.dir,
      setHandleDisabled,
      press: (e) => {
        const el = root.value
        if (!(el instanceof HTMLElement) || !isDragPress(e) || drag.active) return false
        pressed = drag.press(
          el,
          e,
          splitterDragAxis({ orientation: props.orientation, dir: locale.value.dir }),
        )
        return true
      },
    })
    return () =>
      renderPart(
        "div",
        mergeProps({ ...normalizeProps(api.value.root()), ref: refTo(root) }, attrs),
        slots.default?.(state()),
        props.asChild,
      )
  },
})

/** Panel `index`: its size is `flex-grow` on a zero basis. */
const Panel = defineComponent({
  name: "SplitterPanel",
  inheritAttrs: false,
  props: {
    /** The panel's index in the Root's `panels` (known on the server). */
    index: { type: Number, required: true },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSplitter("Panel")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(ctx.api().panel(props.index)), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

/** The focusable `separator` between panel `index` and the next one. */
const Handle = defineComponent({
  name: "SplitterHandle",
  inheritAttrs: false,
  props: {
    /** The boundary after panel `index` (its primary panel). */
    index: { type: Number, required: true },
    /** Disables this handle only. */
    disabled: { type: Boolean, default: undefined },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useSplitter("Handle")
    const env = useEnvironment()
    onMounted(() => {
      watch(
        () => [props.index, props.disabled] as const,
        ([index, disabled], old) => {
          if (old && old[0] !== index) ctx.setHandleDisabled(old[0], false)
          ctx.setHandleDisabled(index, disabled)
        },
        { immediate: true },
      )
      watch(
        () =>
          [
            props.index,
            attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined,
          ] as const,
        ([index, named]) => warnUnnamedHandle(index, named),
        { immediate: true },
      )
      // The modality tracker must see the pointerdown that comes before the handle's focus.
      onBeforeUnmount(env.modality.subscribe(() => {}))
    })
    onBeforeUnmount(() => ctx.setHandleDisabled(props.index, false))
    const setEl = (node: unknown) => {
      ctx.handles[props.index] = node instanceof Element ? node : null
    }
    return () => {
      const index = props.index
      return renderPart(
        "div",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(ctx.api().handle(index, { disabled: props.disabled })), {
              onPointerdown: (e: PointerEvent) => {
                const el = e.currentTarget
                if (!(el instanceof Element) || el.hasAttribute("data-disabled") || !ctx.press(e))
                  return
                // No text selection and no native focus: the machine focuses without a ring.
                e.preventDefault()
                ctx.send({
                  type: "POINTER.DOWN",
                  handle: index,
                  modality: e.pointerType === "touch" ? "touch" : "pointer",
                })
              },
              onKeydown: (e: KeyboardEvent) => {
                const event = splitterKeyEvent(describeKey(e, env), index, {
                  orientation: ctx.orientation(),
                  dir: ctx.dir(),
                  dragging: ctx.state().dragging,
                })
                if (!event || e.defaultPrevented) return
                e.preventDefault()
                // Escape ends the drag only: a surrounding layer stays open.
                if (event.type === "DRAG.CANCEL") e.stopPropagation()
                ctx.send(event)
              },
              onFocusin: (e: FocusEvent) => {
                if (e.currentTarget instanceof Element)
                  ctx.send({ ...focusEvent(e.currentTarget, env.modality), handle: index })
              },
              onFocusout: () => ctx.send({ ...blurEvent(env.modality), handle: index }),
            }),
            ref: setEl,
          },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `splitter.parts.ts` re-exports them as the `Splitter` namespace. */
export { Handle, Panel, Root }
