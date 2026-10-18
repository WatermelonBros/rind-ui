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
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

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
  readonly api: ReturnType<typeof splitterConnect>
  readonly state: SplitterState
  readonly send: (e: SplitterEvent) => void
  readonly handles: { current: (HTMLElement | null)[] }
  readonly press: (e: PointerEvent<HTMLElement>) => boolean
  readonly setHandleDisabled: (index: number, disabled: boolean | undefined) => void
  readonly orientation: SplitterOrientation
  readonly dir: "ltr" | "rtl"
}

const SplitterContext = createContext<Ctx | null>(null)
function useSplitter(part: string): Ctx {
  const ctx = useContext(SplitterContext)
  if (!ctx) throw new Error(`Splitter.${part} must be inside Splitter.Root`)
  return ctx
}

const px = (style: CSSStyleDeclaration, name: string) =>
  Number.parseFloat(style.getPropertyValue(name)) || 0

/** The Root's content box on the axis, and that minus its handles (the panels' space). */
function measure(root: HTMLElement, handles: readonly (HTMLElement | null)[], vertical: boolean) {
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
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "dir"
> & {
  /** The panels and handles. */
  readonly children?: ReactNode
  /** One entry per panel: `min`, `max`, `collapsible`, `collapsedSize`. */
  readonly panels: readonly SplitterPanel[]
  /** Controlled sizes in percent, one per panel, summing to 100. */
  readonly sizes?: readonly number[]
  /** Uncontrolled initial sizes (default an equal split). */
  readonly defaultSizes?: readonly number[]
  /** Every change (each pointer move); not when the parent changes `sizes`. */
  readonly onSizesChange?: (sizes: readonly number[], details: SplitterChangeDetails) => void
  /** Once at the end of each interaction that changed the sizes: the hook to save a layout. */
  readonly onSizesCommit?: (sizes: readonly number[], details: SplitterCommitDetails) => void
  /** The panel axis. Default: `horizontal` (side by side). */
  readonly orientation?: SplitterOrientation
  /** Percent per arrow key. Default: 5. */
  readonly step?: number
  /** No handle moves or is focusable. */
  readonly disabled?: boolean
  /** Reading direction; mirrors a horizontal Splitter. Default: the provider's. */
  readonly dir?: "ltr" | "rtl"
  /** Another element or a render function receiving the props and the splitter's state. */
  readonly render?: RenderProp<SplitterState>
}

/** Resizable panels on one axis (APG Window Splitter). */
function Root({
  panels,
  sizes,
  defaultSizes,
  onSizesChange,
  onSizesCommit,
  orientation = "horizontal",
  step,
  disabled = false,
  dir: ownDir,
  render,
  id,
  ref,
  children,
  ...rest
}: SplitterRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const { dir } = useLocale(undefined, ownDir)
  const vertical = orientation === "vertical"
  const root = useRef<HTMLElement | null>(null)
  const handles = useRef<(HTMLElement | null)[]>([])
  const [layout, setLayout] = useState<{ space: number; scale: number } | null>(null)
  // Same content, same array: the machine's onProps compares content anyway.
  const resolved = resolveConstraints(panels, layout?.space ?? null)
  const constraints = useRef<SplitterConstraints[]>(resolved)
  if (!sameConstraints(constraints.current, resolved)) constraints.current = resolved
  const [handleDisabled, setHandleDisabledState] = useState<readonly boolean[]>([])
  const [setHandleDisabled] = useState(
    () => (index: number, off: boolean | undefined) =>
      setHandleDisabledState((prev) => {
        if ((prev[index] === true) === (off === true)) return prev
        const next = [...prev]
        next[index] = off === true
        return next
      }),
  )
  const scale = useRef(1)
  scale.current = layout?.scale ?? 1
  const axis = { orientation, dir }
  const axisRef = useRef(axis)
  axisRef.current = axis
  const [drag] = useState(() => pointerDragSession())
  const pressed = useRef<number | null>(null)
  const focusHandle = (index: number, modality: Modality) => {
    const el = handles.current[index]
    if (el) void focusSafely(el, env, "programmatic", modality)
  }
  const focusRef = useRef(focusHandle)
  focusRef.current = focusHandle
  // The machine's environment reads refs, so one object serves every render.
  const [machineEnv] = useState(() => ({
    drag: {
      track: (send: (m: SplitterDragMessage) => void) =>
        drag.track((m) => {
          if (m.type !== "move") return send(m)
          const from = pressed.current
          if (from === null) return
          const delta = splitterDelta(from, m.fraction, axisRef.current.orientation, scale.current)
          send({ type: "move", delta })
        }),
    },
    focusHandle: (index: number, modality: Modality) => focusRef.current(index, modality),
  }))
  const machineProps = {
    sizes,
    defaultSizes,
    panels: constraints.current,
    step,
    disabled,
    handleDisabled,
    onSizesChange: onSizesChange
      ? (next: readonly number[], details: ChangeDetails<SplitterEvent>) =>
          onSizesChange(next, {
            reason: details.reason,
            event: details.event,
            cancel: details.cancel,
          })
      : undefined,
    onSizesCommit,
  }
  const { view, send } = useMachine(splitterMachine, machineProps, machineEnv)
  const current = splitterSizes(machineProps, view.values.sizes)
  const focused = view.context.focused
  const modality = useModality(env.modality, focused !== null)
  const dragging = view.matches("dragging")
  const api = splitterConnect({
    instance,
    orientation,
    dir,
    sizes: current,
    panels: constraints.current,
    disabled,
    handleDisabled,
    focused,
    modality,
    draggingHandle: dragging ? view.context.handle : null,
  })

  // The panels' space: pixel constraints and the pointer scale follow every resize (RRP#720).
  useIsoLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const update = () =>
      setLayout((prev) => {
        const next = measure(el, handles.current, vertical)
        return prev?.space === next?.space && prev?.scale === next?.scale ? prev : next
      })
    update()
    const win = el.ownerDocument.defaultView
    if (!win || typeof win.ResizeObserver !== "function") return
    const observer = new win.ResizeObserver(update)
    observer.observe(el)
    for (const h of handles.current) if (h) observer.observe(h)
    return () => observer.disconnect()
  }, [vertical])

  const state: SplitterState = { sizes: current, dragging, disabled, orientation }
  const ctx: Ctx = {
    api,
    state,
    send,
    handles,
    orientation,
    dir,
    setHandleDisabled,
    press: (e) => {
      const el = root.current
      if (!el || !isDragPress(e) || drag.active) return false
      pressed.current = drag.press(el, e.nativeEvent, splitterDragAxis(axis))
      return true
    },
  }
  const props = mergeProps({ ...normalizeProps(api.root()), ref: composeRefs(root, ref) }, rest)
  return (
    <SplitterContext value={ctx}>
      {renderPart("div", { ...props, children }, render, state)}
    </SplitterContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the splitter's state. */
  readonly render?: RenderProp<SplitterState>
}

