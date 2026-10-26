// JSON Tree View (add-json-tree-view): a Tree View over `jsonTreeCollection`, rebuilt when the
// value or the expansion changes (only expanded containers have children), plus the JSON text
// parts inside each item and copy (Mod+C on the tree, or the CopyTrigger).

import {
  announcerCapability,
  type ClipboardMessages,
  type CollectionKey,
  clipboardCapability,
  clipboardMessages,
  type JsonNode,
  type JsonTreeViewMessages,
  jsonCopyText,
  jsonExpandedKeys,
  jsonItemConnect,
  jsonTreeCollection,
  jsonTreeViewMessages,
  type MessageOverrides,
  type PartProps,
  toKey,
} from "@rind-ui/core"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import {
  ItemIndicator,
  ItemText,
  Tree,
  Item as TreeItem,
  Root as TreeRoot,
  type TreeViewExpandedDetails,
} from "../tree-view/tree-view"
import { useRootId } from "../use-ids"

declare module "../provider" {
  interface RindMessageScopes {
    "json-tree-view": JsonTreeViewMessages
  }
}

export type JsonCopyFormat = "json" | "value" | "pointer"
export type JsonCopyState = "idle" | "copying" | "copied" | "error"

/** What the Root's default slot receives. */
export interface JsonTreeViewApi {
  readonly copyState: JsonCopyState
  /**
   * Expands every container down to `depth` levels (default: one deeper than the deepest open
   * one), stopping before 5000 rows would be visible.
   */
  readonly expandAll: (options?: { readonly depth?: number | undefined }) => void
  /** Copies the highlighted item in `copyFormat` through the clipboard. */
  readonly copy: () => void
}

interface Ctx {
  readonly instance: () => string
  readonly node: (key: CollectionKey) => JsonNode | undefined
  readonly expanded: () => ReadonlySet<string>
  readonly messages: () => JsonTreeViewMessages
  readonly clipboardMessages: () => ClipboardMessages
  readonly maxPreviewItems: () => number | undefined
  readonly api: JsonTreeViewApi
  readonly copyFrom: (near: Element) => void
}
const JsonKey: InjectionKey<Ctx> = Symbol("rind-ui.json-tree-view")
function useJson(part: string): Ctx {
  const ctx = inject(JsonKey, null)
  if (!ctx) throw new Error(`JsonTreeView.${part} must be inside JsonTreeView.Root`)
  return ctx
}
/** The key of the enclosing `JsonTreeView.Item`. */
const ItemKeyKey: InjectionKey<() => CollectionKey> = Symbol("rind-ui.json-tree-view-item")
function useNode(part: string) {
  const ctx = useJson(part)
  const key = inject(ItemKeyKey, null)
  if (!key) throw new Error(`JsonTreeView.${part} must be inside JsonTreeView.Item`)
  return { ctx, node: () => ctx.node(key()) }
}

const MAX_EXPAND = 5000
/** Attributes for the wrapper element; the rest are Tree View props. */
const OWN_ATTR = /^(class|style|aria-.*|data-.*)$/

