/** @jsxImportSource solid-js */
import {
  type AlertAnnounce,
  type AlertEvent,
  type AlertMessages,
  alertConnect,
  alertMachine,
  alertMessages,
  alertWarnings,
  announceableText,
  announcerCapability,
  type ChangeDetails,
  focusPast,
  type MessageOverrides,
  observeText,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  children as resolve,
  Show,
  sharedConfig,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"

declare module "../provider" {
  interface RindMessageScopes {
    alert: AlertMessages
  }
}

export interface AlertState {
  readonly open: boolean
}

interface Ctx {
  readonly connect: Accessor<ReturnType<typeof alertConnect>>
  readonly state: AlertState
  readonly root: Accessor<Element | null>
  readonly send: (event: AlertEvent) => void
}
const AlertContext = createContext<Ctx>()
function useAlert(part: string): Ctx {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error(`Alert.${part} must be inside Alert.Root`)
  return ctx
}

export type AlertRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Default `"polite"`: `"assertive"` for errors and failures, `"off"` for static content. */
  readonly announce?: AlertAnnounce | undefined
  /** Announced instead of the Icon label, Title and Description joined. */
  readonly announcement?: string | undefined
  readonly open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: ChangeDetails<AlertEvent>) => void) | undefined
  /**
   * Where focus goes when the alert is dismissed with focus inside it. Default (or `null`):
   * the next tab stop after the alert, else the previous one. `false`: focus does not move.
   */
  readonly finalFocus?: (() => HTMLElement | null | false) | undefined
  readonly messages?: MessageOverrides<AlertMessages> | undefined
  readonly render?: RenderProp<AlertState> | undefined
  readonly children?: JSX.Element
}

function Root(props: AlertRootProps) {
  const [local, rest] = splitProps(props, [
    "announce",
    "announcement",
    "open",
    "defaultOpen",
    "onOpenChange",
    "finalFocus",
    "messages",
    "render",
    "id",
    "children",
  ])
  const instance = useRootId(() => local.id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("alert", alertMessages, () => local.messages)
  const locale = useLocale(() => undefined)
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  const { view, send } = useMachine(
    alertMachine,
    () => ({
      open: local.open,
      defaultOpen: local.defaultOpen,
      onOpenChange: local.onOpenChange,
      announce: local.announce,
      announcement: local.announcement,
      messages: messages(),
      id: instance(),
      lang: locale().locale,
      moveFocusOut: () => {
        const node = el()
        if (node) focusPast(node, local.finalFocus?.(), env, "alert")
      },
    }),
    env,
  )
  const isOpen = () => view().state === "open"
  const presence = usePresence(isOpen, el)
  // The first render's value: a hydrated alert was present at load and stays silent.
  const hydrating = sharedConfig.context !== undefined
  afterMount(() => {
    send({
      type: "ROOT.MOUNT",
      hydrating,
      segments: untrack(el) ? announceableText(untrack(el) as Element) : [],
    })
    // Shown again (`open` became true): the text read from what this update rendered, so a
    // change made while it was unmounted is announced once, as it is now.
    createEffect(
      on(
        isOpen,
        (open, was) => {
          const node = el()
          if (open && was === false) {
            send({ type: "ROOT.SHOW", segments: node ? announceableText(node) : [] })
          }
        },
        { defer: false },
      ),
    )
    const live = () => (local.announce ?? "polite") !== "off"
    // Every change of the rendered text while the element is mounted.
    createEffect(() => {
      const node = el()
      if (!presence.mounted() || !live() || !node) return
      onCleanup(observeText(node, (segments) => send({ type: "CONTENT.CHANGE", segments })))
    })
    // Warn once per change of what the warnings read, not on every render.
    const warnKey = createMemo(() =>
      JSON.stringify([rest.role, rest["aria-live"], rest["aria-atomic"]]),
    )
    createEffect(() => {
      if (warnKey()) alertWarnings(untrack(() => rest as Readonly<Record<string, unknown>>))
    })
  })
  const connect = createMemo(() =>
    alertConnect({ instance: instance(), open: isOpen(), dismissLabel: messages().dismiss }),
  )
  const state = reactive<AlertState>(() => ({ open: isOpen() }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(connect().root()),
        ...(local.id === undefined ? {} : { id: local.id }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => local.children
  return (
    <AlertContext.Provider value={{ connect, state, root: el, send }}>
      <Show when={presence.mounted()}>
        {renderPart(local.render, merged, state, children, (p) => (
          <div {...p}>{children()}</div>
        ))}
      </Show>
    </AlertContext.Provider>
  )
}

type PartProps<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<AlertState> | undefined
  readonly children?: JSX.Element
}

export type AlertIconProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>> & {
  /** Names the icon (`role="img"`), so the severity is in the alert's text ("Error"). */
  readonly label?: string | undefined
}

function Icon(props: AlertIconProps) {
  const [local, rest] = splitProps(props, ["label", "render", "children"])
  const ctx = useAlert("Icon")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.connect().icon(local.label)), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type AlertTitleProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Title(props: AlertTitleProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAlert("Title")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.connect().title()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type AlertDescriptionProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Description(props: AlertDescriptionProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAlert("Description")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.connect().description()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

/** Whether rendered `nodes` hold any text (an icon-only trigger has none). */
function hasText(nodes: unknown): boolean {
  if (Array.isArray(nodes)) return nodes.some(hasText)
  if (typeof nodes === "string") return nodes.trim() !== ""
  if (typeof nodes === "number") return true
  if (typeof Node === "undefined" || !(nodes instanceof Node)) return false
  if (nodes instanceof Text) return (nodes.data ?? "").trim() !== ""
  // Hidden text does not name the button.
  if (nodes instanceof Element && nodes.getAttribute("aria-hidden") === "true") return false
  return Array.from(nodes.childNodes).some(hasText)
}

export type AlertCloseTriggerProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

function CloseTrigger(props: AlertCloseTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useAlert("CloseTrigger")
  const env = useEnvironment()
  // Modality tracking runs while a trigger is mounted, so focus-visible is known on focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  // Resolved once: also tells whether the children hold text, without building them twice.
  const content = resolve(() => local.children)
  const named = () =>
    rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined || hasText(content())
  const own = createMemo(() =>
    normalizeProps(
      ctx.connect().closeTrigger({ named: named(), focused: focused(), modality: modality() }),
    ),
  )
  const merged = createMemo(() =>
    mergeProps(
      joinHandlers(own(), {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        onClick: () => {
          const r = ctx.root()
          const active = r?.ownerDocument.activeElement
          ctx.send({ type: "CLOSE", focusInside: !!r && !!active && r.contains(active) })
        },
      }),
      rest,
    ),
  )
  return renderPart(local.render, merged, ctx.state, content, (p) => (
    <button {...p}>{content()}</button>
  ))
}

/**
 * An inline message in the page: never a live region of its own and never takes focus; it
 * announces through the Announcer when it appears after load or its text changes.
 */
/** The parts, by name: `alert.parts.ts` re-exports them as the `Alert` namespace. */
export { CloseTrigger, Description, Icon, Root, Title }
