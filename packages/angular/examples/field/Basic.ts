import { Component } from "@angular/core"
import { Field, TextField } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Field, TextField],
  template: `
    <div rindFieldRoot name="email" required>
      <label rindFieldLabel>Email</label>
      <div rindTextFieldRoot>
        <input rindTextFieldInput type="email" placeholder="you@example.com" />
      </div>
      <p rindFieldDescription>We never share it.</p>
      <p rindFieldErrorMessage></p>
    </div>
  `,
})
export class Basic {}
