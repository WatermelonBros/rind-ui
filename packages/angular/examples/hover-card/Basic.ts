import { Component } from "@angular/core"
import { HoverCard } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [HoverCard],
  template: `
    <div>
      Notes by
      <ng-container rindHoverCardRoot>
        <a rindHoverCardTrigger href="https://en.wikipedia.org/wiki/Ada_Lovelace">Ada Lovelace</a>
        <ng-template rindHoverCardPortal>
          <div rindHoverCardPositioner>
            <div rindHoverCardContent>
              <div class="profile-card">
                <span class="profile-avatar" aria-hidden="true">AL</span>
                <div>
                  <strong>Ada Lovelace</strong>
                  <p>Wrote the first published algorithm. 1,815 followers.</p>
                </div>
              </div>
              <div rindHoverCardArrow></div>
            </div>
          </div>
        </ng-template>
      </ng-container>
      on the analytical engine.
    </div>
  `,
})
export class Basic {}
