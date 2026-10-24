/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import { Heading } from "../heading"
import { keepStyle } from "../keep-style"
import { LayerProvider, useParentLayer } from "../layer-context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { Portal as PortalPart, type PortalProps } from "../portal"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare module "../provider" {
  interface RindMessageScopes {
    dialog: DialogMessages
  }
}

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }
type View = ReturnType<Service<typeof dialogMachine>["view"]>

interface Ctx {
  /** The family member: `dialog` or `drawer` (scope, names). */
  readonly scope: string
  /** The layer kind: `alertdialog` for a `role="alertdialog"` dialog. */
  readonly kind: "dialog" | "alertdialog" | "drawer"
  readonly role: "dialog" | "alertdialog"
  readonly service: Service<typeof dialogMachine>
  readonly view: Accessor<View>
  readonly root: Accessor<string>
  readonly modal: Accessor<boolean>
  readonly keepMounted: Accessor<boolean>
  readonly titleFocusTarget: Accessor<boolean>
  readonly messages: Accessor<DialogMessages>
  readonly contentMounted: Accessor<boolean>
  readonly setContentMounted: (on: boolean) => void
  readonly titleLevel: Accessor<HeadingLevel>
  readonly setTitleLevel: (level: HeadingLevel) => void
  /** Ids of the mounted title and description: the only source of the ARIA references. */
  readonly rendered: Accessor<Rendered>
  readonly setRendered: (update: (r: Rendered) => Rendered) => void
  /** The stack's metadata for this layer, followed while open. */
  readonly meta: Accessor<LayerMeta | undefined>
}

export const DialogContext = createContext<Ctx>()
export function useDialog(part: string): Ctx {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error(`${part} must be inside its Dialog or Drawer Root`)
  return ctx
}

const isOpen = (ctx: Ctx) => ctx.view().matches("open")

interface Focus {
  focusWithin?: boolean | undefined
  contentFocused?: boolean | undefined
  modality?: Modality | undefined
}

/** The connect output of a part (read in a computation). */
export function useApi(ctx: Ctx, focus: Accessor<Focus> = () => ({})) {
  return createMemo(() => {
    const view = ctx.view()
    return dialogConnect(
      {
        scope: ctx.scope,
        role: ctx.role,
        instance: ctx.root(),
        open: view.matches("open"),
        modal: ctx.modal(),
        opener: view.context.opener,
        closeReason: view.context.closeReason,
        rendered: ctx.rendered(),
        contentMounted: ctx.contentMounted(),
        meta: ctx.meta(),
        titleFocusTarget: ctx.titleFocusTarget(),
        ...focus(),
        messages: ctx.messages(),
      } as Parameters<typeof dialogConnect>[0],
      ctx.service.send,
    )
  })
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
  readonly id?: string | undefined
  /** Content, backdrop and positioner stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  readonly messages?: MessageOverrides<DialogMessages> | undefined
  /** Receives the actions once, when the Root is created. */
  readonly actionsRef?: ((actions: DialogActions) => void) | undefined
  /** The dialog's parts. */
  readonly children?: JSX.Element
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
  readonly role?: DialogRole | undefined
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
  return function Root(props: AnyDialogRootProps) {
    const [own, rest] = splitProps(props, [
      "id",
      "keepMounted",
      "messages",
      "actionsRef",
      "children",
    ])
    const root = useRootId(() => own.id)
    const parent = useParentLayer(DIALOG_PARENT_KINDS)
    const messages = useMessages("dialog", dialogMessages, () => own.messages)
    const env = useEnvironment()
    const { view, send, service } = useMachine(
      family.machine,
      () => ({ ...rest, root: root(), parent: parent() }) as DialogProps,
      env,
    )
    own.actionsRef?.({ open: () => send({ type: "OPEN" }), close: () => send({ type: "CLOSE" }) })
    const [contentMounted, setContentMounted] = createSignal(false)
    const [titleLevel, setTitleLevel] = createSignal<HeadingLevel>(2)
    const [rendered, setRendered] = createSignal<Rendered>({})
    const [meta, setMeta] = createSignal<LayerMeta | undefined>(undefined)
    afterMount(() => {
      createEffect(() => {
        const open = view().matches("open")
        const id = root()
        setMeta(undefined)
        if (!open) return
        const node = env.dom.getRootNode()
        const stack = getLayerStack("body" in node ? node : node.ownerDocument)
        const read = () => setMeta(stack.get(dialogLayerId(family.scope, id))?.meta())
        read()
        onCleanup(stack.subscribe(read))
      })
    })
    const role = () => rest.role ?? "dialog"
    const ctx: Ctx = {
      scope: family.scope,
      // The kind is read once: a role that changes after the first render is not supported.
      kind: untrack(role) === "alertdialog" ? "alertdialog" : family.kind,
      role: untrack(role),
      service,
      view,
      root,
      // A confirmation is always modal.
      modal: () => role() === "alertdialog" || rest.modal !== false,
      keepMounted: () => own.keepMounted === true,
      titleFocusTarget: () => rest.initialFocus === "title",
      messages,
      contentMounted,
      setContentMounted,
      titleLevel,
      setTitleLevel,
      rendered,
      setRendered,
      meta,
    }
    return <DialogContext.Provider value={ctx}>{own.children}</DialogContext.Provider>
  }
}

