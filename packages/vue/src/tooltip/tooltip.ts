import {
  accessibleNameOf,
  domDelayGroup,
  domHoverIntent,
  domPositioning,
  focusEvent,
  type HoverIntent,
  type PositioningProps,
  type Service,
  type TooltipChangeDetails,
  type TooltipProps,
  tooltipConnect,
  tooltipIds,
  tooltipMachine,
  tooltipPositioning,
} from "@rind-ui/core"
import {
  type ComputedRef,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { keepStyle } from "../keep-style"
import { useParentLayer } from "../layer-context"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart } from "../portal"
import { useEnvironment } from "../provider"
import { asChildProp, elements, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

type View = ReturnType<Service<typeof tooltipMachine>["view"]>

interface Ctx {
  readonly service: Service<typeof tooltipMachine>
  readonly view: ComputedRef<View>
  readonly root: () => string
  readonly props: () => TooltipProps
  readonly type: () => "description" | "label"
  readonly hoverIntent: HoverIntent
  readonly trigger: ShallowRef<HTMLElement | null>
  readonly contentMounted: ShallowRef<boolean>
}

const TooltipKey: InjectionKey<Ctx> = Symbol("rind-ui.tooltip")
function useTooltip(part: string): Ctx {
  const ctx = inject(TooltipKey, null)
  if (!ctx) throw new Error(`Tooltip.${part} must be inside Tooltip.Root`)
  return ctx
}

const isOpen = (ctx: Ctx) => ctx.view.value.values.open

function api(ctx: Ctx, dir?: "ltr" | "rtl") {
  const view = ctx.view.value
  return tooltipConnect(
    {
      instance: ctx.root(),
      open: view.values.open,
      instant: view.context.instant,
      placement: view.context.placement,
      type: ctx.type(),
      contentMounted: ctx.contentMounted.value,
      dir,
      manual: tooltipPositioning(ctx.props()).mode === "manual",
    },
    ctx.service.send,
  )
}

/** What the Root's template ref exposes. */
export interface TooltipActions {
  open(): void
  close(): void
}

export interface TooltipTriggerState {
  readonly open: boolean
}

export interface TooltipContentState {
  readonly open: boolean
}

type Slots<S = undefined> = SlotsType<{
  default?: S extends undefined ? () => VNodeChild : (state: S) => VNodeChild
}>

const Root = defineComponent({
  name: "TooltipRoot",
  props: {
    /** Controlled visibility (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: undefined },
    /** Default 700 ms. */
    openDelay: Number,
    /** Default 300 ms. */
    closeDelay: Number,
    /** The delay group's warm window after this tooltip closes (default 300 ms; 0: none). */
    skipDelay: Number,
    /** Pressing the trigger closes it (default true). */
    closeOnPress: { type: Boolean, default: undefined },
    disabled: { type: Boolean, default: undefined },
    positioning: Object as PropType<PositioningProps>,
    /** Base for the ids of the tooltip's parts. Default: generated. */
    id: String,
    /** `description` (default): the text describes the trigger. `label`: it names it. */
    type: { type: String as PropType<"description" | "label">, default: "description" },
  },
  emits: {
    openChange: (_open: boolean, _details: TooltipChangeDetails) => true,
    "update:open": (_open: boolean) => true,
  },
  slots: Object as Slots<{ open: boolean }>,
  setup(props, { slots, emit, expose }) {
    const root = useRootId(() => props.id)
    const parent = useParentLayer()
    const env = useEnvironment()
    // Positioning, hover intent and the delay group only for components that use them.
    const tooltipEnv = {
      ...env,
      position: domPositioning(env),
      hoverIntent: domHoverIntent(env),
      delayGroup: domDelayGroup(env),
    }
    // The trigger by reference: a rind-ui part used as the trigger keeps its own id.
    const trigger = shallowRef<HTMLElement | null>(null)
    // As changeEmitter, for the tooltip's own details type (its reasons are the tooltip's).
    const onOpenChange = (v: boolean, d: TooltipChangeDetails) => {
      let cancelled = false
      emit("openChange", v, {
        ...d,
        cancel() {
          cancelled = true
          d.cancel()
        },
      })
      if (!cancelled) emit("update:open", v)
    }
    const machineProps = (): TooltipProps => ({
      open: props.open,
      defaultOpen: props.defaultOpen,
      onOpenChange,
      openDelay: props.openDelay,
      closeDelay: props.closeDelay,
      skipDelay: props.skipDelay,
      closeOnPress: props.closeOnPress,
      disabled: props.disabled,
      positioning: props.positioning,
      root: root(),
      parent: parent(),
      getTrigger: () => trigger.value,
    })
    const { view, send, service } = useMachine(tooltipMachine, machineProps, tooltipEnv)
    expose({
      open: () => send({ type: "OPEN" }),
      close: () => send({ type: "CLOSE" }),
    } satisfies TooltipActions)
    provide(TooltipKey, {
      service,
      view,
      root,
      props: machineProps,
      type: () => props.type,
      hoverIntent: tooltipEnv.hoverIntent,
      trigger,
      contentMounted: shallowRef(false),
    })
    return () => slots.default?.({ open: view.value.values.open })
  },
})

/** Development warnings about the trigger and the content, once per mount (design §6). */
function useDevWarnings(ctx: Ctx) {
  if (process.env.NODE_ENV === "production") return
  onMounted(() =>
    // Re-run once the (portalled) content mounted: it is what the content checks read.
    watch(
      [() => ctx.trigger.value, () => ctx.contentMounted.value] as const,
      ([el, mounted]) => {
        if (!el || !mounted) return
        const name = `tooltip #${el.id}`
        if (el.matches(":disabled")) {
          console.warn(
            `[rind-ui] ${name}: the trigger is disabled, so it cannot be focused or hovered; use focusableWhenDisabled (aria-disabled)`,
          )
        } else if (el.tabIndex < 0) {
          console.warn(
            `[rind-ui] ${name}: the trigger is not focusable; keyboard users never see it`,
          )
        }
        if (ctx.type() === "label" && el.hasAttribute("aria-label")) {
          console.warn(
            `[rind-ui] ${name}: aria-label on a type="label" trigger is ignored by assistive technology (aria-labelledby wins)`,
          )
        }
        const content = el.ownerDocument.getElementById(tooltipIds(ctx.root()).content)
        if (!content) return
        // Hidden closed content still holds what it will show: any tabbable descendant.
        const tabbable = content.querySelector<HTMLElement>(
          "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
        )
        if (tabbable) {
          console.warn(
            `[rind-ui] ${name}: its content contains a tabbable element (${tabbable.tagName.toLowerCase()}); tooltips are never focused — use a Hover Card or a Popover`,
          )
        }
        if (ctx.type() === "description") {
          const text = (content.textContent ?? "").trim()
          if (text !== "" && text === accessibleNameOf(el).trim()) {
            console.warn(
              `[rind-ui] ${name}: the description repeats the trigger's name; use type="label"`,
            )
          }
        }
      },
      { immediate: true, flush: "post" },
    ),
  )
}

const Trigger = defineComponent({
  name: "TooltipTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<TooltipTriggerState>,
  setup(props, { attrs, slots }) {
    const ctx = useTooltip("Trigger")
    const env = useEnvironment()
    // The modality tracker needs a subscriber while the trigger is mounted.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const hovered = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    useDevWarnings(ctx)
    const hover = ctx.hoverIntent.triggerProps((e) => ctx.service.send(e))
    const el = shallowRef<Element | null>(null)
    const setEl = (node: unknown) => {
      refTo(el)(node)
      ctx.trigger.value = el.value instanceof HTMLElement ? el.value : null
    }
    return () => {
      const children = slots.default?.({ open: isOpen(ctx) })
      // Rendered through a component (a Switch, an icon button): it keeps its own identity.
      const child = props.asChild ? elements(children ?? null)[0] : undefined
      const foreign = child !== undefined && typeof child.type !== "string"
      const {
        "aria-describedby": describedBy,
        "aria-labelledby": labelledBy,
        ...rest
      } = attrs as Record<string, unknown>
      const a = api(ctx)
      const own = normalizeProps(
        a.trigger(
          {
            focused: focused.value,
            hovered: hovered.value,
            modality: modality.value,
            describedBy: describedBy as string | undefined,
            labelledBy: labelledBy as string | undefined,
            foreign,
          },
          hover,
        ),
      )
      const merged = mergeProps(
        {
          ...joinHandlers(own, {
            onPointermove: (e: PointerEvent) => {
              if (e.pointerType === "mouse" || e.pointerType === "pen") hovered.value = true
            },
            onPointerleave: () => (hovered.value = false),
            onPointerdown: (e: PointerEvent) =>
              a.pressStart(e.pointerType === "mouse" || e.pointerType === "pen"),
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") a.pressStart(false)
            },
            // Assistive technology activates with a bare click (no pointer or key events).
            onClick: (e: MouseEvent) => {
              if (e.detail === 0) a.pressStart(false)
            },
            onFocus: (e: FocusEvent) => {
              focused.value = true
              const f = focusEvent(e.currentTarget as Element, env.modality)
              a.focus(f.modality, f.cause)
            },
            onBlur: () => {
              focused.value = false
              a.blur()
            },
          }),
          ref: setEl,
        },
        rest,
      )
      return renderPart("button", merged, children, props.asChild)
    }
  },
})

