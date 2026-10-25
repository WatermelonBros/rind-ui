import { Component } from "@angular/core"
import { Rating } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Rating],
  template: `
    <div rindRatingRoot [defaultValue]="3">
      <label rindRatingLabel>Rate this recipe</label>
      <div rindRatingControl>
        @for (i of stars; track i) {
          <span rindRatingItem [index]="i"></span>
        }
      </div>
    </div>
  `,
})
export class Basic {
  readonly stars = [1, 2, 3, 4, 5]
}
