import { Component } from "@angular/core"
import { ToggleGroup } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [ToggleGroup],
  template: `
    <div rindToggleGroupRoot aria-label="Alignment" [defaultValue]="['left']">
      <button rindToggleGroupItem value="left">Left</button>
      <button rindToggleGroupItem value="center">Center</button>
      <button rindToggleGroupItem value="right">Right</button>
    </div>
  `,
})
export class Basic {}
