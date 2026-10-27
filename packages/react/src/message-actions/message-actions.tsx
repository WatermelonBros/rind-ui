"use client"

// Message Actions (add-message-actions): a Toolbar (roving focus, one Tab stop) of the actions
// on a chat message. Copy is a Clipboard and Feedback a Toggle Group, both hosted by the
// Toolbar; the parts carry the message-actions attributes, so the theme and the contract find
// them by this component's scope.

import {
  announcerCapability,
  type MessageActionsEvent,
  type MessageActionsMessages,
  type MessageOverrides,
  messageActionsActive,
  messageActionsConnect,
  messageActionsMachine,
  messageActionsMessages,
  type PartProps,
  type RegenerateState,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { flushSync } from "react-dom"
import * as Clipboard from "../clipboard/clipboard.parts"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import type { ToggleGroupRootProps } from "../toggle-group/toggle-group"
import * as ToggleGroup from "../toggle-group/toggle-group.parts"
import type { ToolbarItemProps, ToolbarRootProps } from "../toolbar/toolbar"
import * as Toolbar from "../toolbar/toolbar.parts"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "message-actions": MessageActionsMessages
  }
}

/** What a function child of the Root receives. */
export interface MessageActionsRenderState {
  readonly active: boolean
  readonly editing: boolean
  readonly regenerate: RegenerateState
  readonly index: number
  readonly count: number
}

type Api = ReturnType<typeof messageActionsConnect>

interface Ctx {
  readonly api: Api
  readonly send: (event: MessageActionsEvent) => void
  readonly editEl: { current: HTMLElement | null }
}
const MessageActionsContext = createContext<Ctx | null>(null)
function useMessageActions(part: string): Ctx {
  const ctx = useContext(MessageActionsContext)
  if (!ctx) throw new Error(`MessageActions.${part} must be inside MessageActions.Root`)
  return ctx
}

/** Toolbar props carry the toolbar's scope: the part's own scope replaces it. */
function withoutScope(props: Record<string, unknown>) {
  const { "data-scope": _s, "data-part": _p, "data-instance": _i, ...rest } = props
  return rest
}

export type MessageActionsRootProps = Omit<ToolbarRootProps, "children"> & {
  /** Forces the row visible. */
  readonly active?: boolean
  /** Regenerate the message. */
  readonly onRegenerate?: () => void | Promise<void>
  /** Controlled editing. */
  readonly editing?: boolean
  /** Uncontrolled editing. Default false. */
  readonly defaultEditing?: boolean
  /** Edit was toggled. */
  readonly onEditingChange?: (editing: boolean) => void
  /** How many versions the message has. Default 0. */
  readonly count?: number
  /** Controlled version index (0-based). */
  readonly index?: number
  /** Uncontrolled version index. Default 0. */
  readonly defaultIndex?: number
  /** A move between versions. */
  readonly onIndexChange?: (index: number) => void
  /** The version buttons wrap around. */
  readonly loop?: boolean
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<MessageActionsMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
  /**
   * The message element whose hover, focus and touch show the row. Default: the Root's
   * parent element.
   */
  readonly host?: () => Element | null
  /** The actions, or a function of the row's state. */
  readonly children?: ReactNode | ((state: MessageActionsRenderState) => ReactNode)
}

