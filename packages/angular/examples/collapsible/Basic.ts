import { Component } from "@angular/core"
import { Collapsible } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Collapsible],
  template: `
    <div rindCollapsibleRoot>
      <button rindCollapsibleTrigger>
        <span rindCollapsibleIndicator>▸</span>
        What does headless mean?
      </button>
      <div rindCollapsibleContent>
        <div class="pad">Behaviour, accessibility and state, with no styles. You bring the look.</div>
      </div>
    </div>
  `,
})
export class Basic {}
