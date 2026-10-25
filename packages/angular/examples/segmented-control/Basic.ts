import { Component } from "@angular/core"
import { SegmentedControl } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [SegmentedControl],
  template: `
    <div rindSegmentedControlRoot aria-label="Range" defaultValue="week">
      <button rindSegmentedControlItem value="day">Day</button>
      <button rindSegmentedControlItem value="week">Week</button>
      <button rindSegmentedControlItem value="month">Month</button>
      <span rindSegmentedControlIndicator></span>
    </div>
  `,
})
export class Basic {}
