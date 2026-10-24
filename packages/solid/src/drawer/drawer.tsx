/** @jsxImportSource solid-js */
// Drawer: the Dialog's parts with the drawer service, plus Handle, Indent and
// IndentBackground. Wiring only: the drawer's own attributes come from `drawerExtras` and
// are passed to the Dialog parts as props.
import {
  type DialogMessages,
  type DrawerMessages,
  type DrawerProps,
  drawerExtras,
  drawerIndentProps,
  drawerMachine,
  drawerMessages,
  drawerSide,
  drawerStack,
  type MessageOverrides,
  resolvedPoints,
  type Service,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import {
  createDialogRoot,
  type DialogContentProps,
  type DialogDivProps,
  type DialogRootProps,
  useDialog,
} from "../dialog/dialog"
import * as Dialog from "../dialog/dialog.parts"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    drawer: DrawerMessages
  }
}

type DrawerService = Service<typeof drawerMachine>
type DrawerView = ReturnType<DrawerService["view"]>

// Sound: the drawer machine is the Dialog's pieces plus its own; every Dialog part reads and
// sends only the Dialog's context, values and events, which the drawer machine keeps.
const DialogFamilyRoot = createDialogRoot({
  scope: "drawer",
  kind: "drawer",
  machine: drawerMachine as unknown as Parameters<typeof createDialogRoot>[0]["machine"],
})

type DrawerOwnProps = Omit<
  DrawerProps,
  | keyof Omit<DialogRootProps, "messages" | "id" | "keepMounted" | "actionsRef" | "children">
  | "root"
  | "parent"
  | "dir"
>

export type DrawerRootProps = Omit<DialogRootProps, "messages"> &
  DrawerOwnProps & {
    readonly messages?: MessageOverrides<DrawerMessages> | undefined
  }

interface Settings {
  readonly messages: Accessor<DrawerMessages>
  readonly props: Accessor<Pick<DrawerProps, "side" | "dir" | "snapPoints">>
}
const SettingsContext = createContext<Settings>()

function Root(props: DrawerRootProps) {
  const [own, rest] = splitProps(props, ["messages"])
  const messages = useMessages("drawer", drawerMessages, () => own.messages)
  const locale = useLocale(() => undefined)
  const dialogMessages = createMemo<MessageOverrides<DialogMessages>>(() => ({
    close: messages().close,
  }))
  const settings: Settings = {
    messages,
    props: () => ({
      side: (rest as DrawerProps).side,
      dir: locale().dir,
      snapPoints: (rest as DrawerProps).snapPoints,
    }),
  }
  return (
    <SettingsContext.Provider value={settings}>
      {/* The drawer's props ride along: the drawer machine reads them. */}
      <DialogFamilyRoot
        {...(rest as DialogRootProps)}
        {...{ dir: locale().dir }}
        messages={dialogMessages()}
      />
    </SettingsContext.Provider>
  )
}

/** The drawer's own view: its service, props and the extras for the Dialog parts. */
function useDrawer(part: string) {
  const ctx = useDialog(`Drawer.${part}`)
  // Sound: this Root's service is the drawer machine's (see DialogFamilyRoot).
  const service = ctx.service as unknown as DrawerService
  const view = ctx.view as unknown as Accessor<DrawerView>
  const settings = useContext(SettingsContext)
  if (!settings) throw new Error(`Drawer.${part} must be inside Drawer.Root`)
  const extras = createMemo(() => {
    const v = view()
    return drawerExtras(
      {
        instance: ctx.root(),
        open: v.matches("open"),
        closeReason: v.context.closeReason,
        side: drawerSide(settings.props()),
        swipe: v.context.swipe,
        nested: v.context.nested,
        size: v.context.sizes.content,
        resolved: resolvedPoints(settings.props(), v.context.sizes),
        snapPoint: v.values.snapPoint ?? null,
        messages: settings.messages(),
      },
      service.send,
    )
  })
  return { ctx, service, extras }
}

type Own<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<undefined> | undefined
  readonly children?: JSX.Element
}

// The drawer's attributes go on as props in front of the consumer's; the children stay a
// separate (last) source, so reading them never tracks the drawer's state.

function Positioner(props: DialogDivProps) {
  const [local, rest] = splitProps(props, ["children"])
  const { extras } = useDrawer("Positioner")
  const merged = createMemo(() => mergeProps(normalizeProps(extras().positioner()), rest))
  return <Dialog.Positioner {...merged()}>{local.children}</Dialog.Positioner>
}

function Backdrop(props: DialogDivProps) {
  const [local, rest] = splitProps(props, ["children"])
  const { extras } = useDrawer("Backdrop")
  const merged = createMemo(() => mergeProps(normalizeProps(extras().backdrop()), rest))
  return <Dialog.Backdrop {...merged()}>{local.children}</Dialog.Backdrop>
}

function Content(props: DialogContentProps) {
  const [local, rest] = splitProps(props, ["children"])
  const { extras } = useDrawer("Content")
  const merged = createMemo(() => mergeProps(normalizeProps(extras().content()), rest))
  return <Dialog.Content {...merged()}>{local.children}</Dialog.Content>
}

/** Inside the content: a button cycling the snap points (two or more), else decorative. */
function Handle(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const { extras } = useDrawer("Handle")
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") extras().pressHandle(e.modality)
    },
    disabled: () => !extras().handleIsButton,
  })
  const merged = createMemo(() => {
    const own = normalizeProps(
      extras().handle({ focused: focused(), modality: modality(), pressed: press.pressed() }),
    )
    if (!extras().handleIsButton) return mergeProps(own, rest)
    return mergeProps(
      joinHandlers(own, press.props, {
        onFocusIn: () => setFocused(true),
        onFocusOut: () => setFocused(false),
      }),
      rest,
    )
  })
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <Show when={extras().handleIsButton} fallback={<div {...p}>{children()}</div>}>
      <button {...p}>{children()}</button>
    </Show>
  ))
}

/** `data-active` while a modal drawer is open in the document; the progress after mount. */
function useIndent(part: "indent" | "indent-background") {
  const env = useEnvironment()
  const stack = typeof document === "undefined" ? null : drawerStack(env)
  const [active, setActive] = createSignal(false)
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  afterMount(() => {
    if (!stack) return
    setActive(stack.active())
    onCleanup(stack.subscribe(() => setActive(stack.active())))
  })
  // After mount: the server and the first client render carry no variable (base-ui#4509).
  afterMount(() => {
    const node = el()
    if (!node || !stack) return
    onCleanup(stack.registerIndent(node))
  })
  return createMemo(() => ({
    ...normalizeProps(drawerIndentProps(part, active())),
    ref: setEl,
  }))
}

function Indent(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const own = useIndent("indent")
  const merged = createMemo(() => mergeProps(own(), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function IndentBackground(props: Own<JSX.HTMLAttributes<HTMLDivElement>>) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const own = useIndent("indent-background")
  const merged = createMemo(() => mergeProps(own(), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

const Trigger = Dialog.Trigger
const Portal = Dialog.Portal
const Title = Dialog.Title
const Description = Dialog.Description
const CloseTrigger = Dialog.CloseTrigger

/** The parts, by name: `drawer.parts.ts` re-exports them as the `Drawer` namespace. */
export {
  Backdrop,
  CloseTrigger,
  Content,
  Description,
  Handle,
  Indent,
  IndentBackground,
  Portal,
  Positioner,
  Root,
  Title,
  Trigger,
}
