"use client"

import { type SortDescriptor, sortItems } from "@rind-ui/core"
import { Table } from "@rind-ui/react"
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
