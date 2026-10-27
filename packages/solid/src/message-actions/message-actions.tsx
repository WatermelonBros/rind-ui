/** @jsxImportSource solid-js */
// Message Actions (add-message-actions): a Toolbar (roving focus, one Tab stop) of the actions
// on a chat message. Copy is a Clipboard and Feedback a Toggle Group, both hosted by the
// Toolbar; the parts carry the message-actions attributes, so the theme and the contract find
// them by this component's scope.
import {
  announcerCapability,
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
  type Accessor,
  createContext,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import * as Clipboard from "../clipboard/clipboard.parts"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { reactive, resolveChildren } from "../render"
import type { ToggleGroupRootProps } from "../toggle-group/toggle-group"
import * as ToggleGroup from "../toggle-group/toggle-group.parts"
import type { ToolbarRootProps } from "../toolbar/toolbar"
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
type ActionsEvent = Parameters<
  ReturnType<typeof useMachine<typeof messageActionsMachine>>["send"]
>[0]

interface Ctx {
  readonly api: Accessor<Api>
  readonly send: (event: ActionsEvent) => void
  readonly setEdit: (el: HTMLElement | null) => void
}
const MessageActionsContext = createContext<Ctx>()
function useMessageActions(part: string): Ctx {
  const ctx = useContext(MessageActionsContext)
  if (!ctx) throw new Error(`MessageActions.${part} must be inside MessageActions.Root`)
  return ctx
}

/** Toolbar props carry the toolbar's scope: the part's own scope replaces it. */
const SCOPE = ["data-scope", "data-part", "data-instance"] as const

export type MessageActionsRootProps = Omit<ToolbarRootProps, "children"> & {
  /** Forces the row visible. */
  readonly active?: boolean | undefined
  /** Regenerate the message. */
  readonly onRegenerate?: (() => void | Promise<void>) | undefined
  /** Controlled editing. */
  readonly editing?: boolean | undefined
  /** Uncontrolled editing. Default false. */
  readonly defaultEditing?: boolean | undefined
  /** Edit was toggled. */
  readonly onEditingChange?: ((editing: boolean) => void) | undefined
  /** How many versions the message has. Default 0. */
  readonly count?: number | undefined
  /** Controlled version index (0-based). */
  readonly index?: number | undefined
  /** Uncontrolled version index. Default 0. */
  readonly defaultIndex?: number | undefined
  /** A move between versions. */
  readonly onIndexChange?: ((index: number) => void) | undefined
  /** The version buttons wrap around. */
  readonly loop?: boolean | undefined
  readonly messages?: MessageOverrides<MessageActionsMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  /**
   * The message element whose hover, focus and touch show the row. Default: the Root's
   * parent element.
   */
  readonly host?: (() => Element | null) | undefined
  readonly children?: JSX.Element | ((state: MessageActionsRenderState) => JSX.Element)
}

function Root(props: MessageActionsRootProps) {
  const [own, rest] = splitProps(props, [
    "active",
    "onRegenerate",
    "editing",
    "defaultEditing",
    "onEditingChange",
    "count",
    "index",
    "defaultIndex",
    "onIndexChange",
    "loop",
    "messages",
    "locale",
    "host",
    "children",
  ])
  const instance = useRootId(() => rest.id)
  const env = useEnvironment(announcerCapability)
  const messages = useMessages("message-actions", messageActionsMessages, () => own.messages)
  const locale = useLocale(() => own.locale)
  let editEl: HTMLElement | null = null
  const { view, send } = useMachine(
    messageActionsMachine,
    () => ({
      active: own.active,
      onRegenerate: () => own.onRegenerate?.(),
      ...(own.editing === undefined ? {} : { editing: own.editing }),
      defaultEditing: own.defaultEditing,
      onEditingChange: (e: boolean) => own.onEditingChange?.(e),
      count: own.count,
      ...(own.index === undefined ? {} : { index: own.index }),
      defaultIndex: own.defaultIndex,
      onIndexChange: (i: number) => own.onIndexChange?.(i),
      loop: own.loop,
      messages: messages(),
      id: instance(),
      lang: locale().locale,
    }),
    {
      ...env,
      // After editing ends, the focus comes back to Edit unless it went somewhere on purpose.
      restoreEditFocus: () => {
        const active = editEl?.ownerDocument.activeElement
        if (editEl && (active == null || active === editEl.ownerDocument.body))
          editEl.focus({ preventScroll: true })
      },
    },
  )
  const api = createMemo(() =>
    messageActionsConnect(
      {
        instance: instance(),
        active: messageActionsActive(view().context, { active: own.active }),
        editing: view().values.editing === true,
        regenerate: view().context.regenerate,
        count: own.count ?? 0,
        index: view().values.index ?? 0,
        loop: own.loop === true,
        messages: messages(),
        named: rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
      },
      env,
    ),
  )
  let rootEl: HTMLElement | null = null
  afterMount(() => {
    // The message's own hover, focus and touch show the row (design §1).
    const found = own.host?.() ?? rootEl?.parentElement ?? null
    if (!found) return
    // Elements dispatch the HTMLElement events listened to here (SVG ones included).
    const host = found as HTMLElement
    const on = <K extends keyof HTMLElementEventMap>(type: K, event: ActionsEvent) => {
      const listener = () => send(event)
      host.addEventListener(type, listener, { passive: true })
      onCleanup(() => host.removeEventListener(type, listener))
    }
    on("pointerenter", { type: "POINTER.ENTER" })
    on("pointerleave", { type: "POINTER.LEAVE" })
    on("focusin", { type: "FOCUS.IN" })
    // Out of the message only: a move between its own elements stays inside.
    const out = (e: FocusEvent) => {
      if (!(e.relatedTarget instanceof Node && host.contains(e.relatedTarget)))
        send({ type: "FOCUS.OUT" })
    }
    host.addEventListener("focusout", out)
    onCleanup(() => host.removeEventListener("focusout", out))
    on("touchstart", { type: "TOUCH" })
  })
  const state = (): MessageActionsRenderState => ({
    active: messageActionsActive(view().context, { active: own.active }),
    editing: view().values.editing === true,
    regenerate: view().context.regenerate,
    index: view().values.index ?? 0,
    count: own.count ?? 0,
  })
  const ctx: Ctx = {
    api,
    send,
    setEdit: (el) => {
      editEl = el
    },
  }
  const attrs = createMemo(() => api().root())
  // Fixed keys read through getters: Toolbar.Root rebuilds its children when the key set of a
  // spread changes (data-active and data-editing come and go).
  const rootAttrs = Object.fromEntries(
    ["data-scope", "data-part", "data-instance", "aria-label", "data-active", "data-editing"].map(
      (k) => [k, undefined],
    ),
  )
  for (const k of Object.keys(rootAttrs))
    Object.defineProperty(rootAttrs, k, { get: () => attrs()[k], enumerable: true })
  // A function child is called once with a reactive state (reads track), never re-run: its
  // controls must not remount on every state change.
  const live = reactive(state)
  // Created once, inside the providers: reading `own.children` builds new elements every
  // time (Solid's getter), and a rebuilt control would lose its focus.
  function Body() {
    const content = createMemo(() => {
      const c = own.children
      return typeof c === "function" ? untrack(() => c(live)) : c
    })
    return content as unknown as JSX.Element
  }
  return (
    <MessageActionsContext.Provider value={ctx}>
      {
        // Untracked: the Provider reads its children in a computation, and the spread reads the
        // attributes; tracked, every state change would rebuild the toolbar (and its focus).
        untrack(() => (
          <Toolbar.Root
            {...rest}
            {...rootAttrs}
            id={rest.id ?? instance()}
            ref={(el: HTMLDivElement) => {
              rootEl = el
            }}
          >
            <Body />
          </Toolbar.Root>
        ))
      }
    </MessageActionsContext.Provider>
  )
}

type ButtonProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  readonly children?: JSX.Element
}

