// The Menubar's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in menubar.meta.test.ts.

import type { ComponentMeta } from "../meta"

export const menubarMeta = {
  scope: "menubar",
  name: "Menubar",
  stateless: false,
  parts: [
    {
      name: "Menubar.Root",
      part: "root",
      element: "div",
      description:
        '`role="menubar"`, named by `aria-label` or `aria-labelledby`; one tab stop with arrow keys and typeahead over its items, and the open-menu `value`.',
    },
    {
      name: "Menubar.Menu",
      part: "menu",
      element: "none",
      description:
        "One menu: a Menu root level hosted by the bar; `value` is its key. Open state, `modal` and placement come from the bar.",
    },
    {
      name: "Menubar.Trigger",
      part: "trigger",
      element: "div",
      description:
        'The menu\'s trigger as a bar item: `role="menuitem"`, `aria-haspopup="menu"`, roving `tabindex`; it keeps the menu\'s `data-scope`.',
    },
  ],
  props: {
    value: {
      type: "string | null",
      description: "The open menu's `value` (controlled); `null` when none is open.",
    },
    defaultValue: { type: "string | null", default: "null", description: "Uncontrolled value." },
    onValueChange: {
      type: "(value, details) => void",
      description:
        "`details.reason`: trigger, trigger-key, hover, menu-navigate, api, or the menu's close reason.",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      default: '"horizontal"',
      description:
        "Which arrows move along the bar; vertical menus open beside their item. `aria-orientation` only when vertical.",
    },
    loop: { type: "boolean", default: "true", description: "Arrow moves wrap at both ends." },
    modal: {
      type: "boolean",
      default: "true",
      description: "Passed to every menu: the page is inert while one is open, the bar is not.",
    },
    disabled: { type: "boolean", default: "false", description: "Disables every item." },
    focusableWhenDisabled: {
      type: "boolean",
      default: "true",
      description: "Disabled items stay reachable by arrows and typeahead (`aria-disabled`).",
    },
    actionsRef: {
      type: "Ref<{ focus(): void }>",
      description: "`focus()` moves focus to the bar's tab stop (an application shortcut).",
    },
    "*.render": {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: {
      "data-scope": '"menubar"',
      "data-part": '"root"',
      "data-instance": "The instance id.",
      "data-orientation": '"horizontal" or "vertical".',
      "data-state": '"open" while a menu is open, else "closed".',
      "data-disabled": "While the menubar is disabled.",
      "data-modal": "When its menus are modal.",
    },
    trigger: {
      "data-host": '"menubar": marks the menu trigger as a bar item.',
      "data-key": "The menu's `value`.",
      "data-orientation": "The bar's orientation.",
      "data-highlighted": "While the item has focus.",
    },
  },
  keyboard: [
    ["Tab / Shift+Tab", "The menubar is one tab stop: the last focused item, else the first."],
    [
      "ArrowRight / ArrowLeft",
      "On the bar: next / previous item (mirrored in RTL). In an open menu, at its edge: the next / previous item's menu.",
    ],
    [
      "ArrowDown / ArrowUp",
      "Horizontal bar: open the menu on its first / last item. Vertical: move along the bar.",
    ],
    ["Home / End", "First / last item."],
    ["Enter / Space", "Open the focused item's menu; on the open item, close it."],
    ["Escape", "Close the menu; focus returns to its item."],
    ["Printable characters", "Typeahead to the next matching item."],
  ],
  states: {
    closed: "No menu is open.",
    open: "One menu is open (open mode: hover and arrows switch menus).",
  },
  contract: {
    actions: {
      tabIn: ["keyboard"],
      moveTo: ["keyboard"],
      openMenu: ["pointer", "touch", "keyboard", "virtual"],
      openMenuOnLast: ["keyboard"],
      switchTo: ["pointer", "touch", "keyboard", "virtual"],
      closeMenu: ["keyboard"],
      typeahead: ["keyboard"],
      tabOut: ["keyboard"],
      focusItem: ["keyboard"],
      arrowNext: ["keyboard"],
      leave: ["keyboard"],
    },
    queries: ["items", "currentMenu", "focusedItem", "tabStop", "isDisabled", "orientation"],
    traits: ["directional"],
  },
} as const satisfies ComponentMeta
