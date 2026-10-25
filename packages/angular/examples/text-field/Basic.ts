import { Component } from "@angular/core"
import { TextField } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [TextField],
  template: `
    <div rindTextFieldRoot name="handle" required>
      <label rindTextFieldLabel>Handle</label>
      <input rindTextFieldInput placeholder="@you" maxlength="20" />
      <p rindTextFieldDescription>Up to 20 characters.</p>
      <p rindTextFieldErrorMessage></p>
    </div>
  `,
})
export class Basic {}
