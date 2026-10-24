<script lang="ts">
import { Table } from "../../src/index"

const { root = {} }: { root?: Record<string, unknown> } = $props()
</script>

<Table.Frame id="inventory">
  <Table.Header>
    <Table.Title>Inventory</Table.Title>
    <Table.ExpandTrigger>Full page</Table.ExpandTrigger>
  </Table.Header>
  <Table.Root stickyFirstColumn defaultPinnedColumns={{ start: ["name"], end: [] }} {...root}>
    <Table.Table>
      <Table.Head>
        <Table.Row>
          <!-- No whitespace after "Name": React's markup has none (the column's width). -->
          <Table.ColumnHeader id="name"
            >Name<Table.Filter active
              ><Table.FilterTrigger><Table.FilterIndicator /></Table.FilterTrigger
              ><Table.FilterContent>Only fruit</Table.FilterContent></Table.Filter
            ></Table.ColumnHeader
          >
          <Table.ColumnHeader id="more">More</Table.ColumnHeader>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <Table.Row id="apple">
          <Table.RowHeader>Apple</Table.RowHeader>
          <Table.Cell><Table.RowTrigger>Details</Table.RowTrigger></Table.Cell>
        </Table.Row>
        <Table.RowDetails rowId="apple">Grown in Trentino.</Table.RowDetails>
        <Table.Empty>No rows</Table.Empty>
      </Table.Body>
      <Table.Foot>
        <Table.Row><Table.Cell colspan={2}>1 row</Table.Cell></Table.Row>
      </Table.Foot>
    </Table.Table>
  </Table.Root>
  <Table.Footer>Updated today</Table.Footer>
</Table.Frame>
