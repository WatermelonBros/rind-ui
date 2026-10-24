import { Component } from "@angular/core"
import { Link } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Link],
  template: `
    <p>
      Read the <a rindLink href="/docs/">documentation</a> or the
      <a rindLink href="https://github.com/WatermelonBros/rind-ui">source</a>.
    </p>
  `,
})
export class Basic {}
