// Tree View's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in tree-view.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"tree-view"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const treeViewMeta = {
  scope: "tree-view",
  name: "Tree View",
  stateless: false,
  parts: [
    {
      name: "TreeView.Root",
      part: "root",
      element: "(none)",
      description: "Holds the state; renders no element.",
    },
    {
      name: "TreeView.Label",
      part: "label",
      element: "span",
      description: "Names the tree (`aria-labelledby`) while rendered.",
    },
    {
      name: "TreeView.Tree",
      part: "tree",
      element: "div",
      description:
        '`role="tree"`; one Tab stop (roving). Renders its children function once per visible node, as a flat list.',
    },
    {
      name: "TreeView.Item",
      part: "item",
      element: "div (a with href)",
      description:
        '`role="treeitem"` with `aria-level`, `aria-setsize`, `aria-posinset`; `aria-expanded` on branches only.',
    },
    {
      name: "TreeView.ItemText",
      part: "item-text",
      element: "span",
      description: "The item's name (`aria-labelledby`).",
    },
    {
      name: "TreeView.ItemIndicator",
      part: "item-indicator",
      element: "span",
      description: "`aria-hidden` expand indicator; a press toggles the branch, focus stays put.",
    },
    {
      name: "TreeView.ItemCheckbox",
      part: "item-checkbox",
      element: "span",
      description: "`aria-hidden` check mark of a checkable tree; a press toggles the check.",
    },
    {
      name: "TreeView.Loading",
      part: "loading",
      element: "span",
      description: "`aria-hidden` row under a loading branch (announced, not an item).",
    },
    {
      name: "TreeView.Empty",
      part: "empty",
      element: "div",
      description: "After the tree while it has no nodes; describes it.",
    },
    {
      name: "TreeView.DropIndicator",
      part: "drop-indicator",
      element: "div",
      description:
        "`aria-hidden` line at a pointer drag's target (`--rind-tree-drop-top`, `--rind-tree-drop-level`); render it inside `TreeView.Tree`'s positioned container.",
    },
  ],
  props: {
    movable: {
      type: "boolean | (key) => boolean",
      default: "false",
      description:
        "Nodes can move (Alt+arrows, pointer drags): all, or those the predicate allows.",
    },
    onMove: {
      type: '(key, { parent, index, reason: "keyboard" | "pointer" }) => void',
      description: "A node moved: apply it to `items` with `moveNode(items, key, details)`.",
    },
    items: {
      type: "{ key, label, children?, isBranch?, disabled?, href? }[]",
      description: "The tree's data (or `collection`: a tree collection built by you).",
    },
    selectionMode: {
      type: '"single" | "multiple" | "none"',
      default: '"single"',
      description: "None: activation only.",
    },
    selectionBehavior: {
      type: '"toggle" | "replace"',
      default: '"toggle"',
      description: "Replace: selection follows focus; mod+press toggles.",
    },
    value: { type: "string | null | string[]", description: "Controlled selection." },
    defaultValue: { type: "string | null | string[]", description: "Uncontrolled selection." },
    onValueChange: {
      type: "(value, { reason, key }) => void",
      description: "Every selection change.",
    },
    expandedValue: { type: "string[]", description: "Controlled expanded branch keys." },
    defaultExpandedValue: { type: "string[]", description: "Uncontrolled expanded keys." },
    onExpandedChange: {
      type: '(keys, { reason: "key" | "press" | "api" | "siblings" | "all" }) => void',
      description: "Every expansion change.",
    },
    checkable: {
      type: "boolean",
      default: "false",
      description: "Items carry `aria-checked`; no selection.",
    },
    checkedValue: { type: "string[]", description: "Controlled checked leaf keys." },
    defaultCheckedValue: { type: "string[]", description: "Uncontrolled checked leaf keys." },
    onCheckedChange: {
      type: "(keys, { reason, key }) => void",
      description: "Once per user action.",
    },
    checkPropagation: {
      type: '"both" | "none"',
      default: '"both"',
      description: "Both: a branch is derived from its leaves.",
    },
    expandOnClick: {
      type: "boolean",
      default: "true",
      description: "A press on a branch toggles it.",
    },
    onAction: {
      type: "(key, { modality, via }) => void",
      description: "Enter, and a press when the selection does not consume it.",
    },
    onLoadChildren: {
      type: "(key, { signal }) => Promise | void",
      description: "Called once per unloaded branch when first expanded.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "No Tab stop, no keys or presses.",
    },
  },
  dataAttributes: {
    tree: {
      ...base("tree"),
      "data-selection-mode": "single | multiple | none.",
      "data-checkable": "A checkable tree.",
      "data-empty": "No visible nodes.",
      "data-focus": "Focus is in the tree.",
      "data-focus-visible": "Keyboard focus is in the tree.",
      "data-disabled": "Disabled.",
    },
    item: {
      ...base("item"),
      "data-key": "The node key.",
      "data-level": "The node's level (1 for roots).",
      "data-branch": "A branch.",
      "data-state": "open | closed (branches).",
      "data-expanded": "An expanded branch.",
      "data-selected": "Selected.",
      "data-checked": "Checked.",
      "data-indeterminate": "Some descendant leaves checked.",
      "data-highlighted": "The highlighted (focused) item.",
      "data-disabled": "Disabled.",
      "data-loading": "Children are loading.",
      "data-error": "Loading children failed.",
      "data-focus-visible": "Keyboard focus.",
      "data-hover": "Under the pointer.",
      "data-pressed": "Being pressed.",
      "data-dragging": "Being dragged by a pointer.",
      "data-drop-target": "A pointer drag would drop inside it.",
    },
    "drop-indicator": {
      ...base("drop-indicator"),
      "data-position": "before | after | inside.",
      "data-hidden": "No target.",
    },
    "item-indicator": {
      ...base("item-indicator"),
      "data-state": "open | closed.",
      "data-loading": "The branch is loading.",
      "data-disabled": "The item is disabled.",
    },
    "item-checkbox": {
      ...base("item-checkbox"),
      "data-state": "checked | unchecked | indeterminate.",
    },
  },
  keyboard: [
    ["ArrowDown, ArrowUp", "Next / previous visible item."],
    ["Home, End", "First / last visible item."],
    [
      "ArrowRight",
      "Collapsed branch: expand; expanded branch: first child (mirrored in right-to-left).",
    ],
    ["ArrowLeft", "Expanded branch: collapse; otherwise: the parent (mirrored in right-to-left)."],
    ["*", "Expand every sibling branch."],
    ["Space", "Select (or check, in a checkable tree)."],
    ["Enter", "Activate: follow the link, onAction, then select or toggle the branch."],
    ["Shift+ArrowDown/Up, Shift+Space", "Extend the range from the anchor (multiple)."],
    ["mod+A", "Select the visible items (multiple)."],
    ["Characters", "Typeahead over the visible items."],
    ["Alt+ArrowUp, Alt+ArrowDown", "Movable: move the item before / after its sibling."],
    ["Alt+ArrowRight, Alt+ArrowLeft", "Movable: into the branch above / out of its branch."],
  ],
  states: {
    idle: "Focus is outside the tree.",
    focused: "Focus is in the tree: keys navigate, expand and select.",
  },
  contract: {
    actions: {
      expand: ["keyboard"],
      collapse: ["keyboard"],
      toggle: ["keyboard"],
      check: ["keyboard"],
      expandSiblings: ["keyboard"],
      act: ["pointer", "keyboard", "virtual"],
      expandAll: ["keyboard"],
      focusIn: ["keyboard"],
      tabOut: ["keyboard"],
      next: ["keyboard"],
      typeS: ["keyboard"],
      space: ["keyboard"],
      enter: ["keyboard"],
      star: ["keyboard"],
      selectAll: ["keyboard"],
      moveNode: ["keyboard"],
      dragNode: ["pointer", "virtual"],
    },
    queries: [
      "items",
      "isExpanded",
      "expandedNames",
      "isBusy",
      "isEmpty",
      "highlighted",
      "selected",
      "checked",
      "hasFocus",
    ],
    traits: ["composite-roving", "set-metadata", "selectable"],
  },
} as const satisfies ComponentMeta
