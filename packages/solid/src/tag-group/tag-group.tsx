/** @jsxImportSource solid-js */
// Tag Group: the Root hosting the parts (design §4). Wiring only: the machine owns highlight,
// selection, activation and removal; connect owns every attribute. Tags come from `items`
// data or from static Tag parts (collections registration); both render the same DOM.
import {
  announcerCapability,
  type Collection,
  type CollectionKey,
  checkTagGroupList,
  createListCollection,
  layoutCapability,
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
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  useContext,
} from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useCollectionItems, useRegisterItem } from "../use-collection-items"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare const process: { env: { NODE_ENV?: string } }

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

type Common = Omit<JSX.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange" | "children"> & {
  readonly children?: JSX.Element
  readonly disabled?: boolean | undefined
  /** Disabled tags stay reachable (announced as dimmed). Default true. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Arrow keys wrap around. Default true. */
  readonly loop?: boolean | undefined
  /** How long typed characters build one typeahead search (ms). Default: 1000. */
  readonly typeaheadTimeout?: number | undefined
  /** Data tags. Without them (and without `collection`), Tag parts register themselves. */
  readonly items?: readonly TagGroupItemData[] | undefined
  /** A collection built by the consumer, used instead of `items`. */
  readonly collection?: Collection<unknown> | undefined
  /** Tags are removable: drop the keys from your data, or keep them (nothing happens). */
  readonly onRemove?:
    | ((keys: readonly string[], details: TagGroupRemoveDetails) => void)
    | undefined
  readonly onAction?: ((key: string, details: TagGroupActionDetails) => void) | undefined
  readonly messages?: Partial<TagGroupMessages> | undefined
  /** Another element: a function receiving the props to spread. */
  readonly render?: RenderProp<undefined> | undefined
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
  readonly parts: Accessor<TagGroupParts>
  readonly collection: Accessor<Collection<unknown>>
  readonly registry: ReturnType<typeof useCollectionItems>["registry"] | null
  readonly mount: (part: "label" | "description", on: boolean) => void
  readonly mountLink: (key: CollectionKey, on: boolean) => void
  readonly hover: (key: CollectionKey | null) => void
  readonly press: (key: CollectionKey | null) => void
  readonly hrefOf: (key: CollectionKey) => string | undefined
  readonly removable: Accessor<boolean>
}

const HostContext = createContext<Host>()
const useHost = (part: string): Host => {
  const host = useContext(HostContext)
  if (!host) throw new Error(`TagGroup.${part} must be inside TagGroup.Root`)
  return host
}
const TagContext = createContext<{
  readonly key: Accessor<CollectionKey>
  readonly href: Accessor<string | undefined>
  readonly row: Accessor<HTMLElement | null>
}>()
const ListContext = createContext(false)

type Own<A> = A & {
  /** Another element: a function receiving the props to spread. */
  readonly render?: RenderProp<undefined> | undefined
}