/** A Toolbar item with this component's attributes, from `own(b)`. */
function ActionButton(props: {
  readonly name: string
  readonly own: (api: Api, b: { tag: string; focused: boolean; modality: never }) => PartProps
  readonly press?: (() => void) | undefined
  readonly setEl?: ((el: HTMLElement | null) => void) | undefined
  readonly rest: ButtonProps
}) {
  const ctx = useMessageActions(props.name)
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const [local, rest] = splitProps(props.rest, ["children"])
  const own = createMemo(() => {
    const o = normalizeProps(
      props.own(ctx.api(), { tag: "button", focused: focused(), modality: modality() as never }),
    )
    return o
  })
  return (
    <Toolbar.Item
      focusableWhenDisabled
      render={(p) => {
        const [, toolbar] = splitProps(p, SCOPE)
        // Reactive: the toolbar's roving tabindex and this part's state change after render.
        const merged = reactive(() =>
          mergeProps(
            { ...toolbar },
            {
              ...joinHandlers(own(), {
                onClick: (e: MouseEvent) => {
                  if ((e.currentTarget as HTMLElement).hasAttribute("data-disabled")) return
                  props.press?.()
                },
                onFocusIn: () => setFocused(true),
                onFocusOut: () => setFocused(false),
              }),
              ref: (el: HTMLElement) => props.setEl?.(el),
            },
            rest,
          ),
        )
        return <button {...merged} />
      }}
    >
      {local.children}
    </Toolbar.Item>
  )
}

export type MessageActionsItemProps = Parameters<typeof Toolbar.Item>[0]