const Root = defineComponent({
  name: "JsonTreeViewRoot",
  inheritAttrs: false,
  props: {
    /** The value to show. */
    data: { type: null as unknown as PropType<unknown>, required: true },
    /** Levels open on the first value; a new `data` keeps the user's expansion. Default 1. */
    defaultExpandedDepth: Number,
    /** More children than this are grouped in ranges. Default 100. */
    groupSize: Number,
    /** Keys previewed after a collapsed container. Default 3. */
    maxPreviewItems: Number,
    /** What a copy writes: the subtree as JSON (default), a leaf's raw value, or the pointer. */
    copyFormat: { type: String as PropType<JsonCopyFormat>, default: "json" },
    /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
    copyFeedbackDuration: { type: Number, default: 2000 },
    /** The expanded containers' keys, controlled (`v-model:expandedValue`). */
    expandedValue: Array as PropType<readonly string[]>,
    /** The expanded containers' keys, uncontrolled (instead of `defaultExpandedDepth`). */
    defaultExpandedValue: Array as PropType<readonly string[]>,
    /** Single, multiple or none (default: none). */
    selectionMode: { type: String as PropType<"single" | "multiple" | "none">, default: "none" },
    messages: Object as PropType<MessageOverrides<JsonTreeViewMessages>>,
    /** Default: the provider's locale (the copy announcements' language). */
    locale: String,
    id: String,
  },
  emits: {
    expandedChange: (_keys: readonly string[], _details: TreeViewExpandedDetails) => true,
    "update:expandedValue": (_keys: readonly string[]) => true,
  },
  slots: Object as SlotsType<{ default?: (api: JsonTreeViewApi) => VNodeChild }>,
  setup(props, { attrs, slots, emit }) {
    const instance = useRootId(() => props.id)
    const env = useEnvironment(announcerCapability, clipboardCapability)
    const locale = useLocale(() => props.locale)
    const messages = useMessages("json-tree-view", jsonTreeViewMessages, () => props.messages)
    const copyMessages = useMessages("clipboard", clipboardMessages, () => undefined)
    // The first value's expansion only: later values keep the user's by key.
    const inner = shallowRef<readonly string[]>(
      props.defaultExpandedValue ??
        jsonExpandedKeys(props.data, props.defaultExpandedDepth ?? 1, {
          groupSize: props.groupSize,
          max: MAX_EXPAND,
        }),
    )
    const expandedKeys = () => props.expandedValue ?? inner.value
    const expanded = computed<ReadonlySet<string>>(() => new Set(expandedKeys()))
    const collection = computed(() =>
      jsonTreeCollection(props.data, { expanded: expanded.value, groupSize: props.groupSize }),
    )
    const setExpanded = (keys: readonly string[], details: TreeViewExpandedDetails) => {
      // The same keys again (a re-sync after a new collection): nothing changed.
      const now = expanded.value
      if (keys.length === now.size && keys.every((k) => now.has(k))) return
      inner.value = keys
      emit("expandedChange", keys, details)
      emit("update:expandedValue", keys)
    }
    const node = (key: CollectionKey) => collection.value.get(key)?.value as JsonNode | undefined

    const copyState = shallowRef<JsonCopyState>("idle")
    let timer: ReturnType<typeof env.scheduler.setTimeout> | undefined
    onBeforeUnmount(() => {
      if (timer !== undefined) env.scheduler.clearTimeout(timer)
    })
    const settle = (ok: boolean) => {
      copyState.value = ok ? "copied" : "error"
      env.announcer.announce({
        message: ok ? copyMessages.value.copied : copyMessages.value.copyFailed,
        priority: "polite",
        key: `json-tree-view-${instance()}`,
        lang: locale.value.locale,
      })
      if (timer !== undefined) env.scheduler.clearTimeout(timer)
      timer = env.scheduler.setTimeout(() => {
        timer = undefined
        copyState.value = "idle"
      }, props.copyFeedbackDuration)
    }
    const rootEl = shallowRef<HTMLElement | null>(null)
    /** The focused item, else the highlighted one (the tree's Tab stop). */
    const current = (): JsonNode | undefined => {
      const root = rootEl.value
      const active = root?.ownerDocument.activeElement
      const item =
        (active?.closest('[role="treeitem"][data-key]') as HTMLElement | null) ??
        root?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"][data-key]') ??
        null
      const key = item?.getAttribute("data-key")
      return key == null ? undefined : node(toKey(key))
    }
    const textOf = (n: JsonNode | undefined) => {
      if (!n) throw new Error("[rind-ui] json-tree-view: no item to copy")
      return jsonCopyText(n, props.copyFormat)
    }
    /** Through the Clipboard capability (the CopyTrigger, or a copy event without clipboardData). */
    const copyFrom = (near: Element) => {
      if (copyState.value === "copying") return
      let text: string
      try {
        text = textOf(current())
      } catch {
        settle(false)
        return
      }
      copyState.value = "copying"
      env.clipboard.writeText(text, { near }).then(
        () => settle(true),
        () => settle(false),
      )
    }
    // Mod+C on the tree: the native copy event's clipboardData (synchronous, no permission).
    const onCopy = (e: ClipboardEvent) => {
      const target = e.target as Element | null
      if (!target?.closest('[role="tree"]')) return
      // A text selection is the user's: the browser copies it.
      const root = rootEl.value
      const selection = root?.ownerDocument.getSelection()
      if (selection && !selection.isCollapsed && root?.contains(selection.anchorNode)) return
      e.preventDefault()
      if (!e.clipboardData) {
        copyFrom(target)
        return
      }
      try {
        e.clipboardData.setData("text/plain", textOf(current()))
        settle(true)
      } catch {
        settle(false)
      }
    }
    const api: JsonTreeViewApi = {
      get copyState() {
        return copyState.value
      },
      expandAll: (options) => {
        // One deeper than the deepest open container (levels are 0-based in the collection).
        let deepest = -1
        for (const key of expandedKeys()) {
          const level = collection.value.get(toKey(key))?.level
          if (level !== undefined && level > deepest) deepest = level
        }
        const depth = options?.depth ?? deepest + 2
        const keys = jsonExpandedKeys(props.data, depth, {
          groupSize: props.groupSize,
          max: MAX_EXPAND,
        })
        setExpanded([...new Set([...expandedKeys(), ...keys])], { reason: "all" })
      },
      copy: () => {
        if (rootEl.value) copyFrom(rootEl.value)
      },
    }
    provide(JsonKey, {
      instance,
      node,
      expanded: () => expanded.value,
      messages: () => messages.value,
      clipboardMessages: () => copyMessages.value,
      maxPreviewItems: () => props.maxPreviewItems,
      api,
      copyFrom,
    })
    return () => {
      const own: Record<string, unknown> = {}
      const tree: Record<string, unknown> = {}
      for (const [name, value] of Object.entries(attrs)) {
        ;(OWN_ATTR.test(name) ? own : tree)[name] = value
      }
      const { "aria-label": label, "aria-labelledby": labelledBy, ...wrapper } = own
      const content = slots.default
        ? slots.default(api)
        : h(
            Tree,
            { "aria-label": label, "aria-labelledby": labelledBy },
            {
              default: (n: { key: string }) =>
                h(Item, { value: n.key }, () => [
                  h(ItemIndicator),
                  h(ItemText, null, () => h(Content)),
                ]),
            },
          )
      return h(
        "div",
        {
          ...wrapper,
          "data-scope": "tree-view",
          "data-part": "root",
          "data-instance": instance(),
          "data-json-tree-view": "",
          "data-copy-state": copyState.value,
          ref: rootEl,
          onCopy,
        },
        h(
          TreeRoot,
          {
            ...tree,
            selectionMode: props.selectionMode,
            id: instance(),
            collection: collection.value,
            expandedValue: expandedKeys(),
            onExpandedChange: setExpanded,
          },
          () => content,
        ),
      )
    }
  },
})

