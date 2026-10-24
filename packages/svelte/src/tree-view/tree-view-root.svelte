<script lang="ts">
import {
  announcerCapability,
  type CollectionKey,
  createTreeCollection,
  expansionReason,
  isMovable,
  keySetOf,
  layoutCapability,
  pointerTarget,
  type ScrollToIndexDetails,
  type TreeDropZone,
  type TreeViewActionDetails,
  type TreeViewMessages,
  type TreeViewMoveDetails,
  type TreeViewValue,
  toKey,
  treeDrag,
  treeSelectionOf,
  treeViewConnect,
  treeViewIds,
  treeViewMachine,
  treeViewMessages,
  visibleOf,
} from "@rind-ui/core"
import { SvelteSet } from "svelte/reactivity"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { type TreeViewHost, treeViewHost } from "./context"
import type { TreeViewItemData, TreeViewNodeState, TreeViewRootProps } from "./types"

let {
  id,
  children,
  items,
  collection,
  selectionMode = "single",
  selectionBehavior,
  disallowEmptySelection,
  value = $bindable(),
  defaultValue,
  onValueChange,
  expandedValue = $bindable(),
  defaultExpandedValue,
  onExpandedChange,
  checkable = false,
  checkedValue = $bindable(),
  defaultCheckedValue,
  onCheckedChange,
  checkPropagation,
  expandOnClick,
  onAction,
  onLoadChildren,
  disabled = false,
  focusableWhenDisabled,
  loop,
  typeaheadTimeout,
  messages: given,
  virtualized,
  scrollToIndex,
  movable,
  onMove,
}: TreeViewRootProps = $props()

const fromData = (list: readonly TreeViewItemData[]) =>
  createTreeCollection<TreeViewItemData>({
    roots: list,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    getChildren: (i) => i.children,
    hasUnloadedChildren: (i) => i.isBranch === true,
    isDisabled: (i) => i.disabled === true,
  })
