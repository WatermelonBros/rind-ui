import {
  type ChangeDetails,
  type ClosedContent,
  type CollapsibleEvent,
  type CollapsiblePart,
  type PartProps as CorePartProps,
  collapsibleConnect,
  collapsibleMachine,
  contentSize,
  focusSafely,
  type Modality,
  partId,
  untilFound,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  defineComponent,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
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
import { useEnvironment } from "../provider"
import { asChildProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { useHover, usePress } from "../use-press"

declare const process: { env: { NODE_ENV?: string } }

/**
 * What an embedding component (an Accordion item) adds to the Trigger, Content and Indicator:
 * its connect output, merged over the Collapsible's.
 */
export interface CollapsibleDecoration {
  readonly trigger?: () => CorePartProps
  /** `triggerId`: the trigger's rendered id (a consumer id included). */
  readonly content?: (triggerId: string) => CorePartProps
  readonly indicator?: () => CorePartProps
  /** Wraps the content's children (an Accordion's deeper Heading.Level). */
  readonly wrapContent?: (children: VNodeChild) => VNodeChild
}

type Service = ReturnType<typeof useMachine<typeof collapsibleMachine>>

/** The context the Collapsible parts read; an Accordion item provides its own. */
export interface CollapsibleCtx {
  /** `data-scope` and the size-variable prefix (`--rind-<scope>-content-*`). */
  readonly scope: string
  /** `data-instance`. */
  readonly instance: () => string
  /** The base of the part ids (one per disclosure; an accordion item has its own). */
  readonly idBase: () => string
  /** Names the component in errors ("Collapsible", "Accordion"). */
  readonly label: string
  readonly decoration: CollapsibleDecoration
  readonly view: () => Service["view"]["value"]
  readonly send: Service["send"]
  readonly registry: PartRegistry<CollapsiblePart>
  readonly disabled: () => boolean
  readonly focusableWhenDisabled: () => boolean
  readonly closedContent: () => ClosedContent
  readonly triggerEl: { value: Element | null }
  /** The consumer's trigger id, so a Content rendered after it labels itself with it. */
  readonly triggerId: { current: string | undefined }
  readonly contentEl: { value: Element | null }
}
export const CollapsibleKey: InjectionKey<CollapsibleCtx> = Symbol("rind-ui.collapsible")
function useCollapsible(part: string): CollapsibleCtx {
  const ctx = inject(CollapsibleKey, null)
  if (!ctx)
    throw new Error(`Collapsible.${part} must be inside Collapsible.Root (or Accordion.Item)`)
  return ctx
}

export interface CollapsibleServiceOptions {
  readonly scope: string
  readonly instance: () => string
  readonly idBase: () => string
  readonly label: string
  readonly decoration: CollapsibleDecoration
  readonly props: () => {
    readonly open: boolean | undefined
    readonly defaultOpen: boolean | undefined
    readonly onOpenChange:
      | ((open: boolean, details: ChangeDetails<CollapsibleEvent>) => void)
      | undefined
    readonly disabled: boolean
    readonly focusableWhenDisabled: boolean
    readonly closedContent: ClosedContent
  }
}

/** One disclosure's service and context (a Collapsible Root, or an Accordion item). Call in setup. */
export function useCollapsibleService(o: CollapsibleServiceOptions): CollapsibleCtx {
  const env = useEnvironment()
  const triggerEl = shallowRef<Element | null>(null)
  const contentEl = shallowRef<Element | null>(null)
  const registry = usePartRegistry<CollapsiblePart>({
    scope: o.scope,
    root: o.idBase(),
    // Kept-mounted content is rendered on the server too: aria-controls is in the HTML.
    ...(o.props().closedContent !== "unmount" ? { expected: ["content"] as const } : {}),
  })
  const { view, send } = useMachine(collapsibleMachine, () => ({
    open: o.props().open,
    defaultOpen: o.props().defaultOpen,
    onOpenChange: o.props().onOpenChange,
    disabled: o.props().disabled,
    // Closing with focus inside: the trigger, keeping the modality, before hiding.
    focusOutOfContent: () => {
      const content = contentEl.value
      const trigger = triggerEl.value
      const active = content?.ownerDocument.activeElement
      if (content && trigger instanceof HTMLElement && active && content.contains(active)) {
        void focusSafely(trigger, env, "programmatic")
      }
    },
  }))
  return {
    scope: o.scope,
    instance: o.instance,
    idBase: o.idBase,
    label: o.label,
    decoration: o.decoration,
    view: () => view.value,
    send,
    registry,
    disabled: () => o.props().disabled,
    focusableWhenDisabled: () => o.props().focusableWhenDisabled,
    closedContent: () => o.props().closedContent,
    triggerEl,
    triggerId: { current: undefined },
    contentEl,
  }
}

const NO_DECORATION: CollapsibleDecoration = {}

export interface CollapsibleState {
  readonly open: boolean
  readonly disabled: boolean
}
type Slots = SlotsType<{ default?: (state: CollapsibleState) => VNodeChild }>

/** The connect output for a part, with that part's interaction state. Call in setup. */
function useApi(ctx: CollapsibleCtx) {
  const env = useEnvironment()
  const content = useRenderedId(ctx.registry, "content")
  const trigger = useRenderedId(ctx.registry, "trigger")
  return (
    s: {
      triggerFocused?: boolean
      modality?: Modality
      pressed?: boolean
      hovered?: boolean
      triggerTag?: string
    } = {},
  ) => {
    const triggerId = trigger.value ?? ctx.triggerId.current
    return collapsibleConnect(
      {
        scope: ctx.scope,
        instance: ctx.instance(),
        open: ctx.view().matches("open"),
        reveal: ctx.view().context.reveal,
        disabled: ctx.disabled(),
        focusableWhenDisabled: ctx.focusableWhenDisabled(),
        closedContent: ctx.closedContent(),
        triggerTag: s.triggerTag ?? "button",
        triggerFocused: s.triggerFocused ?? false,
        modality: s.modality ?? "keyboard",
        pressed: s.pressed ?? false,
        hovered: s.hovered ?? false,
        triggerId: triggerId ?? partId(ctx.scope, ctx.idBase(), "trigger"),
        contentId: content.value ?? partId(ctx.scope, ctx.idBase(), "content"),
        contentRendered: content.value !== undefined,
      },
      env,
    )
  }
}

const stateOf = (ctx: CollapsibleCtx): CollapsibleState => ({
  open: ctx.view().matches("open"),
  disabled: ctx.disabled(),
})

const Root = defineComponent({
  name: "CollapsibleRoot",
  inheritAttrs: false,
  props: {
    /** Controlled visibility (`v-model:open`). */
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: undefined },
    /** Ignores activation; the content stays as it is (a parent can still open or close it). */
    disabled: Boolean,
    focusableWhenDisabled: Boolean,
    /** What closed content becomes: findable by the browser's search (default), hidden, or removed. */
    closedContent: { type: String as PropType<ClosedContent>, default: "until-found" },
    id: String,
    ...asChildProp,
  },
  emits: {
    openChange: (_open: boolean, _details: ChangeDetails<CollapsibleEvent>) => true,
    "update:open": (_open: boolean) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const onOpenChange = changeEmitter<boolean, CollapsibleEvent>(
      (v, d) => emit("openChange", v, d),
      (v) => emit("update:open", v),
    )
    const ctx = useCollapsibleService({
      scope: "collapsible",
      instance,
      idBase: instance,
      label: "Collapsible",
      decoration: NO_DECORATION,
      props: () => ({
        open: props.open,
        defaultOpen: props.defaultOpen,
        onOpenChange,
        disabled: props.disabled,
        focusableWhenDisabled: props.focusableWhenDisabled,
        closedContent: props.closedContent,
      }),
    })
    provide(CollapsibleKey, ctx)
    const apiFor = useApi(ctx)
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...normalizeProps(apiFor().root()),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        slots.default?.(stateOf(ctx)),
        props.asChild,
      )
  },
})

