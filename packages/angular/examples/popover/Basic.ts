import { Component } from "@angular/core"
import { Popover } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Popover],
  template: `
    <ng-container rindPopoverRoot>
      <button rindPopoverTrigger>Share <span rindPopoverIndicator>▾</span></button>
      <ng-template rindPopoverPortal>
        <div rindPopoverPositioner>
          <div rindPopoverContent>
            <h2 rindPopoverTitle>Share this page</h2>
            <p rindPopoverDescription>Anyone with the link can view it.</p>
            <input aria-label="Link" readonly value="https://example.com/p/1" />
            <button rindPopoverCloseTrigger>Done</button>
            <div rindPopoverArrow></div>
          </div>
        </div>
      </ng-template>
    </ng-container>
  `,
})
export class Basic {}
