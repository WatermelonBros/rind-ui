<script lang="ts">
import { Table } from "@rind-ui/svelte"

const PROPS = [
  { prop: "value", type: "string", fallback: "—", note: "What a press copies." },
  { prop: "disabled", type: "boolean", fallback: "false", note: "No presses, no copy." },
  { prop: "copyFeedbackDuration", type: "number", fallback: "2000", note: "Milliseconds." },
]
</script>

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
      {#each PROPS as p (p.prop)}
        <Table.Row>
          <Table.RowHeader><code>{p.prop}</code></Table.RowHeader>
          <Table.Cell><code>{p.type}</code></Table.Cell>
          <Table.Cell>{p.fallback}</Table.Cell>
          <Table.Cell>{p.note}</Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Table>
</Table.Root>
