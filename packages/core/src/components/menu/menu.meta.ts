// The Menu's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in menu.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"menu"',
  "data-part": `"${part}"`,
  "data-instance": "The id of the menu level (root or submenu) it belongs to.",
})

const button = {
  "data-focus": "While it has focus.",
  "data-focus-visible": "While it has focus and the last input was not a pointer or touch.",
  "data-pressed": "While it is pressed.",
}

const placement = {
  "data-side": "The physical side it is placed on (`top`, `right`, `bottom`, `left`).",
  "data-anchor-hidden": "While the anchor is scrolled out of view.",
  "data-placing": "Until the first placement of an open.",
}

const item = (part: string) => ({
  ...base(part),
  "data-key": "The item's key.",
  "data-highlighted": "While it is the highlighted item.",
  "data-disabled": "While disabled.",
  "data-focus-visible": "While highlighted by the keyboard or typeahead.",
})

const checkable = {
  "data-state": '"checked" or "unchecked".',
}

export const menuMeta = {
  scope: "menu",
  name: "Menu",
  stateless: false,
  parts: [
    {
      name: "Menu.Root",
      part: "root",
      element: "none",
      description:
        "Renders no element: owns the open state, the layer, positioning, item navigation and the focus rules. `actionsRef` exposes `open()` and `close()`.",
    },
    {
      name: "Menu.Trigger",
      part: "trigger",
      element: "button",
      description:
        '`aria-haspopup="menu"`, `aria-expanded`, `aria-controls` while the content is mounted. Enter, Space, a click or ArrowDown open it on the first item; ArrowUp on the last.',
    },
    {
      name: "Menu.Portal",
      part: "portal",
      element: "none",
      description: "Optional: renders its children in the shared `Portal`.",
    },
    {
      name: "Menu.Positioner",
      part: "positioner",
      element: "div",
      description:
        "Holds the coordinates written by positioning; stays mounted while the content exits.",
    },
    {
      name: "Menu.Content",
      part: "content",
      element: "div",
      description:
        '`role="menu"`, `tabindex="-1"`, named by its trigger (or your own `aria-label` / `aria-labelledby`). Owns the keyboard handling of its items.',
    },
    {
      name: "Menu.Arrow",
      part: "arrow",
      element: "div",
      description: "Decorative (`aria-hidden`) arrow pointing at the trigger.",
    },
    {
      name: "Menu.Item",
      part: "item",
      element: "div",
      description:
        '`role="menuitem"`. Closes the menu when activated (`closeOnSelect`). With `href` it renders a link (`<a>`) that navigates and then closes the menu.',
    },
    {
      name: "Menu.CheckboxItem",
      part: "checkbox-item",
      element: "div",
      description:
        '`role="menuitemcheckbox"` with `aria-checked`. Toggles without closing the menu; Space never closes it.',
    },
    {
      name: "Menu.RadioGroup",
      part: "radio-group",
      element: "div",
      description: '`role="group"` holding the value of the radio items inside it.',
    },
    {
      name: "Menu.RadioItem",
      part: "radio-item",
      element: "div",
      description:
        '`role="menuitemradio"` with `aria-checked`. Selects its `value` without closing the menu.',
    },
    {
      name: "Menu.ItemIndicator",
      part: "item-indicator",
      element: "span",
      description:
        "Decorative (`aria-hidden`) mark of a checkbox or radio item; rendered only while the item is checked unless `keepMounted`.",
    },
    {
      name: "Menu.ItemText",
      part: "item-text",
      element: "span",
      description: "The item's label text.",
    },
    {
      name: "Menu.Group",
      part: "group",
      element: "div",
      description: '`role="group"`, named by its `Menu.GroupLabel` while one is rendered.',
    },
    {
      name: "Menu.GroupLabel",
      part: "group-label",
      element: "div",
      description: 'Names the group (`role="none"`: not an item, skipped by navigation).',
    },
    {
      name: "Menu.Separator",
      part: "separator",
      element: "div",
      description: "A separator between items; not navigable.",
    },
    {
      name: "Menu.Submenu",
      part: "submenu",
      element: "none",
      description:
        "Renders no element: a nested menu level with its own open state, positioning and layer. Holds a `SubmenuTrigger` and its own `Portal` / `Positioner` / `Content`.",
    },
    {
      name: "Menu.SubmenuTrigger",
      part: "submenu-trigger",
      element: "div",
      description:
        '`role="menuitem"` with `aria-haspopup="menu"` and `aria-expanded`. Opens its submenu with the expand key, a click, or hover after `submenuOpenDelay`.',
    },
  ],
  props: {
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Initial open state." },
    onOpenChange: {
      type: "(open: boolean, details: MenuChangeDetails) => void",
      description:
        "Every change request, with `details.reason` (`trigger`, `trigger-key`, `api` to open; `trigger`, `item-select`, `escape-key`, `tab-key`, `outside-press`, `outside-focus`, `window-blur`, `parent-dismissed`, `api` to close) and `details.cancel()`.",
    },
    modal: {
      type: "boolean",
      default: "true",
      description:
        "Modal (root only): everything outside is inert, scroll is locked, and an outside press only closes the menu. `false` leaves the page usable.",
    },
    loop: {
      type: "boolean",
      default: "false",
      description: "Arrow navigation wraps from the last item to the first and back.",
    },
    focusableWhenDisabled: {
      type: "boolean",
      default: "false",
      description: "Disabled items stay reachable by navigation (they still cannot be activated).",
    },
    typeaheadTimeout: {
      type: "number",
      default: "1000",
      description: "Milliseconds of idle time that end a typeahead search.",
    },
    positioning: {
      type: "PositioningProps",
      default: "dropdown preset (submenu preset for a submenu)",
      description:
        "Side, align, offsets, flip, shift, size, arrow and mode (`manual` for CSS anchor positioning).",
    },
    submenuOpenDelay: {
      type: "number",
      default: "100",
      description: "Milliseconds the pointer rests on a submenu trigger before it opens.",
    },
    submenuGraceTimeout: {
      type: "number",
      default: "300",
      description:
        "Milliseconds the pointer may rest inside the grace area towards an open submenu before it closes.",
    },
    keepMounted: {
      type: "boolean",
      default: "false",
      description: "Positioner and content stay mounted (hidden) while closed.",
    },
    actionsRef: {
      type: "Ref<{ open(): void; close(): void }>",
      description: "Programmatic open and close.",
    },
    value: {
      type: "string",
      description:
        "On items: the key (default: generated). On `Menu.RadioItem` (required): the value it selects; on `Menu.RadioGroup`: the controlled selected value.",
    },
    textValue: {
      type: "string",
      description: "On items: the typeahead text (default: the text content).",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "On the trigger, items, the radio group and submenu triggers.",
    },
    closeOnSelect: {
      type: "boolean",
      default: "true (`false` for checkbox and radio items)",
      description: "On items: activating it closes the whole menu tree.",
    },
    onSelect: {
      type: "(details: MenuSelectDetails) => void",
      description:
        "On items: runs on activation with the item's `key`, `kind`, `modality` and `details.cancel()` to keep the menu open.",
    },
    href: {
      type: "string",
      description:
        "On `Menu.Item`: renders a link; with `target`, `rel`, `download` and `routerOptions`.",
    },
    checked: {
      type: "boolean",
      description:
        "On `Menu.CheckboxItem`: controlled checked state (`defaultChecked`, `onCheckedChange`).",
    },
    onValueChange: {
      type: "(value: string | null) => void",
      description: "On `Menu.RadioGroup`: the selected value changed (`defaultValue` for initial).",
    },
    orientation: {
      type: '"horizontal" | "vertical"',
      description: "On `Menu.Separator`: overrides the orientation (default: across the menu).",
    },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    trigger: {
      ...base("trigger"),
      "data-state": '"open" or "closed".',
      ...button,
      "data-disabled": "While disabled.",
    },
    positioner: {
      ...base("positioner"),
      "data-state": '"open" or "closed".',
      ...placement,
      "data-align": "The alignment on that side (`start`, `center`, `end`).",
    },
    content: {
      ...base("content"),
      "data-state": '"open" or "closed" (while it exits).',
      "data-orientation": '"vertical" or "horizontal".',
      "data-modal": "While the root menu is modal.",
      "data-close-reason":
        "The last close reason in kebab case (`escape-key`), until the next open.",
      "data-nested": "Inside another open layer.",
      "data-has-nested": "A layer (a submenu) is open inside it.",
      ...placement,
      "data-align": "The alignment on that side (`start`, `center`, `end`).",
    },
    arrow: {
      ...base("arrow"),
      "data-side": placement["data-side"],
      "data-anchor-hidden": placement["data-anchor-hidden"],
    },
    item: item("item"),
    "checkbox-item": { ...item("checkbox-item"), ...checkable },
    "radio-group": { ...base("radio-group"), "data-disabled": "While disabled." },
    "radio-item": { ...item("radio-item"), ...checkable },
    "item-indicator": { ...base("item-indicator"), ...checkable },
    "item-text": base("item-text"),
    group: base("group"),
    "group-label": base("group-label"),
    separator: { ...base("separator"), "data-orientation": '"horizontal" or "vertical".' },
    "submenu-trigger": {
      ...item("submenu-trigger"),
      "data-state": '"open" or "closed" (the submenu).',
    },
  },
  keyboard: [
    ["Enter / Space / click on the trigger", "Opens the menu; focus goes to the first item."],
    ["ArrowDown on the trigger", "Opens the menu on the first item."],
    ["ArrowUp on the trigger", "Opens the menu on the last item."],
    ["ArrowDown / ArrowUp", "Moves to the next / previous item (`loop` wraps)."],
    ["Home / End", "Moves to the first / last item."],
    ["Printable characters", "Typeahead: moves to the item whose text starts with them."],
    ["Enter / Space on an item", "Activates it; checkbox and radio items stay open on Space."],
    [
      "ArrowRight (ArrowLeft in RTL) on a submenu trigger",
      "Opens the submenu and focuses its first item.",
    ],
    [
      "ArrowLeft (ArrowRight in RTL) in a submenu",
      "Closes the submenu; focus returns to its trigger.",
    ],
    ["Escape", "Closes the topmost level."],
    ["Tab / Shift+Tab", "Closes the whole menu; focus continues from the trigger."],
  ],
  states: {
    closed: "Nothing is mounted (unless `keepMounted`); no layer, lock or inert.",
    opening:
      "A submenu waiting for its hover delay (`submenuOpenDelay`); still closed for `aria-expanded` and `data-state`.",
    open: "A layer of kind `menu`: placed against the trigger, focus moved in after the first placement.",
  },
  contract: {
    actions: {
      open: ["pointer", "touch", "keyboard", "virtual"],
      openWithArrowUp: ["keyboard"],
      close: ["pointer", "touch", "keyboard", "virtual"],
      choose: ["pointer", "touch", "keyboard", "virtual"],
      toggle: ["pointer", "touch", "keyboard", "virtual"],
      openSubmenu: ["pointer", "keyboard", "virtual"],
      closeSubmenu: ["keyboard"],
      arrowDown: ["keyboard"],
      pressEscape: ["keyboard"],
      pressOutside: ["pointer", "virtual"],
      tabOut: ["keyboard"],
      typeahead: ["keyboard"],
    },
    queries: [
      "side",
      "align",
      "isAnchorHidden",
      "isPlaced",
      "isOpen",
      "items",
      "highlighted",
      "focusedItem",
      "isChecked",
      "isDisabled",
      "openPath",
      "closeReason",
    ],
    traits: ["layer", "restores-focus", "presence", "anchored", "modal"],
  },
} as const satisfies ComponentMeta
