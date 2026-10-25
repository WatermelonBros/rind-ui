/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

export interface SplitterChangeDetails {
  readonly reason: ChangeDetails<SplitterEvent>["reason"]
  readonly event: ChangeDetails<SplitterEvent>["event"]
  /** Prevents the change (uncontrolled) or refuses it (controlled). */
  cancel(): void
}

export interface SplitterState {
  readonly sizes: readonly number[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly orientation: SplitterOrientation
}

interface Ctx {
  readonly api: Accessor<ReturnType<typeof splitterConnect>>
  readonly state: SplitterState
  readonly send: (e: SplitterEvent) => void
  readonly handles: (Element | null)[]
  readonly press: (e: PointerEvent) => boolean
  readonly setHandleDisabled: (index: number, disabled: boolean | undefined) => void
  readonly orientation: Accessor<SplitterOrientation>
  readonly dir: Accessor<"ltr" | "rtl">
}

const SplitterContext = createContext<Ctx>()
function useSplitter(part: string): Ctx {
  const ctx = useContext(SplitterContext)
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

export type SplitterRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "onChange" | "dir"
> & {
  /** The panels and handles. */
  readonly children?: JSX.Element | ((state: SplitterState) => JSX.Element)
  /** One entry per panel: `min`, `max`, `collapsible`, `collapsedSize`. */
  readonly panels: readonly SplitterPanel[]
  /** Controlled sizes in percent, one per panel, summing to 100. */
  readonly sizes?: readonly number[] | undefined
  /** Uncontrolled initial sizes (default an equal split). */
  readonly defaultSizes?: readonly number[] | undefined
  /** Every change (each pointer move); not when the parent changes `sizes`. */
  readonly onSizesChange?:
    | ((sizes: readonly number[], details: SplitterChangeDetails) => void)
    | undefined
  /** Once at the end of each interaction that changed the sizes: the hook to save a layout. */
  readonly onSizesCommit?:
    | ((sizes: readonly number[], details: SplitterCommitDetails) => void)
    | undefined
  /** The panel axis. Default: `horizontal` (side by side). */
  readonly orientation?: SplitterOrientation | undefined
  /** Percent per arrow key. Default: 5. */
  readonly step?: number | undefined
  /** No handle moves or is focusable. */
  readonly disabled?: boolean | undefined
  /** Reading direction; mirrors a horizontal Splitter. Default: the provider's. */
  readonly dir?: "ltr" | "rtl" | undefined
  /** Another element: a function receiving the props to spread and the splitter's state. */
  readonly render?: RenderProp<SplitterState> | undefined
}

/** Resizable panels on one axis (APG Window Splitter). */
function Root(props: SplitterRootProps) {
  const [own, rest] = splitProps(props, [
    "panels",
    "sizes",
    "defaultSizes",
    "onSizesChange",
    "onSizesCommit",
    "orientation",
    "step",
    "disabled",
    "dir",
    "render",
    "id",
    "children",
  ])
  const env = useEnvironment()
  const instance = useRootId(() => own.id)
  const locale = useLocale(
    () => undefined,
    () => own.dir,
  )
  const orientation = () => own.orientation ?? "horizontal"
  const vertical = () => orientation() === "vertical"
  const disabled = () => own.disabled === true
  const [rootEl, setRootEl] = createSignal<Element | null>(null)
  const handles: (Element | null)[] = []
  const [layout, setLayout] = createSignal<{ space: number; scale: number } | null>(null)
  // Same content, same array: the machine's onProps compares content anyway.
  const constraints = createMemo(
    () => resolveConstraints(own.panels, layout()?.space ?? null),
    undefined,
    {
      equals: sameConstraints,
    },
  )
  const [handleDisabled, setHandleDisabledState] = createSignal<readonly boolean[]>([])
  const setHandleDisabled = (index: number, off: boolean | undefined) =>
    setHandleDisabledState((prev) => {
      if ((prev[index] === true) === (off === true)) return prev
      const next = [...prev]
      next[index] = off === true
      return next
    })
  const drag = pointerDragSession()
  let pressed: number | null = null
  const focusHandle = (index: number, modality: Modality) => {
    const el = handles[index]
    if (el instanceof HTMLElement) void focusSafely(el, env, "programmatic", modality)
  }
  const machineProps = () => ({
    sizes: own.sizes,
    defaultSizes: own.defaultSizes,
    panels: constraints(),
    step: own.step,
    disabled: disabled(),
    handleDisabled: handleDisabled(),
    onSizesChange: own.onSizesChange
      ? (next: readonly number[], details: ChangeDetails<SplitterEvent>) =>
          own.onSizesChange?.(next, {
            reason: details.reason,
            event: details.event,
            cancel: details.cancel,
          })
      : undefined,
    onSizesCommit: (next: readonly number[], details: SplitterCommitDetails) =>
      own.onSizesCommit?.(next, details),
  })
  const { view, send } = useMachine(splitterMachine, machineProps, {
    drag: {
      track: (forward: (m: SplitterDragMessage) => void) =>
        drag.track((m) => {
          if (m.type !== "move") return forward(m)
          if (pressed === null) return
          forward({
            type: "move",
            delta: splitterDelta(pressed, m.fraction, orientation(), layout()?.scale ?? 1),
          })
        }),
    },
    focusHandle,
  })
  const current = createMemo(() => splitterSizes(machineProps(), view().values.sizes))
  const focused = () => view().context.focused
  const modality = useModality(env.modality, () => focused() !== null)
  const dragging = () => view().matches("dragging")
  const api = createMemo(() =>
    splitterConnect({
      instance: instance(),
      orientation: orientation(),
      dir: locale().dir,
      sizes: current(),
      panels: constraints(),
      disabled: disabled(),
      handleDisabled: handleDisabled(),
      focused: focused(),
      modality: modality(),
      draggingHandle: dragging() ? view().context.handle : null,
    }),
  )

  // The panels' space: pixel constraints and the pointer scale follow every resize (RRP#720).
  afterMount(() => {
    createEffect(() => {
      const el = rootEl()
      const isVertical = vertical()
      if (!(el instanceof HTMLElement)) return
      const update = () => {
        const next = measure(el, handles, isVertical)
        setLayout((prev) =>
          prev?.space === next?.space && prev?.scale === next?.scale ? prev : next,
        )
      }
      update()
      const win = el.ownerDocument.defaultView
      if (!win || typeof win.ResizeObserver !== "function") return
      const observer = new win.ResizeObserver(update)
      observer.observe(el)
      for (const h of handles) if (h) observer.observe(h)
      onCleanup(() => observer.disconnect())
    })
  })

  const state = reactive<SplitterState>(() => ({
    sizes: current(),
    dragging: dragging(),
    disabled: disabled(),
    orientation: orientation(),
  }))
  const ctx: Ctx = {
    api,
    state,
    send,
    handles,
    orientation,
    dir: () => locale().dir,
    setHandleDisabled,
    press: (e) => {
      const el = untrack(rootEl)
      if (!(el instanceof HTMLElement) || !isDragPress(e) || drag.active) return false
      pressed = drag.press(
        el,
        e,
        splitterDragAxis({ orientation: orientation(), dir: locale().dir }),
      )
      return true
    },
  }
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(api().root()), ref: setRootEl }, rest),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <SplitterContext.Provider value={ctx}>
      {renderPart(own.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </SplitterContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the splitter's state. */
  readonly render?: RenderProp<SplitterState> | undefined
  readonly children?: JSX.Element | ((state: SplitterState) => JSX.Element)
}

export type SplitterPanelProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** The panel's index in the Root's `panels` (known on the server). */
  readonly index: number
}

/** Panel `index`: its size is `flex-grow` on a zero basis. */
function Panel(props: SplitterPanelProps) {
  const [local, rest] = splitProps(props, ["index", "render", "children"])
  const ctx = useSplitter("Panel")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().panel(local.index)), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type SplitterHandleProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  /** The boundary after panel `index` (its primary panel). */
  readonly index: number
  /** Disables this handle only. */
  readonly disabled?: boolean | undefined
}