const Trigger = defineComponent({
  name: "CollapsibleTrigger",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCollapsible("Trigger")
    // A consumer id is the id the content's aria-labelledby references (an Accordion region).
    const ownId = () => props.id ?? partId(ctx.scope, ctx.idBase(), "trigger")
    ctx.triggerId.current = props.id
    useRegisterPart(ctx.registry, "trigger", ownId)
    const env = useEnvironment()
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const el = shallowRef<Element | null>(null)
    const tag = shallowRef("button")
    const setEl = (node: unknown) => {
      refTo(el)(node)
      ctx.triggerEl.value = el.value
    }
    const measure = () => (tag.value = el.value?.tagName.toLowerCase() ?? "button")
    onMounted(measure)
    onUpdated(measure)
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    const press = usePress({
      env,
      disabled: () => ctx.disabled(),
      send: (e) => {
        if (e.type === "PRESS") ctx.send({ type: "TOGGLE", modality: e.modality })
      },
    })
    const hover = useHover({ env, send: () => {}, disabled: () => ctx.disabled() })
    const apiFor = useApi(ctx)
    return () => {
      ctx.triggerId.current = props.id
      const api = apiFor({
        triggerFocused: focused.value,
        modality: modality.value,
        pressed: press.pressed.value,
        hovered: hover.hovered.value,
        triggerTag: tag.value,
      })
      const own = normalizeProps({ ...api.trigger(), ...ctx.decoration.trigger?.(), id: ownId() })
      const merged = mergeProps(
        {
          ...joinHandlers(own, press.props, hover.props, {
            onFocusin: () => (focused.value = true),
            onFocusout: () => (focused.value = false),
          }),
          ref: setEl,
        },
        attrs,
      )
      return renderPart("button", merged, slots.default?.(stateOf(ctx)), props.asChild)
    }
  },
})

