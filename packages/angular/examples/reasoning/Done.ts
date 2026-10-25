import { Component } from "@angular/core"
import { Reasoning } from "@rind-ui/angular"

@Component({
  selector: "app-done",
  imports: [Reasoning],
  template: `
    <div rindReasoningRoot [thinking]="false" [duration]="12">
      <button rindReasoningTrigger></button>
      <div rindReasoningContent>{{ trace }}</div>
    </div>
  `,
})
export class Done {
  readonly trace =
    "The user asks why the sea has tides. The moon's gravity pulls the near side of the ocean more than the far side, so the water bulges on both sides. The Earth turns under the two bulges, which gives two high tides a day. The sun adds a smaller pull: spring tides when they line up, neap tides when they are at right angles."
}
