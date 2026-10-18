// Tag Group: the Root hosting the parts (design §4). Wiring only: the machine owns highlight,
// selection, activation and removal; connect owns every attribute. Tags come from `items`
// data or from static Tag parts (collections registration); both render the same DOM.

import {
  type Collection,
  type CollectionKey,
  checkTagGroupList,
  createListCollection,
  type TagGroupActionDetails,
  type TagGroupMessages,
  type TagGroupParts,
  type TagGroupRemoveDetails,
  type TagGroupValue,
  tagGroupConnect,
  tagGroupIds,
  tagGroupMachine,
  tagSelectionOf,
  toKey,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import {
  useCollectionIdentityWarning,
  useCollectionItems,
  useRegisterItem,
} from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine, useSelector } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

/** One tag of a data-driven group. */
export interface TagGroupItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  /** A link tag: its text renders as an anchor. */
  readonly href?: string
}

const fromData = (items: readonly TagGroupItemData[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
  })
const EMPTY = fromData([])

export interface TagGroupChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}

type Common = Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange"> & {
  readonly disabled?: boolean
  /** Disabled tags stay reachable (announced as dimmed). Default true. */
  readonly focusableWhenDisabled?: boolean
  /** Arrow keys wrap around. Default true. */
  readonly loop?: boolean
  /** How long typed characters build one typeahead search (ms). Default: 1000. */
  readonly typeaheadTimeout?: number
  /** Data tags. Without them (and without `collection`), Tag parts register themselves. */
  readonly items?: readonly TagGroupItemData[]
  /** A collection built by the consumer, used instead of `items`. */
  readonly collection?: Collection<unknown>
  /** Tags are removable: drop the keys from your data, or keep them (nothing happens). */
  readonly onRemove?: (keys: readonly string[], details: TagGroupRemoveDetails) => void
  readonly onAction?: (key: string, details: TagGroupActionDetails) => void
  readonly messages?: Partial<TagGroupMessages>
  /** Another element or a render function receiving the props. */
  readonly render?: RenderProp<undefined>
}

type Selection =
  | { readonly selectionMode?: "none" }
  | {
      readonly selectionMode: "single"
      readonly value?: string | null
      readonly defaultValue?: string | null
      readonly onValueChange?: (value: string | null, details: TagGroupChangeDetails) => void
      /** No user action leaves the selection empty. */
      readonly disallowEmptySelection?: boolean
    }
  | {
      readonly selectionMode: "multiple"
      readonly value?: readonly string[]
      readonly defaultValue?: readonly string[]
      readonly onValueChange?: (value: readonly string[], details: TagGroupChangeDetails) => void
      /** No user action leaves the selection empty. */
      readonly disallowEmptySelection?: boolean
    }

export type TagGroupRootProps = Common & Selection

interface Host {
  readonly parts: TagGroupParts
  readonly collection: Collection<unknown>
  readonly registry: ReturnType<typeof useCollectionItems>["registry"] | null
  readonly service: ReturnType<typeof useMachine<typeof tagGroupMachine>>["service"]
  readonly mount: (part: "label" | "description", on: boolean) => void
  readonly mountLink: (key: CollectionKey, on: boolean) => void
  readonly hover: (key: CollectionKey | null) => void
  readonly press: (key: CollectionKey | null) => void
  readonly hrefOf: (key: CollectionKey) => string | undefined
  readonly removable: boolean
}

const HostContext = createContext<Host | null>(null)
const useHost = (part: string): Host => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`TagGroup.${part} must be inside TagGroup.Root`)
  return host
}
const TagContext = createContext<{
  readonly key: CollectionKey
  readonly href: string | undefined
  readonly row: { readonly current: HTMLElement | null }
} | null>(null)
const ListContext = createContext(false)

type Own<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props. */
  readonly render?: RenderProp<undefined>
}

