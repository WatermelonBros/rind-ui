import { Component } from "@angular/core"
import { Toast } from "@rind-ui/angular"
import { createToaster } from "@rind-ui/core"

// One store for the app: show toasts from anywhere with `toaster.show(...)`.
const toaster = createToaster()

@Component({
  selector: "app-basic",
  imports: [Toast],
  // Not portalled here: the region stays inside the example. In an app, render one Toaster at
  // the root with the default portal.
  template: `
    <button type="button" (click)="toaster.show('Changes saved')">Save</button>
    <ng-template [rindToaster]="toaster" [portal]="false" [messages]="messages" let-t>
      <li rindToastRoot>
        <div rindToastTitle></div>
        @if (t.data.description) {
          <div rindToastDescription></div>
        }
        @if (t.data.action) {
          <button rindToastActionTrigger></button>
        }
        <button rindToastCloseTrigger>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </button>
      </li>
    </ng-template>
  `,
})
export class Basic {
  readonly toaster = toaster
  readonly messages = { regionLabel: (key: string) => `Basic notifications (${key})` }
}