const RootImpl = createDialogRoot({ scope: "dialog", kind: "dialog", machine: dialogMachine })

/** Generic over the role, so a confirmation's props are checked against it. */
function Root<R extends DialogRole = "dialog">(props: DialogRootProps<R>) {
  // Sound: every DialogRootProps<R> is an AnyDialogRootProps (the role only narrows it).
  return <RootImpl {...(props as AnyDialogRootProps)} />
}

type Own<A, S = undefined> = Omit<A, "children"> & {
  readonly render?: RenderProp<S> | undefined
  readonly children?: JSX.Element
}

export interface DialogTriggerState {
  readonly open: boolean
}

export type DialogTriggerProps = Own<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  DialogTriggerState
>

function Trigger(props: DialogTriggerProps) {
  const [local, rest] = splitProps(props, ["id", "disabled", "render", "children"])
  const ctx = useDialog("Trigger")
  const api = useApi(ctx)
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const generated = createUniqueId()
  const triggerId = () =>
    local.id ?? partId(ctx.scope, ctx.root(), `trigger-${generated.replace(/:/g, "")}`)
  const disabled = () => local.disabled === true
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") untrack(api).pressTrigger(triggerId(), e.modality)
    },
    disabled,
  })
  const state = reactive<DialogTriggerState>(() => ({ open: isOpen(ctx) }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            api().trigger({
              id: triggerId(),
              focused: focused(),
              modality: modality(),
              pressed: press.pressed(),
              disabled: disabled(),
            }),
          ),
          press.props,
          { onFocusIn: () => setFocused(true), onFocusOut: () => setFocused(false) },
        ),
        ...(disabled() ? { disabled: true } : {}),
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

/** Presence of an animated part (content, backdrop, positioner). */
function usePartPresence(ctx: Ctx, subtree = false) {
  const [node, setNode] = createSignal<Element | null>(null)
  const presence = usePresence(() => isOpen(ctx), node, {
    keepMounted: ctx.keepMounted,
    subtree: () => subtree,
  })
  return { setNode, ...presence }
}

export type DialogDivProps = Own<JSX.HTMLAttributes<HTMLDivElement>>

function Backdrop(props: DialogDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useDialog("Backdrop")
  const api = useApi(ctx)
  const part = usePartPresence(ctx)
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().backdrop()),
        hidden: !isOpen(ctx) && ctx.keepMounted(),
        ref: part.setNode,
      },
      rest,
    ),
  )
  const kept = keepStyle(merged)
  const children = () => local.children
  // Non-modal dialogs render no backdrop: the page stays usable (zag#3401).
  return (
    <Show when={ctx.modal() && part.mounted()}>
      {untrack(() =>
        renderPart(local.render, kept, undefined, children, (p) => <div {...p}>{children()}</div>),
      )}
    </Show>
  )
}

function Positioner(props: DialogDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useDialog("Positioner")
  const api = useApi(ctx)
  // It holds the content: it stays while the content's exit animations run.
  const part = usePartPresence(ctx, true)
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().positioner()),
        hidden: !isOpen(ctx) && ctx.keepMounted(),
        ref: part.setNode,
      },
      rest,
    ),
  )
  const kept = keepStyle(merged)
  const children = () => local.children
  return (
    <Show when={part.mounted()}>
      {untrack(() =>
        renderPart(local.render, kept, undefined, children, (p) => <div {...p}>{children()}</div>),
      )}
    </Show>
  )
}