function Root(all: TagGroupRootProps) {
  const {
    id,
    items,
    collection: given,
    children,
    disabled = false,
    focusableWhenDisabled = true,
    loop = true,
    typeaheadTimeout,
    onRemove,
    onAction,
    messages,
    render,
    ...own
  } = all
  const p = all as Record<string, unknown>
  // The selection props are the machine's, never the element's.
  const {
    selectionMode: _mode,
    value: _value,
    defaultValue: _default,
    onValueChange: _change,
    disallowEmptySelection: _empty,
    ...rest
  } = own as Record<string, unknown>
  const env = useEnvironment()
  const instance = useRootId(id)
  const { collection: registered, registry } = useCollectionItems()
  const data = useMemo(() => (items ? fromData(items) : null), [items])
  const collection = given ?? data ?? registered ?? EMPTY
  useCollectionIdentityWarning(collection, "TagGroup")
  const ids = useMemo(() => tagGroupIds(instance), [instance])
  const selectionMode = (p["selectionMode"] as "single" | "multiple" | "none" | undefined) ?? "none"
  const [staticLinks, setStaticLinks] = useState<ReadonlyMap<CollectionKey, true>>(new Map())
  const links = useMemo(() => {
    const out = new Set<CollectionKey>(staticLinks.keys())
    for (const i of items ?? []) if (i.href !== undefined) out.add(toKey(i.key))
    return out
  }, [items, staticLinks])
  const latest = useRef({
    onValueChange: p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined,
    onRemove,
    onAction,
  })
  latest.current = {
    onValueChange: p["onValueChange"] as ((v: unknown, d: unknown) => void) | undefined,
    onRemove,
    onAction,
  }
  const { service } = useMachine(tagGroupMachine, {
    collection,
    ids,
    instance,
    strategy: "roving",
    selectionMode,
    selectionBehavior: "toggle",
    disallowEmptySelection: p["disallowEmptySelection"] as boolean | undefined,
    disabled,
    focusableWhenDisabled,
    loop,
    typeaheadTimeout,
    links,
    messages,
    ...("value" in all ? { value: p["value"] as TagGroupValue } : {}),
    defaultValue:
      (p["defaultValue"] as TagGroupValue | undefined) ??
      (selectionMode === "multiple" ? [] : null),
    onValueChange: (v, details) => {
      const e = details.event as { type: string; key?: string }
      latest.current.onValueChange?.(v, { reason: e.type, key: e.key })
    },
    onRemove: onRemove ? (keys, d) => latest.current.onRemove?.(keys, d) : undefined,
    onAction: onAction ? (key, d) => latest.current.onAction?.(key, d) : undefined,
  })
  const view = service.view()
  const [mounted, setMounted] = useState({ label: false, description: false })
  const [mount] = useState(
    () => (part: "label" | "description", on: boolean) =>
      setMounted((m) => (m[part] === on ? m : { ...m, [part]: on })),
  )
  const [mountLink] = useState(
    () => (key: CollectionKey, on: boolean) =>
      setStaticLinks((m) => {
        if (m.has(key) === on) return m
        const next = new Map(m)
        if (on) next.set(key, true)
        else next.delete(key)
        return next
      }),
  )
  const [hovered, setHovered] = useState<CollectionKey | null>(null)
  const [pressed, setPressed] = useState<CollectionKey | null>(null)
  const focused = view.matches("focused")
  // The hint follows the last interaction anywhere (a virtual cursor arrives from outside).
  const modality = useModality(env.modality, true)
  const parts = tagGroupConnect(
    {
      instance,
      collection,
      context: view.context,
      selection: tagSelectionOf(view.values.value as TagGroupValue),
      selectionMode,
      removable: onRemove !== undefined,
      actions: onAction !== undefined,
      links,
      disabled,
      focusableWhenDisabled,
      pending: !given && !data && registered === null,
      focused,
      modality,
      // platform-convention: touch screen readers reach the remove button; no Delete hint there
      touchDevice: env.platform.ios || env.platform.android,
      hoveredKey: hovered,
      pressedKey: pressed,
      typingAhead: () => {
        const t = service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (typeaheadTimeout ?? 1000)
      },
      mounted,
      messages,
      send: service.send,
    },
    env,
  )
  const hrefs = useMemo(
    () => new Map((items ?? []).flatMap((i) => (i.href ? [[toKey(i.key), i.href] as const] : []))),
    [items],
  )
  const host: Host = {
    parts,
    collection,
    registry: given || data ? null : registry,
    service,
    mount,
    mountLink,
    hover: setHovered,
    press: setPressed,
    hrefOf: (key) => hrefs.get(key),
    removable: onRemove !== undefined,
  }
  const props = mergeProps(normalizeProps(parts.root()), rest)
  return (
    <HostContext value={host}>
      {renderPart(
        "div",
        {
          ...props,
          children: (
            <>
              {children}
              {parts.hinted ? (
                <span {...normalizeProps(parts.hint())}>{parts.hintText}</span>
              ) : null}
            </>
          ),
        },
        render,
        undefined,
      )}
    </HostContext>
  )
}

function Label({ render, ...rest }: Own<"span">) {
  const host = useHost("Label")
  const { mount } = host
  useIsoLayoutEffect(() => {
    mount("label", true)
    return () => mount("label", false)
  }, [mount])
  return renderPart("span", mergeProps(normalizeProps(host.parts.label()), rest), render, undefined)
}

function Description({ render, ...rest }: Own<"span">) {
  const host = useHost("Description")
  const { mount } = host
  useIsoLayoutEffect(() => {
    mount("description", true)
    return () => mount("description", false)
  }, [mount])
  return renderPart(
    "span",
    mergeProps(normalizeProps(host.parts.description()), rest),
    render,
    undefined,
  )
}

function List({ render, children, ...rest }: Own<"div">) {
  const host = useHost("List")
  useSelector(host.service, (v) => v)
  const el = useRef<HTMLDivElement | null>(null)
  const interactive = host.parts.interactive
  // After the re-render a Label's registration causes (a layout effect), not on the first commit.
  useEffect(() => {
    const node = el.current
    queueMicrotask(() => {
      if (node?.isConnected) checkTagGroupList(node, interactive)
    })
  }, [interactive])
  const naming = { "aria-label": rest["aria-label"], "aria-labelledby": rest["aria-labelledby"] }
  const props = mergeProps({ ...normalizeProps(host.parts.list(naming)), ref: el }, rest)
  return renderPart(
    "div",
    { ...props, children: <ListContext value={true}>{children}</ListContext> },
    render,
    undefined,
  )
}

