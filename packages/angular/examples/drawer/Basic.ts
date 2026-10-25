import { Component } from "@angular/core"
import { Drawer } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [Drawer],
  template: `
    <ng-container rindDrawerRoot #d="rindDrawerRoot">
      <button rindDrawerTrigger>Filters</button>
      <ng-template rindDrawerPortal>
        <div rindDrawerBackdrop></div>
        <div rindDrawerPositioner>
          <div rindDrawerContent>
            @if (d.handleIsButton()) {
              <button rindDrawerHandle></button>
            } @else {
              <div rindDrawerHandle></div>
            }
            <h2 rindDrawerTitle>Filters</h2>
            <p rindDrawerDescription>Narrow the product list.</p>
            <ul class="stack">
              @for (f of filters; track f) {
                <li>
                  <label class="row"><input type="checkbox" /> {{ f }}</label>
                </li>
              }
            </ul>
            <button rindDrawerCloseTrigger>Done</button>
          </div>
        </div>
      </ng-template>
    </ng-container>
  `,
})
export class Basic {
  readonly filters = ["In stock", "On sale", "Free shipping", "New arrivals", "Top rated"]
}
