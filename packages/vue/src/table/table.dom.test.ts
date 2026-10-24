// The Table contract model (React's configurations: uncontrolled, allowUnsorted, controlled
// applying and refusing) against the Vue parts, and markup parity for every part.
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
import { defineComponent, h, shallowRef } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { RindProvider, Table } from "../index"

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
const fixture = (p: P) =>
  h(Table.Root, p, () =>
    h(Table.Table, null, () => [
      h(Table.Caption, null, () => "Stock"),
      h(Table.Head, null, () =>
        h(Table.Row, null, () =>
          COLUMNS.map((c) =>
            h(
              Table.ColumnHeader,
              { key: c.id, sortable: true, id: c.id, firstDirection: c.first },
              () => h(Table.SortTrigger, null, () => [c.name, h(Table.SortIndicator)]),
            ),
          ),
        ),
      ),
      h(Table.Body, null, () =>
        h(Table.Row, null, () => [
          h(Table.RowHeader, null, () => "Apple"),
          h(Table.Cell, null, () => "3"),
          h(Table.Cell, null, () => "10"),
        ]),
      ),
    ]),
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
const withRun = (ui: () => ReturnType<typeof h>) =>
  h(
    RindProvider,
    {
      dir: currentRun()?.direction ?? "ltr",
      environment: { platform: currentRun()?.platform ?? platforms.linux },
    },
    ui,
  )
const Applying = defineComponent({
  setup() {
    const sort = shallowRef<SortDescriptor | null>(null)
    return () =>
      fixture({ sort: sort.value, "onUpdate:sort": (s: SortDescriptor | null) => (sort.value = s) })
  },
})

const box = (value: SortDescriptor | null): TableSortValue => ({ value })
const configs: { name: string; props: P; ui: () => ReturnType<typeof h> }[] = [
  { name: "uncontrolled", props: {}, ui: () => fixture({}) },
  {
    name: "allowUnsorted",
    props: { allowUnsorted: true },
    ui: () => fixture({ allowUnsorted: true }),
  },
  // The oracle runs uncontrolled: an applying parent behaves the same.
  { name: "controlled, applying", props: {}, ui: () => h(Applying) },
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
  describe(`vue table model: ${cfg.name}`, () => {
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
const full = (p: P) =>
  h(Table.Frame, { id: "inventory" }, () => [
    h(Table.Header, null, () => [
      h(Table.Title, null, () => "Inventory"),
      h(Table.ExpandTrigger, null, () => "Full page"),
    ]),
    h(
      Table.Root,
      { stickyFirstColumn: true, defaultPinnedColumns: { start: ["name"], end: [] }, ...p },
      () =>
        h(Table.Table, null, () => [
          h(Table.Head, null, () =>
            h(Table.Row, null, () => [
              h(Table.ColumnHeader, { id: "name" }, () => [
                "Name",
                h(Table.Filter, { active: true }, () => [
                  h(Table.FilterTrigger, null, () => h(Table.FilterIndicator)),
                  h(Table.FilterContent, null, () => "Only fruit"),
                ]),
              ]),
              h(Table.ColumnHeader, { id: "more" }, () => "More"),
            ]),
          ),
          h(Table.Body, null, () => [
            h(Table.Row, { id: "apple" }, () => [
              h(Table.RowHeader, null, () => "Apple"),
              h(Table.Cell, null, () => h(Table.RowTrigger, null, () => "Details")),
            ]),
            h(Table.RowDetails, { rowId: "apple" }, () => "Grown in Trentino."),
            h(Table.Empty, null, () => "No rows"),
          ]),
          h(Table.Foot, null, () =>
            h(Table.Row, null, () => h(Table.Cell, { colspan: 2 }, () => "1 row")),
          ),
        ]),
    ),
    h(Table.Footer, null, () => "Updated today"),
  ])
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

describe("Vue Table matches React", () => {
  it("sorted, unsorted, loading", async () => {
    for (const p of [{}, { defaultSort: { column: "price", direction: "descending" } }] as P[]) {
      await serverParity(reactFixture(p), () => fixture(p))
      await clientParity(reactFixture(p), () => fixture(p))
    }
  })
  it("frame, filter, row details, empty, pinned", async () => {
    for (const p of [{}, { defaultExpandedRows: ["apple"] }] as P[]) {
      await serverParity(reactFull(p), () => full(p))
      await clientParity(reactFull(p), () => full(p))
    }
  })
})
