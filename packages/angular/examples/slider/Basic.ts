import { Component } from "@angular/core"
import { Slider } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Slider],
  template: `
    <div rindSliderRoot [defaultValue]="40">
      <label rindSliderLabel>Volume</label>
      <div rindSliderValueText></div>
      <div rindSliderControl>
        <div rindSliderTrack><div rindSliderIndicator></div></div>
        <div rindSliderThumb [index]="0" [disabled]="false"></div>
      </div>
    </div>
  `,
})
export class Basic {}
