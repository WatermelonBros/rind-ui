import { Component } from "@angular/core"
import { Table } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Table],
  template: `
    <div rindTableRoot>
      <table rindTableTable>
        <caption rindTableCaption>Clipboard props</caption>
        <thead rindTableHead>
          <tr rindTableRow>
            <th rindTableColumnHeader>Prop</th>
            <th rindTableColumnHeader>Type</th>
            <th rindTableColumnHeader>Default</th>
            <th rindTableColumnHeader>Notes</th>
          </tr>
        </thead>
        <tbody rindTableBody>
          @for (p of props; track p.prop) {
            <tr rindTableRow>
              <th rindTableRowHeader><code>{{ p.prop }}</code></th>
              <td rindTableCell><code>{{ p.type }}</code></td>
              <td rindTableCell>{{ p.fallback }}</td>
              <td rindTableCell>{{ p.note }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class Basic {
  readonly props = [
    { prop: "value", type: "string", fallback: "—", note: "What a press copies." },
    { prop: "disabled", type: "boolean", fallback: "false", note: "No presses, no copy." },
    { prop: "copyFeedbackDuration", type: "number", fallback: "2000", note: "Milliseconds." },
  ]
}
