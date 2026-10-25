// The Table contract model (React's configurations: uncontrolled, allowUnsorted, controlled
// applying and refusing) against the Angular parts, and markup parity for every part.
import { Component, signal } from "@angular/core"
import {
  platforms,
  type SortDescriptor,
  type TableSortValue,
  tableContract,
  tableMessages,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Table } from "./table"

const inJsdom = navigator.userAgent.includes("jsdom")
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const COLUMNS = [
  { id: "name", name: "Name", first: "ascending" },
  { id: "price", name: "Price", first: "descending" },
  { id: "stock", name: "Stock", first: "ascending" },
] as const
interface P {
  readonly sort?: SortDescriptor | null
  readonly defaultSort?: SortDescriptor
  readonly allowUnsorted?: boolean
  readonly defaultExpandedRows?: readonly string[]
}
/** The configuration the next fixture renders. */
let current: { p: P; applying: boolean; provider: boolean } = {
  p: {},
  applying: false,
  provider: false,
}

const TABLE = `<div
      rindTableRoot
      [sort]="applying ? sort() : p.sort"
      [defaultSort]="p.defaultSort"
      [allowUnsorted]="p.allowUnsorted"
      (sortChange)="sort.set($event)"
    >
      <table rindTableTable>
        <caption rindTableCaption>Stock</caption>
        <thead rindTableHead>
          <tr rindTableRow>
            @for (c of columns; track c.id) {
              <th rindTableColumnHeader sortable [id]="c.id" [firstDirection]="c.first">
                <button rindTableSortTrigger>{{ c.name }}<span rindTableSortIndicator></span></button>
              </th>
            }
          </tr>
        </thead>
        <tbody rindTableBody>
          <tr rindTableRow>
            <th rindTableRowHeader>Apple</th>
            <td rindTableCell>3</td>
            <td rindTableCell>10</td>
          </tr>
        </tbody>
      </table>
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Table],
  template: `@if (provider) {
      <ng-container rindProvider [dir]="dir" [environment]="env">${TABLE}</ng-container>
    } @else {
      ${TABLE}
    }`,
})
class Fixture {
  readonly columns = COLUMNS
  readonly p = current.p
  readonly applying = current.applying
  readonly provider = current.provider
  readonly sort = signal<SortDescriptor | null>(null)
  readonly dir = currentRun()?.direction ?? "ltr"
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
}

const reactFixture = (p: P) =>
  r(
    R.Table.Root,
    p as never,
    r(
      R.Table.Table,
      null,
      r(R.Table.Caption, null, "Stock"),
      r(
        R.Table.Head,
        null,
        r(
          R.Table.Row,
          null,
          COLUMNS.map((c) =>
            r(
              R.Table.ColumnHeader,
              { key: c.id, sortable: true, id: c.id, firstDirection: c.first },
              r(R.Table.SortTrigger, null, c.name, r(R.Table.SortIndicator)),
            ),
          ),
        ),
      ),
      r(
        R.Table.Body,
        null,
        r(
          R.Table.Row,
          null,
          r(R.Table.RowHeader, null, "Apple"),
          r(R.Table.Cell, null, "3"),
          r(R.Table.Cell, null, "10"),
        ),
      ),
    ),
  )

const box = (value: SortDescriptor | null): TableSortValue => ({ value })
const configs: { name: string; props: Record<string, unknown>; p: P; applying: boolean }[] = [
  { name: "uncontrolled", props: {}, p: {}, applying: false },
  {
    name: "allowUnsorted",
    props: { allowUnsorted: true },
    p: { allowUnsorted: true },
    applying: false,
  },
  // The oracle runs uncontrolled: an applying parent behaves the same.
  { name: "controlled, applying", props: {}, p: {}, applying: true },
  {
    name: "controlled, refusing",
    props: { sort: box({ column: "name", direction: "ascending" }) },
    p: { sort: { column: "name", direction: "ascending" } },
    applying: false,
  },
]
/** The column a SORT step presses: the next one after the sorted column (a walk visits all). */
const nextColumn = (view: { values: { sort?: TableSortValue } }) => {
  const at = COLUMNS.findIndex((c) => c.id === view.values.sort?.value?.column)
  return COLUMNS[(at + 1) % COLUMNS.length] ?? COLUMNS[0]
}
const contract = {
  ...tableContract,
  events: {
    ...tableContract.events,
    SORT: {
      action: "sortBy",
      args: ((view: { values: { sort?: TableSortValue } }) => [nextColumn(view).name]) as never,
      event: ((view: { values: { sort?: TableSortValue } }) => {
        const c = nextColumn(view)
        return { column: c.id, name: c.name, firstDirection: c.first, modality: "pointer" }
      }) as never,
    },
  },
} as typeof tableContract
for (const cfg of configs) {
  describe(`angular table model: ${cfg.name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => {
        current = { p: cfg.p, applying: cfg.applying, provider: true }
        return mount(Fixture)
      },
      target: () => screen,
      anchor: [{ name: "Stock" }] as never,
      props: { root: "oracle", messages: tableMessages, ...cfg.props } as never,
      ...(inJsdom ? { modalities: ["keyboard", "virtual"] as const } : {}),
      a11y,
    })
  })
}

