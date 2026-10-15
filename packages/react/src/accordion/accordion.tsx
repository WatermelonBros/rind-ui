import {
  type AccordionEvent,
  type AccordionItemState,
  accordionConnect,
  accordionMachine,
  type ChangeDetails,
  type ClosedContent,
  type CollapsibleEvent,
  type PartProps as CorePartProps,
  describeKey,
  focusSafely,
  type HeadingLevel,
  type ItemKey,
  itemKey,
  openKeysOf,
  resolveHeadingLevel,
  type TriggerKeyEvent,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"
import {
  CollapsibleContent,
  CollapsibleContext,
  type CollapsibleDecoration,
  CollapsibleIndicator,
  type CollapsibleState,
  CollapsibleTrigger,
  useCollapsibleService,
} from "../collapsible/collapsible"
import { Heading, useHeadingContextLevel } from "../heading/heading"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useRenderedTag } from "../use-rendered-tag"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** The default header level outside any `Heading.Level` (spec "Heading Structure"). */
const DEFAULT_HEADER_LEVEL = 3

interface RootCtx {
  readonly instance: string
  readonly send: (event: AccordionEvent) => void
  readonly openKeys: readonly string[]
  readonly api: ReturnType<typeof accordionConnect>
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
  readonly closedContent: ClosedContent
  readonly level: HeadingLevel
  readonly triggers: Map<ItemKey, { current: HTMLElement | null }>
}
const AccordionContext = createContext<RootCtx | null>(null)
function useAccordion(part: string): RootCtx {
  const ctx = useContext(AccordionContext)
  if (!ctx) throw new Error(`Accordion.${part} must be inside Accordion.Root`)
  return ctx
}

interface ItemCtx {
  readonly state: AccordionItemState
}
const ItemContext = createContext<ItemCtx | null>(null)
function useItem(part: string): ItemCtx {
  const ctx = useContext(ItemContext)
  if (!ctx) throw new Error(`Accordion.${part} must be inside Accordion.Item`)
  return ctx
}

export interface AccordionState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

export type AccordionRootProps = Omit<ComponentPropsWithRef<"div">, "children" | "dir"> & {
  readonly children?: ReactNode
  readonly value?: readonly string[]
  readonly defaultValue?: readonly string[]
  readonly onValueChange?: (
    value: readonly string[],
    details: ChangeDetails<AccordionEvent>,
  ) => void
  /** Several items open at once. */
  readonly multiple?: boolean
  /** Single mode: the open item can be closed (default true). Ignored when `multiple`. */
  readonly collapsible?: boolean
  readonly disabled?: boolean
  /** Disabled triggers stay focusable (`aria-disabled`). */
  readonly focusableWhenDisabled?: boolean
  /** Arrow keys, Home and End move between triggers (off by default, as in APG 2026). */
  readonly keyboardNavigation?: boolean
  readonly orientation?: "vertical" | "horizontal"
  readonly dir?: "ltr" | "rtl"
  /** The headers' level; default: the surrounding `Heading.Level`'s, else 3. */
  readonly headingLevel?: HeadingLevel
  /** What closed content becomes; an item can override it. */
  readonly closedContent?: ClosedContent
  /** Overrides the region rule for open panels. */
  readonly contentRole?: "region" | "none"
  readonly render?: RenderProp<AccordionState>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  multiple = false,
  collapsible = true,
  disabled = false,
  focusableWhenDisabled = false,
  keyboardNavigation = false,
  orientation = "vertical",
  dir: ownDir,
  headingLevel,
  closedContent = "until-found",
  contentRole,
  render,
  id,
  ref,
  children,
  ...rest
}: AccordionRootProps) {
  const env = useEnvironment()
  const { dir } = useLocale(undefined, ownDir)
  const instance = useRootId(id)
  const triggers = useRef(new Map<ItemKey, { current: HTMLElement | null }>()).current
  const { view, send } = useMachine(accordionMachine, {
    value,
    defaultValue,
    onValueChange,
    multiple,
    collapsible,
    disabled,
    keyboardNavigation,
    // Document order of the triggers, whatever the mount order or closed-content mode.
    triggerOrder: (items) =>
      [...items].sort((a, b) => {
        const x = triggers.get(a)?.current
        const y = triggers.get(b)?.current
        if (!x || !y) return 0
        return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      }),
    focusTrigger: (item) => {
      const el = triggers.get(item)?.current
      if (el) void focusSafely(el, env)
    },
  })
  const context = useHeadingContextLevel()
  const level = resolveHeadingLevel(headingLevel, context ?? DEFAULT_HEADER_LEVEL)
  const openKeys = openKeysOf(view.values.value ?? [], multiple)
  const api = accordionConnect(
    {
      instance,
      orientation,
      dir,
      platform: env.platform,
      disabled,
      multiple,
      collapsible,
      keyboardNavigation,
      itemCount: view.context.items.size,
      contentRole,
    },
    send,
  )
  const ctx: RootCtx = {
    instance,
    send,
    openKeys,
    api,
    disabled,
    focusableWhenDisabled,
    closedContent,
    level,
    triggers,
  }
  const props = mergeProps(
    { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ref },
    rest,
  )
  return (
    <AccordionContext value={ctx}>
      {renderPart("div", { ...props, children }, render, { value: openKeys, disabled })}
    </AccordionContext>
  )
}