const EMPTY_TREE = fromData([])
const env = useEnvironment(announcerCapability, layoutCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const data = $derived(items ? fromData(items) : null)
const tree = $derived(collection ?? data ?? EMPTY_TREE)
const ids = $derived(treeViewIds(instance))
// Sound: every key of the defaults is present; a partial override only replaces some.
const messages = $derived({ ...treeViewMessages, ...given } as TreeViewMessages)
const machine = useMachine(
  treeViewMachine,
  () => ({
    tree,
    ids: { list: ids.tree, item: ids.item },
    selectionMode,
    selectionBehavior,
    disallowEmptySelection: selectionMode === "multiple" ? disallowEmptySelection : undefined,
    focusableWhenDisabled,
    loop,
    typeaheadTimeout,
    checkable,
    checkPropagation,
    expandOnClick,
    disabled,
    messages,
    ...(value === undefined ? {} : { value: value as TreeViewValue }),
    defaultValue:
      (defaultValue as TreeViewValue | undefined) ?? (selectionMode === "multiple" ? [] : null),
    onValueChange: (v: TreeViewValue, details: { event: unknown }) => {
      const e = details.event as { type: string; key?: string }
      onValueChange?.(v as never, { reason: e.type, key: e.key })
      if (value !== undefined) value = v as never
    },
    ...(expandedValue !== undefined ? { expandedValue } : {}),
    defaultExpandedValue: defaultExpandedValue ?? [],
    onExpandedValueChange: (keys: readonly string[], details: { event: { type: string } }) => {
      onExpandedChange?.(keys, { reason: expansionReason(details.event.type as never) })
      if (expandedValue !== undefined) expandedValue = keys
    },
    ...(checkedValue !== undefined ? { checkedValue } : {}),
    defaultCheckedValue: defaultCheckedValue ?? [],
    onCheckedValueChange: (keys: readonly string[], details: { event: unknown }) => {
      const e = details.event as { type: string; key?: string }
      onCheckedChange?.(keys, { reason: e.type, key: e.key })
      if (checkedValue !== undefined) checkedValue = keys
    },
    onAction: onAction ? (key: string, d: TreeViewActionDetails) => onAction?.(key, d) : undefined,
    onLoadChildren: onLoadChildren
      ? (key: string, o: { readonly signal: AbortSignal }) => onLoadChildren?.(key, o)
      : undefined,
    virtualized,
    scrollToIndex: scrollToIndex ? (d: ScrollToIndexDetails) => scrollToIndex?.(d) : undefined,
    movable,
    onMove: onMove ? (key: string, d: TreeViewMoveDetails) => onMove?.(key, d) : undefined,
  }),
  env,
)
let label = $state(false)
let empty = $state(false)
const texts = new SvelteSet<CollectionKey>()
let hovered = $state<CollectionKey | null>(null)
let pressed = $state<CollectionKey | null>(null)
let dropAt = $state<{ top: number; level: number } | null>(null)
const canMove = (key: CollectionKey) => isMovable({ movable, disabled }, key)
const focused = $derived(machine.view.matches("focused"))
const modality = useModality(env.modality, () => focused)
const expandedKeys = $derived(machine.view.values.expandedValue as readonly string[] | undefined)
const visible = $derived(visibleOf(tree, expandedKeys))
const expanded = $derived(keySetOf(expandedKeys))
const parts = $derived.by(() => {
  const ctx = machine.view.context
  const mode = checkable ? "none" : selectionMode
  return treeViewConnect(
    {
      instance,
      tree,
      visible,
      expanded,
      context: {
        highlightedKey: ctx.highlightedKey,
        highlightSource: ctx.highlightSource,
        loading: ctx.loading,
        failed: ctx.failed,
      },
      selection: treeSelectionOf(machine.view.values.value as TreeViewValue | undefined, mode),
      selectionMode: mode,
      checkable,
      checked: keySetOf(machine.view.values.checkedValue as readonly string[] | undefined),
      checkPropagation: checkPropagation ?? "both",
      disabled,
      focusableWhenDisabled,
      typingAhead: () => {
        const t = machine.service.getSnapshot().context.typeahead
        return t.buffer !== "" && env.clock.now() - t.at <= (typeaheadTimeout ?? 1000)
      },
      focused,
      modality: modality.current,
      hovered,
      pressed,
      mounted: { label, empty, itemText: (key: CollectionKey) => texts.has(key) },
      send: machine.send,
      canMove,
      movable: movable !== undefined && movable !== false,
      drag: ctx.drag,
      moveInstructions: messages.moveInstructions,
    },
    env,
  )
})
const node = (key: CollectionKey): TreeViewNodeState | undefined => {
  const n = tree.get(key)
  if (!n) return undefined
  const item = parts.item(key)
  return {
    key,
    index: visible.get(key)?.index ?? -1,
    value: n.value,
    label: n.textValue,
    level: n.level + 1,
    posInSet: n.setIndex + 1,
    setSize: n.setSize,
    isLast: n.setIndex === n.setSize - 1,
    parentKey: n.parentKey,
    isBranch: n.hasChildren,
    expanded: n.hasChildren && expanded.has(key),
    selected: item["aria-selected"] === "true",
    checked: item["aria-checked"] as "true" | "false" | "mixed" | undefined,
    loading: machine.view.context.loading.has(key),
    disabled: n.disabled,
  }
}
const host: TreeViewHost = {
  parts: () => parts,
  tree: () => tree,
  visible: () => visible,
  focused: () => focused,
  highlightedIndex: () => {
    const k = machine.view.context.highlightedKey
    return k === null ? undefined : visible.get(k)?.index
  },
  node,
  messages: () => messages,
  env,
  mountLabel: (on) => {
    label = on
  },
  mountEmpty: (on) => {
    empty = on
  },
  mountText: (key, on) => {
    if (on) texts.add(key)
    else texts.delete(key)
  },
  setHovered: (key) => {
    hovered = key
  },
  setPressed: (key) => {
    pressed = key
  },
  options: () => ({ checkable, selectionMode }),
  canMove,
  dropAt: () => dropAt,
  startDrag: (key, event) => {
    const treeEl = (event.currentTarget as HTMLElement).closest<HTMLElement>('[role="tree"]')
    if (!treeEl || (event.pointerType === "mouse" && event.button !== 0)) return
    const send = machine.send
    let auto: { key: CollectionKey; timer: ReturnType<typeof env.scheduler.setTimeout> } | null =
      null
    const stopAuto = () => {
      if (auto) env.scheduler.clearTimeout(auto.timer)
      auto = null
    }
    treeDrag(event, {
      tree: treeEl,
      onStart: () => send({ type: "DRAG.START", key }),
      onOver: (row, fraction) => {
        // The latest tree and expansion: a branch may have opened during the drag.
        const raw = row?.getAttribute("data-key")
        const over = raw ? toKey(raw) : null
        const n = over === null ? undefined : node(over)
        if (over === null || !n || !row) {
          stopAuto()
          dropAt = null
          send({ type: "DRAG.OVER", over: null, zone: null, target: null })
          return
        }
        const zone: TreeDropZone =
          fraction < 0.25
            ? "before"
            : fraction > 0.75
              ? "after"
              : n.isBranch
                ? "inside"
                : fraction < 0.5
                  ? "before"
                  : "after"
        const target = pointerTarget(tree, key, over, zone, n.expanded)
        send({ type: "DRAG.OVER", over, zone, target })
        // A collapsed branch held over its middle opens (a drop inside it can then be aimed).
        if (zone === "inside" && n.isBranch && !n.expanded && target) {
          if (auto?.key !== over) {
            stopAuto()
            auto = {
              key: over,
              timer: env.scheduler.setTimeout(() => send({ type: "EXPAND", key: over }), 700),
            }
          }
        } else stopAuto()
        if (!target || zone === "inside") {
          dropAt = null
          return
        }
        const box = row.getBoundingClientRect()
        const parent = target.parent === null ? undefined : node(toKey(target.parent))
        dropAt = {
          top: (zone === "before" ? box.top : box.bottom) - treeEl.getBoundingClientRect().top,
          level: parent ? parent.level + 1 : 1,
        }
      },
      onEnd: (drop) => {
        stopAuto()
        dropAt = null
        send(drop ? { type: "DRAG.END" } : { type: "DRAG.CANCEL" })
      },
    })
  },
}
treeViewHost.set(host)
</script>

{@render children?.()}{#if movable}<span {...attrs(normalizeProps(parts.moveInstructions()))}>{parts.moveInstructionsText}</span>{/if}
