import { Component } from "@angular/core"
import { RadioGroup } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [RadioGroup],
  template: `
    <div rindRadioGroupRoot defaultValue="Medium">
      <span rindRadioGroupLabel>Size</span>
      @for (value of sizes; track value) {
        <div rindRadioGroupItem [value]="value">
          <button rindRadioGroupItemControl><span rindRadioGroupItemIndicator></span></button>
          <label rindRadioGroupItemLabel>{{ value }}</label>
        </div>
      }
    </div>
  `,
})
export class Basic {
  readonly sizes = ["Small", "Medium", "Large"]
}
