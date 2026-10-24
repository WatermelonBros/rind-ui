/** @jsxImportSource solid-js */
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import {
  CollapsibleContext,
  type CollapsibleDecoration,
  type CollapsibleState,
  useCollapsibleService,
} from "../collapsible/collapsible"
import { Heading, useHeadingContextLevel } from "../heading/heading"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare const process: { env: { NODE_ENV?: string } }

/** The default header level outside any `Heading.Level` (spec "Heading Structure"). */
const DEFAULT_HEADER_LEVEL = 3

interface RootCtx {
  readonly instance: Accessor<string>
  readonly send: (event: AccordionEvent) => void
  readonly openKeys: Accessor<readonly string[]>
  readonly api: Accessor<ReturnType<typeof accordionConnect>>
  readonly disabled: Accessor<boolean>
  readonly focusableWhenDisabled: Accessor<boolean>
  readonly closedContent: Accessor<ClosedContent>
  readonly level: Accessor<HeadingLevel>
  readonly triggers: Map<ItemKey, Accessor<Element | null>>
}
const AccordionContext = createContext<RootCtx>()
function useAccordion(part: string): RootCtx {
  const ctx = useContext(AccordionContext)
  if (!ctx) throw new Error(`Accordion.${part} must be inside Accordion.Root`)
  return ctx
}
const ItemStateContext = createContext<Accessor<AccordionItemState>>()

export interface AccordionState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

export type AccordionRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue" | "id" | "dir"
> & {
  /** Controlled open items. */
  readonly value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: ChangeDetails<AccordionEvent>) => void)
    | undefined
  /** Several items open at once. */
  readonly multiple?: boolean | undefined
  /** Single mode: the open item can be closed (default true). Ignored when `multiple`. */
  readonly collapsible?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Disabled triggers stay focusable (`aria-disabled`). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Arrow keys, Home and End move between triggers (off by default, as in APG 2026). */
  readonly keyboardNavigation?: boolean | undefined
  readonly orientation?: "vertical" | "horizontal" | undefined
  readonly dir?: "ltr" | "rtl" | undefined
  /** The headers' level; default: the surrounding `Heading.Level`'s, else 3. */
  readonly headingLevel?: HeadingLevel | undefined
  /** What closed content becomes; an item can override it. */
  readonly closedContent?: ClosedContent | undefined
  /** Overrides the region rule for open panels. */
  readonly contentRole?: "region" | "none" | undefined
  readonly id?: string | undefined
  readonly render?: RenderProp<AccordionState> | undefined
  readonly children?: JSX.Element | ((state: AccordionState) => JSX.Element)
}

function Root(props: AccordionRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "multiple",
    "collapsible",
    "disabled",
    "focusableWhenDisabled",
    "keyboardNavigation",
    "orientation",
    "dir",
    "headingLevel",
    "closedContent",
    "contentRole",
    "id",
    "render",
    "children",
  ])
  const env = useEnvironment()
  const locale = useLocale(
    () => undefined,
    () => local.dir,
  )
  const instance = useRootId(() => local.id)
  const triggers = new Map<ItemKey, Accessor<Element | null>>()
  const multiple = () => local.multiple === true
  const { view, send } = useMachine(accordionMachine, () => ({
    value: local.value,
    defaultValue: local.defaultValue,
    onValueChange: local.onValueChange,
    multiple: multiple(),
    collapsible: local.collapsible ?? true,
    disabled: local.disabled === true,
    keyboardNavigation: local.keyboardNavigation === true,
    // Document order of the triggers, whatever the mount order or closed-content mode.
    triggerOrder: (items: readonly ItemKey[]) =>
      [...items].sort((a, b) => {
        const x = triggers.get(a)?.()
        const y = triggers.get(b)?.()
        if (!x || !y) return 0
        return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      }),
    focusTrigger: (item: ItemKey) => {
      const el = triggers.get(item)?.()
      if (el instanceof HTMLElement) void focusSafely(el, env)
    },
  }))
  const context = useHeadingContextLevel()
  const level = createMemo(() =>
    resolveHeadingLevel(local.headingLevel, context() ?? DEFAULT_HEADER_LEVEL),
  )
  const openKeys = createMemo(() => openKeysOf(view().values.value ?? [], multiple()))
  const api = createMemo(() =>
    accordionConnect(
      {
        instance: instance(),
        orientation: local.orientation ?? "vertical",
        dir: locale().dir,
        platform: env.platform,
        disabled: local.disabled === true,
        multiple: multiple(),
        collapsible: local.collapsible ?? true,
        keyboardNavigation: local.keyboardNavigation === true,
        itemCount: view().context.items.size,
        contentRole: local.contentRole,
      },
      send,
    ),
  )
  const state = reactive<AccordionState>(() => ({
    value: openKeys(),
    disabled: local.disabled === true,
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().root()),
        ...(local.id === undefined ? {} : { id: local.id }),
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <AccordionContext.Provider
      value={{
        instance,
        send,
        openKeys,
        api,
        disabled: () => local.disabled === true,
        focusableWhenDisabled: () => local.focusableWhenDisabled === true,
        closedContent: () => local.closedContent ?? "until-found",
        level,
        triggers,
      }}
    >
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </AccordionContext.Provider>
  )
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

export type AccordionItemProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** A non-empty string, unique within the accordion. */
  readonly value: string
  readonly disabled?: boolean | undefined
  readonly closedContent?: ClosedContent | undefined
  readonly render?: RenderProp<CollapsibleState> | undefined
  readonly children?: JSX.Element | ((state: CollapsibleState) => JSX.Element)
}

