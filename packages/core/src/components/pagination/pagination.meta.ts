// Pagination's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked
// against the code in pagination.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"pagination"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

const control = {
  "data-disabled": "Present when the control is unavailable or the pagination is disabled.",
  "data-focus": "Present while focused.",
  "data-focus-visible": "Present while focused by keyboard or assistive technology.",
  "data-hover": "Present while hovered by a mouse or pen.",
  "data-pressed": "Present while pressed.",
}

export const paginationMeta = {
  scope: "pagination",
  name: "Pagination",
  stateless: false,
  parts: [
    {
      name: "Pagination.Root",
      part: "root",
      element: "nav",
      description:
        'A navigation landmark named "Pagination" unless you pass `aria-label`/`aria-labelledby`; owns the page and the page size.',
    },
    { name: "Pagination.List", part: "list", element: "ul", description: "The list of controls." },
    {
      name: "Pagination.Item",
      part: "item",
      element: "li",
      description: "Holds one page, ellipsis or trigger.",
    },
    {
      name: "Pagination.Page",
      part: "page",
      element: "button",
      description:
        'A page control (`<a>` with `getPageHref`); the current one has `aria-current="page"` and stays enabled.',
    },
    {
      name: "Pagination.Ellipsis",
      part: "ellipsis",
      element: "span",
      description: "Stands for two or more hidden pages; `aria-hidden`, no role, never focusable.",
    },
    {
      name: "Pagination.First / Previous / Next / Last",
      part: "first | previous | next | last",
      element: "button",
      description:
        "Triggers; unavailable at the ends (`aria-disabled`, still focusable), named from messages when icon-only.",
    },
  ],
  props: {
    totalPages: {
      type: "number",
      description: "The number of pages (at least 1). Or pass `count` and `pageSize`.",
    },
    count: {
      type: "number",
      description: "The number of items; the total is `ceil(count / pageSize)`.",
    },
    page: { type: "number", description: "Controlled current page (1-based)." },
    defaultPage: { type: "number", default: "1", description: "Uncontrolled initial page." },
    onPageChange: {
      type: "(page, { reason, cancel }) => void",
      description:
        "Every change, once; `reason` is SET_PAGE, PREV, NEXT, FIRST, LAST, SET_PAGE_SIZE or COUNT.CHANGE.",
    },
    pageSize: { type: "number", description: "Controlled page size (with `count` only)." },
    defaultPageSize: { type: "number", default: "10", description: "Uncontrolled page size." },
    onPageSizeChange: {
      type: "(pageSize, details) => void",
      description: "Page size changes; the page moves so its first item stays visible.",
    },
    siblingCount: {
      type: "number",
      default: "1",
      description: "Pages shown beside the current one.",
    },
    boundaryCount: { type: "number", default: "1", description: "Pages always shown at each end." },
    getPageHref: {
      type: "(page, pageSize) => string",
      description: "Renders links instead of buttons; same-tab activations also change the page.",
    },
    disabled: {
      type: "boolean",
      default: "false",
      description: "Every control ignores activation and shows no hover (disable while loading).",
    },
    focusableWhenDisabled: {
      type: "boolean",
      default: "true",
      description:
        "Unavailable controls keep focus (`aria-disabled`); `false` uses native disabled.",
    },
    messages: {
      type: "Partial<PaginationMessages>",
      description: "`label`, `page(n)`, `first`, `previous`, `next`, `last`.",
    },
    "*.render": {
      type: "ReactElement | (props, state) => ReactNode",
      description:
        "On every part; Root's state is `page`, `pageSize`, `totalPages`, `pages`, `range`.",
    },
  },
  dataAttributes: {
    root: { ...base("root"), "data-disabled": "Present while the pagination is disabled." },
    list: base("list"),
    item: { ...base("item"), "data-type": '"page", "ellipsis" or "trigger".' },
    page: {
      ...base("page"),
      "data-value": "The page number.",
      "data-current": 'Present on the current page (with `aria-current="page"`).',
      ...control,
    },
    ellipsis: { ...base("ellipsis"), "data-position": '"start" or "end".' },
    next: {
      ...base("next"),
      "data-direction": '"first", "previous", "next" or "last" (part named the same).',
      ...control,
    },
  },
  keyboard: [
    ["Tab / Shift+Tab", "Next / previous control (not a composite: no arrow keys)."],
    ["Enter", "Activates the focused page, trigger or link."],
    ["Space", "Activates the focused button."],
  ],
  states: { idle: "The only state: page changes are guarded self-loops." },
  contract: {
    actions: {
      goTo: ["pointer", "keyboard", "virtual"],
      next: ["pointer", "keyboard", "virtual"],
      previous: ["pointer", "keyboard", "virtual"],
      first: ["pointer", "keyboard", "virtual"],
      last: ["pointer", "keyboard", "virtual"],
    },
    queries: ["currentPage", "visiblePages", "isDisabled", "href", "isFocused"],
    traits: [],
  },
} as const satisfies ComponentMeta
