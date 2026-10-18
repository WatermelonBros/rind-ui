"use client"

import { TreeView, type TreeViewItemData } from "@rind-ui/react"
import { useState } from "react"
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

export const variants: Variants = {
  Basic: {
    title: "Basic",
    description: "Arrow keys move; Right expands, Left collapses or climbs to the parent.",
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
}
