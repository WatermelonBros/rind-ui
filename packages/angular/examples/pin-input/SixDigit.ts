import { Component } from "@angular/core"
import { PinInput } from "@rind-ui/angular"

@Component({
  selector: "app-six-digit",
  imports: [PinInput],
  template: `
    <div rindPinInputRoot [length]="6">
      <label rindPinInputLabel>Verification code</label>
      <div rindPinInputControl>
        <input rindPinInputInput />
        @for (i of slots; track i) {
          <div rindPinInputSlot [index]="i"></div>
        }
      </div>
    </div>
  `,
})
export class SixDigit {
  readonly slots = [0, 1, 2, 3, 4, 5]
}