const Content = defineComponent({
  name: "CollapsibleContent",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCollapsible("Content")
    const env = useEnvironment()
    const open = () => ctx.view().matches("open")
    const el = shallowRef<Element | null>(null)
    const setEl = (node: unknown) => {
      refTo(el)(node)
      ctx.contentEl.value = el.value
    }
    const presence = usePresence(open, el)
    // Closed with nothing animating (reduced motion, jsdom, no theme): hidden in the closing
    // step itself, not after presence's asynchronous wait (base-ui#4553).
    const quickExit = shallowRef(false)
    watch(open, (o) => {
      if (o) quickExit.value = false
    })
    const exited = () => presence.state === "absent" || quickExit.value
    const mounted = () => ctx.closedContent() !== "unmount" || open() || !exited()
    // A consumer id is the id the trigger references (aria-controls).
    const own = () => props.id ?? partId(ctx.scope, ctx.idBase(), "content")
    useRegisterPart(ctx.registry, "content", () => (mounted() ? own() : undefined))
    const findable = () => ctx.closedContent() === "until-found" && !ctx.disabled()
    let size: { node: Element; s: ReturnType<typeof contentSize> } | null = null
    // The open value of the last update that ran the size sequence (undefined: none yet).
    let sized: boolean | undefined
    // Defined from the first paint, the server's included (zag#1396); the same value on every
    // render, so the imperative writes below are never overwritten by Vue's patch.
    const initialSize = open() ? "auto" : "0px"
    let stopAnimation = () => {}
    // Size properties: 0px → px → auto → px → 0px, only after an update that changed `open`.
    const runSize = () => {
      const node = el.value
      const isOpen = open()
      const initial = sized === undefined
      if (sized === isOpen) return
      sized = isOpen
      if (!(node instanceof HTMLElement)) return
      // A remounted content (unmount mode) is a new element.
      if (size?.node !== node) size = { node, s: contentSize(node, `rind-${ctx.scope}`) }
      const s = size.s
      stopAnimation()
      stopAnimation = () => {}
      if (isOpen) {
        const instant = initial || ctx.view().context.reveal === "find-in-page"
        s.opened({ instant })
        if (instant) return
        // Settled once the enter animations finished (or at once when nothing animates).
        const running = node.getAnimations?.({ subtree: true }) ?? []
        let live = true
        void Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(() => {
          if (live) s.settled()
        })
        stopAnimation = () => {
          live = false
        }
        return
      }
      if (initial) return
      s.closed()
      if ((node.getAnimations?.({ subtree: true }) ?? []).length === 0) quickExit.value = true
    }
    // until-found: imperatively, re-applied after every update; beforematch opens instantly.
    let finder: ReturnType<typeof untilFound> | null = null
    let finderNode: Element | null = null
    const runFinder = () => {
      const node = el.value
      const want = findable() && node instanceof HTMLElement
      if (finder && (!want || finderNode !== node)) {
        finder.dispose()
        // No longer findable (disabled): Vue's `hidden` did not change, so degrade it here.
        if (finderNode?.getAttribute("hidden") === "until-found")
          finderNode.setAttribute("hidden", "")
        finder = null
        finderNode = null
      }
      if (want && !finder && node instanceof HTMLElement) {
        finderNode = node
        finder = untilFound(node, {
          scheduler: env.scheduler,
          isOpen: () => open() || !exited(),
          onReveal: () => {
            ctx.send({ type: "OPEN", reason: "find-in-page" })
            // Full size in the same task, before the browser highlights the match (base-ui#5513).
            size?.s.opened({ instant: true })
          },
        })
      }
      finder?.sync()
      // Development: a stylesheet hiding [hidden] defeats find-in-page (react-spectrum#7160).
      if (
        process.env.NODE_ENV === "production" ||
        !(node instanceof HTMLElement) ||
        !findable() ||
        open()
      )
        return
      if (
        node.getAttribute("hidden") === "until-found" &&
        getComputedStyle(node).display === "none"
      ) {
        console.warn(
          `[rind-ui] ${ctx.scope}: the closed content computes display: none, so find-in-page cannot reveal it (a stylesheet sets [hidden] { display: none }?)`,
        )
      }
    }
    const afterRender = () => {
      runSize()
      runFinder()
    }
    onMounted(afterRender)
    onUpdated(afterRender)
    onBeforeUnmount(() => {
      stopAnimation()
      finder?.dispose()
    })
    const apiFor = useApi(ctx)
    const triggerRendered = useRenderedId(ctx.registry, "trigger")
    return () => {
      if (!mounted()) return null
      const triggerId =
        triggerRendered.value ?? ctx.triggerId.current ?? partId(ctx.scope, ctx.idBase(), "trigger")
      // Closed and settled: hidden. until-found is a boolean `hidden` (server HTML carries
      // hidden=""), upgraded right after mount by the until-found module (hidden-content).
      const hidden = !open() && exited()
      const merged = mergeProps(
        {
          ...normalizeProps({
            ...apiFor().content(hidden),
            ...ctx.decoration.content?.(triggerId),
          }),
          style: {
            [`--rind-${ctx.scope}-content-height`]: initialSize,
            [`--rind-${ctx.scope}-content-width`]: initialSize,
          },
          ref: setEl,
        },
        attrs,
      )
      const content = slots.default?.(stateOf(ctx))
      const wrap = ctx.decoration.wrapContent
      return renderPart("div", merged, wrap ? wrap(content) : content, props.asChild)
    }
  },
})

const Indicator = defineComponent({
  name: "CollapsibleIndicator",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useCollapsible("Indicator")
    const apiFor = useApi(ctx)
    return () =>
      renderPart(
        "span",
        mergeProps(
          normalizeProps({ ...apiFor().indicator(), ...ctx.decoration.indicator?.() }),
          attrs,
        ),
        slots.default?.(stateOf(ctx)),
        props.asChild,
      )
  },
})

/** The parts, by name: `collapsible.parts.ts` re-exports them as the `Collapsible` namespace. */
export { Content, Indicator, Root, Trigger }