function Root({
  active,
  onRegenerate,
  editing,
  defaultEditing,
  onEditingChange,
  count,
  index,
  defaultIndex,
  onIndexChange,
  loop,
  messages: ownMessages,
  locale: ownLocale,
  host,
  children,
  id,
  ref,
  ...rest
}: MessageActionsRootProps) {
  const instance = useRootId(id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("message-actions", messageActionsMessages, ownMessages)
  const { locale } = useLocale(ownLocale)
  const editEl = useRef<HTMLElement | null>(null)
  const [machineEnv] = useState(() => ({
    ...env,
    // After editing ends, the focus comes back to Edit unless it went somewhere on purpose.
    restoreEditFocus: () => {
      const el = editEl.current
      const activeEl = el?.ownerDocument.activeElement
      if (el && (activeEl == null || activeEl === el.ownerDocument.body))
        el.focus({ preventScroll: true })
    },
  }))
  const { view, send } = useMachine(
    messageActionsMachine,
    {
      active,
      onRegenerate: () => onRegenerate?.(),
      ...(editing === undefined ? {} : { editing }),
      defaultEditing,
      onEditingChange: (e: boolean) => onEditingChange?.(e),
      count,
      ...(index === undefined ? {} : { index }),
      defaultIndex,
      onIndexChange: (i: number) => onIndexChange?.(i),
      loop,
      messages,
      id: instance,
      lang: locale,
    },
    machineEnv,
  )
  const isActive = messageActionsActive(view.context, { active })
  const api = messageActionsConnect(
    {
      instance,
      active: isActive,
      editing: view.values.editing === true,
      regenerate: view.context.regenerate,
      count: count ?? 0,
      index: view.values.index ?? 0,
      loop: loop === true,
      messages,
      named: rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
    },
    env,
  )
  const rootEl = useRef<HTMLDivElement | null>(null)
  const hostRef = useRef(host)
  hostRef.current = host
  useEffect(() => {
    // The message's own hover, focus and touch show the row (design §1).
    const found = hostRef.current?.() ?? rootEl.current?.parentElement ?? null
    if (!found) return
    // Elements dispatch the HTMLElement events listened to here (SVG ones included).
    const el = found as HTMLElement
    const offs: (() => void)[] = []
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (e: HTMLElementEventMap[K]) => void,
    ) => {
      el.addEventListener(type, listener, { passive: true })
      offs.push(() => el.removeEventListener(type, listener))
    }
    on("pointerenter", () => send({ type: "POINTER.ENTER" }))
    on("pointerleave", () => send({ type: "POINTER.LEAVE" }))
    on("focusin", () => send({ type: "FOCUS.IN" }))
    // Out of the message only: a move between its own elements stays inside.
    on("focusout", (e) => {
      if (!(e.relatedTarget instanceof Node && el.contains(e.relatedTarget)))
        send({ type: "FOCUS.OUT" })
    })
    on("touchstart", () => send({ type: "TOUCH" }))
    return () => {
      for (const off of offs) off()
    }
  }, [send])
  const state: MessageActionsRenderState = {
    active: isActive,
    editing: view.values.editing === true,
    regenerate: view.context.regenerate,
    index: view.values.index ?? 0,
    count: count ?? 0,
  }
  const ctx: Ctx = { api, send, editEl }
  return (
    <MessageActionsContext value={ctx}>
      <Toolbar.Root
        {...rest}
        {...normalizeProps(api.root())}
        id={id ?? instance}
        ref={composeRefs(rootEl, ref)}
      >
        {typeof children === "function" ? children(state) : children}
      </Toolbar.Root>
    </MessageActionsContext>
  )
}

type ButtonProps = ComponentPropsWithRef<"button">

/** A Toolbar item with this component's attributes, from `own(b)`. */
function ActionButton({
  name,
  own,
  press,
  elRef,
  props: { children, ref, ...rest },
}: {
  readonly name: string
  readonly own: (api: Api, b: Parameters<Api["edit"]>[0]) => PartProps
  readonly press: () => void
  readonly elRef?: { current: HTMLElement | null }
  readonly props: ButtonProps
}) {
  const ctx = useMessageActions(name)
  const env = useEnvironment()
  // Tracks the modality from mount, so the first keyboard focus is already visible.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const ownProps = normalizeProps(own(ctx.api, { tag: "button", focused, modality }))
  return (
    <Toolbar.Item
      focusableWhenDisabled
      render={(p) => (
        <button
          {...mergeProps(
            withoutScope(p),
            {
              ...joinHandlers(ownProps, {
                onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                  if (e.currentTarget.hasAttribute("data-disabled")) return
                  press()
                },
                onFocus: () => setFocused(true),
                onBlur: () => setFocused(false),
              }),
              ref: elRef ? composeRefs(elRef, ref) : ref,
            },
            rest,
          )}
        />
      )}
    >
      {children}
    </Toolbar.Item>
  )
}

export type MessageActionsItemProps = ToolbarItemProps

/** Your own action: a Toolbar item. */
function Item(props: MessageActionsItemProps) {
  const ctx = useMessageActions("Item")
  // Sound: the consumer's Toolbar.Item props, with this part's data-* first.
  const merged = mergeProps(normalizeProps(ctx.api.item()), props) as MessageActionsItemProps
  return <Toolbar.Item {...merged} />
}

export type MessageActionsCopyProps = Omit<ComponentPropsWithRef<"span">, "children"> & {
  /** What a press copies; a function is called at press time (the message's latest text). */
  readonly value: string | (() => string)
  /** The Trigger's content (an icon); the name stays `messages.copy`. */
  readonly children?: ReactNode
}

/** Copies `value` with Clipboard's states and announcements; its trigger is a Toolbar item. */
function Copy({ value, children, ...rest }: MessageActionsCopyProps) {
  const ctx = useMessageActions("Copy")
  // A press re-reads a function value before Clipboard copies: the re-render is flushed in
  // this handler, which runs before the Trigger's own in the same task.
  const [, setReads] = useState(0)
  const text = typeof value === "function" ? value() : value
  return (
    <span {...mergeProps(normalizeProps(ctx.api.copy()), rest)}>
      <Clipboard.Root
        value={text}
        messages={{ copy: ctx.api.names.copy }}
        render={(p) => <span {...p} />}
      >
        <Toolbar.Item
          focusableWhenDisabled
          render={(p) => (
            <Clipboard.Trigger
              {...(mergeProps(withoutScope(p), {
                onClick: () => {
                  if (typeof value === "function") flushSync(() => setReads((n) => n + 1))
                },
              }) as ButtonProps)}
            />
          )}
        >
          {children}
        </Toolbar.Item>
      </Clipboard.Root>
    </span>
  )
}