/** The focusable `separator` between panel `index` and the next one. */
function Handle(props: SplitterHandleProps) {
  const [local, rest] = splitProps(props, ["index", "disabled", "render", "children"])
  const ctx = useSplitter("Handle")
  const env = useEnvironment()
  createEffect(() => {
    const index = local.index
    ctx.setHandleDisabled(index, local.disabled)
    onCleanup(() => ctx.setHandleDisabled(index, false))
  })
  afterMount(() => {
    createEffect(() => {
      const index = local.index
      const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
      warnUnnamedHandle(index, named)
    })
    // The modality tracker must see the pointerdown that comes before the handle's focus.
    onCleanup(env.modality.subscribe(() => {}))
  })
  const index = untrack(() => local.index)
  onCleanup(() => {
    ctx.handles[index] = null
  })
  const merged = createMemo(() => {
    const at = local.index
    return mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().handle(at, { disabled: local.disabled })), {
          onPointerDown: (e: PointerEvent) => {
            const el = e.currentTarget
            if (!(el instanceof Element) || el.hasAttribute("data-disabled") || !ctx.press(e))
              return
            // No text selection and no native focus: the machine focuses without a ring.
            e.preventDefault()
            ctx.send({
              type: "POINTER.DOWN",
              handle: at,
              modality: e.pointerType === "touch" ? "touch" : "pointer",
            })
          },
          onKeyDown: (e: KeyboardEvent) => {
            const event = splitterKeyEvent(describeKey(e, env), at, {
              orientation: ctx.orientation(),
              dir: ctx.dir(),
              dragging: ctx.state.dragging,
            })
            if (!event || e.defaultPrevented) return
            e.preventDefault()
            // Escape ends the drag only: a surrounding layer stays open.
            if (event.type === "DRAG.CANCEL") e.stopPropagation()
            ctx.send(event)
          },
          onFocusIn: (e: FocusEvent) => {
            if (e.currentTarget instanceof Element)
              ctx.send({ ...focusEvent(e.currentTarget, env.modality), handle: at })
          },
          onFocusOut: () => ctx.send({ ...blurEvent(env.modality), handle: at }),
        }),
        ref: (node: Element | null) => {
          ctx.handles[index] = node
        },
      },
      rest,
    )
  })
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** The parts, by name: `splitter.parts.ts` re-exports them as the `Splitter` namespace. */
export { Handle, Panel, Root }
