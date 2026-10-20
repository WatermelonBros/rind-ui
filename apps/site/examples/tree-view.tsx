"use client"

import { moveNode } from "@rind-ui/core"
import { TreeView, type TreeViewItemData, type TreeViewNodeState } from "@rind-ui/react"
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import { type RefObject, useEffect, useRef, useState } from "react"
import type { States, Variants } from "./types"

/** `focused` needs real focus inside the tree: the driver reaches it from the same example. */
export const states: States = { "tree-view": { idle: "Basic", focused: "Basic" } }

const FILES: readonly TreeViewItemData[] = [
  {
    key: "src",
    label: "src",
    children: [
      {
        key: "components",
        label: "components",
        children: [
          { key: "button.tsx", label: "button.tsx" },
          { key: "dialog.tsx", label: "dialog.tsx" },
        ],
      },
      { key: "index.ts", label: "index.ts" },
      { key: "server.ts", label: "server.ts" },
    ],
  },
  {
    key: "docs",
    label: "docs",
    children: [
      { key: "readme.md", label: "readme.md" },
      { key: "changelog.md", label: "changelog.md" },
    ],
  },
  { key: "package.json", label: "package.json" },
]

function Rows({ checkable = false }: { readonly checkable?: boolean }) {
  return (
    <TreeView.Tree>
      {(node) => (
        <TreeView.Item value={node.key}>
          {node.isBranch ? (
            <TreeView.ItemIndicator>▸</TreeView.ItemIndicator>
          ) : (
            <span aria-hidden="true" className="tree-spacer" />
          )}
          {checkable ? <TreeView.ItemCheckbox /> : null}
          <TreeView.ItemText>{node.label}</TreeView.ItemText>
        </TreeView.Item>
      )}
    </TreeView.Tree>
  )
}

export function Basic() {
  return (
    <TreeView.Root items={FILES} defaultExpandedValue={["src"]} defaultValue="index.ts">
      <TreeView.Label>Files</TreeView.Label>
      <Rows />
    </TreeView.Root>
  )
}

export function Movable() {
  const [items, setItems] = useState<TreeViewItemData[]>([
    ...FILES,
    { key: "archive", label: "archive", isBranch: true, children: [] },
  ])
  return (
    <TreeView.Root
      items={items}
      defaultExpandedValue={["src", "docs"]}
      movable
      onMove={(key, target) => setItems((all) => moveNode(all, key, target))}
    >
      <TreeView.Label>Project</TreeView.Label>
      {/* The drop line is positioned against this wrapper (the tree's top). */}
      <div style={{ position: "relative" }}>
        <Rows />
        <TreeView.DropIndicator />
      </div>
    </TreeView.Root>
  )
}

export function Multiple() {
  return (
    <TreeView.Root
      items={FILES}
      selectionMode="multiple"
      selectionBehavior="replace"
      defaultExpandedValue={["src", "docs"]}
    >
      <TreeView.Label>Files (multiple)</TreeView.Label>
      <Rows />
    </TreeView.Root>
  )
}

export function Checkable() {
  const [checked, setChecked] = useState<readonly string[]>(["button.tsx"])
  return (
    <div className="stack">
      <TreeView.Root
        items={FILES}
        checkable
        selectionMode="none"
        checkedValue={checked}
        onCheckedChange={setChecked}
        defaultExpandedValue={["src", "components"]}
      >
        <TreeView.Label>Files to commit</TreeView.Label>
        <Rows checkable />
      </TreeView.Root>
      <p className="note">Checked: {checked.join(", ") || "none"}</p>
    </div>
  )
}

/** A folder that loads its children the first time it opens. */
export function LazyLoading() {
  const [items, setItems] = useState<readonly TreeViewItemData[]>([
    { key: "remote", label: "remote", isBranch: true },
    { key: "local", label: "local", isBranch: true },
  ])
  return (
    <TreeView.Root
      items={items}
      selectionMode="none"
      onLoadChildren={async (key) => {
        // Stands in for a request.
        await new Promise((resolve) => setTimeout(resolve, 600))
        setItems((all) =>
          all.map((item) =>
            item.key === key
              ? {
                  ...item,
                  children: ["a", "b", "c"].map((n) => ({
                    key: `${key}-${n}`,
                    label: `${key} file ${n}`,
                  })),
                }
              : item,
          ),
        )
      }}
    >
      <TreeView.Label>Lazy folders</TreeView.Label>
      <Rows />
    </TreeView.Root>
  )
}

const PAGES: readonly TreeViewItemData[] = [
  {
    key: "guides",
    label: "Guides",
    children: [
      { key: "get-started", label: "Get started" },
      { key: "theme", label: "Theming" },
    ],
  },
  { key: "testing-accessibility", label: "Testing" },
]

export function Links() {
  return (
    <TreeView.Root items={PAGES} selectionMode="none" defaultExpandedValue={["guides"]}>
      <TreeView.Label>Documentation</TreeView.Label>
      <TreeView.Tree>
        {(node) =>
          node.isBranch ? (
            <TreeView.Item value={node.key}>
              <TreeView.ItemIndicator>▸</TreeView.ItemIndicator>
              <TreeView.ItemText>{node.label}</TreeView.ItemText>
            </TreeView.Item>
          ) : (
            <TreeView.Item
              value={node.key}
              href={node.key === "theme" ? "/theme/" : `/docs/${node.key}/`}
              current={node.key === "theming" ? "page" : undefined}
            >
              <span aria-hidden="true" className="tree-spacer" />
              <TreeView.ItemText>{node.label}</TreeView.ItemText>
            </TreeView.Item>
          )
        }
      </TreeView.Tree>
    </TreeView.Root>
  )
}

