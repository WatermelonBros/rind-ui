/** @jsxImportSource solid-js */
// The Table contract model (React's configurations: uncontrolled, allowUnsorted, controlled
// applying and refusing) against the Solid parts, and markup parity for every part.
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
import { createSignal, For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { RindProvider, Table, type TableRootProps } from "../index"

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

type P = Record<string, unknown>
// `p` may carry getters: a spread keeps them reactive.
const fixture = (p: P): JSX.Element => (
  <Table.Root {...(p as TableRootProps)}>
    <Table.Table>
      <Table.Caption>Stock</Table.Caption>
      <Table.Head>
        <Table.Row>
          <For each={COLUMNS}>
            {(c) => (
              <Table.ColumnHeader sortable id={c.id} firstDirection={c.first}>
                <Table.SortTrigger>
                  {c.name}
                  <Table.SortIndicator />
                </Table.SortTrigger>
              </Table.ColumnHeader>
            )}
          </For>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          <Table.RowHeader>Apple</Table.RowHeader>
          <Table.Cell>3</Table.Cell>
          <Table.Cell>10</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Table>
  </Table.Root>
)
const reactFixture = (p: P) =>
  r(
    R.Table.Root,
    p,
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
const withRun = (ui: () => JSX.Element): JSX.Element => (
  <RindProvider
    dir={currentRun()?.direction ?? "ltr"}
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
  >
    {ui()}
  </RindProvider>
)
function Applying() {
  const [sort, setSort] = createSignal<SortDescriptor | null>(null)
  return fixture({
    get sort() {
      return sort()
    },
    onSortChange: (s: SortDescriptor | null) => setSort(s),
  })
}

const box = (value: SortDescriptor | null): TableSortValue => ({ value })
const configs: { name: string; props: P; ui: () => JSX.Element }[] = [
  { name: "uncontrolled", props: {}, ui: () => fixture({}) },
  {
    name: "allowUnsorted",
    props: { allowUnsorted: true },
    ui: () => fixture({ allowUnsorted: true }),
  },
  // The oracle runs uncontrolled: an applying parent behaves the same.
  { name: "controlled, applying", props: {}, ui: () => <Applying /> },
  {
    name: "controlled, refusing",
    props: { sort: box({ column: "name", direction: "ascending" }) },
    ui: () => fixture({ sort: { column: "name", direction: "ascending" } }),
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
  describe(`solid table model: ${cfg.name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => mount(() => withRun(cfg.ui)),
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
const full = (p: P): JSX.Element => (
  <Table.Frame id="inventory">
    <Table.Header>
      <Table.Title>Inventory</Table.Title>
      <Table.ExpandTrigger>Full page</Table.ExpandTrigger>
    </Table.Header>
    <Table.Root
      stickyFirstColumn
      defaultPinnedColumns={{ start: ["name"], end: [] }}
      {...(p as TableRootProps)}
    >
      <Table.Table>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader id="name">
              Name
              <Table.Filter active>
                <Table.FilterTrigger>
                  <Table.FilterIndicator />
                </Table.FilterTrigger>
                <Table.FilterContent>Only fruit</Table.FilterContent>
              </Table.Filter>
            </Table.ColumnHeader>
            <Table.ColumnHeader id="more">More</Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row id="apple">
            <Table.RowHeader>Apple</Table.RowHeader>
            <Table.Cell>
              <Table.RowTrigger>Details</Table.RowTrigger>
            </Table.Cell>
          </Table.Row>
          <Table.RowDetails rowId="apple">Grown in Trentino.</Table.RowDetails>
          <Table.Empty>No rows</Table.Empty>
        </Table.Body>
        <Table.Foot>
          <Table.Row>
            <Table.Cell colSpan={2}>1 row</Table.Cell>
          </Table.Row>
        </Table.Foot>
      </Table.Table>
    </Table.Root>
    <Table.Footer>Updated today</Table.Footer>
  </Table.Frame>
)
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

describe("Solid Table matches React", () => {
  it("sorted, unsorted, loading", async () => {
    for (const p of [{}, { defaultSort: { column: "price", direction: "descending" } }] as P[]) {
      await clientParity(reactFixture(p), () => fixture(p))
    }
  })
  it("frame, filter, row details, empty, pinned", async () => {
    for (const p of [{}, { defaultExpandedRows: ["apple"] }] as P[]) {
      await clientParity(reactFull(p), () => full(p))
    }
  })
})
