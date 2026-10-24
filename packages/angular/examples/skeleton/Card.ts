import { Component } from "@angular/core"
import { Skeleton } from "@rind-ui/angular"

@Component({
  selector: "app-card",
  imports: [Skeleton],
  template: `
    <div rindSkeletonRoot [loading]="true">
      <span rindSkeletonStatus></span>
      <div rindSkeletonContent class="stack">
        <div class="row">
          <span rindSkeletonItem data-shape="circle"><span aria-hidden="true">AL</span></span>
          <span rindSkeletonItem>Ada Lovelace</span>
        </div>
        <span rindSkeletonItem>
          The analytical engine weaves algebraic patterns just as the Jacquard loom weaves flowers
          and leaves.
        </span>
      </div>
    </div>
  `,
})
export class Card {}
