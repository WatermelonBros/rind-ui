import {
  type ContextMenuMessages,
  claimRegionEvent,
  contextMenuMessages,
  contextMenuRegionProps,
  createMenuTree,
  longPress,
  type MenuAnchorDetails,
  type MenuChangeDetails,
  type MenuPoint,
  type MessageOverrides,
  menuIds,
  menuLevelId,
} from "@rind-ui/core"
import {
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  useId,
  type VNodeChild,
  watch,
} from "vue"
import { joinHandlers } from "../join-handlers"
import { levelOptionProps, type MenuLevel, MenuLevelKey, useMenuLevelService } from "../menu/menu"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    "context-menu": ContextMenuMessages
  }
}

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

/** `openChange`'s details, with where and on what the opening gesture happened. */
export type ContextMenuChangeDetails = MenuChangeDetails & {
  readonly point: MenuPoint | null
  readonly target: Element | null
  readonly nativeEvent: Event | null
}

/** What the Root's template ref exposes. */
export interface ContextMenuActions {
  /** Opens it at `point` (viewport coordinates), for `target` (e.g. a document listener). */
  openAt(point: MenuPoint, target?: Element | null): void
  close(): void
}

export interface ContextMenuTriggerState {
  readonly open: boolean
}

interface RegionCtx {
  readonly disabled: () => boolean
  readonly longPress: () => boolean
  readonly longPressDelay: () => number
  readonly messages: () => ContextMenuMessages
}
const RegionKey: InjectionKey<RegionCtx> = Symbol("rind-ui.context-menu")

const detailsOf = (d: MenuChangeDetails): ContextMenuChangeDetails => {
  const e = d.event as { point?: MenuPoint; target?: Element | null; nativeEvent?: Event }
  return {
    ...d,
    point: e.point ?? null,
    target: e.target ?? null,
    nativeEvent: e.nativeEvent ?? null,
  }
}

const Root = defineComponent({
  name: "ContextMenuRoot",
  props: {
    ...levelOptionProps,
    /** Base for the ids of the menu's parts. Default: generated. */
    id: String,
    /** Controlled visibility (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: undefined },
    /** Default true. */
    modal: { type: Boolean, default: true },
    /** The browser's own menu shows instead. */
    disabled: Boolean,
    /** Default true: a touch or pen held on the region opens it. */
    longPress: { type: Boolean, default: true },
    /** Default 500 ms. */
    longPressDelay: { type: Number, default: 500 },
    keepMounted: Boolean,
    messages: Object as PropType<MessageOverrides<ContextMenuMessages>>,
  },
  emits: {
    openChange: (_open: boolean, _details: ContextMenuChangeDetails) => true,
    "update:open": (_open: boolean) => true,
    /** A second gesture in the same region moved the open menu. */
    anchorChange: (_details: MenuAnchorDetails) => true,
  },
  slots: Object as SlotsType<{ default?: (state: { open: boolean }) => VNodeChild }>,
  setup(props, { slots, emit, expose }) {
    const levelId = menuLevelId(useRootId(() => props.id)())
    const messages = useMessages("context-menu", contextMenuMessages, () => props.messages)
    const tree = createMenuTree({ parentKind: "context-menu" })
    const trigger = shallowRef<HTMLElement | null>(null)
    const onOpenChange = (v: boolean, d: MenuChangeDetails) => {
      let cancelled = false
      emit("openChange", v, {
        ...detailsOf(d),
        cancel() {
          cancelled = true
          d.cancel()
        },
      })
      if (!cancelled) emit("update:open", v)
    }
    const s = useMenuLevelService({
      level: "root",
      levelId,
      tree,
      trigger,
      options: () => props,
      controllable: () => ({
        open: props.open,
        defaultOpen: props.defaultOpen,
        onOpenChange,
        modal: props.modal,
      }),
      region: () => ({ onAnchorChange: (d: MenuAnchorDetails) => emit("anchorChange", d) }),
    })
    expose({
      openAt: (point, target = null) => s.send({ type: "OPEN_AT", point, target }),
      close: () => s.send({ type: "CLOSE" }),
    } satisfies ContextMenuActions)
    const open = () => s.view.value.matches("open")
    if (process.env.NODE_ENV !== "production") {
      onMounted(() => {
        // Development: a controlled open with no gesture anchors at the region's corner.
        watch(
          () => props.open,
          (o) => {
            if (o !== true) return
            if (s.service.getSnapshot().context.regionAnchor === null) {
              console.warn(
                `[rind-ui] context-menu ${levelId}: opened without a point; it is placed at the region's top-left corner (use the actions' openAt)`,
              )
            }
          },
          { immediate: true },
        )
        // Development: the menu needs a name of its own (no trigger text names it).
        watch(
          open,
          (o) => {
            if (!o) return
            const content = document.getElementById(menuIds(levelId).content)
            if (
              content &&
              !content.getAttribute("aria-label") &&
              !content.getAttribute("aria-labelledby")
            ) {
              console.warn(
                `[rind-ui] context-menu ${levelId}: the menu has no accessible name; pass aria-label to Menu.Content`,
              )
            }
          },
          { immediate: true, flush: "post" },
        )
      })
    }
    const ctx: MenuLevel = {
      service: s.service,
      view: s.view,
      levelId,
      level: "root",
      props: s.props,
      tree,
      keepMounted: () => props.keepMounted,
      registry: s.registry,
      activations: s.activations,
      submenus: s.submenus,
      hoverIntent: s.hoverIntent,
      trigger,
      contentMounted: shallowRef(false),
      meta: s.meta,
      inMenubar: false,
      region: true,
    }
    provide(MenuLevelKey, ctx)
    provide(RegionKey, {
      disabled: () => props.disabled,
      longPress: () => props.longPress,
      longPressDelay: () => props.longPressDelay,
      messages: () => messages.value,
    })
    return () => slots.default?.({ open: open() })
  },
})