function Tag({
  value,
  textValue,
  disabled,
  href,
  render,
  children,
  ...rest
}: Own<"div"> & {
  /** The tag key. */
  readonly value: string
  /** The tag's text for typeahead and the remove button's name. */
  readonly textValue?: string | undefined
  /** Disables this tag: it cannot be selected or removed. */
  readonly disabled?: boolean | undefined
  /** A link tag: TagText renders an anchor to it. */
  readonly href?: string | undefined
}) {
  const host = useHost("Tag")
  const key = toKey(value)
  const ref = useRef<HTMLDivElement | null>(null)
  useRegisterItem(host.registry, { key: value, textValue, disabled }, ref)
  const { mountLink } = host
  useIsoLayoutEffect(() => {
    if (href === undefined) return
    mountLink(key, true)
    return () => mountLink(key, false)
  }, [mountLink, key, href])
  useSelector(host.service, (v) => v)
  const naming = { "aria-label": rest["aria-label"], "aria-labelledby": rest["aria-labelledby"] }
  const own = host.parts.item(key, naming)
  const { hover, press } = host
  const props = mergeProps(
    {
      ...normalizeProps(own),
      ref,
      // Hover for mouse and pen only.
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType !== "touch") hover(key)
      },
      onPointerLeave: () => hover(null),
      onPointerDown: () => press(key),
      onPointerUp: () => press(null),
      onPointerCancel: () => press(null),
    },
    rest,
  )
  const cell = <div {...normalizeProps(host.parts.itemCell())}>{children}</div>
  return (
    <TagContext value={{ key, href: href ?? host.hrefOf(key), row: ref }}>
      {renderPart("div", { ...props, children: cell }, render, undefined)}
    </TagContext>
  )
}

function TagText({ render, ...rest }: Own<"span">) {
  const host = useHost("TagText")
  const tag = useContext(TagContext)
  if (!tag) throw new Error("TagGroup.TagText must be inside TagGroup.Tag")
  const own = normalizeProps(host.parts.itemText(tag.key))
  if (tag.href !== undefined) {
    return renderPart("a", mergeProps({ ...own, href: tag.href }, rest), render, undefined)
  }
  return renderPart("span", mergeProps(own, rest), render, undefined)
}

function TagRemove({ render, children, ...rest }: Own<"button">) {
  const host = useHost("TagRemove")
  const tag = useContext(TagContext)
  if (!tag) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[rind-ui] TagGroup: TagRemove is outside a Tag; it renders nothing.")
    }
    return null
  }
  if (!host.removable) return null
  const own = host.parts.itemRemove(tag.key)
  const row = tag.row
  const props = mergeProps(
    {
      ...normalizeProps(own),
      // The press focuses the tag (connect prevents the button's own focus).
      onPointerDown: (e: React.PointerEvent) => {
        ;(own["onPointerDown"] as ((e: unknown) => void) | undefined)?.(e)
        if (!e.defaultPrevented || (own["disabled"] as boolean | undefined)) return
        row.current?.focus({ preventScroll: true })
      },
    },
    rest,
  )
  return renderPart("button", { ...props, children: children ?? <CrossIcon /> }, render, undefined)
}

/** The default remove icon: an SVG, so it adds no text to the tag's text value. */
const CrossIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="1em" height="1em">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

function Empty({ render, ...rest }: Own<"div">) {
  const host = useHost("Empty")
  const inList = useContext(ListContext)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && !inList) {
      console.warn("[rind-ui] TagGroup: Empty is outside List; render it inside TagGroup.List.")
    }
  }, [inList])
  if (!host.parts.isEmpty) return null
  return renderPart("div", mergeProps(normalizeProps(host.parts.empty()), rest), render, undefined)
}

/** Data mode: every tag of `items`, with its text and (removable) its remove button. */
function Tags({
  children,
}: {
  /** Renders one tag's content from its label and key; default: TagText and TagRemove. */
  readonly children?: (label: string, key: string) => ReactNode
}) {
  const host = useHost("Tags")
  const out: ReactNode[] = []
  for (const node of host.collection) {
    if (node.type !== "item") continue
    out.push(
      <Tag key={node.key} value={node.key} textValue={node.textValue} disabled={node.disabled}>
        {children ? (
          children(node.textValue, node.key)
        ) : (
          <>
            <TagText>{node.textValue}</TagText>
            <TagRemove />
          </>
        )}
      </Tag>,
    )
  }
  return out
}

/** A collection of tags: browse with one Tab stop; select, act on, follow or remove them. */
export const TagGroup = {
  Root,
  Label,
  Description,
  List,
  Tag,
  TagText,
  TagRemove,
  Empty,
  Tags,
}
