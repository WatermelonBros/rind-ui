import { Component } from "@angular/core"
import { Dialog } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Dialog],
  template: `
    <ng-container rindDialogRoot>
      <button rindDialogTrigger>Edit profile</button>
      <ng-template rindDialogPortal>
        <div rindDialogBackdrop></div>
        <div rindDialogPositioner>
          <div rindDialogContent>
            <h2 rindDialogTitle>Edit profile</h2>
            <p rindDialogDescription>Change how your name appears to others.</p>
            <label class="stack">
              Display name
              <input value="Ada Lovelace" />
            </label>
            <div class="row">
              <button rindDialogCloseTrigger>Cancel</button>
              <button rindDialogCloseTrigger>Save</button>
            </div>
          </div>
        </div>
      </ng-template>
    </ng-container>
  `,
})
export class Basic {}
