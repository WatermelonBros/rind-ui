import {
  type ChangeDetails,
  domPositioning,
  type FocusTarget,
  getLayerStack,
  type HeadingLevel,
  type LayerMeta,
  type MessageOverrides,
  type Modality,
  type PopoverCloseReason,
  type PopoverDismissEvent,
  type PopoverEvent,
  type PopoverMessages,
  type PopoverProps,
  type PositioningProps,
  partId,
  popoverConnect,
  popoverIds,
  popoverLayerId,
  popoverMachine,
  popoverMessages,
  popoverPositioning,
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
  onUpdated,
  type PropType,
  provide,
  type ShallowRef,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { changeEmitter } from "../emit-change"
import { provideHeadingSection } from "../heading/heading"
import { joinHandlers } from "../join-handlers"
import { keepStyle } from "../keep-style"
import { provideLayer, useParentLayer } from "../layer-context"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart } from "../portal"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderedTag, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    popover: PopoverMessages
  }
}

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }
type View = ReturnType<Service<typeof popoverMachine>["view"]>

interface Ctx {
  readonly service: Service<typeof popoverMachine>
  readonly view: ComputedRef<View>
  readonly root: () => string
  readonly scope: () => string
  readonly props: () => PopoverProps
  readonly keepMounted: () => boolean
  readonly messages: ComputedRef<PopoverMessages>
  readonly contentMounted: ShallowRef<boolean>
  readonly anchorRendered: ShallowRef<boolean>
  readonly titleLevel: ShallowRef<HeadingLevel>
  readonly rendered: ShallowRef<Rendered>
  /** The stack's metadata for this layer, followed while open. */
  readonly meta: ShallowRef<LayerMeta | undefined>
}

const PopoverKey: InjectionKey<Ctx> = Symbol("rind-ui.popover")
function usePopover(part: string): Ctx {
  const ctx = inject(PopoverKey, null)
  if (!ctx) throw new Error(`Popover.${part} must be inside Popover.Root`)
  return ctx
}

/**
 * For components composed on the Popover (Date Field's picker): the enclosing Popover's open
 * state and its machine's `send`, or null outside one. Not exported from the package.
 */
export function usePopoverControls(): {
  readonly open: () => boolean
  readonly send: Service<typeof popoverMachine>["send"]
} | null {
  const ctx = inject(PopoverKey, null)
  return ctx ? { open: () => ctx.view.value.matches("open"), send: ctx.service.send } : null
}

const isOpen = (ctx: Ctx) => ctx.view.value.matches("open")

function api(
  ctx: Ctx,
  extra: {
    dir?: "ltr" | "rtl"
    focusWithin?: boolean
    contentFocused?: boolean
    modality?: Parameters<typeof popoverConnect>[0]["modality"]
  } = {},
) {
  const view = ctx.view.value
  const props = ctx.props()
  return popoverConnect(
    {
      instance: ctx.root(),
      scope: ctx.scope(),
      open: view.matches("open"),
      modal: props.modal === true,
      disabled: props.disabled,
      placement: view.context.placement,
      closeReason: view.context.closeReason,
      rendered: ctx.rendered.value,
      contentMounted: ctx.contentMounted.value,
      anchorRendered: ctx.anchorRendered.value,
      meta: ctx.meta.value,
      manual: popoverPositioning(props).mode === "manual",
      ...extra,
      messages: ctx.messages.value,
    },
    ctx.service.send,
  )
}

/** What the Root's template ref exposes. */
export interface PopoverActions {
  open(): void
  close(): void
  /** Recomputes the position (a moved anchor the tracking cannot see). */
  reposition(): void
}

export interface PopoverTriggerState {
  readonly open: boolean
}

export interface PopoverContentState {
  readonly open: boolean
}

type Slots<S = undefined> = SlotsType<{
  default?: S extends undefined ? () => VNodeChild : (state: S) => VNodeChild
}>

