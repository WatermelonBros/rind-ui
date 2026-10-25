import { Component } from "@angular/core"
import { TagsInput } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [TagsInput],
  template: `
    <ng-container rindTagsInputRoot [defaultValue]="tags">
      <label rindTagsInputLabel>Tags</label>
      <div rindTagsInputControl data-variant="outline">
        <div rindTagsInputChips></div>
        <input rindTagsInputInput placeholder="Add a tag" />
        <button rindTagsInputClearTrigger aria-label="Clear all"></button>
      </div>
    </ng-container>
  `,
})
export class Basic {
  readonly tags = ["rome", "paris"]
}
