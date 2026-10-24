import { Component } from "@angular/core"
import { Progress } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Progress],
  template: `
    <div rindProgressRoot [value]="40">
      <span rindProgressLabel>Uploading</span>
      <span rindProgressValueText></span>
      <div rindProgressTrack><div rindProgressIndicator></div></div>
    </div>
  `,
})
export class Basic {}
