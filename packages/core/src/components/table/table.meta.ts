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
      name: "Table.Frame",
      part: "frame",
      element: "div",
      description:
        "Optional box around Header, Root and Footer. `expanded` shows it full page: a modal dialog named by the Caption; Escape returns.",
    },
    {
      name: "Table.Header",
      part: "header",
      element: "div",
      description: "Free content above the table (search field, actions, ExpandTrigger).",
    },
    {
      name: "Table.Title",
      part: "title",
      element: "div",
      description:
        "Inside the Frame: names the table and the full-page view when there is no Caption (`aria-labelledby`).",
    },
    {
      name: "Table.Footer",
      part: "footer",
      element: "div",
      description: "Free content below the table (pagination, row range).",
    },
    {
      name: "Table.ExpandTrigger",
      part: "expand-trigger",
      element: "button",
      description:
        'A toggle button (`aria-pressed`) for the full-page view; named "Full page" unless it has text. `expanded` / `collapsed` nodes, else provider icons.',
    },
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
    {
      name: "Table.Row",
      part: "row",
      element: "tr",
      description: "A row; no handlers. With an `id` it can expand (RowTrigger, RowDetails).",
    },
    {
      name: "Table.RowTrigger",
      part: "row-trigger",
      element: "button",
      description:
        'Opens and closes the row\'s details (`aria-expanded`, `aria-controls`); named "Show details {row}" unless labelled.',
    },
    {
      name: "Table.RowDetails",
      part: "row-details",
      element: "tr",
      description:
        "Right after its Row (`rowId`): one cell spanning every column, any content; `hidden` while collapsed.",
    },
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
      name: "Table.Filter",
      part: "filter-content",
      element: "div",
      description:
        'A Popover scoped to the table, inside a ColumnHeader with an `id`; `active` marks the column filtered. Holds FilterTrigger and FilterContent (a dialog named "Filter {column}").',
    },
    {
      name: "Table.FilterTrigger",
      part: "filter-trigger",
      element: "button",
      description:
        'Opens the filter (`aria-haspopup="dialog"`, `aria-expanded`); named "Filter {column}"; described "Filtered" while active. The header stays named by its text.',
    },
    {
      name: "Table.FilterIndicator",
      part: "filter-indicator",
      element: "span",
      description:
        "`aria-hidden`; `active` node while filtered, else `children`, else provider icons.",
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
    pinnedColumns: {
      type: "{ start: string[], end: string[] }",
      description:
        "Column ids pinned at the inline start and end; their cells stick there (measured offsets).",
    },
    defaultPinnedColumns: {
      type: "{ start: string[], end: string[] }",
      default: "{ start: [], end: [] }",
      description: "Uncontrolled initial pinned columns.",
    },
    onPinnedColumnsChange: {
      type: "(pinned, details) => void",
      description: "Called when the pinned columns change.",
    },
    expandedRows: {
      type: "readonly string[]",
      description: "Controlled ids of the rows whose details are open.",
    },
    defaultExpandedRows: {
      type: "readonly string[]",
      default: "[]",
      description: "Uncontrolled initial open rows.",
    },
    onExpandedRowsChange: {
      type: "(rows, details) => void",
      description: "A RowTrigger proposes the new list.",
    },
    multiple: {
      type: "boolean",
      default: "true",
      description: "Several rows open at once; `false`: opening one closes the others.",
    },
    rowCount: {
      type: "number",
      description:
        'The rows shown (after filters); announced politely when it changes ("12 rows").',
    },
    rowRange: {
      type: "{ from, to, total }",
      description: 'With pagination: announced instead of the count ("Rows 11 to 20 of 87").',
    },
    "Frame.expanded": { type: "boolean", description: "Controlled full-page view." },
    "Frame.defaultExpanded": {
      type: "boolean",
      default: "false",
      description: "Uncontrolled initial full-page view.",
    },
    "Frame.onExpandedChange": {
      type: "(expanded, details) => void",
      description: "The ExpandTrigger or Escape proposes the change.",
    },
    "Filter.active": {
      type: "boolean",
      default: "false",
      description:
        'The column is filtered: the trigger carries `data-active` and the description "Filtered".',
    },
    "SortIndicator.ascending": {
      type: "ReactNode",
      description: "Rendered while sorted ascending.",
    },
    "SortIndicator.descending": {
      type: "ReactNode",
      description: "Rendered while sorted descending.",
    },
    "SortIndicator.none": { type: "ReactNode", description: "Rendered while not sorted." },
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
    row: {
      ...base("row"),
      "data-row": "The row id (`id`).",
      "data-expanded": "While its details are open.",
    },
    "row-trigger": {
      ...base("row-trigger"),
      "data-expanded": "While the row's details are open.",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    "row-details": {
      ...base("row-details"),
      "data-row": "The row id it belongs to.",
      "data-expanded": "While open.",
    },
    "column-header": {
      ...base("column-header"),
      "data-column": "The column id (`id`).",
      "data-pinned": '"start" or "end" while pinned.',
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
    frame: { ...base("frame"), "data-expanded": "While full page." },
    header: { ...base("header"), "data-expanded": "While full page." },
    title: { ...base("title"), "data-expanded": "While full page." },
    footer: { ...base("footer"), "data-expanded": "While full page." },
    "expand-trigger": {
      ...base("expand-trigger"),
      "data-expanded": "While full page.",
      "data-focus": "Focused.",
      "data-focus-visible": "Keyboard focus.",
    },
    "filter-trigger": {
      "data-part": '"filter-trigger"',
      "data-column": "The column id.",
      "data-active": "While the column is filtered.",
    },
    "filter-indicator": {
      ...base("filter-indicator"),
      "data-active": "While the column is filtered.",
    },
  },
  keyboard: [
    [
      "Tab",
      "Reaches each sort button; reaches the scroll container only when it overflows and holds no control.",
    ],
    ["Enter, Space", "On a sort button: sorts by that column (again: the other direction)."],
    ["Arrow keys", "On the scroll container: scroll the table."],
  ],
  states: {
    idle: "The sort and the pinned columns are values; the scroll stop is measured.",
    counting: "`rowCount` or `rowRange` changed: announced after a 400 ms quiet period.",
  },
  contract: {
    actions: {
      sortBy: ["pointer", "keyboard", "touch", "virtual"],
      openFilter: ["pointer", "keyboard", "virtual"],
      closeFilter: ["keyboard"],
      setExpanded: ["pointer", "keyboard", "virtual"],
      toggleRow: ["pointer", "keyboard", "virtual"],
      focusScroller: ["keyboard"],
    },
    queries: [
      "name",
      "columns",
      "rows",
      "sort",
      "pinned",
      "isExpanded",
      "expandedRows",
      "isFilterActive",
      "isScrollStop",
      "isEmpty",
      "isLoading",
    ],
    traits: [],
  },
} as const satisfies ComponentMeta
