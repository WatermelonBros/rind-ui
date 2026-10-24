import { Component } from "@angular/core"
import { Fieldset, TextField } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Fieldset, TextField],
  template: `
    <fieldset rindFieldsetRoot>
      <legend rindFieldsetLegend>Shipping address</legend>
      <p rindFieldsetDescription>All fields are required.</p>
      <div class="stack">
        <div rindTextFieldRoot name="street" required>
          <label rindTextFieldLabel>Street</label>
          <input rindTextFieldInput />
        </div>
        <div rindTextFieldRoot name="city" required>
          <label rindTextFieldLabel>City</label>
          <input rindTextFieldInput />
        </div>
      </div>
    </fieldset>
  `,
})
export class Basic {}
