<script lang="ts">
import {
  announcerCapability,
  type CollectionKey,
  clipboardCapability,
  clipboardMessages,
  type JsonNode,
  jsonCopyText,
  jsonExpandedKeys,
  jsonTreeCollection,
  jsonTreeViewMessages,
  toKey,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { useEnvironment, useLocale, useMessages } from "../provider"
import ItemIndicator from "../tree-view/tree-view-item-indicator.svelte"
import ItemText from "../tree-view/tree-view-item-text.svelte"
import TreeRoot from "../tree-view/tree-view-root.svelte"
import Tree from "../tree-view/tree-view-tree.svelte"
import type { TreeViewExpandedDetails } from "../tree-view/types"
import { jsonContext } from "./context"
import Content from "./json-tree-view-content.svelte"
import Item from "./json-tree-view-item.svelte"
import type { JsonCopyState, JsonTreeViewApi, JsonTreeViewRootProps } from "./types"

let {
  data,
  defaultExpandedDepth,
  groupSize,
  maxPreviewItems,
  copyFormat = "json",
  copyFeedbackDuration = 2000,
  expandedValue = $bindable(),
  defaultExpandedValue,
  onExpandedChange,
  messages: ownMessages,
  locale: ownLocale,
  id,
  class: className,
  style,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  children,
  ...tree
}: JsonTreeViewRootProps = $props()

const MAX_EXPAND = 5000
const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability, clipboardCapability)
const locale = useLocale(() => ownLocale)
const messages = useMessages("json-tree-view", jsonTreeViewMessages, () => ownMessages)
const copyMessages = useMessages("clipboard", clipboardMessages, () => undefined)
// The first value's expansion only: later values keep the user's by key.
let inner = $state<readonly string[]>(
  untrack(
    () =>
      defaultExpandedValue ??
      jsonExpandedKeys(data, defaultExpandedDepth ?? 1, { groupSize, max: MAX_EXPAND }),
  ),
)
const expandedKeys = $derived(expandedValue ?? inner)
const expanded = $derived<ReadonlySet<string>>(new Set(expandedKeys))
const collection = $derived(jsonTreeCollection(data, { expanded, groupSize }))
const setExpanded = (keys: readonly string[], details: TreeViewExpandedDetails) => {
  // The same keys again (a re-sync after a new collection): nothing changed.
  const now = untrack(() => expanded)
  if (keys.length === now.size && keys.every((k) => now.has(k))) return
  inner = keys
  if (expandedValue !== undefined) expandedValue = keys
  onExpandedChange?.(keys, details)
}
const node = (key: CollectionKey) => collection.get(key)?.value as JsonNode | undefined

let copyState = $state<JsonCopyState>("idle")
let copying = false
let timer: ReturnType<typeof env.scheduler.setTimeout> | undefined
$effect(() => () => {
  if (timer !== undefined) env.scheduler.clearTimeout(timer)
})
const settle = (ok: boolean) => {
  copying = false
  copyState = ok ? "copied" : "error"
  env.announcer.announce({
    message: ok ? copyMessages().copied : copyMessages().copyFailed,
    priority: "polite",
    key: `json-tree-view-${instance}`,
    lang: locale.current.locale,
  })
  if (timer !== undefined) env.scheduler.clearTimeout(timer)
  timer = env.scheduler.setTimeout(() => {
    timer = undefined
    copyState = "idle"
  }, copyFeedbackDuration)
}
let rootEl: HTMLElement | undefined = $state()
/** The focused item, else the highlighted one (the tree's Tab stop). */
const current = (): JsonNode | undefined => {
  const active = rootEl?.ownerDocument.activeElement
  const item =
    (active?.closest('[role="treeitem"][data-key]') as HTMLElement | null) ??
    rootEl?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"][data-key]') ??
    null
  const key = item?.getAttribute("data-key")
  return key == null ? undefined : node(toKey(key))
}
const textOf = (n: JsonNode | undefined) => {
  if (!n) throw new Error("[rind-ui] json-tree-view: no item to copy")
  return jsonCopyText(n, copyFormat)
}
/** Through the Clipboard capability (the CopyTrigger, or a copy event without clipboardData). */
const copyFrom = (near: Element) => {
  if (copying) return
  let text: string
  try {
    text = textOf(current())
  } catch {
    settle(false)
    return
  }
  copying = true
  copyState = "copying"
  env.clipboard.writeText(text, { near }).then(
    () => settle(true),
    () => settle(false),
  )
}
// Mod+C on the tree: the native copy event's clipboardData (synchronous, no permission).
const oncopy = (e: ClipboardEvent) => {
  const target = e.target as Element | null
  if (!target?.closest('[role="tree"]')) return
  // A text selection is the user's: the browser copies it.
  const selection = rootEl?.ownerDocument.getSelection()
  if (selection && !selection.isCollapsed && rootEl?.contains(selection.anchorNode)) return
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
    return copyState
  },
  expandAll: (options) => {
    // One deeper than the deepest open container (levels are 0-based in the collection).
    let deepest = -1
    for (const key of expandedKeys) {
      const level = collection.get(toKey(key))?.level
      if (level !== undefined && level > deepest) deepest = level
    }
    const depth = options?.depth ?? deepest + 2
    const keys = jsonExpandedKeys(data, depth, { groupSize, max: MAX_EXPAND })
    setExpanded([...new Set([...expandedKeys, ...keys])], { reason: "all" })
  },
  copy: () => {
    if (rootEl) copyFrom(rootEl)
  },
}
jsonContext.set({
  instance: () => instance,
  node,
  expanded: () => expanded,
  messages: () => messages(),
  clipboardMessages: () => copyMessages(),
  maxPreviewItems: () => maxPreviewItems,
  api,
  copyFrom,
})
</script>

<div
  data-scope="tree-view"
  data-part="root"
  data-instance={instance}
  data-json-tree-view=""
  data-copy-state={copyState}
  class={className}
  {style}
  bind:this={rootEl}
  {oncopy}
>
  <TreeRoot
    {...tree}
    selectionMode={tree.selectionMode ?? "none"}
    id={instance}
    {collection}
    expandedValue={expandedKeys}
    onExpandedChange={setExpanded}
  >
    {#if children}
      {@render children(api)}
    {:else}
      <Tree aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
        {#snippet children(n)}
          <Item value={n.key}><ItemIndicator /><ItemText><Content /></ItemText></Item>
        {/snippet}
      </Tree>
    {/if}
  </TreeRoot>
</div>
