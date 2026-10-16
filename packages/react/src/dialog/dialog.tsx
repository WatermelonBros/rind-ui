import {
  DIALOG_PARENT_KINDS,
  type DialogMessages,
  type DialogProps,
  dialogConnect,
  dialogLayerId,
  dialogMachine,
  dialogMessages,
  getLayerStack,
  type HeadingLevel,
  type LayerMeta,
  type MessageOverrides,
  type Modality,
  partId,
  type Service,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type Dispatch,
  type ReactNode,
  type Ref,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { Heading } from "../heading/heading"
import { joinHandlers } from "../join-handlers"
import { LayerProvider, useParentLayer } from "../layer-context"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    dialog: DialogMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

const SCOPE = "dialog"

interface Ctx {
  readonly service: Service<typeof dialogMachine>
  readonly root: string
  readonly modal: boolean
  readonly keepMounted: boolean
  readonly titleFocusTarget: boolean
  readonly messages: DialogMessages
  readonly contentMounted: boolean
  readonly setContentMounted: (on: boolean) => void
  readonly titleLevel: HeadingLevel
  readonly setTitleLevel: (level: HeadingLevel) => void
  /** Ids of the mounted title and description: the only source of the ARIA references. */
  readonly rendered: Rendered
  readonly setRendered: Dispatch<SetStateAction<Rendered>>
}

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }
const DialogContext = createContext<Ctx | null>(null)
function useDialog(part: string): Ctx {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error(`Dialog.${part} must be inside Dialog.Root`)
  return ctx
}

/** The stack's metadata for this layer, followed while open. */
function useMeta(root: string, open: boolean): LayerMeta | undefined {
  const env = useEnvironment()
  const [meta, setMeta] = useState<LayerMeta | undefined>(undefined)
  useEffect(() => {
    if (!open || typeof document === "undefined") return setMeta(undefined)
    const node = env.dom.getRootNode()
    const stack = getLayerStack("body" in node ? node : node.ownerDocument)
    const read = () => setMeta(stack.get(dialogLayerId(SCOPE, root))?.meta())
    read()
    return stack.subscribe(read)
  }, [root, env, open])
  return meta
}

function useApi(
  ctx: Ctx,
  focus: { focusWithin?: boolean; contentFocused?: boolean; modality?: Modality } = {},
) {
  const view = useSelector(ctx.service, (v) => v)
  const open = view.matches("open")
  const meta = useMeta(ctx.root, open)
  return {
    open,
    api: dialogConnect(
      {
        scope: SCOPE,
        instance: ctx.root,
        open,
        modal: ctx.modal,
        opener: view.context.opener,
        closeReason: view.context.closeReason,
        rendered: ctx.rendered,
        contentMounted: ctx.contentMounted,
        meta,
        titleFocusTarget: ctx.titleFocusTarget,
        ...focus,
        messages: ctx.messages,
      },
      ctx.service.send,
    ),
  }
}

/** What `actionsRef` exposes. */
export interface DialogActions {
  open(): void
  close(): void
}

