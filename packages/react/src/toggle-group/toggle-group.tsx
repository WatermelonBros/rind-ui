import {
  type ChangeDetails,
  type CollectionKey,
  createListCollection,
  type ToggleGroupEvent,
  toggleGroupConnect,
  toggleGroupIds,
  toggleGroupMachine,
  toKey,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useCompositeHost, useHostItem } from "../composite-host"
import { declaredItems, serverStop } from "../declared-items"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { Toggle, type ToggleIndicatorProps, type ToggleRootProps } from "../toggle/toggle"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { useHover, usePress } from "../use-press"
import { useRenderedTag } from "../use-rendered-tag"

declare const process: { env: { NODE_ENV?: string } }

const EMPTY = createListCollection<{ key: string }>({
  items: [],
  getKey: (i) => i.key,
  getText: (i) => i.key,
})

interface Ctx {
  readonly api: ReturnType<typeof toggleGroupConnect>
  readonly send: (event: ToggleGroupEvent) => void
  readonly registry: ReturnType<typeof useCollectionItems>["registry"]
  readonly value: readonly string[]
  readonly disabled: boolean
  readonly focusableWhenDisabled: boolean
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

const GroupContext = createContext<Ctx | null>(null)
function useGroup(part: string): Ctx {
  const ctx = useContext(GroupContext)
  if (!ctx) throw new Error(`ToggleGroup.${part} must be inside ToggleGroup.Root`)
  return ctx
}

export interface ToggleGroupState {
  readonly value: readonly string[]
  readonly disabled: boolean
}

export type ToggleGroupRootProps = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue"
> & {
  readonly children?: ReactNode
  readonly value?: readonly string[]
  readonly defaultValue?: readonly string[]
  readonly onValueChange?: (
    value: readonly string[],
    details: ChangeDetails<ToggleGroupEvent>,
  ) => void
  /** Default `single`: pressing an item replaces the selection. */
  readonly selectionMode?: "single" | "multiple"
  /** The last pressed item cannot be released. */
  readonly disallowEmptySelection?: boolean
  readonly orientation?: "horizontal" | "vertical"
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean
  readonly disabled?: boolean
  readonly focusableWhenDisabled?: boolean
  readonly render?: RenderProp<ToggleGroupState>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  selectionMode = "single",
  disallowEmptySelection = false,
  orientation = "horizontal",
  loop = true,
  disabled = false,
  focusableWhenDisabled: ownFocusable,
  render,
  id,
  ref,
  children,
  ...rest
}: ToggleGroupRootProps) {
  const env = useEnvironment()
  // Hosted by a Toolbar: its disabled state applies, its focusableWhenDisabled unless ours.
  const host = useCompositeHost()
  const focusableWhenDisabled = ownFocusable ?? host?.focusableWhenDisabled ?? false
  const instance = useRootId(id)
  const ids = useMemo(() => toggleGroupIds(instance), [instance])
  const fieldsetDisabled = useFieldsetDisabled()
  const groupDisabled = disabled || fieldsetDisabled || host?.disabled === true
  const { collection: registered, registry } = useCollectionItems()
  const collection = registered ?? EMPTY
  const { view, send } = useMachine(toggleGroupMachine, {
    collection,
    strategy: "roving",
    ids,
    loop,
    selectionMode,
    disallowEmptySelection,
    focusableWhenDisabled,
    value,
    defaultValue,
    onValueChange,
    disabled: groupDisabled,
  })
  const current = view.values.value ?? []
  const api = toggleGroupConnect(
    {
      instance,
      collection,
      value: current,
      highlightedKey: view.context.highlightedKey,
      pending: registered === null,
      pendingStop: serverStop(declaredItems(children, Item), current),
      orientation,
      selectionMode,
      disabled: groupDisabled,
      focusableWhenDisabled,
      focusWithin: view.matches("focused"),
      hosted: host !== null,
    },
    send,
    env,
  )
  const el = useRef<HTMLElement | null>(null)
  // Development: a group needs a name (aria-label or aria-labelledby: radix#754).
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node) return
    if (!node.getAttribute("aria-label") && !node.getAttribute("aria-labelledby")) {
      console.warn(
        `[rind-ui] toggle-group: the root #${node.id} has no accessible name; pass aria-label or aria-labelledby`,
      )
    }
  })
  const ctx: Ctx = {
    api,
    send,
    registry,
    value: current,
    disabled: groupDisabled,
    focusableWhenDisabled,
  }
  const props = mergeProps({ ...normalizeProps(api.root()), ref: composeRefs(el, ref) }, rest)
  return (
    <GroupContext value={ctx}>
      {renderPart("div", { ...props, children }, render, {
        value: current,
        disabled: groupDisabled,
      })}
    </GroupContext>
  )
}

