import { Component } from "@angular/core"
import { Switch } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Switch],
  template: `
    <div class="stack">
      <div rindSwitchRoot defaultChecked>
        <button rindSwitchControl><span rindSwitchThumb></span></button>
        <label rindSwitchLabel>Wi-Fi</label>
      </div>
      <div rindSwitchRoot>
        <button rindSwitchControl><span rindSwitchThumb></span></button>
        <label rindSwitchLabel>Bluetooth</label>
      </div>
    </div>
  `,
})
export class Basic {}
