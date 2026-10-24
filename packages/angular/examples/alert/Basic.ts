import { Component } from "@angular/core"
import { Alert } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Alert],
  template: `
    <div rindAlertRoot announce="off">
      <span rindAlertIcon>ℹ</span>
      <div rindAlertTitle>Maintenance tonight</div>
      <div rindAlertDescription>Saving is paused from 22:00 to 22:30.</div>
    </div>
  `,
})
export class Basic {}
