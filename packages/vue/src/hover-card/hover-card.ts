import {
  domHoverIntent,
  domPositioning,
  focusEvent,
  getLayerStack,
  type HoverCardChangeDetails,
  type HoverCardProps,
  type HoverIntent,
  hoverCardConnect,
  hoverCardLayerId,
  hoverCardMachine,
  hoverCardPositioning,
  type LayerMeta,
  type PositioningProps,
  type Service,
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
import { provideLayer, useParentLayer } from "../layer-context"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart } from "../portal"
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

type View = ReturnType<Service<typeof hoverCardMachine>["view"]>

interface Ctx {
  readonly service: Service<typeof hoverCardMachine>
  readonly view: ComputedRef<View>
  readonly root: () => string
  readonly props: () => HoverCardProps
  readonly keepMounted: () => boolean
  readonly hoverIntent: HoverIntent
  readonly trigger: ShallowRef<HTMLElement | null>
  readonly contentMounted: ShallowRef<boolean>
  /** The stack's metadata for this layer, followed while shown. */
  readonly meta: ShallowRef<LayerMeta | undefined>
}

const HoverCardKey: InjectionKey<Ctx> = Symbol("rind-ui.hover-card")
function useHoverCard(part: string): Ctx {
  const ctx = inject(HoverCardKey, null)
  if (!ctx) throw new Error(`HoverCard.${part} must be inside HoverCard.Root`)
  return ctx
}

const isOpen = (ctx: Ctx) => ctx.view.value.values.open === true

function api(ctx: Ctx, extra: { dir?: "ltr" | "rtl"; focusWithin?: boolean } = {}) {
  const view = ctx.view.value
  return hoverCardConnect(
    {
      instance: ctx.root(),
      open: view.values.open === true,
      placement: view.context.placement,
      closeReason: view.context.closeReason,
      contentMounted: ctx.contentMounted.value,
      meta: ctx.meta.value,
      manual: hoverCardPositioning(ctx.props()).mode === "manual",
      ...extra,
    },
    ctx.service.send,
  )
}

/** What the Root's template ref exposes. */
export interface HoverCardActions {
  open(): void
  close(): void
}

export interface HoverCardTriggerState {
  readonly open: boolean
}

export interface HoverCardContentState {
  readonly open: boolean
}

type Slots<S = undefined> = SlotsType<{
  default?: S extends undefined ? () => VNodeChild : (state: S) => VNodeChild
}>

