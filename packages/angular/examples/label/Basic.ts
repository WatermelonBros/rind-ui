import { Component } from "@angular/core"
import { Label } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Label],
  template: `
    <div class="stack">
      <label rindLabel for="example-name">Name</label>
      <input id="example-name" class="native" placeholder="Click the label" />
    </div>
  `,
})
export class Basic {}