export interface DialogContentState {
  readonly open: boolean
}

export type DialogContentProps = Own<JSX.HTMLAttributes<HTMLDivElement>, DialogContentState>

function Content(props: DialogContentProps) {
  const [local, rest] = splitProps(props, [
    "render",
    "children",
    "aria-labelledby",
    "aria-describedby",
  ])
  const ctx = useDialog("Content")
  const env = useEnvironment()
  const [focusWithin, setFocusWithin] = createSignal(false)
  const [contentFocused, setContentFocused] = createSignal(false)
  const modality = useModality(env.modality, contentFocused)
  const api = useApi(ctx, () => ({
    focusWithin: focusWithin(),
    contentFocused: contentFocused(),
    modality: modality(),
  }))
  const [node, setNode] = createSignal<Element | null>(null)
  const presence = usePresence(() => isOpen(ctx), node, { keepMounted: ctx.keepMounted })
  // Focus within, from the DOM itself: native focusin/focusout on the content plus a check
  // of the active element on attach and at the next frame (the initial focus move), so it
  // holds where a focus move does not reach the handlers (WebKit on Linux).
  afterMount(() => {
    createEffect(() => {
      const el = presence.mounted() ? node() : null
      ctx.setContentMounted(el !== null)
      if (!(el instanceof HTMLElement)) return
      onCleanup(() => ctx.setContentMounted(false))
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
      onCleanup(() => {
        env.scheduler.cancelAnimationFrame(frame)
        el.removeEventListener("focusin", sync)
        el.removeEventListener("focusout", onFocusOut)
      })
    })
  })
  const exiting = () => !isOpen(ctx) && presence.state() === "exiting"
  const state = reactive<DialogContentState>(() => ({ open: isOpen(ctx) }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(
          api().content({
            labelledBy: local["aria-labelledby"],
            describedBy: local["aria-describedby"],
          }),
        ),
        hidden: !isOpen(ctx) && !exiting() && ctx.keepMounted(),
        // Closing: presses on the exiting content do nothing (mui/base-ui#3153).
        ...(exiting() ? { inert: true } : {}),
        ref: setNode,
      },
      rest,
    ),
  )
  const kept = keepStyle(merged)
  // Headings inside the body are one level below the title.
  const children = () => (
    <LayerProvider layer={dialogLayerId(ctx.scope, ctx.root())} kind={ctx.kind}>
      <Heading.Level level={Math.min(6, ctx.titleLevel() + 1) as HeadingLevel}>
        {local.children}
      </Heading.Level>
    </LayerProvider>
  )
  return (
    <Show when={presence.mounted()}>
      {untrack(() =>
        renderPart(local.render, kept, state, children, (p) => <div {...p}>{children()}</div>),
      )}
    </Show>
  )
}

/** Registers a title/description part with the Root while it is mounted. */
function useRegistered(ctx: Ctx, part: "title" | "description") {
  afterMount(() => {
    createEffect(() => {
      const id = partId(ctx.scope, ctx.root(), part)
      ctx.setRendered((r) => ({ ...r, [part]: id }))
      onCleanup(() => ctx.setRendered((r) => ({ ...r, [part]: undefined })))
    })
  })
}

export type DialogTitleProps = Own<JSX.HTMLAttributes<HTMLHeadingElement>> & {
  /** The heading level (default 2); headings in the content are one level below. */
  readonly level?: HeadingLevel | undefined
}

function Title(props: DialogTitleProps) {
  const [local, rest] = splitProps(props, ["level", "render", "children"])
  const ctx = useDialog("Title")
  const api = useApi(ctx)
  useRegistered(ctx, "title")
  const level = () => local.level ?? 2
  createEffect(() => ctx.setTitleLevel(level()))
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = useRenderedTag(
    () => `h${level()}`,
    () => local.render,
    el,
  )
  const merged = createMemo(() =>
    mergeProps(
      { ...normalizeProps(api().title({ level: level(), tag: tag() })), ref: setEl },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <Dynamic component={`h${level()}`} {...p}>
      {children()}
    </Dynamic>
  ))
}