const Root = defineComponent({
  name: "HoverCardRoot",
  props: {
    /** Controlled visibility (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: undefined },
    /** Default 700 ms. */
    openDelay: Number,
    /** Default 300 ms. */
    closeDelay: Number,
    disabled: { type: Boolean, default: undefined },
    positioning: Object as PropType<PositioningProps>,
    /** Base for the ids of the hover card's parts. Default: generated. */
    id: String,
    /** Positioner and content stay mounted (hidden) while closed. */
    keepMounted: Boolean,
  },
  emits: {
    openChange: (_open: boolean, _details: HoverCardChangeDetails) => true,
    "update:open": (_open: boolean) => true,
  },
  slots: Object as Slots<{ open: boolean }>,
  setup(props, { slots, emit, expose }) {
    const root = useRootId(() => props.id)
    const parent = useParentLayer()
    const env = useEnvironment()
    const hoverEnv = { ...env, position: domPositioning(env), hoverIntent: domHoverIntent(env) }
    const trigger = shallowRef<HTMLElement | null>(null)
    // As changeEmitter, for the hover card's own details type (its reasons are the card's).
    const onOpenChange = (v: boolean, d: HoverCardChangeDetails) => {
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
    const machineProps = (): HoverCardProps => ({
      open: props.open,
      defaultOpen: props.defaultOpen,
      onOpenChange,
      openDelay: props.openDelay,
      closeDelay: props.closeDelay,
      disabled: props.disabled,
      positioning: props.positioning,
      root: root(),
      parent: parent(),
      getTrigger: () => trigger.value,
    })
    const { view, send, service } = useMachine(hoverCardMachine, machineProps, hoverEnv)
    expose({
      open: () => send({ type: "OPEN" }),
      close: () => send({ type: "CLOSE" }),
    } satisfies HoverCardActions)
    const meta = shallowRef<LayerMeta | undefined>(undefined)
    onMounted(() =>
      watch(
        [() => view.value.values.open === true, root] as const,
        ([open, id], _, onCleanup) => {
          meta.value = undefined
          if (!open) return
          const node = env.dom.getRootNode()
          const stack = getLayerStack("body" in node ? node : node.ownerDocument)
          const read = () => (meta.value = stack.get(hoverCardLayerId(id))?.meta())
          read()
          onCleanup(stack.subscribe(read))
        },
        { immediate: true },
      ),
    )
    provide(HoverCardKey, {
      service,
      view,
      root,
      props: machineProps,
      keepMounted: () => props.keepMounted,
      hoverIntent: hoverEnv.hoverIntent,
      trigger,
      contentMounted: shallowRef(false),
      meta,
    })
    return () => slots.default?.({ open: view.value.values.open === true })
  },
})

/** The link that previews: it keeps its role and href. */
const Trigger = defineComponent({
  name: "HoverCardTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<HoverCardTriggerState>,
  setup(props, { attrs, slots }) {
    const ctx = useHoverCard("Trigger")
    const env = useEnvironment()
    // The modality tracker needs a subscriber while the trigger is mounted.
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const hovered = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const el = shallowRef<Element | null>(null)
    const setEl = (node: unknown) => {
      refTo(el)(node)
      ctx.trigger.value = el.value instanceof HTMLElement ? el.value : null
    }
    // Development: a hover card is a link's preview; a button wants a Popover.
    onMounted(() => {
      const node = el.value
      if (process.env.NODE_ENV === "production" || !node || node.hasAttribute("href")) return
      // A citation marker without a link is a button by design (add-citation §1).
      if (node.getAttribute("data-scope") === "citation") return
      console.warn(
        `[rind-ui] hover-card #${node.id}: the trigger is not a link (no href); a hover card is a link's preview — use a Popover for a button`,
      )
    })
    const hover = ctx.hoverIntent.triggerProps((e) => ctx.service.send(e))
    return () => {
      const a = api(ctx)
      const own = normalizeProps(
        a.trigger(
          { focused: focused.value, hovered: hovered.value, modality: modality.value },
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
        attrs,
      )
      return renderPart("a", merged, slots.default?.({ open: isOpen(ctx) }), props.asChild)
    }
  },
})

/** The trigger's direction: the portalled positioner carries it (inline sides, RTL). */
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

const Positioner = defineComponent({
  name: "HoverCardPositioner",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useHoverCard("Positioner")
    const dir = useTriggerDir(ctx)
    const el = shallowRef<Element | null>(null)
    // It holds the content: it stays while the content's exit animations run.
    const presence = usePresence(() => isOpen(ctx), el, {
      keepMounted: ctx.keepMounted,
      subtree: () => true,
    })
    // Positioning writes to this element's style too.
    const kept = keepStyle()
    return () => {
      if (!presence.mounted) return null
      const merged = mergeProps(
        {
          ...normalizeProps(api(ctx, dir.value ? { dir: dir.value } : {}).positioner()),
          hidden: !isOpen(ctx) && ctx.keepMounted(),
          ref: refTo(el),
        },
        attrs,
      )
      return kept(merged, (p) => renderPart("div", p, slots.default?.(), props.asChild))
    }
  },
})

const Content = defineComponent({
  name: "HoverCardContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<HoverCardContentState>,
  setup(props, { attrs, slots }) {
    const ctx = useHoverCard("Content")
    const env = useEnvironment()
    // Layers opened from here (a select, a nested card) are this card's children.
    provideLayer(
      () => hoverCardLayerId(ctx.root()),
      () => "popover",
    )
    const focusWithin = shallowRef(false)
    const el = shallowRef<Element | null>(null)
    const presence = usePresence(() => isOpen(ctx), el, { keepMounted: ctx.keepMounted })
    onMounted(() =>
      watch(
        () => (presence.mounted ? el.value : null),
        (node, _, onCleanup) => {
          ctx.contentMounted.value = node !== null
          if (!(node instanceof HTMLElement)) return
          onCleanup(() => (ctx.contentMounted.value = false))
          // Focus within, from the DOM (native events plus a frame check), reported to the machine.
          let inside = false
          const report = (now: boolean) => {
            if (now === inside) return
            inside = now
            focusWithin.value = now
            ctx.service.send({ type: now ? "FOCUS_WITHIN.ENTER" : "FOCUS_WITHIN.LEAVE" })
          }
          const sync = () => {
            const active = node.ownerDocument.activeElement
            report(active !== null && node.contains(active))
          }
          const onFocusOut = (e: FocusEvent) => {
            const next = e.relatedTarget as Node | null
            if (next && node.contains(next)) return
            report(false)
          }
          sync()
          const frame = env.scheduler.requestAnimationFrame(sync)
          node.addEventListener("focusin", sync)
          node.addEventListener("focusout", onFocusOut)
          onCleanup(() => {
            env.scheduler.cancelAnimationFrame(frame)
            node.removeEventListener("focusin", sync)
            node.removeEventListener("focusout", onFocusOut)
          })
        },
        { immediate: true, flush: "post" },
      ),
    )
    return () => {
      if (!presence.mounted) return null
      const open = isOpen(ctx)
      const exiting = !open && presence.state === "exiting"
      const {
        "aria-label": label,
        "aria-labelledby": labelledBy,
        ...rest
      } = attrs as Record<string, unknown>
      const merged = mergeProps(
        {
          ...normalizeProps(
            api(ctx, { focusWithin: focusWithin.value }).content({
              label: label as string | undefined,
              labelledBy: labelledBy as string | undefined,
            }),
          ),
          hidden: !open && !exiting && ctx.keepMounted(),
          ...(exiting ? { inert: "" } : {}),
          ref: refTo(el),
        },
        rest,
      )
      return renderPart("div", merged, slots.default?.({ open }), props.asChild)
    }
  },
})

const Arrow = defineComponent({
  name: "HoverCardArrow",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useHoverCard("Arrow")
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
  name: "HoverCardPortal",
  inheritAttrs: false,
  slots: Object as Slots,
  setup(_, { attrs, slots }) {
    const ctx = useHoverCard("Portal")
    const logicalParent = () => ctx.trigger.value
    return () => h(PortalPart, { logicalParent, ...attrs }, slots)
  },
})

/** The parts, by name: `hover-card.parts.ts` re-exports them as the `HoverCard` namespace. */
export { Arrow, Content, Portal, Positioner, Root, Trigger }