/** The anchor's direction: the portalled positioner carries it (inline sides, RTL). */
function useTriggerDir(ctx: Ctx) {
  const dir = shallowRef<"ltr" | "rtl" | undefined>(undefined)
  onMounted(() =>
    watch(
      () => isOpen(ctx),
      (open) => {
        if (!open) return
        const found = ctx.trigger.value?.closest("[dir]")?.getAttribute("dir")
        dir.value = found === "rtl" ? "rtl" : "ltr"
      },
      { immediate: true, flush: "post" },
    ),
  )
  return dir
}

/** Always mounted (the description exists while closed); hidden once the exit ends. */
function usePart(ctx: Ctx) {
  const el = shallowRef<Element | null>(null)
  const presence = usePresence(() => isOpen(ctx), el, {
    keepMounted: () => true,
    subtree: () => true,
  })
  // Hidden only once presence is over: the update that closes is still "present", and hiding
  // there would cut the exit animation.
  return { el, hidden: () => !isOpen(ctx) && presence.state === "absent" }
}

const Positioner = defineComponent({
  name: "TooltipPositioner",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTooltip("Positioner")
    const dir = useTriggerDir(ctx)
    const part = usePart(ctx)
    // Positioning writes to this element's style too.
    const kept = keepStyle()
    return () => {
      const merged = mergeProps(
        {
          ...normalizeProps(api(ctx, dir.value).positioner()),
          hidden: part.hidden(),
          ref: refTo(part.el),
        },
        attrs,
      )
      return kept(merged, (p) => renderPart("div", p, slots.default?.(), props.asChild))
    }
  },
})

