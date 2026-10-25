import { Component } from "@angular/core"
import { ColorPicker } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [ColorPicker],
  template: `
    <div rindColorPickerRoot defaultValue="#3D8BFF">
      <label rindColorPickerLabel>Background</label>
      <div rindColorPickerControl>
        <button rindColorPickerTrigger><div rindColorPickerValueSwatch></div></button>
        <span rindColorPickerValueText></span>
      </div>
      <ng-template rindColorPickerPortal>
        <div rindColorPickerPositioner>
          <div rindColorPickerContent>
            <div rindColorPickerArea>
              <div rindColorPickerAreaBackground></div>
              <div rindColorPickerAreaThumb></div>
            </div>
            <div rindColorPickerChannelSlider channel="hue">
              <div rindColorPickerChannelSliderTrack>
                <div rindColorPickerChannelSliderThumb></div>
              </div>
            </div>
            <div rindColorPickerChannelSlider channel="alpha">
              <div rindColorPickerChannelSliderTrack>
                <div rindColorPickerTransparencyGrid></div>
                <div rindColorPickerChannelSliderThumb></div>
              </div>
            </div>
            <div class="row">
              <div rindColorPickerChannelInput channel="hex"></div>
              <button rindColorPickerEyeDropperTrigger>Pick</button>
            </div>
            <div rindColorPickerSwatchGroup>
              @for (c of swatches; track c) {
                <div rindColorPickerSwatchTrigger [color]="c">
                  <div rindColorPickerSwatch [color]="c" aria-hidden="true"></div>
                  <span rindColorPickerSwatchIndicator></span>
                </div>
              }
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `,
})
export class Basic {
  readonly swatches = ["#FF3D8B", "#FF8F3D", "#F5D90A", "#2EC27E", "#3D8BFF", "#8B3DFF"]
}
