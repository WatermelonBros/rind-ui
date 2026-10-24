/** @jsxImportSource solid-js */
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
  type Accessor,
  createComputed,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
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
  readonly wrapContent?: (children: () => JSX.Element) => JSX.Element
}

type Service = ReturnType<typeof useMachine<typeof collapsibleMachine>>

/** The context the Collapsible parts read; an Accordion item provides its own. */
export interface CollapsibleCtx {
  /** `data-scope` and the size-variable prefix (`--rind-<scope>-content-*`). */
  readonly scope: string
  /** `data-instance`. */
  readonly instance: Accessor<string>
  /** The base of the part ids (one per disclosure; an accordion item has its own). */
  readonly idBase: Accessor<string>
  /** Names the component in errors ("Collapsible", "Accordion"). */
  readonly label: string
  readonly decoration: CollapsibleDecoration
  readonly view: Service["view"]
  readonly send: Service["send"]
  readonly registry: PartRegistry<CollapsiblePart>
  readonly disabled: Accessor<boolean>
  readonly focusableWhenDisabled: Accessor<boolean>
  readonly closedContent: Accessor<ClosedContent>
  readonly triggerEl: Accessor<Element | null>
  readonly setTriggerEl: (el: Element | null) => void
  /** The consumer's trigger id, so a Content rendered after it labels itself with it. */
  readonly triggerId: { current: string | undefined }
  readonly contentEl: Accessor<Element | null>
  readonly setContentEl: (el: Element | null) => void
}
export const CollapsibleContext = createContext<CollapsibleCtx>()
function useCollapsible(part: string): CollapsibleCtx {
  const ctx = useContext(CollapsibleContext)
  if (!ctx)
    throw new Error(`Collapsible.${part} must be inside Collapsible.Root (or Accordion.Item)`)
  return ctx
}

export interface CollapsibleServiceOptions {
  readonly scope: string
  readonly instance: Accessor<string>
  readonly idBase: Accessor<string>
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

/** One disclosure's service and context (a Collapsible Root, or an Accordion item). Call in a component. */
export function useCollapsibleService(o: CollapsibleServiceOptions): CollapsibleCtx {
  const env = useEnvironment()
  const [triggerEl, setTriggerEl] = createSignal<Element | null>(null)
  const [contentEl, setContentEl] = createSignal<Element | null>(null)
  const registry = usePartRegistry<CollapsiblePart>({
    scope: o.scope,
    root: o.idBase(),
    // Kept-mounted content is rendered on the server too: aria-controls is in the HTML.
    ...(untrack(o.props).closedContent !== "unmount" ? { expected: ["content"] as const } : {}),
  })
  const { view, send } = useMachine(collapsibleMachine, () => ({
    open: o.props().open,
    defaultOpen: o.props().defaultOpen,
    onOpenChange: o.props().onOpenChange,
    disabled: o.props().disabled,
    // Closing with focus inside: the trigger, keeping the modality, before hiding.
    focusOutOfContent: () => {
      const content = contentEl()
      const trigger = triggerEl()
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
    view,
    send,
    registry,
    disabled: () => o.props().disabled,
    focusableWhenDisabled: () => o.props().focusableWhenDisabled,
    closedContent: () => o.props().closedContent,
    triggerEl,
    setTriggerEl,
    triggerId: { current: undefined },
    contentEl,
    setContentEl,
  }
}

const NO_DECORATION: CollapsibleDecoration = {}

export interface CollapsibleState {
  readonly open: boolean
  readonly disabled: boolean
}

/** The connect output for a part, with that part's interaction state. Call in a component. */
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
    const triggerId = trigger() ?? ctx.triggerId.current
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
        contentId: content() ?? partId(ctx.scope, ctx.idBase(), "content"),
        contentRendered: content() !== undefined,
      },
      env,
    )
  }
}

const stateOf = (ctx: CollapsibleCtx) =>
  reactive<CollapsibleState>(() => ({
    open: ctx.view().matches("open"),
    disabled: ctx.disabled(),
  }))

