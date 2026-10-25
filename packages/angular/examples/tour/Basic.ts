import { Component, inject } from "@angular/core"
import { RindIds, TextField, Toolbar, Tour, type TourStepDef } from "@rind-ui/angular"

@Component({
  selector: "app-basic",
  imports: [TextField, Toolbar, Tour],
  template: `
    <div class="stack">
      <!-- The trigger first: a card placed below its target never covers it. -->
      <ng-container rindTourRoot [steps]="steps">
        <button rindTourTrigger>Take the tour</button>
        <ng-template rindTourPortal>
          <div rindTourBackdrop></div>
          <div rindTourSpotlight></div>
          <div rindTourPositioner>
            <div rindTourContent>
              <div rindTourArrow></div>
              <h2 rindTourTitle></h2>
              <p rindTourDescription></p>
              <div class="row">
                <span rindTourProgressText></span>
                <ng-template rindTourActions let-actions>
                  @for (a of actions; track a.action) {
                    <button rindTourActionTrigger [action]="a"></button>
                  }
                </ng-template>
                <button rindTourCloseTrigger>Close</button>
              </div>
            </div>
          </div>
        </ng-template>
      </ng-container>
      <div class="row" style="align-items: last baseline">
        <!-- The tour's targets are plain wrappers: an id on a rind part would replace its own. -->
        <div [id]="ids.search">
          <div rindTextFieldRoot class="row">
            <label rindTextFieldLabel>Search</label>
            <input rindTextFieldInput />
          </div>
        </div>
        <div [id]="ids.toolbar">
          <div rindToolbarRoot class="row" aria-label="Formatting">
            <button rindToolbarButton>Bold</button>
            <button rindToolbarButton>Italic</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Basic {
  private readonly base = inject(RindIds).next()
  readonly ids = { search: `${this.base}-search`, toolbar: `${this.base}-toolbar` }
  private readonly byId = (id: string) => () => document.getElementById(id)
  private readonly nav = [
    { action: "prev" as const, label: "Back" },
    { action: "next" as const, label: "Next" },
  ]
  // The last step ends the tour instead of offering a next one.
  private readonly last = [
    { action: "prev" as const, label: "Back" },
    { action: "dismiss" as const, label: "Done" },
  ]
  readonly steps: TourStepDef[] = [
    {
      id: "welcome",
      title: "Welcome",
      description: "Three quick steps through the editor.",
      actions: [{ action: "skip", label: "Skip" }, ...this.nav],
    },
    {
      id: "search",
      title: "Search",
      description: "Find any file by name.",
      target: this.byId(this.ids.search),
      actions: this.nav,
    },
    {
      id: "toolbar",
      title: "Formatting",
      description: "Bold and italic live here.",
      target: this.byId(this.ids.toolbar),
      side: "top",
      actions: this.last,
    },
  ]
}