function Item(props: AccordionItemProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "disabled",
    "closedContent",
    "render",
    "children",
  ])
  const root = useAccordion("Item")
  const env = useEnvironment()
  const key = createMemo(() => itemKey(local.value))
  const disabled = createMemo(() => local.disabled === true || root.disabled())
  const focusable = createMemo(() => !disabled() || root.focusableWhenDisabled())
  const open = () => root.openKeys().includes(key())
  const generated = createUniqueId()
  const state = (): AccordionItemState => ({ item: key(), open: open(), disabled: disabled() })
  // Registered on mount and whenever its key or flags change; unregistered on unmount.
  afterMount(() => {
    let old: ItemKey | undefined
    createEffect(() => {
      const item = key()
      const isDisabled = disabled()
      const isFocusable = focusable()
      if (old !== undefined && old !== item) root.send({ type: "ITEM.UNREGISTER", item: old })
      root.send({ type: "ITEM.REGISTER", item, disabled: isDisabled, focusable: isFocusable })
      old = item
    })
    onCleanup(() => root.send({ type: "ITEM.UNREGISTER", item: untrack(key) }))
  })
  const decoration: CollapsibleDecoration = {
    trigger: () => {
      const t = root.api().trigger(state())
      const onKeyDown = t["onKeyDown"] as (e: TriggerKeyEvent) => void // set by connect
      return {
        ...t,
        onKeyDown: (e: KeyboardEvent) =>
          onKeyDown({
            ...describeKey(e, env),
            onTrigger: e.target === e.currentTarget,
            preventDefault: () => e.preventDefault(),
          }),
      } satisfies CorePartProps
    },
    content: (triggerId) => root.api().content(state(), triggerId),
    indicator: () => root.api().indicator(),
    // A heading inside a panel is one level below its header.
    wrapContent: (c) => (
      <Heading.Level level={Math.min(root.level() + 1, 6) as HeadingLevel}>{c()}</Heading.Level>
    ),
  }
  const ctx = useCollapsibleService({
    scope: "accordion",
    instance: root.instance,
    idBase: () => generated,
    label: "Accordion",
    decoration,
    props: () => ({
      open: open(),
      defaultOpen: undefined,
      // A proposal is always one of the collapsible's own events (never a system event).
      onOpenChange: (_open: boolean, details: ChangeDetails<CollapsibleEvent>) =>
        root.send(itemEvent(key(), details.event as CollapsibleEvent)),
      disabled: disabled(),
      focusableWhenDisabled: root.focusableWhenDisabled(),
      closedContent: local.closedContent ?? root.closedContent(),
    }),
  })
  afterMount(() => {
    const item = untrack(key)
    root.triggers.set(item, ctx.triggerEl)
    onCleanup(() => root.triggers.delete(item))
  })
  const itemState = reactive<CollapsibleState>(() => ({ open: open(), disabled: disabled() }))
  const merged = createMemo(() => mergeProps(normalizeProps(root.api().item(state())), rest))
  const children = () => resolveChildren(local.children, itemState)
  return (
    <ItemStateContext.Provider value={state}>
      <CollapsibleContext.Provider value={ctx}>
        {renderPart(local.render, merged, itemState, children, (p) => (
          <div {...p}>{children()}</div>
        ))}
      </CollapsibleContext.Provider>
    </ItemStateContext.Provider>
  )
}

export type AccordionHeaderProps = Omit<JSX.HTMLAttributes<HTMLHeadingElement>, "children"> & {
  readonly render?: RenderProp<CollapsibleState> | undefined
  readonly children?: JSX.Element | ((state: CollapsibleState) => JSX.Element)
}

function Header(props: AccordionHeaderProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const root = useAccordion("Header")
  const state = useContext(ItemStateContext)
  if (!state) throw new Error("Accordion.Header must be inside Accordion.Item")
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = () =>
    local.render ? (el()?.tagName.toLowerCase() ?? `h${root.level()}`) : `h${root.level()}`
  // APG: the button is the heading's only element (base-ui#3632).
  afterMount(() =>
    createEffect(() => {
      const node = el()
      state()
      if (process.env.NODE_ENV === "production" || !node) return
      const others = Array.from(node.children).filter(
        (c) => c.getAttribute("data-part") !== "trigger",
      )
      if (others.length > 0) {
        console.warn(
          `[rind-ui] accordion: the header of item "${state().item}" contains elements besides its trigger; the trigger must be the heading's only element`,
        )
      }
    }),
  )
  const itemState = reactive<CollapsibleState>(() => ({
    open: state().open,
    disabled: state().disabled,
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(root.api().header(state(), root.level(), tag())),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, itemState)
  return renderPart(local.render, merged, itemState, children, (p) => (
    <Dynamic component={`h${root.level()}`} {...p}>
      {children()}
    </Dynamic>
  ))
}

/** The parts, by name: `accordion.parts.ts` re-exports them (and the Collapsible's) as the `Accordion` namespace. */
export { Header, Item, Root }
