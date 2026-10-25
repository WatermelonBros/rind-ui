/** @jsxImportSource solid-js */

import type { ItemRegistry } from "@rind-ui/core"
import {
  announcerCapability,
  type ChangeDetails,
  type CollectionKey,
  createListCollection,
  layoutCapability,
  type ToggleGroupEvent,
  toggleGroupConnect,
  toggleGroupIds,
  toggleGroupMachine,
  toKey,
} from "@rind-ui/core"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  useContext,
} from "solid-js"
import { useCompositeHost, useHostItem } from "../composite-host"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import type { ToggleIndicatorProps, ToggleRootProps } from "../toggle/toggle"
import * as Toggle from "../toggle/toggle.parts"
import { declaredStop, useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

type Connect = typeof toggleGroupConnect
interface Ctx {
  /** The connect output; `pendingStop` for an item still unregistered (server, hydration). */
  readonly api: (pendingStop?: string | null) => ReturnType<Connect>
  readonly send: (event: ToggleGroupEvent) => void
  readonly registry: ItemRegistry
  readonly value: Accessor<readonly string[]>
  readonly disabled: Accessor<boolean>
  readonly focusableWhenDisabled: Accessor<boolean>
  readonly stop: ReturnType<typeof declaredStop>
}
/** Enough state to read an item's id (the key the host knows it by). */
const NO_STATE = {
  tag: "button",
  itemDisabled: false,
  focused: false,
  modality: "keyboard",
  pressed: false,
  hovered: false,
} as const

const GroupContext = createContext<Ctx>()

export interface ToggleGroupState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

export type ToggleGroupRootProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "children" | "defaultValue"
> & {
  /** The group's Items. */
  readonly children?: JSX.Element
  readonly value?: readonly string[] | undefined
  readonly defaultValue?: readonly string[] | undefined
  readonly onValueChange?:
    | ((value: readonly string[], details: ChangeDetails<ToggleGroupEvent>) => void)
    | undefined
  /** Default `single`: pressing an item replaces the selection. */
  readonly selectionMode?: "single" | "multiple" | undefined
  /** The last pressed item cannot be released. */
  readonly disallowEmptySelection?: boolean | undefined
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly focusableWhenDisabled?: boolean | undefined
  readonly render?: RenderProp<ToggleGroupState> | undefined
}

function Root(props: ToggleGroupRootProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "defaultValue",
    "onValueChange",
    "selectionMode",
    "disallowEmptySelection",
    "orientation",
    "loop",
    "disabled",
    "focusableWhenDisabled",
    "render",
    "id",
    "children",
  ])
  const env = useEnvironment(announcerCapability, layoutCapability)
  // Hosted by a Toolbar: its disabled state applies, its focusableWhenDisabled unless ours.
  const host = useCompositeHost()
  const focusableWhenDisabled = () =>
    local.focusableWhenDisabled ?? host?.focusableWhenDisabled ?? false
  const instance = useRootId(() => local.id)
  const ids = createMemo(() => toggleGroupIds(instance()))
  const fieldsetDisabled = useFieldsetDisabled()
  const groupDisabled = () =>
    local.disabled === true || fieldsetDisabled() || host?.disabled === true
  const { collection: registered, registry } = useCollectionItems()
  const collection = () => registered() ?? EMPTY
  const selectionMode = () => local.selectionMode ?? "single"
  const { view, send } = useMachine(
    toggleGroupMachine,
    () => ({
      collection: collection(),
      strategy: "roving" as const,
      ids: ids(),
      loop: local.loop ?? true,
      selectionMode: selectionMode(),
      disallowEmptySelection: local.disallowEmptySelection ?? false,
      focusableWhenDisabled: focusableWhenDisabled(),
      value: local.value,
      defaultValue: local.defaultValue,
      onValueChange: local.onValueChange,
      disabled: groupDisabled(),
    }),
    env,
  )
  const current = (): readonly string[] => view().values.value ?? []
  const api = (pendingStop: string | null = null) =>
    toggleGroupConnect(
      {
        instance: instance(),
        collection: collection(),
        value: current(),
        highlightedKey: view().context.highlightedKey,
        pending: registered() === null,
        pendingStop,
        orientation: local.orientation ?? "horizontal",
        selectionMode: selectionMode(),
        disabled: groupDisabled(),
        focusableWhenDisabled: focusableWhenDisabled(),
        focusWithin: view().matches("focused"),
        hosted: host !== null,
      },
      send,
      env,
    )
  const [el, setEl] = createSignal<Element | null>(null)
  // Development: a group needs a name (aria-label or aria-labelledby: radix#754).
  afterMount(() =>
    createEffect(() => {
      const node = el()
      if (process.env.NODE_ENV === "production" || !node) return
      if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
        console.warn(
          `[rind-ui] toggle-group: the root #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
        )
      }
    }),
  )
  const state = reactive<ToggleGroupState>(() => ({
    value: current(),
    disabled: groupDisabled(),
  }))
  const merged = createMemo(() => mergeProps({ ...normalizeProps(api().root()), ref: setEl }, rest))
  const children = () => local.children
  return (
    <GroupContext.Provider
      value={{
        api,
        send,
        registry,
        value: current,
        disabled: groupDisabled,
        focusableWhenDisabled,
        stop: declaredStop(),
      }}
    >
      {renderPart(local.render, merged, state, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </GroupContext.Provider>
  )
}

export interface ToggleGroupItemState {
  readonly pressed: boolean
  readonly disabled: boolean
}

/** An item of a group (its `value` is its key in the group's value). */
type GroupItemProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "children"> & {
  /** The item's key in the group's value. */
  readonly value: string
  /** Disables this item: it cannot be pressed. */
  readonly disabled?: boolean | undefined
  /** The item's text in the group's collection (icon-only items). Default: its text content. */
  readonly textValue?: string | undefined
  readonly render?: RenderProp<ToggleGroupItemState> | undefined
  readonly children?: JSX.Element | ((state: ToggleGroupItemState) => JSX.Element)
}

/**
 * A toggle: inside `ToggleGroup.Root` an item of the group (`value` is its key); alone, a
 * single toggle button with its own `pressed` state (no group wrapper, no roving).
 */
export type ToggleGroupItemProps =
  | GroupItemProps
  | (ToggleRootProps & { readonly value?: undefined; readonly textValue?: undefined })

/** The pressed state and indicator props an item gives its indicator. */
const ItemContext = createContext<{
  state: ToggleGroupItemState
  indicator: Accessor<Record<string | symbol, unknown>>
}>()

function Item(props: ToggleGroupItemProps) {
  const ctx = useContext(GroupContext)
  if (!ctx) return <Toggle.Root {...(props as ToggleRootProps)} />
  if (props.value === undefined) {
    throw new Error("ToggleGroup.Item needs a `value` inside ToggleGroup.Root")
  }
  return <GroupItem {...(props as GroupItemProps)} />
}

function GroupItem(props: GroupItemProps) {
  const [local, rest] = splitProps(props, ["value", "disabled", "textValue", "render", "children"])
  const ctx = useContext(GroupContext) as Ctx
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const key = (): CollectionKey => toKey(local.value)
  const [el, setEl] = createSignal<Element | null>(null)
  const tag = () => (local.render ? (el()?.tagName.toLowerCase() ?? "button") : "button")
  const ownDisabled = () => local.disabled === true
  useRegisterItem(
    ctx.registry,
    () => ({ key: local.value, textValue: local.textValue, disabled: ownDisabled() }),
    el,
  )
  // Read once, in document order: this item's view of the server tab stop.
  const pendingStop = ctx.stop(local.value, ctx.disabled() || ownDisabled(), ctx.value())
  // Hosted: the item is also one of the host's controls (navigation and tab stop).
  const host = useCompositeHost()
  const hostKey = () => ctx.api().item(key(), NO_STATE)["id"] as string // set by the connect
  const itemDisabled = () => ctx.disabled() || ownDisabled()
  useHostItem(
    host,
    () => ({
      id: hostKey(),
      skip: itemDisabled() && !ctx.focusableWhenDisabled(),
      textValue: local.textValue,
    }),
    el,
  )
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "PRESS", key: key(), modality: e.modality })
    },
    disabled: itemDisabled,
  })
  const hover = useHover({ env, send: () => {}, disabled: itemDisabled })
  const state = reactive<ToggleGroupItemState>(() => ({
    pressed: ctx.value().includes(key()),
    disabled: itemDisabled(),
  }))
  const own = createMemo(() =>
    normalizeProps(
      ctx.api(pendingStop).item(key(), {
        tag: tag(),
        itemDisabled: ownDisabled(),
        focused: focused(),
        modality: modality(),
        pressed: press.pressed(),
        hovered: hover.hovered(),
      }),
    ),
  )
  const hostProps = () =>
    host
      ? normalizeProps(
          host.itemProps({
            id: hostKey(),
            disabled: itemDisabled(),
            first: host.claimFirst(hostKey()),
          }),
        )
      : {}
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(own(), hostProps(), press.props, hover.props, {
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        }),
        ref: setEl,
      },
      rest,
    ),
  )
  const indicator = createMemo(() =>
    normalizeProps(ctx.api(pendingStop).itemIndicator(key(), { itemDisabled: ownDisabled() })),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <ItemContext.Provider value={{ state, indicator }}>
      {renderPart(local.render, merged, state, children, (p) => (
        <button {...p}>{children()}</button>
      ))}
    </ItemContext.Provider>
  )
}

export type ToggleGroupItemIndicatorProps = ToggleIndicatorProps

/** Decorative: its children while the item is pressed, `fallback` otherwise. */
function ItemIndicator(props: ToggleGroupItemIndicatorProps) {
  const item = useContext(ItemContext)
  // A lone item is a single toggle: its own indicator.
  if (!item) return <Toggle.Indicator {...props} />
  const [local, rest] = splitProps(props, ["fallback", "render", "children"])
  const merged = createMemo(() => mergeProps(item.indicator(), rest))
  const children = () =>
    item.state.pressed ? resolveChildren(local.children, item.state) : local.fallback
  return renderPart(local.render, merged, item.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

/** The parts, by name: `toggle-group.parts.ts` re-exports them as the `ToggleGroup` namespace. */
export { Item, ItemIndicator, Root }
