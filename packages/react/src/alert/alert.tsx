"use client"

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
  Children,
  type ComponentPropsWithRef,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
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
  readonly connect: ReturnType<typeof alertConnect>
  readonly open: boolean
  readonly root: { current: HTMLElement | null }
  readonly send: (event: AlertEvent) => void
}
const AlertContext = createContext<Ctx | null>(null)
function useAlert(part: string): Ctx {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error(`Alert.${part} must be inside Alert.Root`)
  return ctx
}

const noop = () => () => {}
/** True while hydrating (and on the server): the server snapshot is used only then. */
const useHydrating = () =>
  useSyncExternalStore(
    noop,
    () => false,
    () => true,
  )

export type AlertRootProps = ComponentPropsWithRef<"div"> & {
  /** Default `"polite"`: `"assertive"` for errors and failures, `"off"` for static content. */
  readonly announce?: AlertAnnounce
  /** Announced instead of the Icon label, Title and Description joined. */
  readonly announcement?: string
  readonly open?: boolean
  readonly defaultOpen?: boolean
  readonly onOpenChange?: (open: boolean, details: ChangeDetails<AlertEvent>) => void
  /**
   * Where focus goes when the alert is dismissed with focus inside it. Default (or `null`):
   * the next tab stop after the alert, else the previous one. `false`: focus does not move.
   */
  readonly finalFocus?: () => HTMLElement | null | false
  readonly messages?: MessageOverrides<AlertMessages>
  readonly render?: RenderProp<AlertState>
}

function Root({
  announce,
  announcement,
  open,
  defaultOpen,
  onOpenChange,
  finalFocus,
  messages: ownMessages,
  render,
  id,
  ref,
  ...rest
}: AlertRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("alert", alertMessages, ownMessages)
  const { locale } = useLocale()
  const el = useRef<HTMLElement | null>(null)
  const { view, send } = useMachine(
    alertMachine,
    {
      open,
      defaultOpen,
      onOpenChange,
      announce,
      announcement,
      messages,
      id: instance,
      lang: locale,
      moveFocusOut: () => {
        if (el.current) focusPast(el.current, finalFocus?.(), env, "alert")
      },
    },
    env,
  )
  const isOpen = view.state === "open"
  const presence = usePresence(isOpen, el)
  // The first render's value: a hydrated alert was present at load and stays silent.
  const hydrating = useRef(useHydrating()).current
  useEffect(() => {
    send({
      type: "ROOT.MOUNT",
      hydrating,
      segments: el.current ? announceableText(el.current) : [],
    })
  }, [send, hydrating])
  // Shown again (`open` became true): the text read from what this commit rendered, so a
  // change made while it was unmounted is announced once, as it is now.
  const wasOpen = useRef(isOpen)
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      send({ type: "ROOT.SHOW", segments: el.current ? announceableText(el.current) : [] })
    }
    wasOpen.current = isOpen
  }, [isOpen, send])
  const live = (announce ?? "polite") !== "off"
  // Every change of the rendered text while the element is mounted.
  useEffect(() => {
    const node = el.current
    if (!presence.mounted || !live || !node) return
    return observeText(node, (segments) => send({ type: "CONTENT.CHANGE", segments }))
  }, [presence.mounted, live, send])
  const own = rest as Readonly<Record<string, unknown>> // the element's own props, read by name
  const warnKey = JSON.stringify([rest.role, rest["aria-live"], rest["aria-atomic"]])
  const latest = useRef(own)
  latest.current = own
  useEffect(() => {
    if (warnKey) alertWarnings(latest.current)
  }, [warnKey])
  const connect = alertConnect({ instance, open: isOpen, dismissLabel: messages.dismiss })
  const ctx = useMemo(() => ({ connect, open: isOpen, root: el, send }), [connect, isOpen, send])
  if (!presence.mounted) return null
  const props = mergeProps(
    {
      ...normalizeProps(connect.root()),
      ...(id === undefined ? {} : { id }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return (
    <AlertContext value={ctx}>{renderPart("div", props, render, { open: isOpen })}</AlertContext>
  )
}

export type AlertIconProps = ComponentPropsWithRef<"span"> & {
  /** Names the icon (`role="img"`), so the severity is in the alert's text ("Error"). */
  readonly label?: string
  readonly render?: RenderProp<AlertState>
}

function Icon({ label, render, ...rest }: AlertIconProps) {
  const { connect, open } = useAlert("Icon")
  return renderPart("span", mergeProps(normalizeProps(connect.icon(label)), rest), render, {
    open,
  })
}

export type AlertTitleProps = ComponentPropsWithRef<"div"> & {
  readonly render?: RenderProp<AlertState>
}

function Title({ render, ...rest }: AlertTitleProps) {
  const { connect, open } = useAlert("Title")
  return renderPart("div", mergeProps(normalizeProps(connect.title()), rest), render, { open })
}

export type AlertDescriptionProps = ComponentPropsWithRef<"div"> & {
  readonly render?: RenderProp<AlertState>
}

function Description({ render, ...rest }: AlertDescriptionProps) {
  const { connect, open } = useAlert("Description")
  return renderPart("div", mergeProps(normalizeProps(connect.description()), rest), render, {
    open,
  })
}

/** Whether `children` render any text (an icon-only trigger has none). */
function hasText(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (typeof child === "string") return child.trim() !== ""
    if (typeof child === "number") return true
    if (!isValidElement(child)) return false
    const props = child.props as { readonly children?: ReactNode; readonly "aria-hidden"?: unknown }
    // Hidden text does not name the button.
    return (
      props["aria-hidden"] !== true && props["aria-hidden"] !== "true" && hasText(props.children)
    )
  })
}

export type AlertCloseTriggerProps = ComponentPropsWithRef<"button"> & {
  readonly render?: RenderProp<AlertState>
}

function CloseTrigger({ render, children, ...rest }: AlertCloseTriggerProps) {
  const { connect, open, root, send } = useAlert("CloseTrigger")
  const env = useEnvironment()
  // Modality tracking runs while a trigger is mounted, so focus-visible is known on focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const named =
    rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined || hasText(children)
  const own = normalizeProps(connect.closeTrigger({ named, focused, modality }))
  const props = mergeProps(
    {
      ...joinHandlers(own, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        onClick: () => {
          const r = root.current
          const active = r?.ownerDocument.activeElement
          send({ type: "CLOSE", focusInside: !!r && !!active && r.contains(active) })
        },
      }),
      children,
    },
    rest,
  )
  return renderPart("button", props, render, { open })
}

/**
 * An inline message in the page: never a live region of its own and never takes focus; it
 * announces through the Announcer when it appears after load or its text changes.
 */
export const Alert = { Root, Icon, Title, Description, CloseTrigger }