/** The region: a right click, a long press or the context-menu key on it opens the menu. */
const Trigger = defineComponent({
  name: "ContextMenuTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as SlotsType<{ default?: (state: ContextMenuTriggerState) => VNodeChild }>,
  setup(props, { attrs, slots }) {
    const ctx = inject(MenuLevelKey, null)
    const region = inject(RegionKey, null)
    if (!ctx || !region) throw new Error("ContextMenu.Trigger must be inside ContextMenu.Root")
    const env = useEnvironment()
    // The modality tracker classifies a contextmenu with no press before it (AT, keyboard).
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const send = ctx.service.send
    let start: MenuPoint = { x: 0, y: 0 }
    let target: Element | null = null
    const press = usePress({
      env,
      // Read once, when the press is created.
      longPress: longPress({ threshold: region.longPressDelay(), moveTolerance: 10 }),
      disabled: () => region.disabled() || !region.longPress(),
      send: (e) => {
        // Touch and pen only: a held mouse button is no long press.
        if (e.type !== "LONG_PRESS" || (e.pointerType !== "touch" && e.pointerType !== "pen")) {
          return
        }
        send({ type: "REGION.LONG_PRESS", point: start, target })
      },
    })
    const hintId = `${useId()}-hint`
    const el = shallowRef<Element | null>(null)
    // The hint only for a region the consumer made focusable.
    const focusable = shallowRef(false)
    const measure = () => (focusable.value = el.value?.hasAttribute("tabindex") === true)
    onMounted(measure)
    onUpdated(measure)
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const setEl = (node: unknown) => {
      refTo(el)(node)
      ctx.trigger.value = el.value instanceof HTMLElement ? el.value : null
    }
    return () => {
      const open = ctx.view.value.matches("open")
      const hint = focusable.value && region.longPress()
      const own = normalizeProps(
        contextMenuRegionProps(
          {
            instance: ctx.levelId,
            open,
            disabled: region.disabled(),
            hintId: hint ? hintId : undefined,
            focused: focused.value,
            modality: modality.value,
          },
          send,
          env,
        ),
      )
      // Only the press module's pointer side (and its trailing-click and callout guards): keys
      // on the region and its rows stay the consumer's.
      const p = press.props as Record<string, ((e: never) => void) | undefined>
      const pick = {
        onClick: p["onClick"],
        onContextmenu: p["onContextmenu"],
        onDragstart: p["onDragstart"],
        onPointerenter: p["onPointerenter"],
        onPointerleave: p["onPointerleave"],
      }
      const merged = mergeProps(
        {
          ...joinHandlers(own, pick, {
            // The region's own focus (a focusable region), not its rows'.
            onFocusin: (e: FocusEvent) => (focused.value = e.target === e.currentTarget),
            onFocusout: (e: FocusEvent) => {
              if (e.target === e.currentTarget) focused.value = false
            },
          }),
          onPointerdown: (e: PointerEvent) => {
            // The innermost region takes a long press; an outer one never starts its timer.
            if (e.pointerType === "mouse" || !claimRegionEvent(e)) return
            start = { x: e.clientX, y: e.clientY }
            target = e.target as Element
            p["onPointerdown"]?.(e as never)
          },
          ref: setEl,
        },
        attrs,
      )
      return renderPart(
        "div",
        merged,
        [
          slots.default?.({ open }),
          hint ? h("span", { id: hintId, hidden: true }, region.messages().longPressHint) : null,
        ],
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `context-menu.parts.ts` re-exports them as the `ContextMenu` namespace. */
export { Root, Trigger }
