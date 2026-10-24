import { Component } from "@angular/core"
import { Meter } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Meter],
  template: `
    <div rindMeterRoot [value]="75">
      <span rindMeterLabel>Storage</span>
      <span rindMeterValueText></span>
      <div rindMeterTrack><div rindMeterIndicator></div></div>
    </div>
  `,
})
export class Basic {}