export interface ToggleGroupItemState {
  readonly pressed: boolean
  readonly disabled: boolean
}

/** An item of a group (its `value` is its key in the group's value). */
type GroupItemProps = Omit<ComponentPropsWithRef<"button">, "value"> & {
  /** The item's key in the group's value. */
  readonly value: string
  readonly disabled?: boolean
  readonly textValue?: string
  readonly render?: RenderProp<ToggleGroupItemState>
}

/**
 * A toggle: inside `ToggleGroup.Root` an item of the group (`value` is its key); alone, a
 * single toggle button with its own `pressed` state (no group wrapper, no roving).
 */
export type ToggleGroupItemProps =
  | GroupItemProps
  | (ToggleRootProps & { readonly value?: undefined; readonly textValue?: undefined })

/** The pressed state and indicator props an item gives its indicator. */
const ItemContext = createContext<{ state: ToggleGroupItemState; indicator: object } | null>(null)

function Item(props: ToggleGroupItemProps) {
  const ctx = useContext(GroupContext)
  if (!ctx) return <Toggle.Root {...(props as ToggleRootProps)} />
  if (props.value === undefined) {
    throw new Error("ToggleGroup.Item needs a `value` inside ToggleGroup.Root")
  }
  return <GroupItem {...(props as GroupItemProps)} />
}

function GroupItem({ value, disabled = false, textValue, render, ref, ...rest }: GroupItemProps) {
  const ctx = useGroup("Item")
  const env = useEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const key: CollectionKey = toKey(value)
  const el = useRef<HTMLElement | null>(null)
  useRegisterItem(ctx.registry, { key: value, textValue, disabled }, el)
  // Hosted: the item is also one of the host's controls (navigation and tab stop).
  const host = useCompositeHost()
  const hostKey = ctx.api.item(key, NO_STATE)["id"] as string // set by the connect
  const itemDisabled = ctx.disabled || disabled
  useHostItem(
    host,
    { id: hostKey, skip: itemDisabled && !ctx.focusableWhenDisabled, textValue },
    el,
  )
  const hostProps = host
    ? normalizeProps(
        host.itemProps({ id: hostKey, disabled: itemDisabled, first: host.claimFirst(hostKey) }),
      )
    : {}
  const tag = useRenderedTag("button", render, el)
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const isDisabled = () => ctx.disabled || disabled
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "PRESS", key, modality: e.modality })
    },
    disabled: isDisabled,
  })
  const hover = useHover({ env, send: () => {}, disabled: isDisabled })
  const own = normalizeProps(
    ctx.api.item(key, {
      tag,
      itemDisabled: disabled,
      focused,
      modality,
      pressed: press.pressed,
      hovered: hover.hovered,
    }),
  )
  const props = mergeProps(
    {
      ...joinHandlers(own, hostProps, press.props, hover.props, {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  const state = { pressed: ctx.value.includes(key), disabled: isDisabled() }
  return (
    <ItemContext
      value={{
        state,
        indicator: normalizeProps(ctx.api.itemIndicator(key, { itemDisabled: disabled })),
      }}
    >
      {renderPart("button", props, render, state)}
    </ItemContext>
  )
}

export type ToggleGroupItemIndicatorProps = ToggleIndicatorProps

/** Decorative: its children while the item is pressed, `fallback` otherwise. */
function ItemIndicator(props: ToggleGroupItemIndicatorProps) {
  const item = useContext(ItemContext)
  // A lone item is a single toggle: its own indicator.
  if (!item) return <Toggle.Indicator {...props} />
  const { fallback, render, children, ...rest } = props
  const own = mergeProps(item.indicator as Record<string, unknown>, rest)
  return renderPart(
    "span",
    { ...own, children: item.state.pressed ? children : fallback },
    render,
    item.state,
  )
}

export const ToggleGroup = { Root, Item, ItemIndicator }
