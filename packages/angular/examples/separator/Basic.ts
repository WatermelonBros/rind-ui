import { Component } from "@angular/core"
import { Separator } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Separator],
  template: `
    <div class="stack">
      <p>Account</p>
      <div rindSeparatorRoot></div>
      <p>Billing</p>
      <div rindSeparatorRoot></div>
      <p>Team</p>
    </div>
  `,
})
export class Basic {}
