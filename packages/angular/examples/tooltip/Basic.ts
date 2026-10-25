import { Component } from "@angular/core"
import { Tooltip } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Tooltip],
  template: `
    <ng-container rindTooltipRoot>
      <button rindTooltipTrigger>Save</button>
      <ng-template rindTooltipPortal>
        <div rindTooltipPositioner>
          <div rindTooltipContent>
            Save the document (Ctrl+S)
            <div rindTooltipArrow></div>
          </div>
        </div>
      </ng-template>
    </ng-container>
  `,
})
export class Basic {}
