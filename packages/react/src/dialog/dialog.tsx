"use client"

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
import { closeOnSubmit } from "@rind-ui/core/internal"
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

interface Ctx {
  /** The family member: `dialog` or `drawer` (scope, names). */
  readonly scope: string
  /** The layer kind: `alertdialog` for a `role="alertdialog"` dialog. */
  readonly kind: "dialog" | "alertdialog" | "drawer"
  readonly role: "dialog" | "alertdialog"
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
export const DialogContext = createContext<Ctx | null>(null)
export function useDialog(part: string): Ctx {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error(`${part} must be inside its Dialog or Drawer Root`)
  return ctx
}

/** The stack's metadata for this layer, followed while open. */
function useMeta(scope: string, root: string, open: boolean): LayerMeta | undefined {
  const env = useEnvironment()
  const [meta, setMeta] = useState<LayerMeta | undefined>(undefined)
  useEffect(() => {
    if (!open || typeof document === "undefined") return setMeta(undefined)
    const node = env.dom.getRootNode()
    const stack = getLayerStack("body" in node ? node : node.ownerDocument)
    const read = () => setMeta(stack.get(dialogLayerId(scope, root))?.meta())
    read()
    return stack.subscribe(read)
  }, [scope, root, env, open])
  return meta
}

export function useApi(
  ctx: Ctx,
  focus: { focusWithin?: boolean; contentFocused?: boolean; modality?: Modality } = {},
) {
  const view = useSelector(ctx.service, (v) => v)
  const open = view.matches("open")
  const meta = useMeta(ctx.scope, ctx.root, open)
  const input = {
    instance: ctx.root,
    open,
    opener: view.context.opener,
    closeReason: view.context.closeReason,
    rendered: ctx.rendered,
    contentMounted: ctx.contentMounted,
    meta,
    titleFocusTarget: ctx.titleFocusTarget,
    ...focus,
    messages: ctx.messages,
  }
  return {
    open,
    /** The connect input, for a family member's own parts (Alert Dialog's Cancel, Action). */
    input,
    api: dialogConnect(
      {
        scope: ctx.scope,
        role: ctx.role,
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

type DialogRootBase = Omit<
  DialogProps,
  "root" | "parent" | "role" | "modal" | "closeOnInteractOutside"
> & {
  /** The base of the generated part ids. Default: a generated id. */
  readonly id?: string
  /** Content, backdrop and positioner stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean
  readonly messages?: MessageOverrides<DialogMessages>
  readonly actionsRef?: Ref<DialogActions>
  /** The dialog's parts. */
  readonly children?: ReactNode
}

/** The content's role: a dialog, or a confirmation that interrupts. */
export type DialogRole = "dialog" | "alertdialog"

/**
 * A dialog's Root props. With `role="alertdialog"` (a confirmation: always modal, never
 * closed by an outside press) `modal` and `closeOnInteractOutside` do not exist; the role is
 * inferred from the JSX attribute, so `<Dialog.Root role="alertdialog" modal={false}>` does
 * not compile.
 */
export type DialogRootProps<R extends DialogRole = "dialog"> = DialogRootBase & {
  /** `alertdialog`: a confirmation. Always modal, an outside press never closes it, focus starts on Cancel, a missing description warns. */
  readonly role?: R
} & (R extends "alertdialog"
    ? { readonly modal?: never; readonly closeOnInteractOutside?: never }
    : {
        readonly modal?: DialogProps["modal"]
        readonly closeOnInteractOutside?: DialogProps["closeOnInteractOutside"]
      })

/** What a Root receives at runtime (either role). */
type AnyDialogRootProps = DialogRootBase & {
  readonly role?: DialogRole
  readonly modal?: DialogProps["modal"]
  readonly closeOnInteractOutside?: DialogProps["closeOnInteractOutside"]
}

/** The Root of a dialog-family member: its machine, scope and layer kind. */
/* @__NO_SIDE_EFFECTS__ */
export function createDialogRoot(family: {
  readonly scope: string
  readonly kind: "dialog" | "drawer"
  readonly machine: typeof dialogMachine
}) {
  return function Root({
    id,
    keepMounted = false,
    messages: ownMessages,
    actionsRef,
    children,
    ...props
  }: AnyDialogRootProps) {
    const root = useRootId(id)
    const parent = useParentLayer(DIALOG_PARENT_KINDS)
    const messages = useMessages("dialog", dialogMessages, ownMessages)
    const env = useEnvironment()
    const { service, send } = useMachine(family.machine, { ...props, root, parent }, env)
    useImperativeHandle(
      actionsRef,
      () => ({ open: () => send({ type: "OPEN" }), close: () => send({ type: "CLOSE" }) }),
      [send],
    )
    const [contentMounted, setContentMounted] = useState(false)
    const [titleLevel, setTitleLevel] = useState<HeadingLevel>(2)
    const [rendered, setRendered] = useState<Rendered>({})
    const role = props.role ?? "dialog"
    // A confirmation is always modal.
    const modal = role === "alertdialog" || props.modal !== false
    const initialFocus = props.initialFocus
    const ctx: Ctx = {
      scope: family.scope,
      kind: role === "alertdialog" ? "alertdialog" : family.kind,
      role,
      service,
      root,
      modal,
      keepMounted,
      titleFocusTarget: initialFocus === "title",
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
}

const RootImpl = createDialogRoot({ scope: "dialog", kind: "dialog", machine: dialogMachine })
/** Generic over the role, so a confirmation's props are checked against it. */
const Root = <R extends DialogRole = "dialog">(props: DialogRootProps<R>) => (
  // Sound: every DialogRootProps<R> is an AnyDialogRootProps (the role only narrows it).
  <RootImpl {...(props as AnyDialogRootProps)} />
)

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
  const triggerId = id ?? partId(ctx.scope, ctx.root, `trigger-${generated.replace(/:/g, "")}`)
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
  // Focus within, from the DOM itself: native focusin/focusout on the content plus a check
  // of the active element on attach and at the next frame (the initial focus move), so it
  // holds where a focus move does not reach React's handlers (WebKit on Linux).
  useIsoLayoutEffect(() => {
    const el = node.current
    if (!mounted || !el) return
    const sync = () => {
      const active = el.ownerDocument.activeElement
      setFocusWithin(active !== null && el.contains(active))
      setContentFocused(active === el)
    }
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null
      if (next && el.contains(next)) return
      setFocusWithin(false)
      setContentFocused(false)
    }
    sync()
    const frame = env.scheduler.requestAnimationFrame(sync)
    el.addEventListener("focusin", sync)
    el.addEventListener("focusout", onFocusOut)
    return () => {
      env.scheduler.cancelAnimationFrame(frame)
      el.removeEventListener("focusin", sync)
      el.removeEventListener("focusout", onFocusOut)
    }
  }, [mounted, env, node])
  if (!mounted) return null
  const exiting = !open && state === "exiting"
  const props = mergeProps(
    {
      ...normalizeProps(api.content({ labelledBy, describedBy })),
      hidden: !open && !exiting && ctx.keepMounted,
      // Closing: presses on the exiting content do nothing (mui/base-ui#3153).
      ...(exiting ? { inert: true } : {}),
      ref: composeRefs(node, ref),
    },
    {
      ...rest,
      // Headings inside the body are one level below the title.
      children: (
        <LayerProvider layer={dialogLayerId(ctx.scope, ctx.root)} kind={ctx.kind}>
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
  const id = partId(ctx.scope, ctx.root, part)
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

/** Cancel and Action: press-activated buttons that close with their own reason. */
function useCloseButton(part: "cancel" | "action", id: string | undefined, disabled: boolean) {
  const ctx = useDialog(part === "cancel" ? "Cancel" : "Action")
  const { api } = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const generated = useId()
  const own = id ?? partId(ctx.scope, ctx.root, `${part}-${generated.replace(/:/g, "")}`)
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type !== "PRESS") return
      const m = e.modality
      closeOnSubmit(env, own, () =>
        part === "cancel" ? api.pressCancel(m) : api.pressAction(own, m),
      )
    },
    disabled: () => disabled,
  })
  const props = normalizeProps(
    api[part]({ id: own, focused, modality, pressed: press.pressed, disabled }),
  )
  return joinHandlers(props, press.props, {
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  })
}

type ButtonProps = Own<"button">

function Cancel({ id, disabled = false, render, ref, ...rest }: ButtonProps) {
  const props = useCloseButton("cancel", id, disabled)
  return renderPart(
    "button",
    mergeProps({ ...props, ...(disabled ? { disabled: true } : {}), ref }, rest),
    render,
    undefined,
  )
}

function Action({ id, disabled = false, render, ref, ...rest }: ButtonProps) {
  const props = useCloseButton("action", id, disabled)
  return renderPart(
    "button",
    mergeProps({ ...props, ...(disabled ? { disabled: true } : {}), ref }, rest),
    render,
    undefined,
  )
}

function CloseTrigger({ id, render, ref, ...rest }: Own<"button">) {
  const ctx = useDialog("CloseTrigger")
  const { api } = useApi(ctx)
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const generated = useId()
  const closeId = id ?? partId(ctx.scope, ctx.root, `close-${generated.replace(/:/g, "")}`)
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const el = useRef<HTMLElement | null>(null)
  // No content of its own (an icon): named by messages.close.
  const [empty, setEmpty] = useState(false)
  useIsoLayoutEffect(() => {
    setEmpty((el.current?.textContent ?? "").trim() === "")
  })
  const close = useCallback(
    (m: Parameters<typeof api.pressClose>[0]) =>
      closeOnSubmit(env, closeId, () => api.pressClose(m)),
    [api, env, closeId],
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
  // The opener once open; before that (and when opened programmatically) the first trigger,
  // so the host carries the trigger's theme, dir and lang from the first open on.
  const logicalParent = () =>
    (opener ? env.dom.getById(opener) : null) ??
    env.dom
      .getRootNode()
      .querySelector?.(
        `[data-scope="${ctx.scope}"][data-part="trigger"][data-instance="${ctx.root}"]`,
      ) ??
    null
  return <PortalPart logicalParent={logicalParent} {...props} />
}

/** The parts, by name: `dialog.parts.ts` re-exports them as the `Dialog` namespace. */
export {
  Action,
  Backdrop,
  Cancel,
  CloseTrigger,
  Content,
  Description,
  Portal,
  Positioner,
  Root,
  Title,
  Trigger,
}