const Root = defineComponent({
  name: "PopoverRoot",
  props: {
    /** Controlled visibility (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: undefined },
    /** Default false. */
    modal: { type: Boolean, default: undefined },
    disabled: { type: Boolean, default: undefined },
    /** Default true. */
    closeOnEscape: { type: Boolean, default: undefined },
    /** Default true. */
    closeOnInteractOutside: { type: Boolean, default: undefined },
    /** Elements whose presses and focus count as inside (a toast). */
    persistentElements: Function as PropType<() => readonly Element[]>,
    /** `false`: focus stays; `null` or a function returning null: the default rule. */
    initialFocus: { type: Function as PropType<(() => FocusTarget) | null>, default: undefined },
    /** `false`: focus does not move back; `null`: the trigger. */
    finalFocus: {
      type: [Function, Boolean] as PropType<
        ((reason: PopoverCloseReason | undefined) => FocusTarget) | null | false
      >,
      default: undefined,
    },
    /** Side, align, offsets, flip, shift, size, arrow and mode (`manual` for CSS anchor positioning). */
    positioning: Object as PropType<PositioningProps>,
    /** Base for the ids of the popover's parts. Default: generated. */
    id: String,
    /** Positioner and content stay mounted (hidden) while closed. */
    keepMounted: Boolean,
    messages: Object as PropType<MessageOverrides<PopoverMessages>>,
    /** The parts' `data-scope`, for composites (Table's filters): internal. */
    scope: String,
  },
  emits: {
    openChange: (_open: boolean, _details: ChangeDetails<PopoverEvent>) => true,
    "update:open": (_open: boolean) => true,
    /** Escape is about to close it; `event.preventDefault()` keeps it open. */
    escapeKeyDown: (_event: PopoverDismissEvent) => true,
    /** A press or focus outside is about to close it; `event.preventDefault()` keeps it open. */
    interactOutside: (_event: PopoverDismissEvent) => true,
  },
  slots: Object as Slots<{ open: boolean }>,
  setup(props, { slots, emit, expose }) {
    const root = useRootId(() => props.id)
    const parent = useParentLayer()
    const messages = useMessages("popover", popoverMessages, () => props.messages)
    const env = useEnvironment()
    // Positioning only for anchored components: not part of domEnvironment().
    const withPosition = { ...env, position: domPositioning(env) }
    const anchorRendered = shallowRef(false)
    const onOpenChange = changeEmitter<boolean, PopoverEvent>(
      (v, d) => emit("openChange", v, d),
      (v) => emit("update:open", v),
    )
    const machineProps = (): PopoverProps => ({
      open: props.open,
      defaultOpen: props.defaultOpen,
      onOpenChange,
      modal: props.modal,
      disabled: props.disabled,
      closeOnEscape: props.closeOnEscape,
      closeOnInteractOutside: props.closeOnInteractOutside,
      onEscapeKeyDown: (e) => emit("escapeKeyDown", e),
      onInteractOutside: (e) => emit("interactOutside", e),
      persistentElements: props.persistentElements,
      initialFocus: props.initialFocus,
      finalFocus: props.finalFocus,
      positioning: props.positioning,
      root: root(),
      parent: parent(),
      anchored: anchorRendered.value,
      scope: props.scope,
    })
    const { view, send, service } = useMachine(popoverMachine, machineProps, withPosition)
    expose({
      open: () => send({ type: "open" }),
      close: () => send({ type: "api", close: true }),
      reposition: () => send({ type: "POSITION.REPOSITION" }),
    } satisfies PopoverActions)
    const meta = shallowRef<LayerMeta | undefined>(undefined)
    onMounted(() =>
      watch(
        () => [view.value.matches("open"), root()] as const,
        ([open, id], _, onCleanup) => {
          meta.value = undefined
          if (!open) return
          const node = env.dom.getRootNode()
          const stack = getLayerStack("body" in node ? node : node.ownerDocument)
          const read = () => (meta.value = stack.get(popoverLayerId(id))?.meta())
          read()
          onCleanup(stack.subscribe(read))
        },
        { immediate: true },
      ),
    )
    provide(PopoverKey, {
      service,
      view,
      root,
      scope: () => props.scope ?? "popover",
      props: machineProps,
      keepMounted: () => props.keepMounted,
      messages,
      contentMounted: shallowRef(false),
      anchorRendered,
      titleLevel: shallowRef<HeadingLevel>(2),
      rendered: shallowRef<Rendered>({}),
      meta,
    })
    return () => slots.default?.({ open: view.value.matches("open") })
  },
})

/** Focus and modality of a button part, plus its press. */
function useButton(onPress: (modality: Modality) => void, disabled: () => boolean = () => false) {
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the button is mounted.
  onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
  const focused = shallowRef(false)
  const modality = useModality(env.modality, () => focused.value)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(e.modality)
    },
    disabled,
  })
  const handlers = {
    onFocus: () => (focused.value = true),
    onBlur: () => (focused.value = false),
  }
  return { focused, modality, press, handlers }
}

