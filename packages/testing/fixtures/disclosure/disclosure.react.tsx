import {
  type DomEnvironment,
  localeAttrs,
  type Modality,
  type Service,
  untilFound,
} from "@rind-ui/core"
import {
  mergeProps,
  normalizeProps,
  type PartRegistry,
  type RenderProp,
  renderPart,
  useEnvironment,
  useMachine,
  useModality,
  usePartRegistry,
  useRegisterPart,
  useRenderedId,
  useRootId,
  useSelector,
} from "@rind-ui/react"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { connect, type DisclosurePart } from "./disclosure.connect"
import {
  type DisclosureMachine,
  type DisclosureProps,
  disclosureMachine,
} from "./disclosure.machine"

interface Ctx {
  readonly hiddenUntilFound: boolean
  readonly service: Service<DisclosureMachine>
  readonly root: string
  readonly registry: PartRegistry<DisclosurePart>
}
const DisclosureContext = createContext<Ctx | null>(null)

function useDisclosure(part: string): Ctx {
  const ctx = useContext(DisclosureContext)
  if (!ctx) throw new Error(`Disclosure.${part} must be inside Disclosure.Root`)
  return ctx
}

/** Parts subscribe to the slices they render (open, rendered ids), not the whole snapshot. */
function useApi(ctx: Ctx, focus: { triggerFocused?: boolean; modality?: Modality } = {}) {
  const open = useSelector(ctx.service, (view) => view.matches("open"))
  const revealed = useSelector(ctx.service, (view) => view.context.revealed)
  const content = useRenderedId(ctx.registry, "content")
  const state = { open, revealed, hiddenUntilFound: ctx.hiddenUntilFound, ...focus }
  return connect(state, ctx.service.send, {
    root: ctx.root,
    rendered: content === undefined ? {} : { content },
  })
}

type Own<T extends keyof React.JSX.IntrinsicElements> = Omit<
  ComponentPropsWithRef<T>,
  "children"
> & {
  readonly children?: ReactNode
  readonly render?: RenderProp<{ open: boolean }>
}

export interface RootProps extends DisclosureProps, Own<"div"> {
  readonly env?: DomEnvironment
}

function Root({
  open,
  defaultOpen,
  onOpenChange,
  closeOnEscape,
  autoCloseMs,
  hiddenUntilFound = false,
  env,
  id,
  render,
  ...rest
}: RootProps) {
  const root = useRootId(id)
  // Content is expected: the trigger's aria-controls renders on the server too.
  const registry = usePartRegistry<DisclosurePart>({
    scope: "disclosure",
    root,
    expected: ["content"],
  })
  const { service, view } = useMachine(
    disclosureMachine,
    { open, defaultOpen, onOpenChange, closeOnEscape, autoCloseMs, hiddenUntilFound },
    env,
  )
  // Stable: parts re-render through their selectors, not through context.
  const ctx: Ctx = useMemo(
    () => ({ service, root, registry, hiddenUntilFound }),
    [service, root, registry, hiddenUntilFound],
  )
  const api = useApi(ctx)
  return (
    <DisclosureContext value={ctx}>
      {renderPart("div", mergeProps(normalizeProps(api.root()), rest), render, {
        open: view.matches("open"),
      })}
    </DisclosureContext>
  )
}

function Trigger({ render, ...rest }: Own<"button">) {
  const ctx = useDisclosure("Trigger")
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the trigger is mounted.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const api = useApi(ctx, { triggerFocused: focused, modality })
  const props = mergeProps(
    normalizeProps(api.trigger()),
    { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
    rest,
  )
  useRegisterPart(ctx.registry, "trigger", String(props["id"]))
  return renderPart("button", props, render, { open: api.open })
}

function Content({ render, portal, ...rest }: Own<"div"> & { readonly portal?: boolean }) {
  const ctx = useDisclosure("Content")
  const api = useApi(ctx)
  const env = useEnvironment()
  // Outside the root, the part carries the root's direction and language itself.
  const part = portal ? { ...api.content(), ...localeAttrs(env.locale) } : api.content()
  const node = useRef<HTMLDivElement | null>(null)
  const props = mergeProps(normalizeProps(part), { ref: node }, rest)
  useRegisterPart(ctx.registry, "content", String(props["id"]))
  useUntilFound(ctx, node)
  const element = renderPart("div", props, render, { open: api.open })
  return portal && typeof document !== "undefined" ? createPortal(element, document.body) : element
}

/** hidden="until-found" kept imperatively, beforematch → OPEN with reason find-in-page. */
function useUntilFound(ctx: Ctx, node: RefObject<HTMLDivElement | null>) {
  const env = useEnvironment()
  const handle = useRef<ReturnType<typeof untilFound> | null>(null)
  useLayoutEffect(() => {
    const el = node.current
    if (!ctx.hiddenUntilFound || !el) return
    const h = untilFound(el, {
      scheduler: env.scheduler,
      isOpen: () => ctx.service.getSnapshot().state === "open",
      onReveal: () => ctx.service.send({ type: "OPEN", reason: "find-in-page" }),
    })
    handle.current = h
    return () => {
      h.dispose()
      handle.current = null
    }
  }, [ctx, env, node])
  // After every commit (React would otherwise leave the browser's removal in place).
  useLayoutEffect(() => {
    handle.current?.sync()
  })
}

export const Disclosure = { Root, Trigger, Content }