export type SplitterPanelProps = PartProps<"div"> & {
  /** The panel's index in the Root's `panels` (known on the server). */
  readonly index: number
}

/** Panel `index`: its size is `flex-grow` on a zero basis. */
function Panel({ index, render, ...rest }: SplitterPanelProps) {
  const ctx = useSplitter("Panel")
  const props = mergeProps(normalizeProps(ctx.api.panel(index)), rest)
  return renderPart("div", props, render, ctx.state)
}

export type SplitterHandleProps = PartProps<"div"> & {
  /** The boundary after panel `index` (its primary panel). */
  readonly index: number
  /** Disables this handle only. */
  readonly disabled?: boolean
}

/** The focusable `separator` between panel `index` and the next one. */
function Handle({ index, disabled, render, ref, ...rest }: SplitterHandleProps) {
  const ctx = useSplitter("Handle")
  const env = useEnvironment()
  const { send, setHandleDisabled } = ctx
  useIsoLayoutEffect(() => {
    setHandleDisabled(index, disabled)
    return () => setHandleDisabled(index, false)
  }, [index, disabled, setHandleDisabled])
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  useEffect(() => warnUnnamedHandle(index, named), [index, named])
  // The modality tracker must see the pointerdown that comes before the handle's focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.handle(index, { disabled })), {
        onPointerDown: (e: PointerEvent<HTMLElement>) => {
          if (e.currentTarget.hasAttribute("data-disabled") || !ctx.press(e)) return
          // No text selection and no native focus: the machine focuses without a ring.
          e.preventDefault()
          send({
            type: "POINTER.DOWN",
            handle: index,
            modality: e.pointerType === "touch" ? "touch" : "pointer",
          })
        },
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          const event = splitterKeyEvent(describeKey(e.nativeEvent, env), index, {
            orientation: ctx.orientation,
            dir: ctx.dir,
            dragging: ctx.state.dragging,
          })
          if (!event || e.defaultPrevented) return
          e.preventDefault()
          // Escape ends the drag only: a surrounding layer stays open.
          if (event.type === "DRAG.CANCEL") e.stopPropagation()
          send(event)
        },
        onFocus: (e: { currentTarget: Element }) =>
          send({ ...focusEvent(e.currentTarget, env.modality), handle: index }),
        onBlur: () => send({ ...blurEvent(env.modality), handle: index }),
      }),
      ref: composeRefs((el: HTMLElement | null) => {
        ctx.handles.current[index] = el
      }, ref),
    },
    rest,
  )
  return renderPart("div", props, render, ctx.state)
}

export const Splitter = { Root, Panel, Handle }