// Everything else, in markup: Frame with its Title and full-page trigger, a filtered column,
// an expandable row with its details, a pinned column and the empty row.
@Component({
  selector: "rind-f",
  imports: [Table],
  template: `<div rindTableFrame id="inventory">
    <div rindTableHeader>
      <div rindTableTitle>Inventory</div>
      <button rindTableExpandTrigger>Full page</button>
    </div>
    <div
      rindTableRoot
      stickyFirstColumn
      [defaultPinnedColumns]="pinned"
      [defaultExpandedRows]="p.defaultExpandedRows"
    >
      <table rindTableTable>
        <thead rindTableHead>
          <tr rindTableRow>
            <th rindTableColumnHeader id="name">
              Name<ng-container rindTableFilter active>
                <button rindTableFilterTrigger><span rindTableFilterIndicator></span></button>
                <ng-template rindTableFilterPortal>
                  <div rindTableFilterPositioner>
                    <div rindTableFilterContent>Only fruit</div>
                  </div>
                </ng-template>
              </ng-container>
            </th>
            <th rindTableColumnHeader id="more">More</th>
          </tr>
        </thead>
        <tbody rindTableBody>
          <tr rindTableRow id="apple">
            <th rindTableRowHeader>Apple</th>
            <td rindTableCell><button rindTableRowTrigger>Details</button></td>
          </tr>
          <tr rindTableRowDetails rowId="apple">Grown in Trentino.</tr>
          <tr rindTableEmpty>No rows</tr>
        </tbody>
        <tfoot rindTableFoot>
          <tr rindTableRow><td rindTableCell colspan="2">1 row</td></tr>
        </tfoot>
      </table>
    </div>
    <div rindTableFooter>Updated today</div>
  </div>`,
})
class Full {
  readonly p = current.p
  readonly pinned = { start: ["name"], end: [] }
}

const reactFull = (p: P) =>
  r(
    R.Table.Frame,
    { id: "inventory" },
    r(
      R.Table.Header,
      null,
      r(R.Table.Title, null, "Inventory"),
      r(R.Table.ExpandTrigger, null, "Full page"),
    ),
    r(
      R.Table.Root,
      { stickyFirstColumn: true, defaultPinnedColumns: { start: ["name"], end: [] }, ...p },
      r(
        R.Table.Table,
        null,
        r(
          R.Table.Head,
          null,
          r(
            R.Table.Row,
            null,
            r(
              R.Table.ColumnHeader,
              { id: "name" },
              "Name",
              r(
                R.Table.Filter,
                { active: true },
                r(R.Table.FilterTrigger, null, r(R.Table.FilterIndicator)),
                r(R.Table.FilterContent, null, "Only fruit"),
              ),
            ),
            r(R.Table.ColumnHeader, { id: "more" }, "More"),
          ),
        ),
        r(
          R.Table.Body,
          null,
          r(
            R.Table.Row,
            { id: "apple" },
            r(R.Table.RowHeader, null, "Apple"),
            r(R.Table.Cell, null, r(R.Table.RowTrigger, null, "Details")),
          ),
          r(R.Table.RowDetails, { rowId: "apple" }, "Grown in Trentino."),
          r(R.Table.Empty, null, "No rows"),
        ),
        r(R.Table.Foot, null, r(R.Table.Row, null, r(R.Table.Cell, { colSpan: 2 }, "1 row"))),
      ),
    ),
    r(R.Table.Footer, null, "Updated today"),
  )

describe("Angular Table matches React", () => {
  for (const p of [{}, { defaultSort: { column: "price", direction: "descending" } }] as P[]) {
    it(`sort ${JSON.stringify(p)}`, async () => {
      current = { p, applying: false, provider: false }
      await both(reactFixture(p), Fixture)
    })
  }
  for (const p of [{}, { defaultExpandedRows: ["apple"] }] as P[]) {
    it(`frame, filter, row details, empty, pinned ${JSON.stringify(p)}`, async () => {
      current = { p, applying: false, provider: false }
      await both(reactFull(p), Full)
    })
  }
})
