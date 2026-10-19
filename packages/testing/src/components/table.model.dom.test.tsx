// Model-based tests (add-table 5.3): the sort over every transition. Configurations:
// uncontrolled (three columns, one descending first), allowUnsorted, controlled applying and
// controlled refusing. Browser mode walks pointer, touch, keyboard and virtual in both
// directions; jsdom keyboard and virtual. Overflow is layout: the browser tests cover it.
import {
  platforms,
  type SortDescriptor,
  type TableSortValue,
  tableContract,
  tableMessages,
} from "@rind-ui/core"
import { RindProvider, Table, type TableRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { type ReactElement, useState } from "react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

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

function Fixture(props: TableRootProps) {
  return (
    <Table.Root {...props}>
      <Table.Table>
        <Table.Caption>Stock</Table.Caption>
        <Table.Head>
          <Table.Row>
            {COLUMNS.map((c) => (
              <Table.ColumnHeader key={c.id} sortable id={c.id} firstDirection={c.first}>
                <Table.SortTrigger>
                  {c.name}
                  <Table.SortIndicator />
                </Table.SortTrigger>
              </Table.ColumnHeader>
            ))}
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
}

const withRun = (ui: ReactElement) => (
  <RindProvider
    dir={currentRun()?.direction ?? "ltr"}
    environment={{ platform: currentRun()?.platform ?? platforms.linux }}
  >
    {ui}
  </RindProvider>
)

function Applying() {
  const [sort, setSort] = useState<SortDescriptor | null>(null)
  return <Fixture sort={sort} onSortChange={setSort} />
}

const box = (value: SortDescriptor | null): TableSortValue => ({ value })
const configs: { name: string; props: Record<string, unknown>; ui: () => ReactElement }[] = [
  { name: "uncontrolled", props: {}, ui: () => <Fixture /> },
  { name: "allowUnsorted", props: { allowUnsorted: true }, ui: () => <Fixture allowUnsorted /> },
  // The oracle runs uncontrolled: an applying parent behaves the same.
  { name: "controlled, applying", props: {}, ui: () => <Applying /> },
  {
    name: "controlled, refusing",
    props: { sort: box({ column: "name", direction: "ascending" }) },
    ui: () => <Fixture sort={{ column: "name", direction: "ascending" }} onSortChange={() => {}} />,
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
  describe(`table model: ${cfg.name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => render(withRun(cfg.ui())),
      target: () => screen,
      anchor: [{ name: "Stock" }] as never,
      props: { root: "oracle", messages: tableMessages, ...cfg.props } as never,
      ...(inJsdom ? { modalities: ["keyboard", "virtual"] as const } : {}),
      a11y,
    })
  })
}