const Trigger = defineComponent({
  name: "PopoverTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<PopoverTriggerState>,
  setup(props, { attrs, slots }) {
    const ctx = usePopover("Trigger")
    const b = useButton(
      (m) => api(ctx).pressTrigger(m),
      () => ctx.props().disabled === true,
    )
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const children = slots.default?.({ open: isOpen(ctx) })
      const tag = renderedTag("button", children, props.asChild, measured.value)
      const own = normalizeProps(
        api(ctx).trigger({
          focused: b.focused.value,
          modality: b.modality.value,
          pressed: b.press.pressed.value,
          tag,
        }),
      )
      const merged = mergeProps(
        { ...joinHandlers(own, b.press.props, b.handlers), ref: refTo(el) },
        attrs,
      )
      return renderPart("button", merged, children, props.asChild)
    }
  },
})

/** Optional: positions the content against this element instead of the trigger. */
const Anchor = defineComponent({
  name: "PopoverAnchor",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePopover("Anchor")
    onMounted(() => (ctx.anchorRendered.value = true))
    onBeforeUnmount(() => (ctx.anchorRendered.value = false))
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(api(ctx).anchor()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const Indicator = defineComponent({
  name: "PopoverIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePopover("Indicator")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(api(ctx).indicator()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

/** The anchor's direction: the portalled positioner carries it (inline sides, RTL). */
function useAnchorDir(ctx: Ctx) {
  const dir = shallowRef<"ltr" | "rtl" | undefined>(undefined)
  const env = useEnvironment()
  onMounted(() =>
    watch(
      () => [isOpen(ctx), ctx.anchorRendered.value, ctx.root(), ctx.scope()] as const,
      ([open, anchored, root, scope]) => {
        if (!open) return
        const ids = popoverIds(root, scope)
        const anchor = env.dom.getById(anchored ? ids.anchor : ids.trigger)
        const found = anchor?.closest("[dir]")?.getAttribute("dir")
        dir.value = found === "rtl" ? "rtl" : "ltr"
      },
      { immediate: true, flush: "post" },
    ),
  )
  return dir
}

const Positioner = defineComponent({
  name: "PopoverPositioner",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePopover("Positioner")
    const dir = useAnchorDir(ctx)
    // Positioning and the scroll lock write to this element's style too.
    const kept = keepStyle()
    const el = shallowRef<Element | null>(null)
    // It holds the content: it stays while the content's exit animations run.
    const presence = usePresence(() => isOpen(ctx), el, {
      keepMounted: ctx.keepMounted,
      subtree: () => true,
    })
    return () => {
      if (!presence.mounted) return null
      const open = isOpen(ctx)
      const merged = mergeProps(
        {
          ...normalizeProps(api(ctx, dir.value ? { dir: dir.value } : {}).positioner()),
          hidden: !open && ctx.keepMounted(),
          ref: refTo(el),
        },
        attrs,
      )
      return kept(merged, (p) => renderPart("div", p, slots.default?.(), props.asChild))
    }
  },
})

const Content = defineComponent({
  name: "PopoverContent",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots<PopoverContentState>,
  setup(props, { attrs, slots }) {
    const ctx = usePopover("Content")
    const env = useEnvironment()
    // Headings inside the body are one level below the title; layers opened from here are
    // this popover's children.
    provideLayer(
      () => popoverLayerId(ctx.root()),
      () => "popover",
    )
    provideHeadingSection(() => Math.min(6, ctx.titleLevel.value + 1) as HeadingLevel)
    // The scroll lock writes to this element's style too.
    const kept = keepStyle()
    const focusWithin = shallowRef(false)
    const contentFocused = shallowRef(false)
    const modality = useModality(env.modality, () => contentFocused.value)
    const el = shallowRef<Element | null>(null)
    const presence = usePresence(() => isOpen(ctx), el, { keepMounted: ctx.keepMounted })
    onMounted(() =>
      watch(
        () => (presence.mounted ? el.value : null),
        (node, _, onCleanup) => {
          ctx.contentMounted.value = node !== null
          if (!(node instanceof HTMLElement)) return
          onCleanup(() => (ctx.contentMounted.value = false))
          // Focus within, from the DOM itself (as the Dialog: native events plus a frame check).
          const sync = () => {
            const active = node.ownerDocument.activeElement
            focusWithin.value = active !== null && node.contains(active)
            contentFocused.value = active === node
          }
          const onFocusOut = (e: FocusEvent) => {
            const next = e.relatedTarget as Node | null
            if (next && node.contains(next)) return
            focusWithin.value = false
            contentFocused.value = false
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
        "aria-describedby": describedBy,
        ...rest
      } = attrs as Record<string, unknown>
      const own = api(ctx, {
        focusWithin: focusWithin.value,
        contentFocused: contentFocused.value,
        modality: modality.value,
      }).content({
        label: label as string | undefined,
        labelledBy: labelledBy as string | undefined,
        describedBy: describedBy as string | undefined,
      })
      const merged = mergeProps(
        {
          ...normalizeProps(own),
          hidden: !open && !exiting && ctx.keepMounted(),
          ...(exiting ? { inert: "" } : {}),
          ref: refTo(el),
        },
        rest,
      )
      return kept(merged, (p) => renderPart("div", p, slots.default?.({ open }), props.asChild))
    }
  },
})

const Arrow = defineComponent({
  name: "PopoverArrow",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePopover("Arrow")
    return () =>
      renderPart(
        "div",
        mergeProps(normalizeProps(api(ctx).arrow()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

/** Registers a title/description part with the Root while it is mounted. */
function useRegistered(ctx: Ctx, part: "title" | "description") {
  onMounted(() =>
    watch(
      () => partId(ctx.scope(), ctx.root(), part),
      (id, _, onCleanup) => {
        ctx.rendered.value = { ...ctx.rendered.value, [part]: id }
        onCleanup(() => (ctx.rendered.value = { ...ctx.rendered.value, [part]: undefined }))
      },
      { immediate: true },
    ),
  )
}

const Title = defineComponent({
  name: "PopoverTitle",
  inheritAttrs: false,
  props: {
    /** The heading level (default 2); headings in the content are one level below. */
    level: { type: Number as PropType<HeadingLevel>, default: 2 },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePopover("Title")
    useRegistered(ctx, "title")
    watch(
      () => props.level,
      (level) => (ctx.titleLevel.value = level),
      { immediate: true },
    )
    const el = shallowRef<Element | null>(null)
    const measured = shallowRef<string | null>(null)
    const measure = () => (measured.value = el.value?.tagName.toLowerCase() ?? null)
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const children = slots.default?.()
      const fallback = `h${props.level}`
      const tag = renderedTag(fallback, children, props.asChild, measured.value)
      const merged = mergeProps(
        { ...normalizeProps(api(ctx).title({ level: props.level, tag })), ref: refTo(el) },
        attrs,
      )
      return renderPart(fallback, merged, children, props.asChild)
    }
  },
})

const Description = defineComponent({
  name: "PopoverDescription",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePopover("Description")
    useRegistered(ctx, "description")
    return () =>
      renderPart(
        "p",
        mergeProps(normalizeProps(api(ctx).description()), attrs),
        slots.default?.(),
        props.asChild,
      )
  },
})

const CloseTrigger = defineComponent({
  name: "PopoverCloseTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = usePopover("CloseTrigger")
    const b = useButton((m) => api(ctx).pressClose(m))
    const el = shallowRef<Element | null>(null)
    // No content of its own (an icon): named by messages.close.
    const empty = shallowRef(false)
    const measure = () => (empty.value = (el.value?.textContent ?? "").trim() === "")
    onMounted(measure)
    onUpdated(measure)
    return () => {
      const own = normalizeProps(
        api(ctx).closeTrigger({
          focused: b.focused.value,
          modality: b.modality.value,
          pressed: b.press.pressed.value,
          empty: empty.value,
        }),
      )
      const merged = mergeProps(
        { ...joinHandlers(own, b.press.props, b.handlers), ref: refTo(el) },
        attrs,
      )
      return renderPart("button", merged, slots.default?.(), props.asChild)
    }
  },
})

/** The Portal with the trigger as its logical parent: the host carries its theme, dir and lang. */
const Portal = defineComponent({
  name: "PopoverPortal",
  inheritAttrs: false,
  slots: Object as Slots,
  setup(_, { attrs, slots }) {
    const ctx = usePopover("Portal")
    const env = useEnvironment()
    const logicalParent = () => env.dom.getById(popoverIds(ctx.root(), ctx.scope()).trigger)
    return () => h(PortalPart, { logicalParent, ...attrs }, slots)
  },
})

/** The parts, by name: `popover.parts.ts` re-exports them as the `Popover` namespace. */
export {
  Anchor,
  Arrow,
  CloseTrigger,
  Content,
  Description,
  Indicator,
  Portal,
  Positioner,
  Root,
  Title,
  Trigger,
}
