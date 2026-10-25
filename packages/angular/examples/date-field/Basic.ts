import { Component } from "@angular/core"
import { CalendarDate } from "@internationalized/date"
import { DateField } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [DateField],
  template: `
    <div rindDateFieldRoot name="birthday" [defaultValue]="fixed">
      <label rindDateFieldLabel>Birthday</label>
      <div rindDateFieldInput></div>
    </div>
  `,
})
export class Basic {
  // A fixed date: the example's output never depends on today.
  readonly fixed = new CalendarDate(2026, 10, 14)
}