export type CollapsibleRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children" | "id"> & {
  /** Controlled visibility. */
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?:
    | ((open: boolean, details: ChangeDetails<CollapsibleEvent>) => void)
    | undefined
  /** Ignores activation; the content stays as it is (a parent can still open or close it). */
  readonly disabled?: boolean | undefined
  readonly focusableWhenDisabled?: boolean | undefined
  /** What closed content becomes: findable by the browser's search (default), hidden, or removed. */
  readonly closedContent?: ClosedContent | undefined
  readonly id?: string | undefined
  readonly render?: RenderProp<CollapsibleState> | undefined
  readonly children?: JSX.Element | ((state: CollapsibleState) => JSX.Element)
}

type PartProps<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<CollapsibleState> | undefined
  readonly children?: JSX.Element | ((state: CollapsibleState) => JSX.Element)
}

function Root(props: CollapsibleRootProps) {
  const [local, rest] = splitProps(props, [
    "open",
    "defaultOpen",
    "onOpenChange",
    "disabled",
    "focusableWhenDisabled",
    "closedContent",
    "id",
    "render",
    "children",
  ])
  const instance = useRootId(() => local.id)
  const ctx = useCollapsibleService({
    scope: "collapsible",
    instance,
    idBase: instance,
    label: "Collapsible",
    decoration: NO_DECORATION,
    props: () => ({
      open: local.open,
      defaultOpen: local.defaultOpen,
      onOpenChange: local.onOpenChange,
      disabled: local.disabled === true,
      focusableWhenDisabled: local.focusableWhenDisabled === true,
      closedContent: local.closedContent ?? "until-found",
    }),
  })
  const apiFor = useApi(ctx)
  const state = stateOf(ctx)
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(apiFor().root()),
        ...(local.id === undefined ? {} : { id: local.id }),
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <CollapsibleContext.Provider value={ctx}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </CollapsibleContext.Provider>
  )
}

