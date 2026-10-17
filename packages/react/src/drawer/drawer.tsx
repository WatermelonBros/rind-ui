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
  type ComponentPropsWithRef,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { createDialogRoot, Dialog, type DialogRootProps, useDialog } from "../dialog/dialog"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useSelector } from "../use-machine"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"

declare module "../provider" {
  interface RindMessageScopes {
    drawer: DrawerMessages
  }
}

type DrawerService = Service<typeof drawerMachine>

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
    readonly messages?: MessageOverrides<DrawerMessages>
  }

interface Settings {
  readonly messages: DrawerMessages
  readonly props: Pick<DrawerProps, "side" | "dir" | "snapPoints">
}
const SettingsContext = createContext<Settings>({ messages: drawerMessages, props: {} })

function Root({ messages: own, ...props }: DrawerRootProps) {
  const messages = useMessages("drawer", drawerMessages, own)
  const { dir } = useLocale()
  const dialogMessages: MessageOverrides<DialogMessages> = { close: messages.close }
  const settings: Settings = {
    messages,
    props: { side: props.side, dir, snapPoints: props.snapPoints },
  }
  return (
    <SettingsContext value={settings}>
      {/* The drawer's props ride along: the drawer machine reads them. */}
      <DialogFamilyRoot {...(props as DialogRootProps)} {...{ dir }} messages={dialogMessages} />
    </SettingsContext>
  )
}

/** The drawer's own view: its service, props and the extras for the Dialog parts. */
function useDrawer(part: string) {
  const ctx = useDialog(`Drawer.${part}`)
  // Sound: this Root's service is the drawer machine's (see DialogFamilyRoot).
  const service = ctx.service as unknown as DrawerService
  const view = useSelector(service, (v) => v)
  const { messages, props } = useContext(SettingsContext)
  const extras = drawerExtras(
    {
      instance: ctx.root,
      open: view.matches("open"),
      closeReason: view.context.closeReason,
      side: drawerSide(props),
      swipe: view.context.swipe,
      nested: view.context.nested,
      size: view.context.sizes.content,
      resolved: resolvedPoints(props, view.context.sizes),
      snapPoint: view.values.snapPoint ?? null,
      messages,
    },
    service.send,
  )
  return { ctx, service, extras }
}

// Sound: a part's props are a plain props object (mergeProps' input).
const asProps = (p: object) => p as Readonly<Record<string, unknown>>

type Own<T extends keyof React.JSX.IntrinsicElements, S = undefined> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<S>
}

function Positioner(props: Parameters<typeof Dialog.Positioner>[0]) {
  const { extras } = useDrawer("Positioner")
  return <Dialog.Positioner {...mergeProps(normalizeProps(extras.positioner()), asProps(props))} />
}

function Backdrop(props: Parameters<typeof Dialog.Backdrop>[0]) {
  const { extras } = useDrawer("Backdrop")
  return <Dialog.Backdrop {...mergeProps(normalizeProps(extras.backdrop()), asProps(props))} />
}

function Content(props: Parameters<typeof Dialog.Content>[0]) {
  const { extras } = useDrawer("Content")
  return <Dialog.Content {...mergeProps(normalizeProps(extras.content()), asProps(props))} />
}

/** Inside the content: a button cycling the snap points (two or more), else decorative. */
function Handle({ render, ref, ...rest }: Own<"div">) {
  const { extras } = useDrawer("Handle")
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") extras.pressHandle(e.modality)
    },
    disabled: () => !extras.handleIsButton,
  })
  const own = normalizeProps(extras.handle({ focused, modality, pressed: press.pressed }))
  if (!extras.handleIsButton) {
    return renderPart("div", mergeProps({ ...own, ref }, rest), render, undefined)
  }
  const props = mergeProps(
    {
      ...joinHandlers(own, press.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref,
    },
    rest,
  )
  return renderPart("button", props, render, undefined)
}

/** `data-active` while a modal drawer is open in the document; the progress after mount. */
function useIndent(
  part: "indent" | "indent-background",
  ref: React.Ref<HTMLDivElement> | undefined,
) {
  const env = useEnvironment()
  const stack = typeof document === "undefined" ? null : drawerStack(env)
  const active = useSyncExternalStore(
    (l) => stack?.subscribe(l) ?? (() => {}),
    () => stack?.active() ?? false,
    () => false,
  )
  const el = useRef<HTMLDivElement | null>(null)
  // After mount: the server and the first client render carry no variable (base-ui#4509).
  useEffect(() => {
    const node = el.current
    if (!node || !stack) return
    return stack.registerIndent(node)
  }, [stack])
  return { ...normalizeProps(drawerIndentProps(part, active)), ref: composeRefs(el, ref) }
}

function Indent({ render, ref, ...rest }: Own<"div">) {
  return renderPart("div", mergeProps(useIndent("indent", ref), rest), render, undefined)
}

function IndentBackground({ render, ref, ...rest }: Own<"div">) {
  return renderPart("div", mergeProps(useIndent("indent-background", ref), rest), render, undefined)
}

export const Drawer = {
  Root,
  Trigger: Dialog.Trigger,
  Portal: Dialog.Portal,
  Backdrop,
  Positioner,
  Content,
  Title: Dialog.Title,
  Description: Dialog.Description,
  CloseTrigger: Dialog.CloseTrigger,
  Handle,
  Indent,
  IndentBackground,
}
