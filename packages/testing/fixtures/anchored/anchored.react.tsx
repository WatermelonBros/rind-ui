import { domPositioning, type Modality, type Service } from "@rind-ui/core"
import {
  mergeProps,
  normalizeProps,
  Portal,
  useEnvironment,
  useMachine,
  useModality,
  useRootId,
  useSelector,
} from "@rind-ui/react"
import {
  type ComponentPropsWithRef,
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react"
import { type AnchoredPart, connect } from "./anchored.connect"
import {
  type AnchoredMachine,
  type AnchoredProps,
  anchoredIds,
  anchoredMachine,
  optionsOf,
} from "./anchored.machine"

interface Ctx {
  readonly service: Service<AnchoredMachine>
  readonly root: string
  readonly props: AnchoredProps
  readonly keepMounted: boolean
}
const AnchoredCtx = createContext<Ctx | null>(null)
const useAnchored = (part: string) => {
  const ctx = useContext(AnchoredCtx)
  if (!ctx) throw new Error(`Anchored.${part} must be inside Anchored.Root`)
  return ctx
}

export interface RootProps extends Omit<AnchoredProps, "root"> {
  readonly id?: string
  /** Keep the positioner mounted (hidden) while closed: reopening must not flash. */
  readonly keepMounted?: boolean
  readonly children?: ReactNode
}

function Root({ id, keepMounted = false, children, ...rest }: RootProps) {
  const root = useRootId(id)
  const env = useEnvironment()
  // Positioning only for anchored components: not part of domEnvironment().
  const withPosition = useMemo(() => ({ ...env, position: domPositioning(env) }), [env])
  const props: AnchoredProps = { ...rest, root }
  const { service } = useMachine(anchoredMachine, props, withPosition)
  const ctx: Ctx = { service, root, props, keepMounted }
  return <AnchoredCtx value={ctx}>{children}</AnchoredCtx>
}

function useParts(
  ctx: Ctx,
  dir?: "ltr" | "rtl",
  focusWithin?: boolean,
  trigger?: { readonly focused: boolean; readonly modality: Modality },
) {
  const open = useSelector(ctx.service, (v) => v.matches("open"))
  const placement = useSelector(ctx.service, (v) => v.context.placement)
  return connect(
    {
      open,
      placement,
      dir,
      focusWithin,
      triggerFocused: trigger?.focused,
      modality: trigger?.modality,
      manual: optionsOf(ctx.props).mode === "manual",
    },
    ctx.service.send,
    ctx.root,
  )
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly children?: ReactNode
}

function part<T extends keyof React.JSX.IntrinsicElements>(tag: T, name: AnchoredPart) {
  return function Part({ children, ...rest }: Own<T>) {
    const ctx = useAnchored(name)
    const parts = useParts(ctx)
    const props = mergeProps(normalizeProps(parts[name]()), rest as Record<string, unknown>)
    return createElement(tag, props, children)
  }
}

/** The portalled positioner: carries the anchor's direction, mounted while open (or kept). */
function Positioner({ children, ...rest }: Own<"div">) {
  const ctx = useAnchored("Positioner")
  const open = useSelector(ctx.service, (v) => v.matches("open"))
  const [dir, setDir] = useState<"ltr" | "rtl" | undefined>(undefined)
  useLayoutEffect(() => {
    if (!open) return
    const trigger = document.getElementById(anchoredIds(ctx.root).trigger)
    const found = trigger?.closest("[dir]")?.getAttribute("dir")
    setDir(found === "rtl" ? "rtl" : "ltr")
  }, [open, ctx.root])
  const parts = useParts(ctx, dir)
  if (!open && !ctx.keepMounted) return null
  const props = mergeProps(
    normalizeProps(parts.positioner()),
    open ? {} : { hidden: true },
    rest as Record<string, unknown>,
  )
  return (
    <Portal>
      <div {...props}>{children}</div>
    </Portal>
  )
}

/** The trigger, with its focus ring by modality. */
function Trigger({ children, ...rest }: Own<"button">) {
  const ctx = useAnchored("Trigger")
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const parts = useParts(ctx, undefined, undefined, { focused, modality })
  const props = mergeProps(
    normalizeProps(parts.trigger()),
    { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
    rest as Record<string, unknown>,
  )
  // connect gives type="button"; spelled out so the button type is visible here too.
  return (
    <button type="button" {...props}>
      {children}
    </button>
  )
}

/** The content, tracking focus inside it (React focus events bubble). */
function Content({ children, ...rest }: Own<"div">) {
  const ctx = useAnchored("Content")
  const [focusWithin, setFocusWithin] = useState(false)
  const parts = useParts(ctx, undefined, focusWithin)
  const props = mergeProps(
    normalizeProps(parts.content()),
    {
      onFocus: () => setFocusWithin(true),
      onBlur: (e: { relatedTarget: EventTarget | null; currentTarget: Element }) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false)
      },
    },
    rest as Record<string, unknown>,
  )
  return <div {...props}>{children}</div>
}

export const Anchored = {
  Root,
  Trigger,
  Positioner,
  Content,
  Arrow: part("div", "arrow"),
  Title: part("h2", "title"),
  Close: part("button", "close"),
}

/** The anchored popover the stories and tests render. */
export function AnchoredExample({
  label = "Open",
  title = "Details",
  arrow = false,
  children,
  ...props
}: Omit<RootProps, "arrow"> & { label?: string; title?: string; arrow?: boolean }) {
  return (
    <Anchored.Root {...props} arrow={arrow}>
      <Anchored.Trigger>{label}</Anchored.Trigger>
      <Anchored.Positioner>
        <Anchored.Content>
          {arrow ? <Anchored.Arrow /> : null}
          <Anchored.Title>{title}</Anchored.Title>
          <input aria-label="Note" />
          {children}
          <Anchored.Close>Close</Anchored.Close>
        </Anchored.Content>
      </Anchored.Positioner>
    </Anchored.Root>
  )
}