function Trigger(
  props: PartProps<Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "id">> & { id?: string },
) {
  const [local, rest] = splitProps(props, ["id", "render", "children"])
  const ctx = useCollapsible("Trigger")
  // A consumer id is the id the content's aria-labelledby references (an Accordion region).
  const ownId = () => local.id ?? partId(ctx.scope, ctx.idBase(), "trigger")
  createComputed(() => {
    ctx.triggerId.current = local.id
  })
  useRegisterPart(ctx.registry, "trigger", ownId)
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [el, setEl] = createSignal<Element | null>(null)
  const [tag, setTag] = createSignal("button")
  afterMount(() => createEffect(() => setTag(el()?.tagName.toLowerCase() ?? "button")))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    disabled: () => ctx.disabled(),
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "TOGGLE", modality: e.modality })
    },
  })
  const hover = useHover({ env, send: () => {}, disabled: () => ctx.disabled() })
  const apiFor = useApi(ctx)
  const merged = createMemo(() => {
    const api = apiFor({
      triggerFocused: focused(),
      modality: modality(),
      pressed: press.pressed(),
      hovered: hover.hovered(),
      triggerTag: tag(),
    })
    const own = normalizeProps({ ...api.trigger(), ...ctx.decoration.trigger?.(), id: ownId() })
    return mergeProps(
      {
        ...joinHandlers(own, press.props, hover.props, {
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        }),
        ref: (node: Element) => {
          setEl(node)
          ctx.setTriggerEl(node)
        },
      },
      rest,
    )
  })
  const state = stateOf(ctx)
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function Content(
  props: PartProps<Omit<JSX.HTMLAttributes<HTMLDivElement>, "id">> & { id?: string },
) {
  const [local, rest] = splitProps(props, ["id", "render", "children"])
  const ctx = useCollapsible("Content")
  const env = useEnvironment()
  const open = () => ctx.view().matches("open")
  const [el, setEl] = createSignal<Element | null>(null)
  const presence = usePresence(open, el)
  // Closed with nothing animating (reduced motion, jsdom, no theme): hidden in the closing
  // step itself, not after presence's asynchronous wait (base-ui#4553).
  const [quickExit, setQuickExit] = createSignal(false)
  createComputed(
    on(
      open,
      (o) => {
        if (o) setQuickExit(false)
      },
      { defer: true },
    ),
  )
  const exited = () => presence.state() === "absent" || quickExit()
  const mounted = () => ctx.closedContent() !== "unmount" || open() || !exited()
  // A consumer id is the id the trigger references (aria-controls).
  const own = () => local.id ?? partId(ctx.scope, ctx.idBase(), "content")
  useRegisterPart(ctx.registry, "content", () => (mounted() ? own() : undefined))
  const findable = () => ctx.closedContent() === "until-found" && !ctx.disabled()
  let size: { node: Element; s: ReturnType<typeof contentSize> } | null = null
  // The open value of the last update that ran the size sequence (undefined: none yet).
  let sized: boolean | undefined
  // Defined from the first paint, the server's included (zag#1396); the same value on every
  // update, so the imperative writes below are never overwritten by a patch.
  const initialSize = untrack(open) ? "auto" : "0px"
  let stopAnimation = () => {}
  // Size properties: 0px → px → auto → px → 0px, only after an update that changed `open`.
  const runSize = () => {
    const node = el()
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
    if ((node.getAnimations?.({ subtree: true }) ?? []).length === 0) setQuickExit(true)
  }
  // until-found: imperatively, re-applied after every update; beforematch opens instantly.
  let finder: ReturnType<typeof untilFound> | null = null
  let finderNode: Element | null = null
  const runFinder = () => {
    const node = el()
    const want = findable() && node instanceof HTMLElement
    if (finder && (!want || finderNode !== node)) {
      finder.dispose()
      // No longer findable (disabled): the `hidden` prop did not change, so degrade it here.
      if (finderNode?.getAttribute("hidden") === "until-found")
        finderNode.setAttribute("hidden", "")
      finder = null
      finderNode = null
    }
    if (want && !finder && node instanceof HTMLElement) {
      finderNode = node
      finder = untilFound(node, {
        scheduler: env.scheduler,
        isOpen: () => untrack(open) || !untrack(exited),
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
  afterMount(() => {
    createEffect(() => {
      // After every update of what the sequences read.
      el()
      open()
      exited()
      findable()
      untrack(() => {
        runSize()
        runFinder()
      })
    })
    onCleanup(() => {
      stopAnimation()
      finder?.dispose()
    })
  })
  const apiFor = useApi(ctx)
  const triggerRendered = useRenderedId(ctx.registry, "trigger")
  const state = stateOf(ctx)
  const merged = createMemo(() => {
    const triggerId =
      triggerRendered() ?? ctx.triggerId.current ?? partId(ctx.scope, ctx.idBase(), "trigger")
    // Closed and settled: hidden. until-found is a boolean `hidden` (server HTML carries
    // hidden=""), upgraded right after mount by the until-found module (hidden-content).
    const hidden = !open() && exited()
    return mergeProps(
      {
        ...normalizeProps({
          ...apiFor().content(hidden),
          ...ctx.decoration.content?.(triggerId),
        }),
        style: {
          [`--rind-${ctx.scope}-content-height`]: initialSize,
          [`--rind-${ctx.scope}-content-width`]: initialSize,
        },
        ref: (node: Element) => {
          setEl(node)
          ctx.setContentEl(node)
        },
      },
      rest,
    )
  })
  const children = (): JSX.Element => {
    const content = () => resolveChildren(local.children, state)
    const wrap = ctx.decoration.wrapContent
    return wrap ? wrap(content) : content()
  }
  return (
    <Show when={mounted()}>
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </Show>
  )
}

function Indicator(props: PartProps<JSX.HTMLAttributes<HTMLSpanElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useCollapsible("Indicator")
  const apiFor = useApi(ctx)
  const merged = createMemo(() =>
    mergeProps(normalizeProps({ ...apiFor().indicator(), ...ctx.decoration.indicator?.() }), rest),
  )
  const state = stateOf(ctx)
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <span {...p}>{children()}</span>)
}

/** The parts, by name: `collapsible.parts.ts` re-exports them as the `Collapsible` namespace. */
export { Content, Indicator, Root, Trigger }