export type DialogRootProps = Omit<DialogProps, "root" | "parent"> & {
  readonly id?: string
  /** Content, backdrop and positioner stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean
  readonly messages?: MessageOverrides<DialogMessages>
  readonly actionsRef?: Ref<DialogActions>
  readonly children?: ReactNode
}

function Root({
  id,
  keepMounted = false,
  messages: ownMessages,
  actionsRef,
  children,
  ...props
}: DialogRootProps) {
  const root = useRootId(id)
  const parent = useParentLayer(DIALOG_PARENT_KINDS)
  const messages = useMessages("dialog", dialogMessages, ownMessages)
  const { service, send } = useMachine(dialogMachine, { ...props, root, parent })
  useImperativeHandle(
    actionsRef,
    () => ({ open: () => send({ type: "OPEN" }), close: () => send({ type: "CLOSE" }) }),
    [send],
  )
  const [contentMounted, setContentMounted] = useState(false)
  const [titleLevel, setTitleLevel] = useState<HeadingLevel>(2)
  const [rendered, setRendered] = useState<Rendered>({})
  const modal = props.modal !== false
  const ctx: Ctx = {
    service,
    root,
    modal,
    keepMounted,
    titleFocusTarget: props.initialFocus === "title",
    messages,
    contentMounted,
    setContentMounted,
    titleLevel,
    setTitleLevel,
    rendered,
    setRendered,
  }
  return <DialogContext value={ctx}>{children}</DialogContext>
}

type Own<T extends keyof React.JSX.IntrinsicElements, S = undefined> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<S>
}

export interface DialogTriggerState {
  readonly open: boolean
}

function Trigger({
  id,
  disabled = false,
  render,
  ref,
  ...rest
}: Own<"button", DialogTriggerState>) {
  const ctx = useDialog("Trigger")
  const { api, open } = useApi(ctx)
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const generated = useId()
  const triggerId = id ?? partId(SCOPE, ctx.root, `trigger-${generated.replace(/:/g, "")}`)
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") api.pressTrigger(triggerId, e.modality)
    },
    disabled: () => disabled,
  })
  const el = useRef<HTMLElement | null>(null)
  const own = normalizeProps(
    api.trigger({ id: triggerId, focused, modality, pressed: press.pressed, disabled }),
  )
  const props = mergeProps(
    {
      ...joinHandlers(own, press.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ...(disabled ? { disabled: true } : {}),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", props, render, { open })
}

/** Presence of an animated part (content, backdrop, positioner). */
function usePartPresence(ctx: Ctx, open: boolean, subtree = false) {
  const node = useRef<HTMLElement | null>(null)
  const presence = usePresence(open, node, { keepMounted: ctx.keepMounted, subtree })
  return { node, ...presence }
}

function Backdrop({ render, ref, ...rest }: Own<"div">) {
  const ctx = useDialog("Backdrop")
  const { api, open } = useApi(ctx)
  const { node, mounted } = usePartPresence(ctx, open)
  // Non-modal dialogs render no backdrop: the page stays usable (zag#3401).
  if (!ctx.modal || !mounted) return null
  const props = mergeProps(
    {
      ...normalizeProps(api.backdrop()),
      hidden: !open && ctx.keepMounted,
      ref: composeRefs(node, ref),
    },
    rest,
  )
  return renderPart("div", props, render, undefined)
}

function Positioner({ render, ref, children, ...rest }: Own<"div">) {
  const ctx = useDialog("Positioner")
  const { api, open } = useApi(ctx)
  // It holds the content: it stays while the content's exit animations run.
  const { node, mounted } = usePartPresence(ctx, open, true)
  if (!mounted) return null
  const props = mergeProps(
    {
      ...normalizeProps(api.positioner()),
      hidden: !open && ctx.keepMounted,
      ref: composeRefs(node, ref),
    },
    { ...rest, children },
  )
  return renderPart("div", props, render, undefined)
}

export interface DialogContentState {
  readonly open: boolean
}

function Content({
  render,
  ref,
  children,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  ...rest
}: Own<"div", DialogContentState>) {
  const ctx = useDialog("Content")
  const env = useEnvironment()
  const [focusWithin, setFocusWithin] = useState(false)
  const [contentFocused, setContentFocused] = useState(false)
  const modality = useModality(env.modality, contentFocused)
  const { api, open } = useApi(ctx, { focusWithin, contentFocused, modality })
  const { node, mounted, state } = usePartPresence(ctx, open)
  const { setContentMounted } = ctx
  useIsoLayoutEffect(() => {
    if (!mounted) return
    setContentMounted(true)
    return () => setContentMounted(false)
  }, [mounted, setContentMounted])
  if (!mounted) return null
  const exiting = !open && state === "exiting"
  const props = mergeProps(
    {
      ...normalizeProps(api.content({ labelledBy, describedBy })),
      hidden: !open && !exiting && ctx.keepMounted,
      // Closing: presses on the exiting content do nothing (mui/base-ui#3153).
      ...(exiting ? { inert: true } : {}),
      // React focus events bubble: focus anywhere inside the content.
      onFocus: (e: { target: EventTarget; currentTarget: Element }) => {
        setFocusWithin(true)
        setContentFocused(e.target === e.currentTarget)
      },
      onBlur: (e: { relatedTarget: EventTarget | null; currentTarget: Element }) => {
        setContentFocused(false)
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false)
      },
      ref: composeRefs(node, ref),
    },
    {
      ...rest,
      // Headings inside the body are one level below the title.
      children: (
        <LayerProvider layer={dialogLayerId(SCOPE, ctx.root)} kind="dialog">
          <Heading.Level level={Math.min(6, ctx.titleLevel + 1) as HeadingLevel}>
            {children}
          </Heading.Level>
        </LayerProvider>
      ),
    },
  )
  return renderPart("div", props, render, { open })
}

