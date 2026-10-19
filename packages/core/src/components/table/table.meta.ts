// Table's API facts for the generated docs (scripts/docs-gen.ts). Data only; checked against the
// code in table.meta.test.ts.

import type { ComponentMeta } from "../meta"

const base = (part: string) => ({
  "data-scope": '"table"',
  "data-part": `"${part}"`,
  "data-instance": "The instance id.",
})

export const tableMeta = {
  scope: "table",
  name: "Table",
  stateless: false,
  parts: [
    {
      name: "Table.Root",
      part: "root",
      element: "div",
      description:
        "The scroll container and the state. A named `group` and tab stop only while it overflows with nothing focusable inside (measured on the client).",
    },
    {
      name: "Table.Table",
      part: "table",
      element: "table",
      description:
        "The native table, the Root's only child. Named by the Caption, else `aria-label`.",
    },
    { name: "Table.Caption", part: "caption", element: "caption", description: "Names the table." },
    { name: "Table.Head", part: "head", element: "thead", description: "The header rows." },
    { name: "Table.Body", part: "body", element: "tbody", description: "The data rows." },
    { name: "Table.Foot", part: "foot", element: "tfoot", description: "The footer rows." },
    { name: "Table.Row", part: "row", element: "tr", description: "A row; no handlers." },
    {
      name: "Table.ColumnHeader",
      part: "column-header",
      element: "th",
      description:
        '`scope="col"` (`colgroup` when spanning). With `sortable` and an `id`, holds one SortTrigger and carries `aria-sort` while sorted.',
    },
    {
      name: "Table.RowHeader",
      part: "row-header",
      element: "th",
      description: '`scope="row"` (`rowgroup` when spanning).',
    },
    { name: "Table.Cell", part: "cell", element: "td", description: "A data cell; no handlers." },
    {
      name: "Table.SortTrigger",
      part: "sort-trigger",
      element: "button",
      description:
        "The column's sort button, named by its content (the column's text). A press proposes the next sort.",
    },
    {
      name: "Table.SortIndicator",
      part: "sort-indicator",
      element: "span",
      description: "`aria-hidden`; the direction for the theme to draw.",
    },
    {
      name: "Table.Empty",
      part: "empty",
      element: "tr",
      description:
        "A row with one cell spanning every column (`colSpan`, else counted after mount).",
    },
  ],
  props: {
    sort: {
      type: "{ column, direction } | null",
      description: "Controlled sort. The Table never reorders rows: sort the data (`sortItems`).",
    },
    defaultSort: {
      type: "{ column, direction } | null",
      default: "null",
      description: "Uncontrolled initial sort.",
    },
    onSortChange: {
      type: "(sort, details) => void",
      description: "A press proposes the next sort; `details.event.column`, `details.cancel()`.",
    },
    allowUnsorted: {
      type: "boolean",
      default: "false",
      description:
        "A press on the sorted column at the opposite of its first direction clears the sort.",
    },
    stickyFirstColumn: {
      type: "boolean",
      default: "false",
      description:
        "`data-sticky-first-column` on the Root (the theme pins the first cell of each row).",
    },
    "Table.loading": {
      type: "boolean",
      default: "false",
      description: '`aria-busy="true"` and `data-loading` on the table.',
    },
    "ColumnHeader.firstDirection": {
      type: '"ascending" | "descending"',
      default: '"ascending"',
      description: "On a sortable column: the direction of its first press.",
    },
    messages: {
      type: "Partial<TableMessages>",
      description: "Overrides the strings (also through the provider).",
    },
    locale: {
      type: "string",
      description: "Default: the provider's locale (the announcement's language).",
    },
    render: {
      type: "element | (props, state) => element",
      description: "Substitutes the rendered element without changing behaviour.",
    },
  },
  dataAttributes: {
    root: {
      ...base("root"),
      "data-overflow-x": "The table overflows horizontally (measured).",
      "data-overflow-y": "The table overflows vertically (measured).",
      "data-overflow-x-start": "Content is hidden before the visible part (reading order).",
      "data-overflow-x-end": "Content is hidden after the visible part (reading order).",
      "data-sticky-first-column": "With `stickyFirstColumn`.",
      "data-focus-visible": "The scroll stop has keyboard focus.",
    },
    table: {
      ...base("table"),
      "data-loading": "With `loading`.",
      "data-sorted": "While sorted.",
      "data-empty": "While an Empty row is mounted.",
    },
    caption: base("caption"),
    head: base("head"),
    body: base("body"),
    foot: base("foot"),
    row: base("row"),
    "column-header": {
      ...base("column-header"),
      "data-sortable": "With `sortable`.",
      "data-sort": '"ascending" or "descending" while sorted by this column.',
    },
    "row-header": base("row-header"),
    cell: base("cell"),
    "sort-trigger": {
      ...base("sort-trigger"),
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
      "data-direction": '"ascending", "descending" or "none".',
    },
    "sort-indicator": {
      ...base("sort-indicator"),
      "data-direction": '"ascending", "descending" or "none".',
    },
    empty: base("empty"),
  },
  keyboard: [
    [
      "Tab",
      "Reaches each sort button; reaches the scroll container only when it overflows and holds no control.",
    ],
    ["Enter, Space", "On a sort button: sorts by that column (again: the other direction)."],
    ["Arrow keys", "On the scroll container: scroll the table."],
  ],
  states: { idle: "The only state; the sort is a value, the scroll stop is measured." },
  contract: {
    actions: {
      sortBy: ["pointer", "keyboard", "touch", "virtual"],
      focusScroller: ["keyboard"],
    },
    queries: ["name", "columns", "rows", "sort", "isScrollStop", "isEmpty", "isLoading"],
    traits: [],
  },
} as const satisfies ComponentMeta