/** A Tree View item with the JSON attributes (`data-type`, `data-key`, `data-range`, …). */
const Item = defineComponent({
  name: "JsonTreeViewItem",
  inheritAttrs: false,
  props: {
    /** The node key. */
    value: { type: String, required: true },
  },
  setup(props, { attrs, slots }) {
    const ctx = useJson("Item")
    const key = () => toKey(props.value)
    provide(ItemKeyKey, key)
    return () => {
      const n = ctx.node(key())
      const json = n
        ? jsonItemConnect({ instance: ctx.instance(), node: n, messages: ctx.messages() }).item()
        : {}
      return h(TreeItem, { ...normalizeProps(json), ...attrs, value: props.value }, slots)
    }
  },
})

function jsonPart(
  name: string,
  pick: (api: ReturnType<typeof jsonItemConnect>) => { attrs: PartProps; text: string | null },
) {
  return defineComponent({
    name: `JsonTreeView${name}`,
    inheritAttrs: false,
    slots: Object as SlotsType<{ default?: () => VNodeChild }>,
    setup(_, { attrs, slots }) {
      const { ctx, node } = useNode(name)
      return () => {
        const n = node()
        if (!n) return null
        const p = pick(
          jsonItemConnect({
            instance: ctx.instance(),
            node: n,
            messages: ctx.messages(),
            maxPreviewItems: ctx.maxPreviewItems(),
          }),
        )
        return h("span", mergeProps(normalizeProps(p.attrs), attrs), [slots.default?.() ?? p.text])
      }
    },
  })
}