/** Your own action: a Toolbar item. */
function Item(props: MessageActionsItemProps) {
  const ctx = useMessageActions("Item")
  // Children stay lazy (created inside Toolbar.Item); the rest merges after this part's data-*.
  const [local, rest] = splitProps(props, ["children"])
  // Sound: the consumer's Toolbar.Item props, with this part's data-* first.
  const merged = mergeProps(
    normalizeProps(ctx.api().item()),
    rest as Record<string, unknown>,
  ) as MessageActionsItemProps
  return <Toolbar.Item {...merged}>{local.children}</Toolbar.Item>
}

export type MessageActionsCopyProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** What a press copies; a function is called at press time (the message's latest text). */
  readonly value: string | (() => string)
  /** The Trigger's content (an icon); the name stays `messages.copy`. */
  readonly children?: JSX.Element
}

/** Copies `value` with Clipboard's states and announcements; its trigger is a Toolbar item. */
function Copy(props: MessageActionsCopyProps) {
  const [local, rest] = splitProps(props, ["value", "children"])
  const ctx = useMessageActions("Copy")
  // A press re-reads a function value before Clipboard copies (the Trigger's own handler
  // runs after this one, in the same task).
  const [reads, setReads] = createSignal(0)
  const value = () => {
    reads()
    return typeof local.value === "function" ? local.value() : local.value
  }
  return (
    <span {...mergeProps(normalizeProps(ctx.api().copy()), rest)}>
      <Clipboard.Root
        value={value()}
        messages={{ copy: ctx.api().names.copy }}
        render={(p) => <span {...p} />}
      >
        <Toolbar.Item
          focusableWhenDisabled
          render={(p) => {
            const [, toolbar] = splitProps(p, SCOPE)
            const merged = reactive(() =>
              mergeProps({ ...toolbar }, { onClick: () => setReads((n) => n + 1) }),
            )
            return <Clipboard.Trigger {...merged} />
          }}
        >
          {local.children}
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
      rest={props}
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
      setEl={ctx.setEdit}
      rest={props}
    />
  )
}

export type MessageActionsFeedbackProps = Omit<ToggleGroupRootProps, "selectionMode">

/** Thumbs up/down: a single, deselectable Toggle Group named `messages.feedback`. */
function Feedback(props: MessageActionsFeedbackProps) {
  const ctx = useMessageActions("Feedback")
  // Children stay lazy: created inside ToggleGroup.Root, under its context.
  const [local, rest] = splitProps(props, ["children"])
  // Built once: a call spread into a component is re-run on every prop read.
  const merged = mergeProps(
    { "aria-label": ctx.api().names.feedback },
    normalizeProps(ctx.api().feedback()),
    rest,
  )
  return (
    <ToggleGroup.Root {...merged} selectionMode="single">
      {local.children}
    </ToggleGroup.Root>
  )
}

export type MessageActionsFeedbackItemProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "children"
> & {
  readonly value: "up" | "down"
  readonly children?: JSX.Element
}

/** `value="up"` or `"down"`, named "Good response" / "Bad response". */
function FeedbackItem(props: MessageActionsFeedbackItemProps) {
  const ctx = useMessageActions("FeedbackItem")
  const [local, rest] = splitProps(props, ["value", "children"])
  // Built once: a call spread into a component is re-run on every prop read.
  const merged = mergeProps(
    { "aria-label": local.value === "up" ? ctx.api().names.up : ctx.api().names.down },
    normalizeProps(ctx.api().feedbackItem(local.value)),
    rest,
  )
  return (
    <ToggleGroup.Item {...merged} value={local.value}>
      {local.children}
    </ToggleGroup.Item>
  )
}

/** A group ("Versions"), rendered from two versions. */
function Versions(
  props: Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & { children?: JSX.Element },
) {
  const ctx = useMessageActions("Versions")
  const [local, rest] = splitProps(props, ["children"])
  return (
    <Show when={ctx.api().hasVersions}>
      <div {...mergeProps(normalizeProps(ctx.api().versions()), rest)}>{local.children}</div>
    </Show>
  )
}

/** The previous version; disabled but focusable on the first (unless `loop`). */
function VersionPrevious(props: ButtonProps) {
  const ctx = useMessageActions("VersionPrevious")
  return (
    <ActionButton
      name="VersionPrevious"
      own={(api, b) => api.versionPrevious(b)}
      press={() => ctx.send({ type: "PRESS.PREVIOUS" })}
      rest={props}
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
      rest={props}
    />
  )
}

/** "2 / 3", `aria-hidden` (a move announces "Version 2 of 3"); its content replaces it. */
function VersionStatus(
  props: Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & { children?: JSX.Element },
) {
  const ctx = useMessageActions("VersionStatus")
  const [local, rest] = splitProps(props, ["children"])
  return (
    <span {...mergeProps(normalizeProps(ctx.api().versionStatus()), rest)}>
      {resolveChildren(local.children, undefined) ?? ctx.api().versionText}
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
