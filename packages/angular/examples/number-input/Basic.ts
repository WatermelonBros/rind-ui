import { Component } from "@angular/core"
import { NumberInput } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [NumberInput],
  template: `
    <div rindNumberInputRoot [defaultValue]="2">
      <label rindNumberInputLabel>Quantity</label>
      <div rindNumberInputControl>
        <button rindNumberInputDecrementTrigger>−</button>
        <input rindNumberInputInput />
        <button rindNumberInputIncrementTrigger>+</button>
      </div>
    </div>
  `,
})
export class Basic {}
