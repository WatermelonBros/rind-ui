// The Context Menu's API facts for the generated docs (scripts/docs-gen.ts). Data only;
// checked against the code in context-menu.meta.test.ts. The menu itself is the Menu's.

import type { ComponentMeta } from "../meta"

export const contextMenuMeta = {
  scope: "context-menu",
  name: "Context Menu",
  stateless: false,
  parts: [
    {
      name: "ContextMenu.Root",
      part: "root",
      element: "none",
      description:
        "Renders no element: a Menu root whose opening gestures happen on a region. Owns the open state, the anchor point and the long press settings. `actionsRef` exposes `openAt()` and `close()`.",
    },
    {
      name: "ContextMenu.Trigger",
      part: "trigger",
      element: "div",
      description:
        "The region: a right click, Control+click on macOS, Shift+F10 or the context-menu key, or a long press with touch or pen opens the menu. Not a button: no popup ARIA, your `tabindex` is left alone.",
    },
    {
      name: "The Menu parts",
      part: "content",
      element: "div",
      description:
        "`Menu.Portal`, `Menu.Positioner`, `Menu.Content`, items, groups, separators and submenus work inside `ContextMenu.Root` as they do in a Menu. The content has no trigger to name it: pass `aria-label` or `aria-labelledby`.",
    },
  ],
  props: {
    open: { type: "boolean", description: "Controlled open state." },
    defaultOpen: { type: "boolean", default: "false", description: "Initial open state." },
    onOpenChange: {
      type: "(open: boolean, details: ContextMenuChangeDetails) => void",
      description:
        "Every change request. `details.reason` is `context-menu`, `context-menu-key`, `long-press` or `api` to open; the Menu's reasons plus `scroll` (a non-modal menu and a page scroll) to close. `details.point` and `details.target` say where and on what the gesture happened; `details.nativeEvent` is the event; `details.cancel()` keeps it as it was.",
    },
    onAnchorChange: {
      type: "(details: MenuAnchorDetails) => void",
      description:
        "A second gesture in the region moved the open menu: the new `point` and `target`.",
    },
    modal: {
      type: "boolean",
      default: "true",
      description:
        "Everything outside is inert and scroll is locked. `false` leaves the page usable: a scroll closes the menu and a second right click in the region moves it.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "The browser's own menu shows instead; the region ignores every gesture.",
    },
    longPress: {
      type: "boolean",
      default: "true",
      description: "A touch or pen held on the region opens the menu.",
    },
    longPressDelay: {
      type: "number",
      default: "500",
      description: "Milliseconds a touch or pen is held before the menu opens.",
    },
    keepMounted: {
      type: "boolean",
      default: "false",
      description: "Positioner and content stay mounted (hidden) while closed.",
    },
    messages: {
      type: "{ longPressHint: string }",
      description:
        "The hint a focusable region is described by (`Long press for more options`); override per instance or on the provider.",
    },
    actionsRef: {
      type: "Ref<{ openAt(point, target?): void; close(): void }>",
      description: "Programmatic open at viewport coordinates, and close.",
    },
    "*.render": {
      type: "RenderProp",
      description: "On the region: substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    trigger: {
      "data-scope": '"menu"',
      "data-part": '"trigger"',
      "data-instance": "The id of the menu it belongs to.",
      "data-context-menu": "Always: marks the trigger as a region, not a button.",
      "data-state": '"open" or "closed".',
      "data-disabled": "While disabled.",
    },
    content: {
      "data-context-menu": "Always on a context menu's content; the Menu's attributes also apply.",
    },
  },
  keyboard: [
    ["Shift+F10 / ContextMenu key on the region", "Opens the menu on the first item."],
    ["Control+click (macOS)", "Opens the menu where the pointer is."],
    ["Escape", "Closes the menu; focus returns to the element that had it."],
    ["Other keys", "As in the Menu: arrows, Home / End, typeahead, Enter / Space."],
  ],
  states: {
    closed: "Nothing is mounted (unless `keepMounted`); no layer, lock or inert.",
    opening: "A submenu waiting for its hover delay; still closed for `data-state` on the region.",
    open: "A layer of kind `menu` placed at the anchor point, focus moved in after the first placement.",
  },
  contract: {
    actions: {
      open: ["pointer", "touch", "keyboard", "virtual"],
      openWithArrowUp: ["keyboard"],
      close: ["keyboard"],
      choose: ["pointer", "touch", "keyboard", "virtual"],
      toggle: ["pointer", "touch", "keyboard", "virtual"],
      openSubmenu: ["pointer", "keyboard", "virtual"],
      closeSubmenu: ["keyboard"],
      arrowDown: ["keyboard"],
      pressEscape: ["keyboard"],
      pressOutside: ["pointer", "virtual"],
      tabOut: ["keyboard"],
      typeahead: ["keyboard"],
      openAt: ["pointer", "touch", "keyboard", "virtual"],
      reanchor: ["pointer", "virtual"],
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
      "anchorPoint",
    ],
    traits: ["layer", "restores-focus", "presence", "anchored", "modal"],
  },
} as const satisfies ComponentMeta
