import { Component } from "@angular/core"
import { RadioGroup, ToggleGroup, Toolbar } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Toolbar, ToggleGroup, RadioGroup],
  template: `
    <div rindToolbarRoot aria-label="Formatting">
      <div
        rindToggleGroupRoot
        aria-label="Text style"
        selectionMode="multiple"
        [defaultValue]="['bold']"
      >
        <button rindToggleGroupItem value="bold">Bold</button>
        <button rindToggleGroupItem value="italic">Italic</button>
      </div>
      <div rindToolbarSeparator></div>
      <div rindRadioGroupRoot aria-label="Alignment" orientation="horizontal" defaultValue="left">
        @for (value of alignments; track value) {
          <div rindRadioGroupItem [value]="value">
            <button rindRadioGroupItemControl><span rindRadioGroupItemIndicator></span></button>
            <label rindRadioGroupItemLabel>{{ value }}</label>
          </div>
        }
      </div>
      <div rindToolbarSeparator></div>
      <button rindToolbarButton>Share</button>
    </div>
  `,
})
export class Basic {
  readonly alignments = ["left", "center", "right"]
}