function Root(all: TagGroupRootProps) {
  const [own, rest] = splitProps(
    all as Record<string, unknown> & TagGroupRootProps,
    [
      "id",
      "items",
      "collection",
      "children",
      "disabled",
      "focusableWhenDisabled",
      "loop",
      "typeaheadTimeout",
      "onRemove",
      "onAction",
      "messages",
      "render",
      // The selection props are the machine's, never the element's.
      "selectionMode",
      "value",
      "defaultValue",
      "onValueChange",
      "disallowEmptySelection",
    ] as never[],
  ) as unknown as [
    Common & {
      selectionMode?: "single" | "multiple" | "none"
      value?: TagGroupValue
      defaultValue?: TagGroupValue
      onValueChange?: (v: unknown, d: unknown) => void
      disallowEmptySelection?: boolean
      id?: string
    },
    Record<string, unknown>,
  ]
  const env = useEnvironment(announcerCapability, layoutCapability)
  const instance = useRootId(() => own.id)
  const { collection: registered, registry } = useCollectionItems()
  const data = createMemo(() => (own.items ? fromData(own.items) : null))
  const collection = createMemo(() => own.collection ?? data() ?? registered() ?? EMPTY)
  const ids = createMemo(() => tagGroupIds(instance()))
  const selectionMode = () => own.selectionMode ?? "none"
  const [staticLinks, setStaticLinks] = createSignal<ReadonlyMap<CollectionKey, true>>(new Map())
  const links = createMemo(() => {
    const out = new Set<CollectionKey>(staticLinks().keys())
    for (const i of own.items ?? []) if (i.href !== undefined) out.add(toKey(i.key))
    return out
  })
  const typeaheadTimeout = () => own.typeaheadTimeout
  const { view, send, service } = useMachine(
    tagGroupMachine,
    () => ({
      collection: collection(),
      ids: ids(),
      instance: instance(),
      strategy: "roving" as const,
      selectionMode: selectionMode(),
      selectionBehavior: "toggle" as const,
      disallowEmptySelection: own.disallowEmptySelection,
      disabled: own.disabled === true,
      focusableWhenDisabled: own.focusableWhenDisabled ?? true,
      loop: own.loop ?? true,
      typeaheadTimeout: typeaheadTimeout(),
      links: links(),
      messages: own.messages,
      ...("value" in all ? { value: own.value as TagGroupValue } : {}),
      defaultValue:
        (own.defaultValue as TagGroupValue | undefined) ??
        (selectionMode() === "multiple" ? [] : null),
      onValueChange: (v: TagGroupValue, details: { event: unknown }) => {
        const e = details.event as { type: string; key?: string }
        own.onValueChange?.(v, { reason: e.type, key: e.key })
      },
      onRemove: own.onRemove
        ? (keys: readonly string[], d: TagGroupRemoveDetails) => own.onRemove?.(keys, d)
        : undefined,
      onAction: own.onAction
        ? (key: string, d: TagGroupActionDetails) => own.onAction?.(key, d)
        : undefined,
    }),
    env,
  )
  const [mounted, setMounted] = createSignal({ label: false, description: false })
  const mount = (part: "label" | "description", on: boolean) =>
    setMounted((m) => (m[part] === on ? m : { ...m, [part]: on }))
  const mountLink = (key: CollectionKey, on: boolean) =>
    setStaticLinks((m) => {
      if (m.has(key) === on) return m
      const next = new Map(m)
      if (on) next.set(key, true)
      else next.delete(key)
      return next
    })
  const [hovered, setHovered] = createSignal<CollectionKey | null>(null)
  const [pressed, setPressed] = createSignal<CollectionKey | null>(null)
  const focused = () => view().matches("focused")
  // The hint follows the last interaction anywhere (a virtual cursor arrives from outside).
  const modality = useModality(env.modality, () => true)
  const parts = createMemo(() =>
    tagGroupConnect(
      {
        instance: instance(),
        collection: collection(),
        context: view().context,
        selection: tagSelectionOf(view().values.value as TagGroupValue),
        selectionMode: selectionMode(),
        removable: own.onRemove !== undefined,
        actions: own.onAction !== undefined,
        links: links(),
        disabled: own.disabled === true,
        focusableWhenDisabled: own.focusableWhenDisabled ?? true,
        pending: !own.collection && !data() && registered() === null,
        focused: focused(),
        modality: modality(),
        // platform-convention: touch screen readers reach the remove button; no Delete hint there
        touchDevice: env.platform.ios || env.platform.android,
        hoveredKey: hovered(),
        pressedKey: pressed(),
        typingAhead: () => {
          const t = service.getSnapshot().context.typeahead
          return t.buffer !== "" && env.clock.now() - t.at <= (typeaheadTimeout() ?? 1000)
        },
        mounted: mounted(),
        messages: own.messages,
        send: service.send,
      },
      env,
    ),
  )
  const hrefs = createMemo(
    () =>
      new Map((own.items ?? []).flatMap((i) => (i.href ? [[toKey(i.key), i.href] as const] : []))),
  )
  const host: Host = {
    parts,
    collection,
    registry: own.collection || own.items ? null : registry,
    mount,
    mountLink,
    hover: setHovered,
    press: setPressed,
    hrefOf: (key) => hrefs().get(key),
    removable: () => own.onRemove !== undefined,
  }
  void send
  const merged = createMemo(() => mergeProps(normalizeProps(parts().root()), rest))
  const children = () => (
    <>
      {own.children}
      <Show when={parts().hinted}>
        <span {...normalizeProps(parts().hint())}>{parts().hintText}</span>
      </Show>
    </>
  )
  return (
    <HostContext.Provider value={host}>
      {renderPart(own.render, merged, undefined, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </HostContext.Provider>
  )
}

export type TagGroupSpanProps = Own<Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children">> & {
  readonly children?: JSX.Element
}

function Label(props: TagGroupSpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Label")
  createEffect(() => {
    host.mount("label", true)
    onCleanup(() => host.mount("label", false))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.parts().label()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function Description(props: TagGroupSpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Description")
  createEffect(() => {
    host.mount("description", true)
    onCleanup(() => host.mount("description", false))
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.parts().description()), rest))
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type TagGroupDivProps = Own<Omit<JSX.HTMLAttributes<HTMLDivElement>, "children">> & {
  readonly children?: JSX.Element
}

function List(props: TagGroupDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("List")
  const [el, setEl] = createSignal<HTMLElement | null>(null)
  // After the re-render a Label's registration causes, not on the first commit.
  afterMount(() => {
    createEffect(() => {
      const node = el()
      const interactive = host.parts().interactive
      queueMicrotask(() => {
        if (node?.isConnected) checkTagGroupList(node, interactive)
      })
    })
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(
          host.parts().list({
            "aria-label": rest["aria-label"],
            "aria-labelledby": rest["aria-labelledby"],
          }),
        ),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => <ListContext.Provider value={true}>{local.children}</ListContext.Provider>
  return renderPart(local.render, merged, undefined, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

export type TagGroupTagProps = TagGroupDivProps & {
  /** The tag key. */
  readonly value: string
  /** The tag's text for typeahead and the remove button's name. */
  readonly textValue?: string | undefined
  /** Disables this tag: it cannot be selected or removed. */
  readonly disabled?: boolean | undefined
  /** A link tag: TagText renders an anchor to it. */
  readonly href?: string | undefined
}

function Tag(props: TagGroupTagProps) {
  const [local, rest] = splitProps(props, [
    "value",
    "textValue",
    "disabled",
    "href",
    "render",
    "children",
  ])
  const host = useHost("Tag")
  const key = createMemo(() => toKey(local.value))
  const [row, setRow] = createSignal<HTMLElement | null>(null)
  useRegisterItem(
    host.registry,
    () => ({ key: local.value, textValue: local.textValue, disabled: local.disabled }),
    row,
  )
  createEffect(() => {
    if (local.href === undefined) return
    const k = key()
    host.mountLink(k, true)
    onCleanup(() => host.mountLink(k, false))
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(
          host.parts().item(key(), {
            "aria-label": rest["aria-label"],
            "aria-labelledby": rest["aria-labelledby"],
          }),
        ),
        ref: setRow,
        // Hover for mouse and pen only.
        onPointerEnter: (e: PointerEvent) => {
          if (e.pointerType !== "touch") host.hover(key())
        },
        onPointerLeave: () => host.hover(null),
        onPointerDown: () => host.press(key()),
        onPointerUp: () => host.press(null),
        onPointerCancel: () => host.press(null),
      },
      rest,
    ),
  )
  const children = () => <div {...normalizeProps(host.parts().itemCell())}>{local.children}</div>
  return (
    <TagContext.Provider value={{ key, href: () => local.href ?? host.hrefOf(key()), row }}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </TagContext.Provider>
  )
}

function TagText(props: TagGroupSpanProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("TagText")
  const tag = useContext(TagContext)
  if (!tag) throw new Error("TagGroup.TagText must be inside TagGroup.Tag")
  const own = createMemo(() => normalizeProps(host.parts().itemText(tag.key())))
  const merged = createMemo(() =>
    mergeProps(tag.href() !== undefined ? { ...own(), href: tag.href() } : own(), rest),
  )
  const children = () => local.children
  return renderPart(local.render, merged, undefined, children, (p) => (
    <Show when={tag.href() !== undefined} fallback={<span {...p}>{children()}</span>}>
      <a {...p}>{children()}</a>
    </Show>
  ))
}

export type TagGroupRemoveProps = Own<
  Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "children">
> & {
  readonly children?: JSX.Element
}

function TagRemove(props: TagGroupRemoveProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("TagRemove")
  const tag = useContext(TagContext)
  if (!tag) {
    afterMount(() => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[rind-ui] TagGroup: TagRemove is outside a Tag; it renders nothing.")
      }
    })
    return null
  }
  const merged = createMemo(() => {
    const own = host.parts().itemRemove(tag.key())
    return mergeProps(
      {
        ...normalizeProps(own),
        // The press focuses the tag (connect prevents the button's own focus).
        onPointerDown: (e: PointerEvent) => {
          ;(own["onPointerDown"] as ((e: unknown) => void) | undefined)?.(e)
          if (!e.defaultPrevented || (own["disabled"] as boolean | undefined)) return
          tag.row()?.focus({ preventScroll: true })
        },
      },
      rest,
    )
  })
  const children = () => local.children ?? <CrossIcon />
  return (
    <Show when={host.removable()}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <button {...p}>{children()}</button>
      ))}
    </Show>
  )
}

/** The default remove icon: an SVG, so it adds no text to the tag's text value. */
const CrossIcon = () => (
  <svg aria-hidden="true" {...{ focusable: "false" }} viewBox="0 0 16 16" width="1em" height="1em">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
)

function Empty(props: TagGroupDivProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const host = useHost("Empty")
  const inList = useContext(ListContext)
  afterMount(() => {
    if (process.env.NODE_ENV !== "production" && !inList) {
      console.warn("[rind-ui] TagGroup: Empty is outside List; render it inside TagGroup.List.")
    }
  })
  const merged = createMemo(() => mergeProps(normalizeProps(host.parts().empty()), rest))
  const children = () => local.children
  return (
    <Show when={host.parts().isEmpty}>
      {renderPart(local.render, merged, undefined, children, (p) => (
        <div {...p}>{children()}</div>
      ))}
    </Show>
  )
}

export interface TagGroupTagsProps {
  /** Renders one tag's content from its label and key; default: TagText and TagRemove. */
  readonly children?: (label: string, key: string) => JSX.Element
}

/** Data mode: every tag of `items`, with its text and (removable) its remove button. */
function Tags(props: TagGroupTagsProps) {
  const host = useHost("Tags")
  const nodes = createMemo(() => [...host.collection()].filter((n) => n.type === "item"))
  return (
    <For each={nodes()}>
      {(node) => (
        <Tag value={node.key} textValue={node.textValue} disabled={node.disabled}>
          {props.children ? (
            props.children(node.textValue, node.key)
          ) : (
            <>
              <TagText>{node.textValue}</TagText>
              <TagRemove />
            </>
          )}
        </Tag>
      )}
    </For>
  )
}

/** A collection of tags: browse with one Tab stop; select, act on, follow or remove them. */
/** The parts, by name: `tag-group.parts.ts` re-exports them as the `TagGroup` namespace. */
export { Description, Empty, Label, List, Root, Tag, TagRemove, Tags, TagText }