/** Calls `onRegenerate`; disabled and busy until its promise settles. */
function Regenerate(props: ButtonProps) {
  const ctx = useMessageActions("Regenerate")
  return (
    <ActionButton
      name="Regenerate"
      own={(api, b) => api.regenerate(b)}
      press={() => ctx.send({ type: "PRESS.REGENERATE" })}
      props={props}
    />
  )
}

/** Toggles editing (`aria-pressed`); the focus comes back to it when editing ends. */
function Edit(props: ButtonProps) {
  const ctx = useMessageActions("Edit")
  return (
    <ActionButton
      name="Edit"
      own={(api, b) => api.edit(b)}
      press={() => ctx.send({ type: "PRESS.EDIT" })}
      elRef={ctx.editEl}
      props={props}
    />
  )
}

export type MessageActionsFeedbackProps = Omit<ToggleGroupRootProps, "selectionMode">

/** Thumbs up/down: a single, deselectable Toggle Group named `messages.feedback`. */
function Feedback(props: MessageActionsFeedbackProps) {
  const ctx = useMessageActions("Feedback")
  return (
    <ToggleGroup.Root
      aria-label={ctx.api.names.feedback}
      {...(mergeProps(normalizeProps(ctx.api.feedback()), props) as MessageActionsFeedbackProps)}
      selectionMode="single"
    />
  )
}

export type MessageActionsFeedbackItemProps = Omit<
  ComponentPropsWithRef<"button">,
  "value" | "children"
> & {
  /** Thumbs up or down. */
  readonly value: "up" | "down"
  /** The item's content (an icon); the name stays "Good response" / "Bad response". */
  readonly children?: ReactNode
}

/** `value="up"` or `"down"`, named "Good response" / "Bad response". */
function FeedbackItem({ value, children, ...rest }: MessageActionsFeedbackItemProps) {
  const ctx = useMessageActions("FeedbackItem")
  const props = mergeProps(
    { "aria-label": value === "up" ? ctx.api.names.up : ctx.api.names.down },
    normalizeProps(ctx.api.feedbackItem(value)),
    rest,
  )
  return (
    // Sound: mergeProps of button attributes; `value` is set last.
    <ToggleGroup.Item
      {...(props as Omit<ComponentPropsWithRef<"button">, "disabled">)}
      value={value}
    >
      {children}
    </ToggleGroup.Item>
  )
}

/** A group ("Versions"), rendered from two versions. */
function Versions({ children, ...rest }: ComponentPropsWithRef<"div">) {
  const ctx = useMessageActions("Versions")
  if (!ctx.api.hasVersions) return null
  return <div {...mergeProps(normalizeProps(ctx.api.versions()), rest)}>{children}</div>
}

/** The previous version; disabled but focusable on the first (unless `loop`). */
function VersionPrevious(props: ButtonProps) {
  const ctx = useMessageActions("VersionPrevious")
  return (
    <ActionButton
      name="VersionPrevious"
      own={(api, b) => api.versionPrevious(b)}
      press={() => ctx.send({ type: "PRESS.PREVIOUS" })}
      props={props}
    />
  )
}

/** The next version; disabled but focusable on the last (unless `loop`). */
function VersionNext(props: ButtonProps) {
  const ctx = useMessageActions("VersionNext")
  return (
    <ActionButton
      name="VersionNext"
      own={(api, b) => api.versionNext(b)}
      press={() => ctx.send({ type: "PRESS.NEXT" })}
      props={props}
    />
  )
}

/** "2 / 3", `aria-hidden` (a move announces "Version 2 of 3"); its content replaces it. */
function VersionStatus({ children, ...rest }: ComponentPropsWithRef<"span">) {
  const ctx = useMessageActions("VersionStatus")
  return (
    <span {...mergeProps(normalizeProps(ctx.api.versionStatus()), rest)}>
      {children ?? ctx.api.versionText}
    </span>
  )
}

/** The parts, by name: `message-actions.parts.ts` re-exports them as the `MessageActions` namespace. */
export {
  Copy,
  Edit,
  Feedback,
  FeedbackItem,
  Item,
  Regenerate,
  Root,
  VersionNext,
  VersionPrevious,
  VersionStatus,
  Versions,
}
