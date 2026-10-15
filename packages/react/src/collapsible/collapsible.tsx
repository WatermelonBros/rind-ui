import {
  type ChangeDetails,
  type ClosedContent,
  type CollapsibleEvent,
  type CollapsiblePart,
  collapsibleConnect,
  collapsibleMachine,
  contentSize,
  focusSafely,
  partId,
  untilFound,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import {
  type PartRegistry,
  usePartRegistry,
  useRegisterPart,
  useRenderedId,
  useRootId,
} from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { useHover, usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

interface Ctx {
  readonly instance: string
  readonly view: ReturnType<typeof useMachine<typeof collapsibleMachine>>["view"]
  readonly send: ReturnType<typeof useMachine<typeof collapsibleMachine>>["send"]
  readonly registry: PartRegistry<CollapsiblePart>
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  readonly closedContent: ClosedContent
  readonly triggerEl: { current: HTMLElement | null }
  readonly contentEl: { current: HTMLElement | null }
}
const CollapsibleContext = createContext<Ctx | null>(null)
function useCollapsible(part: string): Ctx {
  const ctx = useContext(CollapsibleContext)
  if (!ctx) throw new Error(`Collapsible.${part} must be inside Collapsible.Root`)
  return ctx
}

export interface CollapsibleState {
  readonly open: boolean
  readonly disabled: boolean
}

export type CollapsibleRootProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
  readonly children?: ReactNode
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean, details: ChangeDetails<CollapsibleEvent>) => void
  /** Ignores activation; the content stays as it is (a parent can still open or close it). */
  readonly disabled?: boolean
  readonly focusableWhenDisabled?: boolean
  /** What closed content becomes: findable by the browser's search (default), hidden, or removed. */
  readonly closedContent?: ClosedContent
  readonly render?: RenderProp<CollapsibleState>
}

function Root({
  open,
  defaultOpen,
  onOpenChange,
  disabled = false,
  focusableWhenDisabled = false,
  closedContent = "until-found",
  render,
  id,
  ref,
  children,
  ...rest
}: CollapsibleRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const triggerEl = useRef<HTMLElement | null>(null)
  const contentEl = useRef<HTMLElement | null>(null)
  const registry = usePartRegistry<CollapsiblePart>({
    scope: "collapsible",
    root: instance,
    // Kept-mounted content is rendered on the server too: aria-controls is in the HTML.
    ...(closedContent !== "unmount" ? { expected: ["content"] as const } : {}),
  })
  const { view, send } = useMachine(collapsibleMachine, {
    open,
    defaultOpen,
    onOpenChange,
    disabled,
    // Closing with focus inside: the trigger, keeping the modality, before hiding.
    focusOutOfContent: () => {
      const content = contentEl.current
      const trigger = triggerEl.current
      const active = content?.ownerDocument.activeElement
      if (content && trigger && active && content.contains(active)) {
        void focusSafely(trigger, env, "programmatic")
      }
    },
  })
  const ctx: Ctx = useMemo(
    () => ({
      instance,
      view,
      send,
      registry,
      disabled,
      focusableWhenDisabled,
      closedContent,
      triggerEl,
      contentEl,
    }),
    [instance, view, send, registry, disabled, focusableWhenDisabled, closedContent],
  )
  const api = useApi(ctx, false, "keyboard", false, false, "button")
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  return (
    <CollapsibleContext value={ctx}>
      {renderPart("div", { ...props, children }, render, {
        open: view.matches("open"),
        disabled,
      })}
    </CollapsibleContext>
  )
}

function useApi(
  ctx: Ctx,
  triggerFocused: boolean,
  modality: ReturnType<typeof useModality>,
  pressed: boolean,
  hovered: boolean,
  triggerTag: string,
) {
  const env = useEnvironment()
  const content = useRenderedId(ctx.registry, "content")
  return collapsibleConnect(
    {
      instance: ctx.instance,
      open: ctx.view.matches("open"),
      reveal: ctx.view.context.reveal,
      disabled: ctx.disabled,
      focusableWhenDisabled: ctx.focusableWhenDisabled,
      closedContent: ctx.closedContent,
      triggerTag,
      triggerFocused,
      modality,
      pressed,
      hovered,
      triggerId: partId("collapsible", ctx.instance, "trigger"),
      contentId: content ?? partId("collapsible", ctx.instance, "content"),
      contentRendered: content !== undefined,
    },
    env,
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<CollapsibleState>
}

function Trigger({ render, ref, ...rest }: PartProps<"button">) {
  const ctx = useCollapsible("Trigger")
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("button", render, el)
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    disabled: () => ctx.disabled,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "TOGGLE", modality: e.modality })
    },
  })
  const hover = useHover({ env, send: () => {}, disabled: () => ctx.disabled })
  const api = useApi(ctx, focused, modality, press.pressed, hover.hovered, tag)
  const own = normalizeProps(api.trigger())
  const props = mergeProps(
    {
      ...joinHandlers(own, press.props, hover.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(composeRefs(el, ctx.triggerEl), ref),
    },
    rest,
  )
  return renderPart("button", props, render, {
    open: ctx.view.matches("open"),
    disabled: ctx.disabled,
  })
}

