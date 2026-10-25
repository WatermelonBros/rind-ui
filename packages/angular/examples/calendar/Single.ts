import { Component, signal } from "@angular/core"
import { CalendarDate } from "@internationalized/date"
import { Calendar } from "@rind-ui/angular"
import type { CalendarValue } from "@rind-ui/core"

@Component({
  selector: "app-single",
  imports: [Calendar],
  template: `
    <div class="stack">
      <!-- A fixed month: the example's markup never depends on today. -->
      <div
        rindCalendarRoot
        aria-label="Departure"
        [visibleMonths]="1"
        [value]="value()"
        (valueChange)="value.set($event)"
        [defaultFocusedValue]="month"
      >
        <div rindCalendarHeader>
          <button rindCalendarPrevTrigger></button>
          <h2 rindCalendarHeading></h2>
          <button rindCalendarNextTrigger></button>
        </div>
        <table rindCalendarGrid [month]="0"></table>
      </div>
      <span class="note">selected: {{ value() ? value()!.toString() : "none" }}</span>
    </div>
  `,
})
export class Single {
  readonly value = signal<CalendarValue>(null)
  readonly month = new CalendarDate(2026, 10, 14)
}