export type AccordionItemProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
  readonly children?: ReactNode
  /** A non-empty string, unique within the accordion. */
  readonly value: string
  readonly disabled?: boolean
  readonly closedContent?: ClosedContent
  readonly render?: RenderProp<CollapsibleState>
}

/** Collapsible's TOGGLE / OPEN / CLOSE proposals become the accordion's item events. */
function itemEvent(item: ItemKey, event: CollapsibleEvent): AccordionEvent {
  switch (event.type) {
    case "TOGGLE":
      return { type: "ITEM.TOGGLE", item, modality: event.modality }
    case "OPEN":
      return { type: "ITEM.OPEN", item, reason: event.reason }
    case "CLOSE":
      return { type: "ITEM.CLOSE", item, reason: event.reason }
    default: {
      const never: never = event
      return never
    }
  }
}

function Item({
  value,
  disabled: own = false,
  closedContent,
  render,
  ref,
  children,
  ...rest
}: AccordionItemProps) {
  const root = useAccordion("Item")
  const env = useEnvironment()
  const key = itemKey(value)
  const disabled = own || root.disabled
  const focusable = !disabled || root.focusableWhenDisabled
  const open = root.openKeys.includes(key)
  const idBase = useRootId(undefined)
  const state: AccordionItemState = { item: key, open, disabled }
  const { send, api, level } = root
  useIsoLayoutEffect(() => {
    send({ type: "ITEM.REGISTER", item: key, disabled, focusable })
  }, [send, key, disabled, focusable])
  useIsoLayoutEffect(() => () => send({ type: "ITEM.UNREGISTER", item: key }), [send, key])
  const decoration: CollapsibleDecoration = useMemo(() => {
    const s: AccordionItemState = { item: key, open, disabled }
    return {
      trigger: () => {
        const t = api.trigger(s)
        const onKeyDown = t["onKeyDown"] as (e: TriggerKeyEvent) => void // set by connect
        return {
          ...t,
          onKeyDown: (e: KeyboardEvent) =>
            onKeyDown({
              ...describeKey(e.nativeEvent, env),
              onTrigger: e.target === e.currentTarget,
              preventDefault: () => e.preventDefault(),
            }),
        } satisfies CorePartProps
      },
      content: (triggerId) => api.content(s, triggerId),
      indicator: () => api.indicator(),
      // A heading inside a panel is one level below its header.
      wrapContent: (c) => (
        <Heading.Level level={Math.min(level + 1, 6) as HeadingLevel}>{c}</Heading.Level>
      ),
    }
    // `api` is rebuilt each render; its inputs are what the memo keys on.
  }, [key, open, disabled, api, level, env])
  const ctx = useCollapsibleService({
    scope: "accordion",
    instance: root.instance,
    idBase,
    label: "Accordion",
    decoration,
    open,
    defaultOpen: undefined,
    // A proposal is always one of the collapsible's own events (never a system event).
    onOpenChange: (_open, details) => send(itemEvent(key, details.event as CollapsibleEvent)),
    disabled,
    focusableWhenDisabled: root.focusableWhenDisabled,
    closedContent: closedContent ?? root.closedContent,
  })
  useIsoLayoutEffect(() => {
    root.triggers.set(key, ctx.triggerEl)
    return () => {
      root.triggers.delete(key)
    }
  }, [root.triggers, key, ctx.triggerEl])
  const props = mergeProps({ ...normalizeProps(api.item(state)), ref }, rest)
  return (
    <ItemContext value={{ state }}>
      <CollapsibleContext value={ctx}>
        {renderPart("div", { ...props, children }, render, { open, disabled })}
      </CollapsibleContext>
    </ItemContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<CollapsibleState>
}

function Header({ render, ref, ...rest }: PartProps<"h3">) {
  const root = useAccordion("Header")
  const { state } = useItem("Header")
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag(`h${root.level}`, render, el)
  // APG: the button is the heading's only element (base-ui#3632).
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node) return
    const others = Array.from(node.children).filter(
      (c) => c.getAttribute("data-part") !== "trigger",
    )
    if (others.length > 0) {
      console.warn(
        `[rind-ui] accordion: the header of item "${state.item}" contains elements besides its trigger; the trigger must be the heading's only element`,
      )
    }
  })
  const props = mergeProps(
    { ...normalizeProps(root.api.header(state, root.level, tag)), ref: composeRefs(el, ref) },
    rest,
  )
  return renderPart(`h${root.level}`, props, render, {
    open: state.open,
    disabled: state.disabled,
  })
}

export const Accordion = {
  Root,
  Item,
  Header,
  Trigger: CollapsibleTrigger,
  Content: CollapsibleContent,
  Indicator: CollapsibleIndicator,
}