function Content({ render, ref, id, ...rest }: PartProps<"div">) {
  const ctx = useCollapsible("Content")
  const env = useEnvironment()
  const open = ctx.view.matches("open")
  const el = useRef<HTMLElement | null>(null)
  const presence = usePresence(open, el)
  // Closed with nothing animating (reduced motion, jsdom, no theme): hidden in the closing
  // step itself, not after presence's asynchronous wait (base-ui#4553).
  const [quickExit, setQuickExit] = useState(false)
  if (open && quickExit) setQuickExit(false)
  const exited = presence.state === "absent" || quickExit
  const mounted = ctx.closedContent !== "unmount" || open || !exited
  // A consumer id is the id the trigger references (aria-controls).
  const own = id ?? partId("collapsible", ctx.instance, "content")
  useRegisterPart(ctx.registry, "content", mounted ? own : undefined)
  // Hidden once closed and its exit finished; until-found is set by its module.
  const settledClosed = !open && exited
  const findable = ctx.closedContent === "until-found" && !ctx.disabled
  const size = useRef<{ node: HTMLElement; s: ReturnType<typeof contentSize> } | null>(null)
  // The open value of the last commit that ran the size sequence (undefined: none yet).
  const sized = useRef<boolean | undefined>(undefined)
  // Defined from the first paint, the server's included (zag#1396); rendered once, so the
  // imperative writes below are never overwritten by React.
  const [initialSize] = useState(() => (open ? "auto" : "0px"))
  // Read by the until-found module after every commit, never a stale render's value.
  const latest = useRef({ open, exited, send: ctx.send })
  latest.current = { open, exited, send: ctx.send }
  // Size properties: 0px → px → auto → px → 0px, only after a commit that changed `open`:
  // a re-insertion or an <Activity> show re-runs this effect and must not replay (radix#3778).
  useIsoLayoutEffect(() => {
    const node = el.current
    const initial = sized.current === undefined
    if (sized.current === open) return
    sized.current = open
    if (!node) return
    // A remounted content (unmount mode) is a new element.
    if (size.current?.node !== node)
      size.current = { node, s: contentSize(node, "rind-collapsible") }
    const s = size.current.s
    if (open) {
      const instant = initial || ctx.view.context.reveal === "find-in-page"
      s.opened({ instant })
      if (instant) return
      // Settled once the enter animations finished (or at once when nothing animates).
      const running = node.getAnimations?.({ subtree: true }) ?? []
      let live = true
      void Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(() => {
        if (live) s.settled()
      })
      return () => {
        live = false
      }
    }
    if (initial) return
    s.closed()
    if ((node.getAnimations?.({ subtree: true }) ?? []).length === 0) setQuickExit(true)
    return undefined
  }, [open, mounted])
  // until-found: imperatively, re-applied after every commit; beforematch opens instantly.
  const finder = useRef<ReturnType<typeof untilFound> | null>(null)
  useIsoLayoutEffect(() => {
    const node = el.current
    if (!findable || !node) return
    const h = untilFound(node, {
      scheduler: env.scheduler,
      isOpen: () => latest.current.open || !latest.current.exited,
      onReveal: () => {
        latest.current.send({ type: "OPEN", reason: "find-in-page" })
        // Full size in the same task, before the browser highlights the match (base-ui#5513).
        size.current?.s.opened({ instant: true })
      },
    })
    finder.current = h
    return () => {
      h.dispose()
      finder.current = null
      // No longer findable (disabled): React's `hidden` did not change, so degrade it here.
      if (node.getAttribute("hidden") === "until-found") node.setAttribute("hidden", "")
    }
  }, [findable, mounted, env])
  useIsoLayoutEffect(() => {
    finder.current?.sync()
  })
  // Development: a stylesheet hiding [hidden] defeats find-in-page (react-spectrum#7160).
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node || !findable || open) return
    if (
      node.getAttribute("hidden") === "until-found" &&
      getComputedStyle(node).display === "none"
    ) {
      console.warn(
        "[rind-ui] collapsible: the closed content computes display: none, so find-in-page cannot reveal it (a stylesheet sets [hidden] { display: none }?)",
      )
    }
  })
  const api = useApi(ctx, false, "keyboard", false, false, "button")
  // Closed and settled: hidden. until-found is a boolean `hidden` for React (server HTML
  // carries hidden=""), upgraded right after commit by the until-found module (hidden-content).
  const hidden = settledClosed
  const props = mergeProps(
    {
      ...normalizeProps(api.content(hidden)),
      style: {
        "--rind-collapsible-content-height": initialSize,
        "--rind-collapsible-content-width": initialSize,
      } as React.CSSProperties, // custom properties are not in CSSProperties' keys
      ref: composeRefs(composeRefs(el, ctx.contentEl), ref),
    },
    rest,
  )
  if (!mounted) return null
  return renderPart("div", props, render, { open, disabled: ctx.disabled })
}

function Indicator({ render, ...rest }: PartProps<"span">) {
  const ctx = useCollapsible("Indicator")
  const api = useApi(ctx, false, "keyboard", false, false, "button")
  const props = mergeProps(normalizeProps(api.indicator()), rest)
  return renderPart("span", props, render, {
    open: ctx.view.matches("open"),
    disabled: ctx.disabled,
  })
}

export const Collapsible = { Root, Trigger, Content, Indicator }