/**
 * Registers a title/description part with the Root while it is mounted. React state, not a
 * machine event: StrictMode re-runs this while the service is stopped, which drops events.
 */
function useRegistered(ctx: Ctx, part: "title" | "description") {
  const { setRendered } = ctx
  const id = partId(SCOPE, ctx.root, part)
  useIsoLayoutEffect(() => {
    setRendered((r) => ({ ...r, [part]: id }))
    return () => setRendered((r) => ({ ...r, [part]: undefined }))
  }, [setRendered, part, id])
}

export type DialogTitleProps = Own<"h2"> & {
  /** The heading level (default 2); headings in the content are one level below. */
  readonly level?: HeadingLevel
}

function Title({ level = 2, render, ref, ...rest }: DialogTitleProps) {
  const ctx = useDialog("Title")
  const { api } = useApi(ctx)
  useRegistered(ctx, "title")
  const { setTitleLevel } = ctx
  useIsoLayoutEffect(() => setTitleLevel(level), [level, setTitleLevel])
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag(`h${level}`, render, el)
  const props = mergeProps(
    { ...normalizeProps(api.title({ level, tag })), ref: composeRefs(el, ref) },
    rest,
  )
  return renderPart(`h${level}`, props, render, undefined)
}

function Description({ render, ...rest }: Own<"p">) {
  const ctx = useDialog("Description")
  const { api } = useApi(ctx)
  useRegistered(ctx, "description")
  const props = mergeProps(normalizeProps(api.description()), rest)
  return renderPart("p", props, render, undefined)
}

function CloseTrigger({ id, render, ref, ...rest }: Own<"button">) {
  const ctx = useDialog("CloseTrigger")
  const { api } = useApi(ctx)
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const generated = useId()
  const closeId = id ?? partId(SCOPE, ctx.root, `close-${generated.replace(/:/g, "")}`)
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const el = useRef<HTMLElement | null>(null)
  // No content of its own (an icon): named by messages.close.
  const [empty, setEmpty] = useState(false)
  useIsoLayoutEffect(() => {
    setEmpty((el.current?.textContent ?? "").trim() === "")
  })
  const close = useCallback(
    (m: Parameters<typeof api.pressClose>[0]) => {
      const node = el.current as HTMLButtonElement | null
      // A submit button of a form: close on that form's submit, so the form is still
      // connected when it submits (radix#1109, #1779); an invalid form keeps it open.
      if (node?.type === "submit" && node.form) {
        const form = node.form
        const onSubmit = () => api.pressClose(m)
        form.addEventListener("submit", onSubmit, { once: true })
        env.scheduler.setTimeout(() => form.removeEventListener("submit", onSubmit), 0)
        return
      }
      api.pressClose(m)
    },
    [api, env],
  )
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") close(e.modality)
    },
  })
  const own = normalizeProps(
    api.closeTrigger({ id: closeId, focused, modality, pressed: press.pressed, empty }),
  )
  const props = mergeProps(
    {
      ...joinHandlers(own, press.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("button", props, render, undefined)
}

function Portal(props: PortalProps) {
  const ctx = useDialog("Portal")
  const env = useEnvironment()
  const opener = useSelector(ctx.service, (v) => v.context.opener)
  return <PortalPart logicalParent={() => (opener ? env.dom.getById(opener) : null)} {...props} />
}

export const Dialog = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Positioner,
  Content,
  Title,
  Description,
  CloseTrigger,
}
