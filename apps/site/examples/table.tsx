"use client"

import {
  facetValues,
  filterItems,
  paginateItems,
  type SortDescriptor,
  sortItems,
} from "@rind-ui/core"
import { CheckboxGroup, Pagination, Table, TextField, VisuallyHidden } from "@rind-ui/react"
import { useState } from "react"
import type { States, Variants } from "./types"

/** One state: the sort is a value, the scroll stop is measured. */
export const states: States = { table: { idle: "Basic" } }

const PROPS = [
  { prop: "value", type: "string", fallback: "—", note: "What a press copies." },
  { prop: "disabled", type: "boolean", fallback: "false", note: "No presses, no copy." },
  { prop: "copyFeedbackDuration", type: "number", fallback: "2000", note: "Milliseconds." },
]

export function Basic() {
  return (
    <Table.Root>
      <Table.Table>
        <Table.Caption>Clipboard props</Table.Caption>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader>Prop</Table.ColumnHeader>
            <Table.ColumnHeader>Type</Table.ColumnHeader>
            <Table.ColumnHeader>Default</Table.ColumnHeader>
            <Table.ColumnHeader>Notes</Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {PROPS.map((p) => (
            <Table.Row key={p.prop}>
              <Table.RowHeader>
                <code>{p.prop}</code>
              </Table.RowHeader>
              <Table.Cell>
                <code>{p.type}</code>
              </Table.Cell>
              <Table.Cell>{p.fallback}</Table.Cell>
              <Table.Cell>{p.note}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Table>
    </Table.Root>
  )
}

const FEATURES = [
  { feature: "Seats", free: "1", pro: "5", team: "Unlimited" },
  { feature: "Storage", free: "1 GB", pro: "100 GB", team: "1 TB" },
  { feature: "Single sign-on", free: "—", pro: "—", team: "Yes" },
  { feature: "Audit log", free: "—", pro: "30 days", team: "1 year" },
  { feature: "Support", free: "Community", pro: "Email", team: "Priority" },
]

export function Pricing() {
  return (
    <Table.Root stickyFirstColumn style={{ maxInlineSize: 420 }}>
      <Table.Table>
        <Table.Caption>Plan comparison</Table.Caption>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader rowSpan={2}>Feature</Table.ColumnHeader>
            <Table.ColumnHeader colSpan={3}>Plans</Table.ColumnHeader>
          </Table.Row>
          <Table.Row>
            <Table.ColumnHeader>Free</Table.ColumnHeader>
            <Table.ColumnHeader>Pro</Table.ColumnHeader>
            <Table.ColumnHeader>Team</Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {FEATURES.map((f) => (
            <Table.Row key={f.feature}>
              <Table.RowHeader>{f.feature}</Table.RowHeader>
              <Table.Cell>{f.free}</Table.Cell>
              <Table.Cell>{f.pro}</Table.Cell>
              <Table.Cell>{f.team}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Table>
    </Table.Root>
  )
}

const RELEASES = [
  { component: "Clipboard", version: "0.5.0", size: 1.9, tests: 333 },
  { component: "Table", version: "0.5.0", size: 4.2, tests: 210 },
  { component: "Rating", version: "0.4.0", size: 3.1, tests: 290 },
  { component: "Splitter", version: "0.4.0", size: 5.6, tests: 412 },
  { component: "Code Block", version: "0.3.2", size: 6.8, tests: 149 },
  { component: "Tree View", version: "0.4.0", size: 9.4, tests: 618 },
]
const COLUMNS = [
  { id: "component", label: "Component", first: "ascending" },
  { id: "version", label: "Version", first: "descending" },
  { id: "size", label: "Size (kB)", first: "ascending" },
  { id: "tests", label: "Tests", first: "descending" },
] as const

export function Sortable() {
  const [sort, setSort] = useState<SortDescriptor | null>(null)
  const rows = sortItems(RELEASES, sort, (r, c) => r[c as keyof (typeof RELEASES)[number]])
  return (
    <Table.Root sort={sort} onSortChange={setSort} allowUnsorted>
      <Table.Table>
        <Table.Caption>Components</Table.Caption>
        <Table.Head>
          <Table.Row>
            {COLUMNS.map((c) => (
              <Table.ColumnHeader key={c.id} sortable id={c.id} firstDirection={c.first}>
                <Table.SortTrigger>
                  {c.label}
                  <Table.SortIndicator />
                </Table.SortTrigger>
              </Table.ColumnHeader>
            ))}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.map((r) => (
            <Table.Row key={r.component}>
              <Table.RowHeader>{r.component}</Table.RowHeader>
              <Table.Cell>{r.version}</Table.Cell>
              <Table.Cell>{r.size.toFixed(1)}</Table.Cell>
              <Table.Cell>{r.tests}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Table>
    </Table.Root>
  )
}

export function Empty() {
  return (
    <Table.Root>
      <Table.Table>
        <Table.Caption>Search results</Table.Caption>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader sortable id="name">
              <Table.SortTrigger>
                Name
                <Table.SortIndicator />
              </Table.SortTrigger>
            </Table.ColumnHeader>
            <Table.ColumnHeader>Type</Table.ColumnHeader>
            <Table.ColumnHeader>Updated</Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Empty colSpan={3}>No results for “carousel”.</Table.Empty>
        </Table.Body>
      </Table.Table>
    </Table.Root>
  )
}

export function Loading() {
  return (
    <Table.Root>
      <Table.Table loading>
        <Table.Caption>Invoices</Table.Caption>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader>Number</Table.ColumnHeader>
            <Table.ColumnHeader>Amount</Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row>
            <Table.RowHeader>INV-0042</Table.RowHeader>
            <Table.Cell>€ 120.00</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Table>
    </Table.Root>
  )
}

export function Rtl() {
  return (
    <Table.Root dir="rtl" stickyFirstColumn style={{ maxInlineSize: 360 }}>
      <Table.Table>
        <Table.Caption>جدول الخطط</Table.Caption>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader>الميزة</Table.ColumnHeader>
            <Table.ColumnHeader>مجاني</Table.ColumnHeader>
            <Table.ColumnHeader>احترافي</Table.ColumnHeader>
            <Table.ColumnHeader>فريق</Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row>
            <Table.RowHeader>المقاعد</Table.RowHeader>
            <Table.Cell>1</Table.Cell>
            <Table.Cell>5</Table.Cell>
            <Table.Cell>غير محدود</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.RowHeader>التخزين</Table.RowHeader>
            <Table.Cell>1 GB</Table.Cell>
            <Table.Cell>100 GB</Table.Cell>
            <Table.Cell>1 TB</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Table>
    </Table.Root>
  )
}

export const variants: Variants = {
  DataTable: {
    title: "Data table",
    description:
      "Everything together: a title, a search field and a full-page toggle in the Header, a Status filter in a popover, sorting with custom icons, expandable rows with a card, pinned columns at both edges, pagination in the Footer, and the row range announced.",
  },
  ExpandableRows: {
    title: "Expandable rows",
    description:
      "`Table.RowTrigger` opens a row's `Table.RowDetails`: any content, here another table. `multiple={false}` keeps one open at a time.",
  },
  Basic: {
    title: "API table",
    description: "A native table: Caption names it, rows have row headers, text stays selectable.",
  },
  Pricing: {
    title: "Grouped headers",
    description:
      "`colSpan`/`rowSpan` with `scope=colgroup`; `stickyFirstColumn` keeps features in view while it scrolls.",
  },
  Sortable: {
    title: "Sortable",
    description:
      "SortTriggers propose the sort; `sortItems` orders the rows. `allowUnsorted` adds a third press.",
  },
  Empty: {
    title: "Empty",
    description: "`Table.Empty` spans every column; sort buttons stay reachable.",
  },
  Loading: { title: "Loading", description: '`loading`: `aria-busy="true"` on the table.' },
  Rtl: {
    title: "Right to left",
    description: "The sticky column and the scroll edges follow the direction.",
  },
}

// ── The data table: every Table feature together ────────────────────────────────────────

/** Phosphor (regular) icons, inline: any node works in their place. */
function Ph({ d }: { readonly d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" width="16" height="16" fill="currentColor">
      <path d={d} />
    </svg>
  )
}
const ICON = {
  up: "M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z",
  down: "M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z",
  both: "M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z",
  funnel:
    "M230.6,49.53A15.81,15.81,0,0,0,216,40H40A16,16,0,0,0,28.19,66.76l.08.09L96,139.17V216a16,16,0,0,0,24.87,13.32l32-21.34A16,16,0,0,0,160,194.66V139.17l67.74-72.32.08-.09A15.8,15.8,0,0,0,230.6,49.53ZM40,56h0Zm106.18,74.58A8,8,0,0,0,144,136v58.66L112,216V136a8,8,0,0,0-2.16-5.47L40,56H216Z",
  out: "M216,48V96a8,8,0,0,1-16,0V67.31l-50.34,50.35a8,8,0,0,1-11.32-11.32L188.69,56H160a8,8,0,0,1,0-16h48A8,8,0,0,1,216,48ZM106.34,138.34,56,188.69V160a8,8,0,0,0-16,0v48a8,8,0,0,0,8,8H96a8,8,0,0,0,0-16H67.31l50.35-50.34a8,8,0,0,0-11.32-11.32Z",
  in: "M144,104V64a8,8,0,0,1,16,0V84.69l42.34-42.35a8,8,0,0,1,11.32,11.32L171.31,96H192a8,8,0,0,1,0,16H152A8,8,0,0,1,144,104Zm-40,40H64a8,8,0,0,0,0,16H84.69L42.34,202.34a8,8,0,0,0,11.32,11.32L96,171.31V192a8,8,0,0,0,16,0V152A8,8,0,0,0,104,144Z",
}

const STATUSES = ["done", "wip", "spec", "todo"] as const
type Status = (typeof STATUSES)[number]
const NAMES = [
  "Accordion",
  "Alert",
  "Avatar",
  "Badge",
  "Breadcrumbs",
  "Button",
  "Calendar",
  "Checkbox",
  "Clipboard",
  "Code Block",
  "Collapsible",
  "Color Picker",
  "Combobox",
  "Context Menu",
  "Date Field",
  "Dialog",
  "Drawer",
  "File Upload",
  "Grid List",
  "Hover Card",
  "Listbox",
  "Marquee",
  "Menu",
  "Menubar",
  "Meter",
  "Navigation Menu",
  "Number Input",
  "Pagination",
  "Pin Input",
  "Popover",
  "Progress",
  "Prompt Input",
  "QR Code",
  "Radio Group",
  "Rating",
  "Scroll Area",
  "Segmented Control",
  "Select",
  "Slider",
  "Splitter",
  "Switch",
  "Table",
]
const COMPONENTS = NAMES.map((name, i) => ({
  name,
  status: (["Marquee", "File Upload"].includes(name)
    ? "spec"
    : i % 11 === 5
      ? "wip"
      : "done") as Status,
  wave: (i % 3) + 1,
  size: Math.round(((i * 37) % 90) / 10 + 1.2 * 10) / 10,
  tests: 80 + ((i * 53) % 600),
  owner: ["core", "a11y", "theme", "site"][i % 4] ?? "core",
}))
type Comp = (typeof COMPONENTS)[number]
const get = (c: Comp, column: string) => c[column as keyof Comp]

const DATA_COLUMNS = [
  { id: "status", label: "Status", first: "ascending" },
  { id: "wave", label: "Wave", first: "ascending" },
  { id: "size", label: "Size (kB)", first: "descending" },
  { id: "tests", label: "Tests", first: "descending" },
  { id: "owner", label: "Owner", first: "ascending" },
] as const

/** Any content works in a row's details: here a card. */
function ComponentCard({ c }: { readonly c: Comp }) {
  return (
    <div className="detail-card">
      <strong>{c.name}</strong>
      <span>
        Wave {c.wave} · owned by {c.owner} · {c.tests} tests · {c.size.toFixed(1)} kB gzip
      </span>
      <span className="status" data-status={c.status}>
        {c.status}
      </span>
    </div>
  )
}

const PARTS: Record<string, readonly { part: string; element: string }[]> = {
  Accordion: [
    { part: "Root", element: "div" },
    { part: "Item", element: "div" },
    { part: "ItemTrigger", element: "button" },
    { part: "ItemContent", element: "div" },
  ],
  Dialog: [
    { part: "Root", element: "—" },
    { part: "Trigger", element: "button" },
    { part: "Content", element: "div" },
    { part: "Title", element: "h2" },
  ],
  Tabs: [
    { part: "Root", element: "div" },
    { part: "List", element: "div" },
    { part: "Trigger", element: "button" },
    { part: "Panel", element: "div" },
  ],
}

export function ExpandableRows() {
  return (
    <Table.Root multiple={false} defaultExpandedRows={["Accordion"]}>
      <Table.Table>
        <Table.Caption>Components and their parts</Table.Caption>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader>
              <VisuallyHidden>Details</VisuallyHidden>
            </Table.ColumnHeader>
            <Table.ColumnHeader>Component</Table.ColumnHeader>
            <Table.ColumnHeader>Parts</Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {Object.entries(PARTS).flatMap(([name, parts]) => [
            <Table.Row key={name} id={name}>
              <Table.Cell>
                <Table.RowTrigger />
              </Table.Cell>
              <Table.RowHeader>{name}</Table.RowHeader>
              <Table.Cell>{parts.length}</Table.Cell>
            </Table.Row>,
            <Table.RowDetails key={`${name}-details`} rowId={name}>
              {/* A whole table inside the details: its own name, headers and sort. */}
              <Table.Root>
                <Table.Table>
                  <Table.Caption>{`${name} parts`}</Table.Caption>
                  <Table.Head>
                    <Table.Row>
                      <Table.ColumnHeader>Part</Table.ColumnHeader>
                      <Table.ColumnHeader>Element</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {parts.map((p) => (
                      <Table.Row key={p.part}>
                        <Table.RowHeader>
                          <code>{`${name}.${p.part}`}</code>
                        </Table.RowHeader>
                        <Table.Cell>
                          <code>{p.element}</code>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Table>
              </Table.Root>
            </Table.RowDetails>,
          ])}
        </Table.Body>
      </Table.Table>
    </Table.Root>
  )
}

function SortIcons() {
  return (
    <Table.SortIndicator
      ascending={<Ph d={ICON.up} />}
      descending={<Ph d={ICON.down} />}
      none={<Ph d={ICON.both} />}
    />
  )
}

export function DataTable() {
  const [query, setQuery] = useState("")
  const [statuses, setStatuses] = useState<readonly string[]>([])
  const [sort, setSort] = useState<SortDescriptor | null>({
    column: "name",
    direction: "ascending",
  })
  const [page, setPage] = useState(1)
  const filtered = filterItems(COMPONENTS, {
    query,
    getValue: get,
    searchColumns: ["name", "owner"],
    filters: statuses.length ? { status: (v) => statuses.includes(v as string) } : {},
  })
  const shown = paginateItems(sortItems(filtered, sort, get), page, 8)
  const facets = facetValues(COMPONENTS, "status", get)
  return (
    <Table.Frame className="data-table">
      <Table.Header>
        <Table.Title>Components</Table.Title>
        <div className="data-table-tools">
          <TextField.Root
            value={query}
            onValueChange={(v) => {
              setQuery(v)
              setPage(1)
            }}
          >
            <TextField.Label>
              <VisuallyHidden>Search components</VisuallyHidden>
            </TextField.Label>
            <TextField.Input type="search" placeholder="Search name or owner" />
          </TextField.Root>
          <Table.ExpandTrigger expanded={<Ph d={ICON.in} />} collapsed={<Ph d={ICON.out} />} />
        </div>
      </Table.Header>
      <Table.Root
        sort={sort}
        onSortChange={setSort}
        pinnedColumns={{ start: ["expand", "name"], end: ["actions"] }}
        rowRange={{ from: shown.from, to: shown.to, total: shown.total }}
      >
        <Table.Table>
          <Table.Head>
            <Table.Row>
              <Table.ColumnHeader id="expand">
                <VisuallyHidden>Details</VisuallyHidden>
              </Table.ColumnHeader>
              <Table.ColumnHeader sortable id="name">
                <Table.SortTrigger>
                  Name
                  <SortIcons />
                </Table.SortTrigger>
              </Table.ColumnHeader>
              {DATA_COLUMNS.map((c) => (
                <Table.ColumnHeader key={c.id} sortable id={c.id} firstDirection={c.first}>
                  <Table.SortTrigger>
                    {c.label}
                    <SortIcons />
                  </Table.SortTrigger>
                  {c.id === "status" ? (
                    <Table.Filter active={statuses.length > 0}>
                      <Table.FilterTrigger>
                        <Table.FilterIndicator>
                          <Ph d={ICON.funnel} />
                        </Table.FilterIndicator>
                      </Table.FilterTrigger>
                      <Table.FilterContent className="filter-panel">
                        <CheckboxGroup.Root
                          allValues={STATUSES.map((s) => s)}
                          value={statuses}
                          onValueChange={(v) => {
                            setStatuses(v)
                            setPage(1)
                          }}
                        >
                          <CheckboxGroup.Label>Status</CheckboxGroup.Label>
                          {facets.map((f) => (
                            <CheckboxGroup.Item key={String(f.value)} value={String(f.value)}>
                              <CheckboxGroup.ItemControl>
                                <CheckboxGroup.ItemIndicator>✓</CheckboxGroup.ItemIndicator>
                              </CheckboxGroup.ItemControl>
                              <CheckboxGroup.ItemLabel>
                                {String(f.value)} ({f.count})
                              </CheckboxGroup.ItemLabel>
                            </CheckboxGroup.Item>
                          ))}
                        </CheckboxGroup.Root>
                      </Table.FilterContent>
                    </Table.Filter>
                  ) : null}
                </Table.ColumnHeader>
              ))}
              <Table.ColumnHeader id="actions">Docs</Table.ColumnHeader>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {shown.items.length === 0 ? (
              <Table.Empty colSpan={DATA_COLUMNS.length + 3}>No component matches.</Table.Empty>
            ) : (
              shown.items.flatMap((c) => [
                <Table.Row key={c.name} id={c.name}>
                  <Table.Cell>
                    <Table.RowTrigger />
                  </Table.Cell>
                  <Table.RowHeader>{c.name}</Table.RowHeader>
                  <Table.Cell>
                    <span className="status" data-status={c.status}>
                      {c.status}
                    </span>
                  </Table.Cell>
                  <Table.Cell>{c.wave}</Table.Cell>
                  <Table.Cell>{c.size.toFixed(1)}</Table.Cell>
                  <Table.Cell>{c.tests}</Table.Cell>
                  <Table.Cell>{c.owner}</Table.Cell>
                  <Table.Cell>
                    <a href={`#${c.name.toLowerCase().replace(/ /g, "-")}`}>
                      Open<VisuallyHidden> {c.name}</VisuallyHidden>
                    </a>
                  </Table.Cell>
                </Table.Row>,
                <Table.RowDetails key={`${c.name}-details`} rowId={c.name}>
                  <ComponentCard c={c} />
                </Table.RowDetails>,
              ])
            )}
          </Table.Body>
        </Table.Table>
      </Table.Root>
      <Table.Footer>
        <span className="note">
          {shown.total === 0 ? "No rows" : `Rows ${shown.from}–${shown.to} of ${shown.total}`}
        </span>
        <Pagination.Root
          count={shown.total}
          pageSize={8}
          page={shown.page}
          onPageChange={setPage}
          aria-label="Components pages"
        >
          {(state) => (
            <Pagination.List>
              <Pagination.Item type="trigger">
                <Pagination.Previous />
              </Pagination.Item>
              {state.pages.map((e) =>
                e.type === "page" ? (
                  <Pagination.Item key={e.key}>
                    <Pagination.Page value={e.value} />
                  </Pagination.Item>
                ) : (
                  <Pagination.Item key={e.key} type="ellipsis">
                    <Pagination.Ellipsis position={e.position} />
                  </Pagination.Item>
                ),
              )}
              <Pagination.Item type="trigger">
                <Pagination.Next />
              </Pagination.Item>
            </Pagination.List>
          )}
        </Pagination.Root>
      </Table.Footer>
    </Table.Frame>
  )
}