/** The property name or index (a range: its bounds). */
const Key = jsonPart("Key", (a) => ({ attrs: a.key(), text: a.keyText }))
/** ":" (its content replaces it). */
const Separator = jsonPart("Separator", (a) => ({ attrs: a.separator(), text: ":" }))
/** A leaf's value, escaped; strings carry `data-quoted`. */
const Value = jsonPart("Value", (a) => ({ attrs: a.value(), text: a.valueText }))
/** `aria-hidden`; a container's glyph summary ("{4}", "[3]"). */
const Summary = jsonPart("Summary", (a) => ({ attrs: a.summary(), text: a.summaryGlyph }))
/** Visually hidden; the spoken summary ("object, 4 entries"). */
const SummaryText = jsonPart("SummaryText", (a) => ({
  attrs: a.summaryTextPart(),
  text: a.summaryText,
}))
/** `aria-hidden`; a collapsed container's first keys. */
const Preview = jsonPart("Preview", (a) => ({ attrs: a.preview(), text: a.previewText }))

/** An item's default text: Key, Separator, then Value or Summary, SummaryText and Preview. */
const Content = defineComponent({
  name: "JsonTreeViewContent",
  setup() {
    const { ctx, node } = useNode("Content")
    return () => {
      const n = node()
      if (!n) return null
      const out: VNodeChild[] = []
      if (n.label !== null || n.type === "range") {
        out.push(h(Key))
        if (n.type !== "range") out.push(h(Separator))
        // A space after the ":" separator: "name: Ada".
        out.push(" ")
      }
      const container = jsonItemConnect({
        instance: "",
        node: n,
        messages: ctx.messages(),
      }).isContainer
      if (container) {
        out.push(h(Summary), h(SummaryText))
        if (!ctx.expanded().has(n.key) && n.count > 0) out.push(h(Preview))
      } else if (n.type !== "range") {
        out.push(h(Value))
      }
      return out
    }
  },
})

/** Copies the highlighted item in `copyFormat`; the result is announced. */
const CopyTrigger = defineComponent({
  name: "JsonTreeViewCopyTrigger",
  inheritAttrs: false,
  slots: Object as SlotsType<{ default?: () => VNodeChild }>,
  setup(_, { attrs, slots }) {
    const ctx = useJson("CopyTrigger")
    return () =>
      h(
        "button",
        mergeProps(
          {
            type: "button",
            "data-scope": "json-tree-view",
            "data-part": "copy-trigger",
            "data-instance": ctx.instance(),
            "data-copy-state": ctx.api.copyState,
            onClick: (e: MouseEvent) => ctx.copyFrom(e.currentTarget as Element),
          },
          attrs,
        ),
        slots.default?.() ?? ctx.clipboardMessages().copy,
      )
  },
})

/** The parts, by name: `json-tree-view.parts.ts` re-exports them as the `JsonTreeView` namespace. */
export { CopyTrigger, Item, Key, Preview, Root, Separator, Summary, SummaryText, Value }
