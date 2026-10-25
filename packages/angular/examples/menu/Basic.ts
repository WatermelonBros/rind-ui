import { Component } from "@angular/core"
import { Menu } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Menu],
  template: `
    <ng-container rindMenuRoot>
      <button rindMenuTrigger>Actions <span aria-hidden="true">▾</span></button>
      <ng-template rindMenuPortal>
        <div rindMenuPositioner>
          <div rindMenuContent>
            <div rindMenuItem>New file</div>
            <div rindMenuItem>Duplicate</div>
            <a rindMenuItem href="/docs/menu/#link-items">Open the docs</a>
            <div rindMenuSeparator></div>
            <div rindMenuItem disabled>Delete</div>
          </div>
        </div>
      </ng-template>
    </ng-container>
  `,
})
export class Basic {}
