import { Component } from "@angular/core"
import { ContextMenu, Menu } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [ContextMenu, Menu],
  template: `
    <ng-container rindContextMenuRoot>
      <div rindContextMenuTrigger tabindex="0" class="context-region">
        README.md
        <small>Right click, long press or Shift+F10</small>
      </div>
      <ng-template rindMenuPortal>
        <div rindMenuPositioner>
          <div rindMenuContent aria-label="README.md actions">
            <div rindMenuItem>Rename</div>
            <div rindMenuItem>Duplicate</div>
            <div rindMenuSeparator></div>
            <div rindMenuItem>Delete</div>
          </div>
        </div>
      </ng-template>
    </ng-container>
  `,
})
export class Basic {}
