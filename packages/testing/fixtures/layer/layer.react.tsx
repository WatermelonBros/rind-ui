import {
  announcerCapability,
  clipboardCapability,
  dateClockCapability,
  getLayerStack,
  type LayerMeta,
  layoutCapability,
  type Modality,
  partId,
  type Service,
  validityCapability,
  visibilityCapability,
} from "@rind-ui/core"
import {
  LayerProvider,
  mergeProps,
  normalizeProps,
  Portal as PortalPart,
  type PresenceOptions,
  useEnvironment,
  useMachine,
  useModality,
  useParentLayer,
  usePresence,
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
  useMemo,
  useRef,
  useState,
} from "react"
import { connect, type LayerPart } from "./layer.connect"
import { type LayerMachine, type LayerProps, layerIdOf, layerMachine } from "./layer.machine"

interface Ctx {
  readonly service: Service<LayerMachine>
  readonly root: string
  readonly modal: boolean
  readonly kind: "dialog" | "menu" | undefined
}
const LayerCtx = createContext<Ctx | null>(null)
const useLayer = (part: string) => {
  const ctx = useContext(LayerCtx)
  if (!ctx) throw new Error(`Layer.${part} must be inside Layer.Root`)
  return ctx
}

/** The stack's metadata for this layer, followed while open. */
function useMeta(ctx: Ctx, open: boolean): LayerMeta | undefined {
  const env = useEnvironment()
  const [meta, setMeta] = useState<LayerMeta | undefined>(undefined)
  useEffect(() => {
    if (!open || typeof document === "undefined") return setMeta(undefined)
    const root = env.dom.getRootNode()
    const stack = getLayerStack("body" in root ? root : root.ownerDocument)
    const read = () => setMeta(stack.get(layerIdOf(ctx.root))?.meta())
    read()
    return stack.subscribe(read)
  }, [ctx.root, env, open])
  return meta
}

function useApi(
  ctx: Ctx,
  focus: { focusWithin?: boolean; triggerFocused?: boolean; modality?: Modality } = {},
) {
  const open = useSelector(ctx.service, (view) => view.matches("open"))
  const meta = useMeta(ctx, open)
  return connect(
    { open, modal: ctx.modal, kind: ctx.kind, meta, ...focus },
    ctx.service.send,
    ctx.root,
  )
}

function Trigger({ children, ...rest }: Own<"button">) {
  const ctx = useLayer("Trigger")
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const api = useApi(ctx, { triggerFocused: focused, modality })
  const props = mergeProps(
    normalizeProps(api.trigger()),
    { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
    rest as Record<string, unknown>,
  )
  // connect gives type="button"; spelled out so the button type is visible here too.
  return createElement("button", { type: "button", ...props }, children)
}

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly children?: ReactNode
}

export interface RootProps extends Omit<LayerProps, "root" | "parent"> {
  readonly id?: string
  readonly children?: ReactNode
}

function Root({ open, defaultOpen, onOpenChange, modal, kind, id, children }: RootProps) {
  const root = useRootId(id)
  const parent = useParentLayer()
  const env = useEnvironment(
    announcerCapability,
    clipboardCapability,
    layoutCapability,
    validityCapability,
    visibilityCapability,
    dateClockCapability,
  )
  const { service } = useMachine(
    layerMachine,
    {
      open,
      defaultOpen,
      onOpenChange,
      modal,
      kind,
      root,
      parent,
    },
    env,
  )
  const ctx = useMemo(
    () => ({ service, root, modal: modal !== false, kind }),
    [service, root, modal, kind],
  )
  return <LayerCtx value={ctx}>{children}</LayerCtx>
}

function part<T extends keyof React.JSX.IntrinsicElements>(tag: T, name: LayerPart) {
  return function Part({ children, ...rest }: Own<T>) {
    const ctx = useLayer(name)
    const api = useApi(ctx)
    const props = mergeProps(normalizeProps(api[name]()), rest as Record<string, unknown>)
    return createElement(tag, props, children)
  }
}

function Portal({ children, container }: { children?: ReactNode; container?: Element | null }) {
  const ctx = useLayer("Portal")
  const env = useEnvironment()
  return (
    <PortalPart
      container={container}
      logicalParent={() => env.dom.getById(partId("layer", ctx.root, "trigger"))}
    >
      {children}
    </PortalPart>
  )
}

/** A part that stays mounted while its exit animations run. */
function presencePart<T extends "div">(tag: T, name: LayerPart, options: PresenceOptions = {}) {
  return function Part({ children, ...rest }: Own<T>) {
    const ctx = useLayer(name)
    const [focusWithin, setFocusWithin] = useState(false)
    const api = useApi(ctx, { focusWithin })
    const node = useRef<HTMLDivElement | null>(null)
    const { mounted } = usePresence(api.open, node, options)
    if (!mounted) return null
    const props = mergeProps(
      normalizeProps(api[name]()),
      {
        ref: node,
        // React focus events bubble: focus anywhere inside the part.
        onFocus: () => setFocusWithin(true),
        onBlur: (e: { relatedTarget: EventTarget | null; currentTarget: Element }) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false)
        },
      },
      rest as Record<string, unknown>,
    )
    const inner = createElement(tag, props, children)
    // Layers opened from inside this one are its children (explicit parentage).
    return name === "content" ? (
      <LayerProvider layer={layerIdOf(ctx.root)} kind={ctx.kind ?? "dialog"}>
        {inner}
      </LayerProvider>
    ) : (
      inner
    )
  }
}

export const Layer = {
  Root,
  Trigger,
  Portal,
  // It holds the content: it stays while the content's exit animations run.
  Positioner: presencePart("div", "positioner", { subtree: true }),
  Backdrop: presencePart("div", "backdrop"),
  Content: presencePart("div", "content"),
  Title: part("h2", "title"),
  Close: part("button", "close"),
}