const Content = defineComponent({
  name: "TooltipContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<TooltipContentState>,
  setup(props, { attrs, slots }) {
    const ctx = useTooltip("Content")
    const part = usePart(ctx)
    // Referenced by the trigger only once it exists: a portalled content mounts after
    // hydration, so the server markup never has a dangling IDREF.
    onMounted(() => (ctx.contentMounted.value = true))
    onBeforeUnmount(() => (ctx.contentMounted.value = false))
    return () =>
      renderPart(
        "div",
        mergeProps(
          { ...normalizeProps(api(ctx).content()), hidden: part.hidden(), ref: refTo(part.el) },
          attrs,
        ),
        slots.default?.({ open: isOpen(ctx) }),
        props.asChild,
      )
  },
})

const Arrow = defineComponent({
  name: "TooltipArrow",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useTooltip("Arrow")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(api(ctx).arrow()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

/** The Portal with the trigger as its logical parent: the host carries its theme, dir and lang. */
const Portal = defineComponent({
  name: "TooltipPortal",
  inheritAttrs: false,
  slots: Object as Slots,
  setup(_, { attrs, slots }) {
    const ctx = useTooltip("Portal")
    const logicalParent = () => ctx.trigger.value
    // Closed tooltips cost nothing: the host follows the trigger's theme only while open.
    return () => h(PortalPart, { logicalParent, observe: isOpen(ctx), ...attrs }, slots)
  },
})

/** The parts, by name: `tooltip.parts.ts` re-exports them as the `Tooltip` namespace. */
export { Arrow, Content, Portal, Positioner, Root, Trigger }