export function Disabled() {
  return (
    <TreeView.Root
      items={FILES.map((f) => (f.key === "docs" ? { ...f, disabled: true } : f))}
      defaultExpandedValue={["src"]}
    >
      <TreeView.Label>Files (docs disabled)</TreeView.Label>
      <Rows />
    </TreeView.Root>
  )
}

export function Empty() {
  return (
    <TreeView.Root items={[]}>
      <TreeView.Label>Empty folder</TreeView.Label>
      <Rows />
      <TreeView.Empty>This folder is empty.</TreeView.Empty>
    </TreeView.Root>
  )
}

export function RightToLeft() {
  return (
    <div dir="rtl" lang="ar">
      <TreeView.Root items={FILES} defaultExpandedValue={["src"]}>
        <TreeView.Label>الملفات</TreeView.Label>
        <Rows />
      </TreeView.Root>
    </div>
  )
}

// 200 folders of 50 files: 10,200 nodes.
const BIG: readonly TreeViewItemData[] = Array.from({ length: 200 }, (_, i) => ({
  key: `folder-${i}`,
  label: `folder-${i + 1}`,
  children: Array.from({ length: 50 }, (_, j) => ({
    key: `folder-${i}-file-${j}`,
    label: `file-${j + 1}.ts`,
  })),
}))
const ROW = 32

/** Module-level (a stable identity): a highlight move re-renders only the two rows involved. */
const bigRow = (node: TreeViewNodeState) => (
  <TreeView.Item
    value={node.key}
    style={{
      position: "absolute",
      insetBlockStart: 0,
      insetInlineStart: 0,
      minInlineSize: "100%",
      blockSize: ROW,
      transform: `translateY(${node.index * ROW}px)`,
    }}
  >
    {node.isBranch ? (
      <TreeView.ItemIndicator>▸</TreeView.ItemIndicator>
    ) : (
      <span aria-hidden="true" className="tree-spacer" />
    )}
    <TreeView.ItemText>{node.label}</TreeView.ItemText>
  </TreeView.Item>
)

/** Inside Root: the rows near the viewport, plus the highlighted one wherever it is. */
function VirtualRows({ scrollTo }: { readonly scrollTo: RefObject<(index: number) => void> }) {
  const { count, persistedIndexes } = TreeView.useVisibleRows()
  const scroller = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW,
    overscan: 8,
    rangeExtractor: (range) =>
      [...new Set([...defaultRangeExtractor(range), ...persistedIndexes])].sort((a, b) => a - b),
  })
  useEffect(() => {
    scrollTo.current = (index) => virtualizer.scrollToIndex(index)
  }, [scrollTo, virtualizer])
  return (
    <div ref={scroller} style={{ blockSize: 320, overflow: "auto" }}>
      <TreeView.Tree
        indexes={virtualizer.getVirtualItems().map((row) => row.index)}
        style={{ position: "relative", blockSize: virtualizer.getTotalSize(), overflow: "visible" }}
      >
        {bigRow}
      </TreeView.Tree>
    </div>
  )
}

/** 10,200 nodes; only the rows near the viewport are in the DOM. */
export function Virtualized() {
  // The virtualizer lives in the child, inside Root: bridged through a ref.
  const scrollTo = useRef<(index: number) => void>(() => {})
  return (
    <TreeView.Root
      items={BIG}
      defaultExpandedValue={["folder-0", "folder-1"]}
      virtualized
      scrollToIndex={({ index }) => scrollTo.current(index)}
    >
      <TreeView.Label>Repository</TreeView.Label>
      <VirtualRows scrollTo={scrollTo} />
    </TreeView.Root>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "Arrow keys move; Right expands, Left collapses or climbs to the parent.",
  },
  Movable: {
    title: "Moving items",
    description:
      "`movable`: drag a row before, after or into a folder (a closed folder opens when you hold over it). Alt with the arrows moves the focused item: up, down, into the folder above, out of its folder.",
  },
  Multiple: {
    title: "Multiple selection",
    description: "Replace behaviour: a press selects one row; Ctrl or Cmd adds, Shift extends.",
  },
  Checkable: {
    title: "Checkboxes",
    description: "A folder's state comes from its files: checked, unchecked or mixed.",
  },
  LazyLoading: {
    title: "Lazy loading",
    description: "`onLoadChildren` runs once per folder; loading is announced.",
  },
  Links: {
    title: "Links",
    description: "Leaves with `href` are native links: they open in a new tab with Ctrl or Cmd.",
  },
  Disabled: {
    title: "Disabled items",
    description: "Skipped by the keys; its children stay reachable when it is open.",
  },
  Empty: { title: "Empty", description: "`TreeView.Empty` describes an empty tree." },
  RightToLeft: {
    title: "Right to left",
    description: "Left expands and Right collapses; the indicator mirrors.",
  },
  Virtualized: {
    title: "Virtualized",
    description:
      "10,200 nodes: `TreeView.Tree indexes` renders a virtualizer's window, `scrollToIndex` follows the keys.",
  },
}
