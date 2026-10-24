import { Component } from "@angular/core"
import { Badge } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Badge],
  template: `
    <div class="row">
      <span>Search <span rindBadgeRoot>Beta</span></span>
      <span rindBadgeRoot data-variant="solid">New</span>
      <span rindBadgeRoot data-variant="outline">Draft</span>
    </div>
  `,
})
export class Basic {}