function Description(props: Own<JSX.HTMLAttributes<HTMLParagraphElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useDialog("Description")
  const api = useApi(ctx)
  useRegistered(ctx, "description")
  const merged = createMemo(() => mergeProps(normalizeProps(api().description()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => <p {...p}>{children()}</p>)
}

export type DialogButtonProps = Own<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

/** Cancel and Action: press-activated buttons that close with their own reason. */
function useCloseButton(
  part: "cancel" | "action",
  id: () => string | undefined,
  disabled: () => boolean,
) {
  const ctx = useDialog(part === "cancel" ? "Cancel" : "Action")
  const api = useApi(ctx)
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const generated = createUniqueId()
  const own = () => id() ?? partId(ctx.scope, ctx.root(), `${part}-${generated.replace(/:/g, "")}`)
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type !== "PRESS") return
      if (part === "cancel") untrack(api).pressCancel(e.modality)
      else untrack(api).pressAction(own(), e.modality)
    },
    disabled,
  })
  return createMemo(() =>
    joinHandlers(
      normalizeProps(
        api()[part]({
          id: own(),
          focused: focused(),
          modality: modality(),
          pressed: press.pressed(),
          disabled: disabled(),
        }),
      ),
      press.props,
      { onFocusIn: () => setFocused(true), onFocusOut: () => setFocused(false) },
    ),
  )
}

function closeButton(part: "cancel" | "action") {
  return function CloseButton(props: DialogButtonProps) {
    const [local, rest] = splitProps(props, ["id", "disabled", "render", "children"])
    const disabled = () => local.disabled === true
    const own = useCloseButton(part, () => local.id, disabled)
    const merged = createMemo(() =>
      mergeProps({ ...own(), ...(disabled() ? { disabled: true } : {}) }, rest),
    )
    const children = () => local.children
    return renderPart(local.render, merged, undefined, children, (p) => (
      <button {...p}>{children()}</button>
    ))
  }
}

const Cancel = closeButton("cancel")
const Action = closeButton("action")

function CloseTrigger(props: DialogButtonProps) {
  const [local, rest] = splitProps(props, ["id", "render", "children"])
  const ctx = useDialog("CloseTrigger")
  const api = useApi(ctx)
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const generated = createUniqueId()
  const closeId = () =>
    local.id ?? partId(ctx.scope, ctx.root(), `close-${generated.replace(/:/g, "")}`)
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const [el, setEl] = createSignal<Element | null>(null)
  // No content of its own (an icon): named by messages.close.
  const [empty, setEmpty] = createSignal(false)
  afterMount(() => {
    createEffect(() => {
      const node = el()
      if (!node) return
      const read = () => setEmpty((node.textContent ?? "").trim() === "")
      read()
      const observer = new MutationObserver(read)
      observer.observe(node, { childList: true, characterData: true, subtree: true })
      onCleanup(() => observer.disconnect())
    })
  })
  const close = (m: Modality) => {
    const node = untrack(el) as HTMLButtonElement | null
    // A submit button of a form: close on that form's submit, so the form is still
    // connected when it submits (radix#1109, #1779); an invalid form keeps it open.
    if (node?.type === "submit" && node.form) {
      const form = node.form
      const onSubmit = () => untrack(api).pressClose(m)
      form.addEventListener("submit", onSubmit, { once: true })
      env.scheduler.setTimeout(() => form.removeEventListener("submit", onSubmit), 0)
      return
    }
    untrack(api).pressClose(m)
  }
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") close(e.modality)
    },
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            api().closeTrigger({
              id: closeId(),
              focused: focused(),
              modality: modality(),
              pressed: press.pressed(),
              empty: empty(),
            }),
          ),
          press.props,
          { onFocusIn: () => setFocused(true), onFocusOut: () => setFocused(false) },
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function Portal(props: PortalProps) {
  const ctx = useDialog("Portal")
  const env = useEnvironment()
  // The opener once open; before that (and when opened programmatically) the first trigger,
  // so the host carries the trigger's theme, dir and lang from the first open on.
  const logicalParent = () => {
    const opener = ctx.view().context.opener
    return (
      (opener ? env.dom.getById(opener) : null) ??
      env.dom
        .getRootNode()
        .querySelector?.(
          `[data-scope="${ctx.scope}"][data-part="trigger"][data-instance="${ctx.root()}"]`,
        ) ??
      null
    )
  }
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
